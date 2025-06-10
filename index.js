// File: index.js
// [UPDATE KEAMANAN] Menambahkan rate limiting untuk melindungi server dari serangan DoS.

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const _ = require('lodash');
const rateLimit = require('express-rate-limit'); // [BARU] Impor library rate limit

const { simulationParams } = require('./config/simulationParams.js');
const Simulation = require('./src/simulation');
const logger = require('./src/utils');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = 3000;

// [BARU] Konfigurasi Rate Limiter
// Ini akan membatasi setiap IP untuk membuat 100 request per 15 menit.
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 menit
	max: 100, // Batas setiap IP untuk 100 request per windowMs
	standardHeaders: true, // Kirim header RateLimit-* ke response
	legacyHeaders: false, // Nonaktifkan header X-RateLimit-* yang lama
    message: 'Too many requests from this IP, please try again after 15 minutes', // Pesan error jika limit terlampaui
});

// [BARU] Terapkan rate limiter ke semua request
app.use(limiter);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const activeSimulations = new Map();

function main() {
    logger.setLevel('DEBUG');
    logger.init(io);

    logger.info("========================================================");
    logger.info("🚀 DOW Chain EPP Server [v7.1 Security Hardened] Siap 🚀");
    logger.info(`Buka browser dan kunjungi http://localhost:${PORT}`);
    logger.info("========================================================");

    io.on('connection', (socket) => {
        logger.info(`✅ ID Socket [${socket.id}] terhubung.`);
        
        socket.on('request-initial-params', () => {
            logger.info(`[${socket.id}] Mengirim parameter awal.`);
            socket.emit('initial-params', simulationParams);
        });

        const handleStartOrRestart = (paramsFromFrontend) => {
            if (activeSimulations.has(socket.id)) {
                activeSimulations.get(socket.id).stop();
            }

            const finalParams = _.cloneDeep(simulationParams);
            _.merge(finalParams, paramsFromFrontend);
            
            logger.debug("Parameter final yang digunakan untuk simulasi:", JSON.stringify(finalParams, null, 2));

            const simulationInstance = new Simulation(finalParams);
            activeSimulations.set(socket.id, simulationInstance);

            try {
                simulationInstance.run(
                    (tickData) => socket.emit('simulation-tick', tickData),
                    (summary) => {
                        socket.emit('simulation-finished', summary);
                        activeSimulations.delete(socket.id);
                    }
                );
            } catch (error) {
                logger.error(`[${socket.id}] Error saat simulasi: ${error.message}`);
                socket.emit('simulation-error', { message: error.message });
            }
        };
        
        socket.on('start-simulation', (params) => {
            logger.info(`[${socket.id}] Menerima perintah 'start-simulation'.`);
            handleStartOrRestart(params);
        });

        socket.on('stop-simulation', () => {
            logger.warn(`[${socket.id}] Menerima perintah 'stop-simulation'.`);
            if (activeSimulations.has(socket.id)) {
                activeSimulations.get(socket.id).stop();
                activeSimulations.delete(socket.id);
                socket.emit('simulation-stopped');
            }
        });

        socket.on('disconnect', () => {
            logger.warn(`❌ ID Socket [${socket.id}] terputus.`);
            if (activeSimulations.has(socket.id)) {
                activeSimulations.get(socket.id).stop();
                activeSimulations.delete(socket.id);
            }
        });
    });

    server.listen(PORT, () => {
        logger.info(`Server berjalan di http://localhost:${PORT}`);
    });
}

main();
