// File: main.js
// Deskripsi: Titik masuk utama (entry point) untuk semua JavaScript di frontend.
// File ini mengorkestrasi semua modul lain (UI, Socket, Chart, Sketch).

// Impor fungsi-fungsi dari modul lain
import { initializeSocket } from './socket.js';
import { initializeChart, updateChart } from './chart.js';
import { initializeSketch } from './sketch.js';
import { 
    getDOMElements,
    populateSettingsForm, 
    collectParamsFromForm,
    resetDashboard,
    handleSimulationEnd,
    updatePathwayStatuses,
    updateSpotlightPanel,
    addLogEntry
} from './ui.js';

// Jalankan semua setelah halaman HTML selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Variabel state global untuk aplikasi frontend
    let initialParams = {};
    let p5SketchInstance = null;
    let socket = null;

    // Ambil semua elemen DOM yang dibutuhkan
    const { startBtn, stopBtn, clearLogBtn, settingsDetails } = getDOMElements();

    // Fungsi untuk menangani penerimaan parameter awal dari server
    const handleInitialParams = (params) => {
        initialParams = JSON.parse(JSON.stringify(params)); // Simpan salinan yang aman
        populateSettingsForm(initialParams);
        initializeChart(initialParams);
        
        // Inisialisasi sketch p5.js jika belum ada
        if (!p5SketchInstance) {
            p5SketchInstance = initializeSketch(initialParams);
        } else {
            p5SketchInstance.updateParams(initialParams);
        }
        
        startBtn.disabled = false;
        updateSpotlightPanel({ title: "STANDBY", subtitle: "Ready for new parameters.", level: "nominal" });
    };

    // Fungsi yang akan dipanggil setiap kali ada data 'tick' dari server
    const handleSimulationTick = (data) => {
        requestAnimationFrame(() => {
            updateChart(data);
            updatePathwayStatuses(data.pathways || []);
            updateSpotlightPanel(data.headline);
        });
        if (p5SketchInstance) {
            p5SketchInstance.onTick(data);
        }
    };
    
    // Inisialisasi koneksi socket dan berikan fungsi-fungsi callback
    socket = initializeSocket({
        onInitialParams: handleInitialParams,
        onTick: handleSimulationTick,
        onFinished: (summary) => {
            handleSimulationEnd(summary);
        },
        onStopped: () => {
            handleSimulationEnd(); // Panggil tanpa summary
            addLogEntry({ level: 'error', message: 'Simulasi dihentikan oleh pengguna.' });
        },
        onLog: (log) => {
            addLogEntry(log);
        }
    });

    // Tambahkan event listener untuk tombol-tombol
    startBtn.onclick = () => {
        const customParams = collectParamsFromForm(initialParams);
        initialParams = customParams; // Update parameter awal dengan setelan terbaru
        resetDashboard(customParams, p5SketchInstance); 
        
        startBtn.disabled = true;
        stopBtn.disabled = false;
        settingsDetails.open = false;
        
        // Kirim perintah start ke server melalui socket
        if(socket) socket.emit('start-simulation', customParams);
    };

    stopBtn.onclick = () => {
        // Kirim perintah stop ke server melalui socket
        if(socket) socket.emit('stop-simulation');
    };
    
    clearLogBtn.onclick = () => {
        const { logConsole } = getDOMElements();
        logConsole.innerHTML = '';
    };
});
