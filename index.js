// File: index.js
// [PERBAIKAN FINAL] Mengubah cara simulasi dimulai. Server sekarang menjadi
// sumber kebenaran parameter, dan hanya menerima perubahan dari frontend.

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const _ = require('lodash'); // Kita butuh lodash untuk deep merging

const { simulationParams } = require('./config/simulationParams.js');
const Simulation = require('./src/simulation');
const logger = require('./src/utils');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const activeSimulations = new Map();

function main() {
    logger.setLevel('DEBUG');
    logger.init(io);

    logger.info("========================================================");
    logger.info("🚀 DOW Chain EPP Server [v7.0 Final Fix] Siap 🚀");
    logger.info(`Buka browser dan kunjungi http://localhost:${PORT}`);
    logger.info("========================================================");

    io.on('connection', (socket) => {
        logger.info(`✅ ID Socket [${socket.id}] terhubung.`);
        
        socket.on('request-initial-params', () => {
            logger.info(`[${socket.id}] Mengirim parameter awal.`);
            // Selalu kirim parameter default yang bersih ke frontend saat pertama kali connect
            socket.emit('initial-params', simulationParams);
        });

        const handleStartOrRestart = (paramsFromFrontend) => {
            if (activeSimulations.has(socket.id)) {
                activeSimulations.get(socket.id).stop();
            }

            // [LOGIKA BARU] Buat salinan dari parameter default, lalu timpa dengan perubahan dari frontend.
            // Ini memastikan semua properti (seperti 'events') selalu ada.
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
