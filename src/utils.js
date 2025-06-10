// File: src/utils.js
// VERSI FINAL: Logger yang sudah bagus disempurnakan dengan penambahan timestamp
// untuk memudahkan debugging pada sistem real-time.
// [MODIFIKASI] Ditambah kemampuan untuk mengirim log ke frontend via Socket.IO

/**
 * @file utils.js
 * @description Berisi fungsi-fungsi bantuan (utilities), dimulai dengan logger kustom.
 */

// Objek untuk level logging, mempermudah pengaturan dan perbandingan.
const LOG_LEVELS = {
    DEBUG: 1, // Paling detail, untuk tracing variabel dan alur program.
    INFO: 2,  // Informasi umum mengenai progres aplikasi (default).
    WARN: 3,  // Peringatan untuk kondisi yang tidak terduga tapi tidak fatal.
    ERROR: 4, // Error yang butuh perhatian.
    NONE: 5   // Menonaktifkan semua log.
};

// Level log default saat aplikasi berjalan.
let currentLogLevel = LOG_LEVELS.INFO;

// Kode ANSI untuk warna di terminal agar output lebih mudah dibaca.
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m" // Warna abu-abu untuk timestamp
};

// [BARU] Variabel untuk menyimpan instance io dari server utama
let ioInstance = null;

const logger = {
    /**
     * [BARU] Menghubungkan logger dengan instance Socket.IO dari server utama.
     * @param {object} io - Instance Server dari Socket.IO.
     */
    init: (io) => {
        ioInstance = io;
    },

    /**
     * Mengatur level log yang akan ditampilkan.
     * @param {'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'} levelName - Nama level.
     */
    setLevel: (levelName) => {
        const level = LOG_LEVELS[levelName.toUpperCase()];
        if (level) {
            currentLogLevel = level;
            // Pesan ini selalu tampil agar user tahu level log yang aktif.
            console.log(`${colors.cyan}[Logger] Log level diatur ke: ${levelName.toUpperCase()}${colors.reset}`);
        } else {
            console.error(`${colors.red}[Logger] Log level tidak valid: ${levelName}${colors.reset}`);
        }
    },

    /**
     * Helper untuk mendapatkan format timestamp.
     * @returns {string} Timestamp dalam format HH:MM:SS.
     * @private
     */
    _getTimestamp: () => {
        return `${colors.gray}[${new Date().toLocaleTimeString('id-ID')}]${colors.reset}`;
    },

    /**
     * Mencetak log level DEBUG.
     * @param {string} message - Pesan log.
     * @param  {...any} args - Argumen tambahan untuk dicetak.
     */
    debug: (message, ...args) => {
        if (currentLogLevel <= LOG_LEVELS.DEBUG) {
            // [MODIFIKASI] Log ke terminal dan emit ke frontend
            console.log(`${logger._getTimestamp()} ${colors.white}[DEBUG]${colors.reset} ${message}`, ...args);
            if (ioInstance) ioInstance.emit('server-log', { level: 'debug', message, timestamp: new Date().toLocaleTimeString('id-ID') });
        }
    },

    /**
     * Mencetak log level INFO.
     * @param {string} message - Pesan log.
     * @param  {...any} args - Argumen tambahan.
     */
    info: (message, ...args) => {
        if (currentLogLevel <= LOG_LEVELS.INFO) {
            // [MODIFIKASI] Log ke terminal dan emit ke frontend
            console.log(`${logger._getTimestamp()} ${message}`, ...args);
            if (ioInstance) ioInstance.emit('server-log', { level: 'info', message, timestamp: new Date().toLocaleTimeString('id-ID') });
        }
    },

    /**
     * Mencetak log level WARN.
     * @param {string} message - Pesan log.
     * @param  {...any} args - Argumen tambahan.
     */
    warn: (message, ...args) => {
        if (currentLogLevel <= LOG_LEVELS.WARN) {
            // [MODIFIKASI] Log ke terminal dan emit ke frontend
            console.warn(`${logger._getTimestamp()} ${colors.yellow}[WARN] ${message}${colors.reset}`, ...args);
            if (ioInstance) ioInstance.emit('server-log', { level: 'warn', message, timestamp: new Date().toLocaleTimeString('id-ID') });
        }
    },

    /**
     * Mencetak log level ERROR.
     * @param {string} message - Pesan log.
     * @param  {...any} args - Argumen tambahan.
     */
    error: (message, ...args) => {
        if (currentLogLevel <= LOG_LEVELS.ERROR) {
            // [MODIFIKASI] Log ke terminal dan emit ke frontend
            console.error(`${logger._getTimestamp()} ${colors.red}🚨 [ERROR] ${message}${colors.reset}`, ...args);
            if (ioInstance) ioInstance.emit('server-log', { level: 'error', message, timestamp: new Date().toLocaleTimeString('id-ID') });
        }
    }
};

// Export logger agar bisa digunakan di seluruh bagian aplikasi.
module.exports = logger;
