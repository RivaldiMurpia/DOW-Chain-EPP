// File: public/simulation-worker.js
// [MODIFIKASI FINAL] Alur data diperbaiki untuk memastikan parameter
// dari server selalu menjadi sumber kebenaran.

self.importScripts("https://cdn.socket.io/4.7.5/socket.io.min.js");

let socket;

const logger = {
    log: (message) => console.log(`[Worker] ${message}`),
    warn: (message) => console.warn(`[Worker] ${message}`),
    error: (message) => console.error(`[Worker] ${message}`),
};

function connectToServer(onConnectCallback) {
    // Selalu putuskan koneksi lama untuk memastikan koneksi baru yang bersih.
    if (socket) {
        socket.disconnect();
    }
    
    socket = io("http://localhost:3000", { 
        transports: ['websocket', 'polling'],
        reconnection: false // Mencegah auto-reconnect yang tidak diinginkan
    });

    socket.on('connect', () => {
        logger.log('Worker berhasil terhubung ke server Node.js.');
        self.postMessage({ type: 'status', payload: { connected: true } });
        if (onConnectCallback) {
            onConnectCallback();
        }
    });

    socket.on('disconnect', () => {
        logger.warn('Worker terputus dari server Node.js.');
        self.postMessage({ type: 'status', payload: { connected: false } });
    });

    socket.on('connect_error', (err) => {
        logger.error('Worker gagal terhubung ke server.');
        self.postMessage({ type: 'error', payload: 'Koneksi gagal' });
    });
    
    // Setup listener umum yang selalu ada
    socket.on('simulation-tick', (data) => self.postMessage({ type: 'tick', payload: data }));
    socket.on('server-log', (logData) => self.postMessage({ type: 'log', payload: logData }));
}

self.onmessage = (event) => {
    const { type, payload } = event.data;

    switch(type) {
        case 'get-initial-params':
            connectToServer(() => {
                logger.log('Meminta parameter awal ke server...');
                socket.emit('request-initial-params');
                socket.once('initial-params', (params) => {
                    logger.log('Menerima parameter awal, mengirim ke Main Thread.');
                    self.postMessage({ type: 'initial-params', payload: params });
                });
            });
            break;

        case 'start':
            // Fungsi `connectToServer` akan memastikan koneksi selalu baru atau sudah ada.
            connectToServer(() => {
                logger.log('Menerima perintah START dari Main Thread.');
                
                socket.off('simulation-finished'); // Hapus listener lama
                socket.on('simulation-finished', (summary) => {
                    logger.log('Simulasi selesai. Mengirim ringkasan ke Main Thread.');
                    self.postMessage({ type: 'finished', payload: summary });
                    socket.disconnect();
                });

                socket.emit('start-simulation', payload.params);
            });
            break;
        
        case 'stop':
            logger.log('Menerima perintah STOP dari Main Thread.');
            if (socket) {
                socket.disconnect();
            }
            break;
    }
};
