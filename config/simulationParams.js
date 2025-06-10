// File: config/simulationParams.js
// SKENARIO BARU: "Kondisi Pasar EVM 2024/2025"
// Mencerminkan data dan tren aktivitas jaringan yang lebih realistis.

const simulationParams = {
    //--------------------------------------------------------------------------
    // PENGATURAN SIMULASI UTAMA
    //--------------------------------------------------------------------------
    totalSimulationTicks: 600, // Simulasi untuk 10 menit
    simulationDelayMs: 30,    // Jeda antar detik, cukup cepat tapi masih bisa diamati

    //--------------------------------------------------------------------------
    // KONFIGURASI JALUR UTAMA (L1) - Selalu di bawah tekanan
    //--------------------------------------------------------------------------
    mainPathway: {
        name: 'Ethereum L1 (Simulated)',
        capacityTPS: 15, // Kapasitas rata-rata Ethereum
        loadTPS: 14,     // Beban masuk hampir mendekati kapasitas, sangat realistis
    },

    //--------------------------------------------------------------------------
    // KONFIGURASI JALUR ALTERNATIF (L2) - Sesuai popularitas & adopsi
    //--------------------------------------------------------------------------
    alternativePathways: [
        // Tier 1 L2s (Sangat Populer)
        { name: 'Arbitrum (Fast Rollup)', capacityTPS: 48, loadTPS: 35, gasFee: 22, congestionThreshold: 500 },
        { name: 'Polygon (Sidechain)', capacityTPS: 55, loadTPS: 38, gasFee: 18, congestionThreshold: 500 },
        { name: 'Base (OP Stack)', capacityTPS: 40, loadTPS: 32, gasFee: 12, congestionThreshold: 500 }, // Hype tinggi, gas murah
        
        // Tier 2 L2s (Populer & Stabil)
        { name: 'Optimism (Stable Rollup)', capacityTPS: 42, loadTPS: 25, gasFee: 16, congestionThreshold: 500 },
        { name: 'zkSync Era (ZK-Rollup)', capacityTPS: 35, loadTPS: 20, gasFee: 28, congestionThreshold: 500 },

        // Tier 3 L2s (Pesaing & Niche)
        { name: 'Starknet (ZK-Rollup)', capacityTPS: 30, loadTPS: 15, gasFee: 30, congestionThreshold: 500 },
        { name: 'Scroll (zkEVM)', capacityTPS: 28, loadTPS: 12, gasFee: 26, congestionThreshold: 500 }
    ],

    //--------------------------------------------------------------------------
    // PENGATURAN EPP CONTROLLER - Dikalibrasi untuk pasar aktif
    //--------------------------------------------------------------------------
    eppControllerSettings: {
        glitchSeverityLevels: {
            warningThreshold: 60, // EPP mulai waspada saat antrian L1 > 60
            criticalThreshold: 180,
        },
        glitchCondition: {
            percentageToMove: 0.6, // Pindahkan 60% antrian saat panik
            maxTransactionsToMoveInOneGo: 1500,
        },
        adaptiveStrategy: {
            enabled: true,
            default: 'mostEconomical', 
            onCritical: 'leastCongested',
        },
        normalCondition: {
            deactivateThresholdMainQueue: 25, // Matikan bantuan jika antrian L1 sudah aman
            minActiveDurationTicksAlternative: 60, // L2 harus aktif minimal 1 menit
        },
        alternativePathwaySmartCooldown: {
            minCoolDownTicks: 45, // Beri waktu istirahat 45 detik sebelum bisa aktif lagi
        },
        circuitBreaker: {
            enabled: true,
            criticalAltQueueThreshold: 480,
            recoveryCheckIntervalTicks: 15,
            recoveryThresholdQueueSize: 60,
        }
    },

    //--------------------------------------------------------------------------
    // SKENARIO EVENT: "Mini Bull Run"
    //--------------------------------------------------------------------------
    events: {
        transactionStorm: {
            startTick: 200,    // Terjadi di menit ke-3
            duration: 90,     // Berlangsung selama 1.5 menit
            multiplier: 4     // Beban L1 tiba-tiba naik 4x lipat
        },
        pathwayDegradation: {
             // Dikosongkan untuk melihat efek murni dari lonjakan aktivitas
        }
    }
};

module.exports = {
    simulationParams,
};
