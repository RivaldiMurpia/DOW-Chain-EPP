// File: ui.js
// Deskripsi: Berisi semua fungsi yang berhubungan dengan manipulasi DOM
// (mengubah tampilan, mengisi form, mengelola tombol, dll).

/**
 * Mengambil dan mengembalikan semua elemen DOM yang sering digunakan.
 * @returns {object} Objek berisi elemen-elemen DOM.
 */
export function getDOMElements() {
    return {
        startBtn: document.getElementById('start-simulation-btn'),
        stopBtn: document.getElementById('stop-simulation-btn'),
        logConsole: document.getElementById('log-console'),
        clearLogBtn: document.getElementById('clear-log-btn'),
        settingsDetails: document.getElementById('settings-details'),
        spotlightPanel: document.getElementById('spotlight-panel'),
        spotlightTitle: document.getElementById('spotlight-title'),
        spotlightSubtitle: document.getElementById('spotlight-subtitle'),
        statusText: document.getElementById('epp-status-text'),
        pathwayStatusContainer: document.getElementById('pathway-status-container'),
    };
}

/**
 * Mengisi form pengaturan berdasarkan parameter yang diterima.
 * @param {object} params - Objek parameter dari server.
 */
export function populateSettingsForm(params){
    const loader = document.getElementById('settings-loader');
    const content = document.getElementById('settings-content');
    if(!loader || !content) return;

    loader.classList.add('hidden');
    content.classList.remove('hidden');

    document.getElementById('totalTicks').value = params.totalSimulationTicks;
    document.getElementById('simulationDelay').value = params.simulationDelayMs;
    document.getElementById('eppStrategy').value = params.eppControllerSettings.adaptiveStrategy.default;

    // Mengisi form L1 dengan parameter TPS
    document.getElementById('l1-capacity-tps').value = params.mainPathway.capacityTPS;
    document.getElementById('l1-load-tps').value = params.mainPathway.loadTPS;

    const l2Container = document.getElementById('l2-settings-container');
    l2Container.innerHTML = ''; 
    params.alternativePathways.forEach((p, index) => {
        const l2Card = document.createElement('div');
        l2Card.className = 'space-y-2';
        l2Card.innerHTML = `
            <h4 class="font-semibold text-gray-300">${p.name}</h4>
            <div>
                <label for="l2-${index}-capacity" class="block text-xs font-medium text-gray-400">Kapasitas (TPS)</label>
                <input type="number" step="0.1" id="l2-${index}-capacity" data-pathway-index="${index}" data-param="capacityTPS" class="l2-setting mt-1 block w-full bg-gray-700 p-2 rounded-md" value="${p.capacityTPS}">
            </div>
            <div>
                <label for="l2-${index}-load" class="block text-xs font-medium text-gray-400">Beban Masuk (TPS)</label>
                <input type="number" step="0.1" id="l2-${index}-load" data-pathway-index="${index}" data-param="loadTPS" class="l2-setting mt-1 block w-full bg-gray-700 p-2 rounded-md" value="${p.loadTPS}">
            </div>
            <div>
                <label for="l2-${index}-gas" class="block text-xs font-medium text-gray-400">Gas Fee</label>
                <input type="number" id="l2-${index}-gas" data-pathway-index="${index}" data-param="gasFee" class="l2-setting mt-1 block w-full bg-gray-700 p-2 rounded-md" value="${p.gasFee}">
            </div>
        `;
        l2Container.appendChild(l2Card);
    });
}

/**
 * Mengumpulkan semua nilai dari form pengaturan menjadi objek parameter baru.
 * @param {object} initialParams - Parameter awal sebagai dasar.
 * @returns {object} Objek parameter yang sudah di-update dengan nilai dari form.
 */
export function collectParamsFromForm(initialParams){
    const customParams = JSON.parse(JSON.stringify(initialParams)); // Salin biar aman
    customParams.totalSimulationTicks = parseInt(document.getElementById('totalTicks').value, 10) || 300;
    customParams.simulationDelayMs = parseInt(document.getElementById('simulationDelay').value, 10) || 50;
    customParams.eppControllerSettings.adaptiveStrategy.default = document.getElementById('eppStrategy').value;

    // Mengambil nilai TPS dari form
    customParams.mainPathway.capacityTPS = parseFloat(document.getElementById('l1-capacity-tps').value) || 15;
    customParams.mainPathway.loadTPS = parseFloat(document.getElementById('l1-load-tps').value) || 12;

    document.querySelectorAll('.l2-setting').forEach(input => {
        const index = input.dataset.pathwayIndex;
        const param = input.dataset.param;
        const value = parseFloat(input.value);
        if (!isNaN(value) && customParams.alternativePathways[index]) {
            customParams.alternativePathways[index][param] = value;
        }
    });
    return customParams;
}

// ... Sisa fungsi di file ui.js tidak perlu diubah ...
// getDOMElements, resetDashboard, handleSimulationEnd, updatePathwayStatuses,
// updateSpotlightPanel, addLogEntry, addSummaryLog, updateSystemStatus
// Semua fungsi ini tetap sama.

/**
 * Mengatur ulang tampilan dashboard ke kondisi awal.
 * @param {object} params - Parameter simulasi untuk inisialisasi ulang.
 * @param {object} p5SketchInstance - Instance dari sketch P5.js.
 */
export function resetDashboard(params, p5SketchInstance){
    const { logConsole, pathwayStatusContainer } = getDOMElements();
    logConsole.innerHTML = '';
    pathwayStatusContainer.innerHTML = '<p class="text-gray-500 italic md:col-span-full">Menunggu simulasi dimulai...</p>';
    if (p5SketchInstance) p5SketchInstance.reset();
}

/**
 * Menangani akhir dari simulasi, baik selesai maupun dihentikan.
 * @param {object | null} summary - Objek ringkasan dari server. Null jika dihentikan.
 */
export function handleSimulationEnd(summary = null) {
    const { startBtn, stopBtn, settingsDetails } = getDOMElements();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    settingsDetails.open = true;
    updateSpotlightPanel({ title: "SIMULATION ENDED", subtitle: "Ready for new parameters.", level: "nominal" });

    if (summary) {
        addSummaryLog(summary);
    }
}

/**
 * Mengupdate status visual dari setiap jalur alternatif.
 * @param {Array<object>} pathways - Array berisi data status jalur.
 */
export function updatePathwayStatuses(pathways){
    const { pathwayStatusContainer } = getDOMElements();
    pathwayStatusContainer.innerHTML = '';
    if (!pathways || pathways.length === 0) {
        pathwayStatusContainer.innerHTML = '<p class="text-gray-500 italic md:col-span-full">Menunggu data...</p>';
        return;
    }
    pathways.forEach(p => {
        const statusColor = p.isActive ? (p.isReady ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-600';
        const statusText = p.isActive ? (p.isReady ? 'AKTIF' : 'AKTIVASI...') : 'NONAKTIF';
        const lightClass = p.isActive && !p.isReady ? 'status-light blinking' : 'status-light';
        pathwayStatusContainer.insertAdjacentHTML('beforeend', `<div class="bg-gray-800 p-4 rounded-lg flex justify-between items-center transition-all duration-300 hover:bg-gray-700"><div><p class="font-bold">${p.name.split(' ')[0]}</p><p class="text-gray-400">Antrian: <span class="font-semibold text-white">${p.queueLength}</span></p></div><div class="flex items-center space-x-3"><span class="text-xs font-bold text-gray-300 tracking-wider">${statusText}</span><div class="${lightClass} w-4 h-4 rounded-full ${statusColor} shadow-lg"></div></div></div>`);
    });
}

/**
 * Mengupdate panel "Spotlight" dengan judul dan status terbaru.
 * @param {object} headline - Objek headline dari server.
 */
export function updateSpotlightPanel(headline) {
    if (!headline) return;
    const { spotlightTitle, spotlightSubtitle, spotlightPanel } = getDOMElements();
    spotlightTitle.textContent = headline.title || 'NETWORK STATUS';
    spotlightSubtitle.textContent = headline.subtitle || 'Monitoring...';
    spotlightPanel.className = 'lg:col-span-1 p-4 rounded-xl shadow-lg border-2 flex flex-col justify-between items-center text-center'; // Reset classes
    spotlightPanel.classList.add(`status-${headline.level}`);
}

/**
 * Menambahkan entri log baru ke konsol log di UI.
 * @param {object} log - Objek log dari server.
 */
export function addLogEntry(log) {
    const { logConsole } = getDOMElements();
    if (!logConsole || log.level === 'debug') return;
    const colors = { info: 'text-cyan-400', warn: 'text-yellow-400', error: 'text-red-500' };
    const colorClass = colors[log.level] || 'text-gray-300';
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `<span class="text-gray-600">${log.timestamp || new Date().toLocaleTimeString('id-ID')}</span><span class="${colorClass} font-bold mx-1">[${log.level.toUpperCase()}]</span><span>${log.message}</span>`;
    logConsole.appendChild(logEntry);
    logConsole.scrollTop = logConsole.scrollHeight;
}

/**
 * Menambahkan blok ringkasan simulasi ke konsol log.
 * @param {object} summary - Objek ringkasan dari server.
 */
function addSummaryLog(summary) {
    const { logConsole } = getDOMElements();
    const stats = summary.finalStats;
    const summaryElement = document.createElement('div');
    summaryElement.className = 'mt-4 pt-2 border-t border-gray-700';
    let summaryHTML = `<div class="font-bold text-green-400">--- RINGKASAN SIMULASI ---</div>`;
    const summaryData = [
        { label: 'Total Tick Berjalan', value: summary.totalTicks },
        { label: 'Total Transaksi Dibuat', value: stats.totalTransactionsGenerated },
        { label: '- Diproses di Jalur Utama', value: stats.totalTransactionsProcessedMain, indent: true },
    ];
    for (const pathwayName in stats.totalTransactionsProcessedAlt) {
        summaryData.push({ label: `- Diproses di ${pathwayName}`, value: stats.totalTransactionsProcessedAlt[pathwayName], indent: true });
    }
    summaryData.push(
        { label: 'Antrian Maksimal di L1', value: stats.maxMainQueueLength, marginTop: true },
        { label: 'Total Pergantian Jalur', value: stats.pathSwitches },
        { label: 'Total Glitch Terdeteksi', value: stats.glitchCount, color: 'text-yellow-400' }
    );
    summaryData.forEach(item => {
        const marginClass = item.marginTop ? 'mt-1' : '';
        const indentClass = item.indent ? 'pl-4' : '';
        const valueColor = item.color || 'text-white';
        summaryHTML += `<div class="${marginClass} ${indentClass}">${item.label}: <b class="${valueColor}">${item.value}</b></div>`;
    });
    summaryElement.innerHTML = summaryHTML;
    logConsole.appendChild(summaryElement);
    logConsole.scrollTop = logConsole.scrollHeight;
}

/**
 * Mengupdate teks status koneksi di header.
 * @param {string} text - Teks yang akan ditampilkan.
 * @param {string} bgColor - Kelas warna background Tailwind.
 * @param {boolean} isBlinking - Apakah teks akan berkedip.
 */
export function updateSystemStatus(text, bgColor, isBlinking = false){
    const { statusText } = getDOMElements();
    statusText.textContent = text;
    statusText.className = `text-lg font-bold ${bgColor} text-white px-4 py-2 rounded-lg transition-all duration-300 ${isBlinking ? 'blinking' : ''}`;
}
