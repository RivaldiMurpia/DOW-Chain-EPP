// File: src/eppController.js
// [PERBAIKAN FINAL] Menghapus reset indeks Round-Robin agar EPP
// bisa "mengingat" giliran terakhirnya dan distribusi beban lebih merata.

const logger = require('./utils');

class EPPController {
    constructor(simulationInstance, params) {
        this.simulation = simulationInstance;
        this.params = params || {};
        this.settings = this.params.eppControllerSettings || {};
        
        this.isCircuitBreakerTripped = false;
        this.recoveryCheckTicker = 0;

        this.lastDistributionIndex = 0;

        logger.debug(`[EPPController] Instance dibuat dengan settings lengkap.`);
    }

    checkAndReact() {
        if (this.isCircuitBreakerTripped) {
            this._handleCircuitBreakerActive();
            return;
        }

        const mainQueueLength = this.simulation.mainPathway.getQueueLength();
        const severityParams = this.settings.glitchSeverityLevels || {};
        
        let glitchLevel = 'none';
        if (mainQueueLength >= (severityParams.criticalThreshold || Infinity)) glitchLevel = 'critical';
        else if (mainQueueLength >= (severityParams.warningThreshold || Infinity)) glitchLevel = 'warning';

        if (glitchLevel !== 'none') {
            this.simulation.recordGlitch();
            this._handleGlitchCondition(glitchLevel);
        } else {
            // [PERBAIKAN] Baris yang me-reset indeks Round-Robin DIHAPUS dari sini.
            // this.lastDistributionIndex = 0; // <-- BARIS INI DIHAPUS
            this._handleNormalCondition();
        }
    }
    
    _selectPathwayForDistribution(strategy) {
        const candidates = this.simulation.alternativePathways.filter(pathway => {
            const state = this.simulation.alternativePathwaysState.get(pathway.name);
            const isReady = state.isActive && (this.simulation.currentTick >= (state.activationTick + (pathway.params.activationDelay || 0)));
            return isReady;
        });

        if (candidates.length === 0) return null;

        const sortedCandidates = candidates.sort((a, b) => {
            if (strategy === 'mostEconomical') {
                return (a.params.gasFee || Infinity) - (b.params.gasFee || Infinity);
            }
            return a.getQueueLength() - b.getQueueLength();
        });

        if (this.lastDistributionIndex >= sortedCandidates.length) {
            this.lastDistributionIndex = 0;
        }

        const chosenPathway = sortedCandidates[this.lastDistributionIndex];
        
        logger.debug(`[EPP-RR] Strategi '${strategy}'. Kandidat: ${sortedCandidates.map(c=>c.name)}. Memilih #${this.lastDistributionIndex}: '${chosenPathway.name}'.`);
        
        this.lastDistributionIndex++;

        return chosenPathway;
    }
    
    // ... Sisa file tidak ada perubahan ...

    _handleGlitchCondition(level) {
        logger.warn(`[Tick ${this.simulation.currentTick}] GLITCH LEVEL '${level.toUpperCase()}' TERDETEKSI! Antrian utama: ${this.simulation.mainPathway.getQueueLength()}`);
        
        const cbParams = this.settings.circuitBreaker || {};
        if (cbParams.enabled) {
            const activePathways = this.simulation.alternativePathways.filter(p => this.simulation.alternativePathwaysState.get(p.name).isActive);
            if (activePathways.length > 0) {
                const allPathwaysAtRisk = activePathways.every(p => p.getQueueLength() >= (cbParams.criticalAltQueueThreshold || Infinity));
                if (allPathwaysAtRisk) {
                    this._tripCircuitBreaker();
                    return;
                }
            }
        }
        
        const adaptiveParams = this.settings.adaptiveStrategy || {};
        let currentStrategy = adaptiveParams.default || 'leastCongested';
        if (adaptiveParams.enabled && level === 'critical') {
            currentStrategy = adaptiveParams.onCritical;
        }

        this._tryActivateNewPathway();
        
        const targetPathwayForDistribution = this._selectPathwayForDistribution(currentStrategy);
        
        if (targetPathwayForDistribution) {
            this._proceedToMoveTransactions(level, targetPathwayForDistribution);
        } else {
            logger.warn(`[Tick ${this.simulation.currentTick}] Glitch terdeteksi, tapi tidak ada jalur alternatif aktif yang siap menerima beban.`);
        }
    }

    _tripCircuitBreaker() {
        logger.error(`[Tick ${this.simulation.currentTick}] 💥 CIRCUIT BREAKER TRIPPED! Semua jalur alternatif kritis. Menangguhkan semua operasi EPP.`);
        this.isCircuitBreakerTripped = true;
        this.recoveryCheckTicker = 0;
    }

    _handleCircuitBreakerActive() {
        this.recoveryCheckTicker++;
        const cbParams = this.settings.circuitBreaker || {};
        const checkInterval = cbParams.recoveryCheckIntervalTicks || 10;
        
        logger.debug(`[EPPController] CIRCUIT BREAKER AKTIF. Menunggu pemulihan... (Tick ke-${this.recoveryCheckTicker} dari ${checkInterval})`);

        if (this.recoveryCheckTicker >= checkInterval) {
            this.recoveryCheckTicker = 0;
            this._attemptRecovery();
        }
    }

    _attemptRecovery() {
        logger.info(`[Tick ${this.simulation.currentTick}] Mencoba pemulihan dari Circuit Breaker...`);
        
        const cbParams = this.settings.circuitBreaker || {};
        const recoveryThreshold = cbParams.recoveryThresholdQueueSize || 5;

        const allPathwaysHealthy = this.simulation.alternativePathways.every(p => p.getQueueLength() < recoveryThreshold);

        if (allPathwaysHealthy) {
            this.isCircuitBreakerTripped = false;
            logger.info(`[Tick ${this.simulation.currentTick}] ✅ Jaringan telah stabil. CIRCUIT BREAKER RESET. Sistem kembali normal.`);
        } else {
            logger.warn(`[Tick ${this.simulation.currentTick}] Gagal pulih. Beberapa jalur masih padat. Pengecekan berikutnya dalam ${cbParams.recoveryCheckIntervalTicks || 10} tick.`);
        }
    }

    _proceedToMoveTransactions(level, targetPathway) {
        const mainQueueLength = this.simulation.mainPathway.getQueueLength();
        if (mainQueueLength === 0) return;

        const currentAltQueueLength = targetPathway.getQueueLength();
        const altCongestionThreshold = targetPathway.params.congestionThreshold || Infinity;

        const generalGlitchParams = this.settings.glitchCondition || {};
        const severityParams = this.settings.glitchSeverityLevels || {};
        const maxToMoveInOneGo = generalGlitchParams.maxTransactionsToMoveInOneGo || mainQueueLength;
        let percentageToMove = generalGlitchParams.percentageToMove || 0.5;
        if (level === 'critical') percentageToMove = severityParams.percentageToMoveCritical || percentageToMove;
        
        let transactionsToMove = Math.ceil(mainQueueLength * percentageToMove);
        transactionsToMove = Math.min(transactionsToMove, maxToMoveInOneGo, mainQueueLength);

        if (currentAltQueueLength >= altCongestionThreshold) {
            logger.warn(`[Tick ${this.simulation.currentTick}] PERINGATAN: Jalur target '${targetPathway.name}' padat. Jumlah pemindahan dikurangi.`);
            transactionsToMove = Math.floor(transactionsToMove / 2);
        }

        if (transactionsToMove > 0) {
            this.simulation.moveTransactionsToAlternative(transactionsToMove, targetPathway.name);
        }
    }

    _tryActivateNewPathway() {
        const candidates = this.simulation.alternativePathways.filter(pathway => {
            const state = this.simulation.alternativePathwaysState.get(pathway.name);
            const cooldownParams = this.settings.alternativePathwaySmartCooldown || {};
            const minCoolDown = cooldownParams.minCoolDownTicks || 0;
            return !state.isActive && (this.simulation.currentTick - state.deactivatedTick) >= minCoolDown;
        });

        if (candidates.length === 0) return null;

        const sortedCandidates = candidates.sort((a,b) => a.processingTimePerTransaction - b.processingTimePerTransaction);

        const bestCandidate = sortedCandidates[0];
        
        logger.debug(`[EPPController] Memilih jalur baru '${bestCandidate.name}' untuk diaktifkan.`);
        this.simulation.activateAlternativePathway(bestCandidate.name);
        return bestCandidate;
    }

    _handleNormalCondition() {
        this.simulation.alternativePathways.forEach(pathway => {
            const state = this.simulation.alternativePathwaysState.get(pathway.name);
            if (!state.isActive) return;

            const mainQueueLength = this.simulation.mainPathway.getQueueLength();
            const altQueueLength = pathway.getQueueLength();
            
            const normalConditionParams = this.settings.normalCondition || {};
            const deactivateThresholdMainQueue = normalConditionParams.deactivateThresholdMainQueue || 0;
            const minActiveDuration = normalConditionParams.minActiveDurationTicksAlternative || 10;
            const activeDuration = this.simulation.currentTick - state.activationTick;

            if (mainQueueLength <= deactivateThresholdMainQueue && altQueueLength === 0 && activeDuration >= minActiveDuration) {
                this.simulation.deactivateAlternativePathway(pathway.name);
            }
        });
    }
}

module.exports = EPPController;
