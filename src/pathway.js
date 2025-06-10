// File: src/pathway.js
// VERSI BARU: Constructor sekarang menghitung 'processingTimePerTransaction'
// secara otomatis dari parameter 'capacityTPS'.

const logger = require('./utils');

class Pathway {
    constructor(name, params) {
        this.name = name;
        this.params = params || {};

        // [LOGIKA BARU] Otomatis hitung waktu proses dari TPS
        const capacityTPS = this.params.capacityTPS || 1;
        this.processingTimePerTransaction = (capacityTPS > 0) ? (1 / capacityTPS) : Infinity;

        this.queue = [];
        this.processingPower = 0;
    }

    /**
     * Menambahkan satu transaksi ke belakang antrian.
     * @param {object} transaction - Objek transaksi yang akan ditambahkan.
     */
    addTransaction(transaction) {
        this.queue.push(transaction);
    }

    /**
     * Mengambil beberapa transaksi sekaligus dari depan antrian.
     * @param {number} count - Jumlah transaksi yang ingin diambil.
     * @returns {Array<object>} Array berisi transaksi yang berhasil diambil.
     */
    shiftTransactions(count) {
        const numToShift = Math.min(count, this.queue.length);
        if (numToShift <= 0) {
            return [];
        }
        return this.queue.splice(0, numToShift);
    }

    /**
     * Mendapatkan jumlah transaksi saat ini dalam antrian.
     * @returns {number}
     */
    getQueueLength() {
        return this.queue.length;
    }

    /**
     * Memproses transaksi dalam antrian untuk satu tick.
     * @returns {Array<object>} Array berisi transaksi yang berhasil diproses di tick ini.
     */
    process() {
        if (this.getQueueLength() === 0) {
            this.processingPower = 0;
            return [];
        }

        if (this.processingTimePerTransaction <= 0) {
            logger.warn(`[${this.name}] Waktu proses tidak valid (${this.processingTimePerTransaction}), tidak ada transaksi yang diproses.`);
            return [];
        }

        this.processingPower += 1;
        logger.debug(`[${this.name}] Power +1 -> Total Power: ${this.processingPower.toFixed(2)}`);

        const processedTransactions = [];

        while (this.processingPower >= this.processingTimePerTransaction && this.getQueueLength() > 0) {
            this.processingPower -= this.processingTimePerTransaction;
            const processedTx = this.queue.shift();
            if (processedTx) {
                processedTransactions.push(processedTx);
            }
        }

        if (processedTransactions.length > 0) {
            logger.debug(`[${this.name}] Berhasil memproses ${processedTransactions.length} transaksi. Sisa Power: ${this.processingPower.toFixed(2)}`);
        }

        return processedTransactions;
    }
}

module.exports = Pathway;
