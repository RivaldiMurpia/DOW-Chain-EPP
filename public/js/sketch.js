// File: sketch.js
// Deskripsi: Mengelola visualisasi topologi jaringan menggunakan p5.js.

// Fungsi pembungkus sketch untuk p5.js
const sketch = (p) => {
    let nodes = [];
    let particles = [];

    // Class untuk merepresentasikan Node (L1 atau L2) di visualisasi
    class Node {
        constructor(label, x, y, isL1 = false) {
            this.label = label;
            this.x = x;
            this.y = y;
            this.isL1 = isL1;
            this.radius = isL1 ? 40 : 25;
            this.queueLength = 0;
            this.isActive = false;
            // Warna default (biru)
            this.targetColor = p.color(59, 130, 246, 150); 
            this.currentColor = p.color(59, 130, 246, 150);
        }

        update(queueLength, isActive) {
            this.queueLength = queueLength;
            this.isActive = isActive;

            const blue = p.color(59, 130, 246); // Warna normal
            const red = p.color(239, 68, 68);   // Warna padat
            const gray = p.color(107, 114, 128); // Warna nonaktif

            if (this.isActive || this.isL1) {
                // Interpolarasi warna dari biru ke merah berdasarkan antrian
                const maxQueue = this.isL1 ? 200 : 50;
                let mix = p.map(p.constrain(this.queueLength, 0, maxQueue), 0, maxQueue, 0, 1);
                this.targetColor = p.lerpColor(blue, red, mix);
            } else {
                this.targetColor = gray;
            }
        }

        draw() {
            // Animasi perubahan warna yang halus
            this.currentColor = p.lerpColor(this.currentColor, this.targetColor, 0.1);
            p.noStroke();
            p.fill(this.currentColor);
            p.ellipse(this.x, this.y, this.radius * 2, this.radius * 2);

            // Teks label
            p.fill(255);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(this.isL1 ? 14 : 10);
            const shortLabel = this.label.split(" ")[0];
            p.text(shortLabel, this.x, this.y - this.radius - 12);
            
            // Teks jumlah antrian
            p.textSize(10);
            p.fill(200);
            p.text(this.queueLength, this.x, this.y);
        }
    }

    // Class untuk merepresentasikan partikel transaksi yang bergerak
    class Particle {
        constructor(startX, startY, endX, endY) {
            this.x = startX;
            this.y = startY;
            this.endX = endX;
            this.endY = endY;
            this.progress = 0;
            this.speed = p.random(0.02, 0.05);
            this.color = p.color(250, 204, 21, p.random(150, 250)); // Warna kuning
        }

        update() {
            this.progress += this.speed;
        }

        draw() {
            const currentX = p.lerp(this.x, this.endX, this.progress);
            const currentY = p.lerp(this.y, this.endY, this.progress);
            p.noStroke();
            p.fill(this.color);
            p.ellipse(currentX, currentY, 5, 5);
        }

        isFinished() {
            return this.progress >= 1;
        }
    }

    // Method p5.js: dieksekusi sekali saat sketch dibuat
    p.setup = () => {
        const container = document.getElementById('p5-canvas-container');
        const canvas = p.createCanvas(container.offsetWidth, container.offsetHeight);
        canvas.parent('p5-canvas-container');
    };
    
    // Method p5.js: dieksekusi terus-menerus (loop)
    p.draw = () => {
        p.clear(); // Bersihkan canvas setiap frame

        // Update dan gambar semua partikel
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].isFinished()) {
                particles.splice(i, 1); // Hapus partikel jika sudah sampai tujuan
            }
        }

        // Gambar semua node
        if (nodes) {
            nodes.forEach(node => node.draw());
        }
    };
    
    // Fungsi kustom untuk mengupdate parameter (posisi node, dll)
    p.updateParams = (newParams) => {
        nodes = [];
        const container = document.getElementById('p5-canvas-container');
        if (!container) return;
        
        const w = container.offsetWidth;
        const h = container.offsetHeight;
        const centerX = w / 2;
        const centerY = h / 2;

        if (newParams.mainPathway) {
            nodes.push(new Node(newParams.mainPathway.name, centerX, centerY, true));
        }

        if (newParams.alternativePathways) {
            const numL2 = newParams.alternativePathways.length;
            const radius = p.min(w, h) / 3;
            for (let i = 0; i < numL2; i++) {
                const angle = p.map(i, 0, numL2, 0, p.TWO_PI) - p.HALF_PI;
                const x = centerX + radius * p.cos(angle);
                const y = centerY + radius * p.sin(angle);
                nodes.push(new Node(newParams.alternativePathways[i].name, x, y));
            }
        }
    };
    
    // Fungsi kustom yang dipanggil setiap ada tick simulasi
    p.onTick = (data) => {
        if (nodes.length === 0) return;
        
        nodes[0].update(data.mainQueue, true);
        data.pathways.forEach((pathwayData) => {
            const node = nodes.find(n => n.label === pathwayData.name);
            if (node) {
                node.update(pathwayData.queueLength, pathwayData.isActive);
            }
        });

        if (data.movedTransactions && data.movedTransactions.length > 0) {
            data.movedTransactions.forEach(move => {
                const targetNode = nodes.find(n => n.label === move.to);
                if (targetNode) {
                    for (let i = 0; i < move.count; i++) {
                        // Batasi jumlah partikel agar tidak membebani browser
                        if (particles.length < 200) {
                            particles.push(new Particle(nodes[0].x, nodes[0].y, targetNode.x, targetNode.y));
                        }
                    }
                }
            });
        }
    };

    // Fungsi kustom untuk mereset visualisasi
    p.reset = () => {
        particles = [];
        if (nodes && nodes.length > 0) {
            nodes.forEach(n => n.update(0, false));
        }
    };
    
    // Method p5.js: dieksekusi saat ukuran window browser berubah
    p.windowResized = (initialParams) => {
        const container = document.getElementById('p5-canvas-container');
        if (container) {
            p.resizeCanvas(container.offsetWidth, container.offsetHeight);
            if (initialParams && initialParams.mainPathway) {
                p.updateParams(initialParams); // Atur ulang posisi node
            }
        }
    };
};

/**
 * Menginisialisasi sketch p5.js dan mengembalikannya.
 * @param {object} initialParams - Parameter awal untuk setup pertama kali.
 * @returns {object} Instance dari sketch p5.js.
 */
export function initializeSketch(initialParams) {
    const p5Instance = new p5(sketch);
    p5Instance.updateParams(initialParams);
    // Kita perlu cara untuk memanggil windowResized dengan parameter
    // Jadi kita buat fungsi pembungkus
    const originalResized = p5Instance.windowResized;
    p5Instance.windowResized = () => originalResized(initialParams);
    return p5Instance;
}
