// File: chart.js
// Deskripsi: Mengelola pembuatan dan pembaruan instance Chart.js.

// Variabel untuk menyimpan instance chart, hanya bisa diakses di dalam modul ini.
let chart;

/**
 * Menginisialisasi atau membuat ulang chart antrian.
 * @param {object} params - Parameter simulasi untuk label dataset.
 */
export function initializeChart(params){
    const canvas = document.getElementById('main-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Hancurkan chart lama jika ada, untuk menghindari memory leak
    if (chart) {
        chart.destroy();
    }

    const colors = ['#ef4444', '#3b82f6', '#14b8a6', '#f97316', '#8b5cf6', '#ec4899', '#facc15', '#22c55e'];
    const datasets = [{ 
        label: params.mainPathway.name, 
        data: [], 
        borderColor: colors[0], 
        tension: 0.2, 
        borderWidth: 2.5,
        pointRadius: 0 // Sembunyikan titik
    }];
    
    params.alternativePathways.forEach((p, index) => {
        datasets.push({ 
            label: p.name, 
            data: [], 
            borderColor: colors[(index + 1) % colors.length], 
            tension: 0.2, 
            borderWidth: 2, 
            borderDash: [5, 5],
            pointRadius: 0 // Sembunyikan titik
        });
    });

    chart = new Chart(ctx, {
        type: 'line', 
        data: { labels: [], datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            animation: false, 
            scales: { 
                y: { 
                    beginAtZero: true, 
                    ticks: { color: '#9ca3af' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.1)' } 
                }, 
                x: { 
                    ticks: { color: '#9ca3af', autoSkip: true, maxTicksLimit: 20 }, 
                    grid: { display: false } 
                } 
            }, 
            plugins: { 
                legend: { 
                    labels: { color: '#e5e7eb', usePointStyle: true, boxWidth: 8 } 
                } 
            } 
        }
    });
}

/**
 * Mengupdate data di chart dengan data tick terbaru.
 * @param {object} data - Data tick dari server.
 */
export function updateChart(data){
    if (!chart || !data || !chart.data.datasets.length) return;
    
    const MAX_POINTS = 150; // Batas jumlah titik data di chart
    
    chart.data.labels.push(data.tick || 0);
    if (chart.data.labels.length > MAX_POINTS) {
        chart.data.labels.shift();
    }
    
    // Update data untuk Jalur Utama (L1)
    chart.data.datasets[0].data.push(data.mainQueue || 0);
    if (chart.data.datasets[0].data.length > MAX_POINTS) {
        chart.data.datasets[0].data.shift();
    }
    
    // Update data untuk setiap Jalur Alternatif (L2)
    data.pathways.forEach((p) => {
        const dataset = chart.data.datasets.find(d => d.label === p.name);
        if (dataset) {
            dataset.data.push(p.queueLength || 0);
            if (dataset.data.length > MAX_POINTS) {
                dataset.data.shift();
            }
        }
    });
    
    // Update chart tanpa animasi untuk performa
    chart.update('none');
}
