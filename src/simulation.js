// File: simulation.js
// PERBAIKAN: Mengubah urutan eksekusi di dalam loop utama untuk menampilkan
// penumpukan antrian secara akurat sebelum diproses.

const EPPController = require('./eppController');
const Pathway = require('./pathway');
const logger = require('./utils');

class Simulation {
    constructor(params) {
        this.params = params || {};
        this.params.events = this.params.events || { transactionStorm: {}, pathwayDegradation: {} };

        this.currentTick = 0;
        this.events = this.params.events;
        this.isRunning = false;
        this.timeoutId = null;
        this.onTick = null;
        this.onFinish = null;

        this.activeDegradations = new Map();
        this.alternativePathwaysState = new Map();
        
        this.mainPathway = new Pathway(this.params.mainPathway?.name || 'Jalur Utama', this.params.mainPathway);
        
        this.tickMovements = [];
        this.currentHeadline = { title: "STANDBY", level: "nominal" };

        this.alternativePathways = (this.params.alternativePathways || []).map(p_params => {
            this.alternativePathwaysState.set(p_params.name, { isActive: false, activationTick: 0, deactivatedTick: -Infinity });
            return new Pathway(p_params.name, p_params);
        });
        
        this._initializeStats();
        this.eppController = new EPPController(this, this.params);
    }
    
    _initializeStats() {
        this.stats = {
            totalTransactionsGenerated: 0,
            totalTransactionsProcessedMain: 0,
            totalTransactionsProcessedAlt: {},
            glitchCount: 0,
            pathSwitches: 0,
            maxMainQueueLength: 0,
        };
        this.alternativePathways.forEach(p => {
            this.stats.totalTransactionsProcessedAlt[p.name] = 0;
        });
    }

    run(onTick, onFinish) {
        if (typeof onTick !== 'function' || typeof onFinish !== 'function') {
            throw new Error("[Simulasi] Error: Method .run() harus dipanggil dengan callback onTick dan onFinish.");
        }
        this.onTick = onTick;
        this.onFinish = onFinish;
        this.isRunning = true;
        this.currentTick = 0; // Mulai dari tick 0
        this.currentHeadline = { title: "STARTING UP", level: "nominal" };
        this._tickLoop();
    }

    stop() {
        this.isRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            logger.info("[Simulasi] Instance simulasi dihentikan secara paksa.");
        }
    }

    /**
     * [LOGIKA BARU] Urutan di dalam loop utama diubah.
     */
    _tickLoop() {
        if (!this.isRunning || this.currentTick > this.params.totalSimulationTicks) {
            this.finalize();
            return;
        }

        // 1. Tentukan headline dan ambil snapshot dari state SAAT INI.
        this.currentHeadline = this._determineHeadline();
        if (this.onTick) {
            // Kirim data snapshot ke frontend untuk ditampilkan.
            this.onTick(this._getDataSnapshot());
        }

        // 2. Lakukan semua proses & event untuk tick ini.
        this._handleEvents();
        this._performTick();
        
        // 3. Naikkan tick dan jadwalkan loop berikutnya.
        this.currentTick++;
        const simulationDelay = this.params.simulationDelayMs || 0;
        this.timeoutId = setTimeout(() => this._tickLoop(), simulationDelay);
    }
    
    /**
     * [LOGIKA BARU] Urutan di dalam performTick juga diubah.
     */
    _performTick() {
        // 1. Proses semua transaksi yang ada di antrian DARI tick sebelumnya.
        this.eppController?.checkAndReact();
        this.stats.totalTransactionsProcessedMain += this.mainPathway.process().length;
        this.alternativePathways.forEach(pathway => {
            this.stats.totalTransactionsProcessedAlt[pathway.name] += pathway.process().length;
        });
        
        // Perbarui statistik antrian maksimal SETELAH diproses, tapi SEBELUM ada tx baru
        this._updateDynamicStats();
        
        // 2. Hasilkan transaksi baru yang akan masuk ke antrian UNTUK DILIHAT di awal tick berikutnya.
        this._generateNewTransactions();
    }

    _determineHeadline() {
        if (this.eppController.isCircuitBreakerTripped) {
            return { title: "CIRCUIT BREAKER TRIPPED", subtitle: "System protection protocol is active.", level: "breaker" };
        }
        const storm = this.events.transactionStorm;
        if (storm && storm.startTick && this.currentTick >= storm.startTick && this.currentTick < storm.startTick + storm.duration) {
            return { title: "TRANSACTION STORM", subtitle: `Network load multiplied by ${storm.multiplier}x.`, level: "storm" };
        }
        const degradation = this.events.pathwayDegradation;
        if (degradation && degradation.target) {
            const endDegradation = degradation.startTick + (degradation.duration || Infinity);
            if (this.currentTick >= degradation.startTick && this.currentTick < endDegradation) {
                return { title: "PATHWAY SABOTAGE", subtitle: `${degradation.target} performance is degraded.`, level: "storm" };
            }
        }
        const mainQueueLength = this.mainPathway.getQueueLength();
        const severityParams = this.params.eppControllerSettings.glitchSeverityLevels || {};
        if (mainQueueLength >= severityParams.criticalThreshold) {
            return { title: "CRITICAL GLITCH", subtitle: "Aggressively rerouting transactions to L2s.", level: "critical" };
        }
        if (mainQueueLength >= severityParams.warningThreshold) {
            return { title: "GLITCH WARNING", subtitle: "Activating alternative pathways to manage load.", level: "warning" };
        }
        return { title: "NETWORK NOMINAL", subtitle: "All systems are running smoothly.", level: "nominal" };
    }
    
    _handleEvents() {
        const storm = this.events.transactionStorm;
        if (storm && this.currentTick === storm.startTick) {
            logger.error(`[Tick ${this.currentTick}] EVENT: Badai Transaksi dimulai!`);
        }
        const degradation = this.events.pathwayDegradation;
        if (degradation && degradation.target) {
            const targetPathway = this.alternativePathways.find(p => p.name === degradation.target);
            if (targetPathway) {
                if (this.currentTick === degradation.startTick) {
                    logger.error(`[Tick ${this.currentTick}] EVENT: Degradasi dimulai untuk ${degradation.target}!`);
                    const originalCapacity = targetPathway.params.capacityTPS;
                    this.activeDegradations.set(degradation.target, originalCapacity);
                    targetPathway.params.capacityTPS /= degradation.factor;
                    const newCapacity = targetPathway.params.capacityTPS;
                    targetPathway.processingTimePerTransaction = newCapacity > 0 ? 1 / newCapacity : Infinity;

                }
                const endTick = degradation.startTick + (degradation.duration || Infinity);
                if (this.currentTick === endTick) {
                     logger.warn(`[Tick ${this.currentTick}] EVENT: Degradasi untuk ${degradation.target} telah berakhir.`);
                     const originalCapacity = this.activeDegradations.get(degradation.target);
                     if (originalCapacity !== undefined) {
                         targetPathway.params.capacityTPS = originalCapacity;
                         targetPathway.processingTimePerTransaction = originalCapacity > 0 ? 1 / originalCapacity : Infinity;
                         this.activeDegradations.delete(degradation.target);
                     }
                }
            }
        }
    }

    _generateNewTransactions() {
        const allPathways = [this.mainPathway, ...this.alternativePathways];
        allPathways.forEach(pathway => {
            let probability = pathway.params.loadTPS || 0;
            const storm = this.events.transactionStorm;
            if (pathway === this.mainPathway && storm && storm.startTick && this.currentTick >= storm.startTick && this.currentTick < storm.startTick + storm.duration) {
                probability *= storm.multiplier;
            }
            const base = Math.floor(probability);
            const count = Math.random() < (probability - base) ? base + 1 : base;
            for (let i = 0; i < count; i++) {
                const newTransaction = { id: `T-${this.currentTick}-${this.stats.totalTransactionsGenerated + 1}`, createdAtTick: this.currentTick };
                pathway.addTransaction(newTransaction);
                this.stats.totalTransactionsGenerated++;
            }
        });
    }

    _getDataSnapshot() {
        const pathwayData = this.alternativePathways.map(p => ({
            name: p.name,
            queueLength: p.getQueueLength(),
            isActive: this.alternativePathwaysState.get(p.name).isActive,
            isReady: this.alternativePathwaysState.get(p.name).isActive && (this.currentTick >= (this.alternativePathwaysState.get(p.name).activationTick + (p.params.activationDelay || 0))),
        }));
        return {
            tick: this.currentTick,
            mainQueue: this.mainPathway.getQueueLength(),
            pathways: pathwayData,
            eppStatus: { isCircuitBreakerTripped: this.eppController.isCircuitBreakerTripped },
            movedTransactions: this.tickMovements,
            headline: this.currentHeadline
        };
    }

    _updateDynamicStats() {
        const mainQueueLength = this.mainPathway.getQueueLength();
        if (mainQueueLength > this.stats.maxMainQueueLength) {
            this.stats.maxMainQueueLength = mainQueueLength;
        }
    }

    activateAlternativePathway(pathwayName) {
        const state = this.alternativePathwaysState.get(pathwayName);
        if (state && !state.isActive) {
            state.isActive = true;
            state.activationTick = this.currentTick;
            this.stats.pathSwitches++;
            logger.warn(`[Tick ${this.currentTick}] [EPP ACTION] Jalur Alternatif '${pathwayName}' DIAKTIFKAN untuk membantu L1!`);
        }
    }

    deactivateAlternativePathway(pathwayName) {
        const state = this.alternativePathwaysState.get(pathwayName);
        if (state && state.isActive) {
            state.isActive = false;
            state.deactivatedTick = this.currentTick;
            logger.info(`[Tick ${this.currentTick}] [EPP ACTION] Bantuan dari '${pathwayName}' tidak lagi diperlukan.`);
        }
    }

    moveTransactionsToAlternative(count, targetPathwayName) {
        const targetPathway = this.alternativePathways.find(p => p.name === targetPathwayName);
        if (!targetPathway || count <= 0) return 0;
        
        const transactionsToMove = this.mainPathway.shiftTransactions(count);
        if (transactionsToMove.length > 0) {
             transactionsToMove.forEach(tx => targetPathway.addTransaction(tx));
             logger.debug(`[EPP] ${transactionsToMove.length} transaksi dari L1 dipindahkan ke '${targetPathwayName}'.`);
             this.tickMovements.push({ to: targetPathwayName, count: transactionsToMove.length });
        }
        return transactionsToMove.length;
    }

    recordGlitch() { this.stats.glitchCount++; }

    finalize() {
        this.isRunning = false;
        logger.info("[Simulasi] Loop simulasi di server selesai.");
        this.printSummary();
        if (this.onFinish) {
            this.onFinish(this.getSummary());
        }
    }

    getSummary() {
        return {
            totalTicks: this.currentTick,
            finalStats: this.stats,
        };
    }

    printSummary() {
        console.log("\n=================== RINGKASAN SIMULASI (TERMINAL) ===================");
        console.log(`Total Tick Berjalan: ${this.currentTick}`);
        console.log(`Total Transaksi Dibuat: ${this.stats.totalTransactionsGenerated}`);
        console.log(`- Diproses di Jalur Utama: ${this.stats.totalTransactionsProcessedMain}`);
        Object.keys(this.stats.totalTransactionsProcessedAlt).forEach(pathwayName => {
            console.log(`- Diproses di ${pathwayName}: ${this.stats.totalTransactionsProcessedAlt[pathwayName]}`);
        });
        console.log(`Antrian Maksimal di Jalur Utama: ${this.stats.maxMainQueueLength}`);
        console.log(`Total Pergantian Jalur: ${this.stats.pathSwitches}`);
        console.log(`Total Glitch Terdeteksi: ${this.stats.glitchCount}`);
        console.log("=====================================================================");
    }
}

module.exports = Simulation;
