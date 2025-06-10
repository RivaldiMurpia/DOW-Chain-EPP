// File: socket.js
// Deskripsi: Mengelola koneksi dan event listener untuk Socket.IO.

import { updateSystemStatus } from './ui.js';

// TIDAK PERLU IMPORT: Variabel 'io' sudah tersedia secara global
// karena sudah dimuat via <script> tag di index.html.
// await import('https://cdn.socket.io/4.7.5/socket.io.min.js');

/**
 * Menginisialisasi koneksi Socket.IO dan memasang semua event listener.
 * @param {object} callbacks - Objek berisi fungsi callback untuk berbagai event.
 * @returns {object} Instance socket yang aktif.
 */
export function initializeSocket(callbacks) {
    // 'io' akan langsung dikenali dari scope global (window.io)
    const socket = io("http://localhost:3000", { transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        updateSystemStatus('TERHUBUNG', 'bg-blue-600');
        socket.emit('request-initial-params');
    });

    socket.on('disconnect', () => { 
        updateSystemStatus('TERPUTUS', 'bg-yellow-600', true); 
        const startBtn = document.getElementById('start-simulation-btn');
        const stopBtn = document.getElementById('stop-simulation-btn');
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = true;
    });

    // Pasang listener berdasarkan callback yang diberikan
    if (callbacks.onInitialParams) {
        socket.on('initial-params', callbacks.onInitialParams);
    }
    if (callbacks.onTick) {
        socket.on('simulation-tick', callbacks.onTick);
    }
    if (callbacks.onFinished) {
        socket.on('simulation-finished', callbacks.onFinished);
    }
    if (callbacks.onStopped) {
        socket.on('simulation-stopped', callbacks.onStopped);
    }
    if (callbacks.onLog) {
        socket.on('server-log', callbacks.onLog);
    }

    return socket;
}
