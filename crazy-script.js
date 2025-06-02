// JavaScript for crazy visual effects will go here!

const canvasElement = document.getElementById('mainCanvas');
if (!(canvasElement instanceof HTMLCanvasElement)) {
    throw new Error('Fatal: mainCanvas not found or is not an HTMLCanvasElement.');
}
const canvas = canvasElement;
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let mouseX = canvas.width / 2;
let mouseY = canvas.height / 2;

// --- Global Variables & Listeners (shared across pages if not reset) ---
let globalHue = 0; // For background gradient or other global color cycling

window.addEventListener('mousemove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // If a page has a specific resize handler, call it
    if (currentPage && currentPage.onResize) {
        currentPage.onResize();
    }
});

// --- Page Management ---
let currentPage = null;
const pages = {};

function switchPage(pageName) {
    if (currentPage && currentPage.cleanup) {
        currentPage.cleanup();
    }
    currentPage = pages[pageName];
    if (currentPage && currentPage.init) {
        currentPage.init();
    }
    // Update active link style
    document.querySelectorAll('#pageNav a').forEach(a => {
        a.classList.remove('active');
        if (a.dataset.page === pageName) {
            a.classList.add('active');
        }
    });

    // Special handling for Page 4 (World History Scroll)
    const page4Container = document.getElementById('page4Container');
    const mainCanvas = document.getElementById('mainCanvas');

    if (pageName === 'page4') {
        if (mainCanvas) mainCanvas.style.display = 'none'; // Hide main canvas
        if (page4Container) page4Container.style.display = 'block'; // Show Page 4 container
        // Initialize or re-initialize Page 4 content if needed
        if (pages.page4 && pages.page4.init) {
             // pages.page4.init(); // Potentially re-init if it handles multiple calls well
        }
    } else {
        if (mainCanvas) mainCanvas.style.display = 'block'; // Show main canvas
        if (page4Container) page4Container.style.display = 'none'; // Hide Page 4 container
    }
}

// --- Page 1: Current Effects ---
pages.page1 = (() => {
    const particles = [];
    const numParticles = 50;
    const particleTrailLength = 30;
    const shockwaveParticles = 100;

    const shapes = [];
    const numShapes = 10;
    const shapeMinSize = 20;
    const shapeMaxSize = 60;
    const shapeGrowthRate = 2;
    const shapeProximityThreshold = 150;

    class Particle {
        x;
        y;
        size;
        color;
        speedX;
        speedY;
        history;

        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 10 + 5;
            this.color = `hsl(${Math.random() * 360}, 70%, 70%)`;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.history = [];
        }

        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.history.push({ x: this.x, y: this.y });
            if (this.history.length > particleTrailLength) {
                this.history.shift();
            }
            if (this.size > 0.2) this.size -= 0.1;
        }

        draw() {
            if (!ctx || this.size <= 0.2) return;
            ctx.beginPath();
            if (this.history.length > 1) {
                ctx.moveTo(this.history[0].x, this.history[0].y);
                for (let i = 1; i < this.history.length; i++) {
                    ctx.lineTo(this.history[i].x, this.history[i].y);
                }
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.size / 2;
                ctx.stroke();
            }
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class Shape {
        x;
        y;
        baseSize;
        currentSize;
        color;
        morphProgress;

        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.baseSize = Math.random() * (shapeMaxSize - shapeMinSize) + shapeMinSize;
            this.currentSize = this.baseSize;
            this.color = `hsl(${Math.random() * 360}, 50%, 60%)`;
            this.morphProgress = 0;
        }

        update(mouseX, mouseY) {
            const distX = this.x - mouseX;
            const distY = this.y - mouseY;
            const distance = Math.sqrt(distX * distX + distY * distY);
            if (distance < shapeProximityThreshold) {
                this.currentSize = Math.min(shapeMaxSize * 1.5, this.currentSize + shapeGrowthRate);
                this.morphProgress = Math.min(1, this.morphProgress + 0.05);
            } else {
                this.currentSize = Math.max(this.baseSize, this.currentSize - shapeGrowthRate / 2);
                this.morphProgress = Math.max(0, this.morphProgress - 0.05);
            }
        }

        draw() {
            if (!ctx) return;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            const size = this.currentSize;
            const xPos = this.x - size / 2;
            const yPos = this.y - size / 2;
            if (this.morphProgress === 0) {
                ctx.rect(xPos, yPos, size, size);
            } else if (this.morphProgress === 1) {
                ctx.arc(this.x, this.y, size / 2, 0, Math.PI * 2);
            } else {
                const borderRadius = (size / 2) * this.morphProgress;
                ctx.moveTo(xPos + borderRadius, yPos);
                ctx.lineTo(xPos + size - borderRadius, yPos);
                ctx.quadraticCurveTo(xPos + size, yPos, xPos + size, yPos + borderRadius);
                ctx.lineTo(xPos + size, yPos + size - borderRadius);
                ctx.quadraticCurveTo(xPos + size, yPos + size, xPos + size - borderRadius, yPos + size);
                ctx.lineTo(xPos + borderRadius, yPos + size);
                ctx.quadraticCurveTo(xPos, yPos + size, xPos, yPos + size - borderRadius);
                ctx.lineTo(xPos, yPos + borderRadius);
                ctx.quadraticCurveTo(xPos, yPos, xPos + borderRadius, yPos);
                ctx.closePath();
            }
            ctx.fill();
        }
    }

    function initParticles() {
        particles.length = 0; // Clear existing
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle(mouseX, mouseY));
        }
    }

    function initShapes() {
        shapes.length = 0; // Clear existing
        for (let i = 0; i < numShapes; i++) {
            shapes.push(new Shape());
        }
    }
    
    function handleParticles() {
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].size <= 0.2) {
                particles.splice(i, 1);
                i--;
                particles.push(new Particle(mouseX, mouseY));
            }
        }
    }

    function handleShapes() {
        for (let i = 0; i < shapes.length; i++) {
            shapes[i].update(mouseX, mouseY);
            shapes[i].draw();
        }
    }

    function createShockwave(x, y) {
        for (let i = 0; i < shockwaveParticles; i++) {
            particles.push(new Particle(x, y));
        }
    }
    
    let clickListener;

    return {
        init: () => {
            initParticles();
            initShapes();
            clickListener = (event) => createShockwave(event.clientX, event.clientY);
            canvas.addEventListener('click', clickListener);
            console.log("Page 1 Initialized");
        },
        update: () => {
            // Background
            globalHue = (globalHue + 0.1) % 360;
            const gradient = ctx.createRadialGradient(
                canvas.width / 2, canvas.height / 2, 0,
                canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
            );
            gradient.addColorStop(0, `hsla(${globalHue}, 70%, 10%, 0.2)`);
            gradient.addColorStop(1, `hsla(${(globalHue + 60) % 360}, 70%, 5%, 0.5)`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            handleParticles();
            handleShapes();

            // Cursor hint
            ctx.beginPath();
            ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
            ctx.closePath();
        },
        cleanup: () => {
            particles.length = 0;
            shapes.length = 0;
            if (clickListener) {
                canvas.removeEventListener('click', clickListener);
                clickListener = null;
            }
            console.log("Page 1 Cleaned Up");
        },
        onResize: () => {
            // Optional: Add any Page 1 specific resize logic if needed beyond global
            initParticles(); // Re-initialize particles for new mouse/canvas center for some effects
            initShapes(); // Re-distribute shapes
        }
    };
})();

// --- Page 2: Cosmic Swirl ---
pages.page2 = (() => {
    let stars = [];
    const numStars = 200;
    let swirlParticles = [];
    const numSwirlParticles = 150;
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    let explosionParticles = [];
    let hueShift = 0;

    class Star {
        x;
        y;
        size;
        opacity;
        opacitySpeed;

        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
            this.opacitySpeed = (Math.random() - 0.5) * 0.02;
        }

        update() {
            this.opacity += this.opacitySpeed;
            if (this.opacity <= 0.1 || this.opacity >= 0.7) {
                this.opacitySpeed *= -1;
            }
        }

        draw() {
            if (!ctx) return;
            ctx.fillStyle = `rgba(255, 255, 220, ${this.opacity})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class SwirlParticle {
        x;
        y;
        size;
        color;
        speedX;
        speedY;
        isExploding;
        targetX;
        targetY;
        angle;
        orbitRadius;
        orbitSpeed;

        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 3 + 1;
            this.color = `hsl(${Math.random() * 60 + 200}, 80%, 60%)`; // Blues/Purples
            this.speedX = 0;
            this.speedY = 0;
            this.isExploding = false;
            this.targetX = 0; // for explosion
            this.targetY = 0; // for explosion
            this.angle = Math.random() * Math.PI * 2;
            this.orbitRadius = Math.random() * (Math.min(canvas.width, canvas.height) / 3) + 50;
            this.orbitSpeed = (Math.random() - 0.5) * 0.02 + 0.005;
        }

        update() {
            if (this.isExploding) {
                this.x += (this.targetX - this.x) * 0.05;
                this.y += (this.targetY - this.y) * 0.05;
                this.size *= 0.97;
            } else {
                this.angle += this.orbitSpeed;
                this.x = center.x + Math.cos(this.angle) * this.orbitRadius;
                this.y = center.y + Math.sin(this.angle) * this.orbitRadius;
                this.orbitRadius -= 0.1; // Slowly pull inwards
                if (this.orbitRadius < 10) {
                    this.orbitRadius = Math.random() * (Math.min(canvas.width, canvas.height) / 3) + 50; // Reset
                    this.angle = Math.random() * Math.PI * 2;
                }
            }
        }

        draw() {
            if (!ctx || this.size < 0.1) return;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }

        explode(clickX, clickY) {
            this.isExploding = true;
            const angle = Math.atan2(this.y - clickY, this.x - clickX);
            const explosionDistance = 200 + Math.random() * 100;
            this.targetX = this.x + Math.cos(angle) * explosionDistance;
            this.targetY = this.y + Math.sin(angle) * explosionDistance;
        }
    }

    function initStars() {
        stars = [];
        for (let i = 0; i < numStars; i++) {
            stars.push(new Star());
        }
    }

    function initSwirlParticles() {
        swirlParticles = [];
        for (let i = 0; i < numSwirlParticles; i++) {
            swirlParticles.push(new SwirlParticle(center.x, center.y));
        }
    }

    function handleStars() {
        stars.forEach(star => {
            star.update();
            star.draw();
        });
    }

    function handleSwirlParticles() {
        for (let i = swirlParticles.length - 1; i >= 0; i--) {
            const p = swirlParticles[i];
            p.update();
            p.draw();
            if (p.isExploding && p.size < 0.1) {
                swirlParticles.splice(i, 1);
            }
        }
    }
    
    let clickListener;

    return {
        init: () => {
            center.x = canvas.width / 2;
            center.y = canvas.height / 2;
            initStars();
            initSwirlParticles();
            explosionParticles = [];
            clickListener = (event) => {
                swirlParticles.forEach(p => p.explode(event.clientX, event.clientY));
            };
            canvas.addEventListener('click', clickListener);
            console.log("Page 2 Initialized");
        },
        update: () => {
            hueShift = (hueShift + 0.05) % 360;
            ctx.fillStyle = `hsla(${hueShift}, 30%, 5%, 0.2)`; // Very dark, slowly shifting background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            handleStars();
            handleSwirlParticles();
        },
        cleanup: () => {
            stars = [];
            swirlParticles = [];
            explosionParticles = [];
            if (clickListener) {
                canvas.removeEventListener('click', clickListener);
                clickListener = null;
            }
            console.log("Page 2 Cleaned Up");
        },
        onResize: () => {
            center.x = canvas.width / 2;
            center.y = canvas.height / 2;
            initStars(); // Re-distribute stars
            initSwirlParticles(); // Re-center swirl and particles
        }
    };
})();

// --- Page 3: Geometric Echoes ---
pages.page3 = (() => {
    let trailShapes = [];
    const maxTrailShapes = 50;
    let rippleEffects = [];
    const gridCellSize = 50;
    let lastMousePos = { x: mouseX, y: mouseY };
    let shapeHue = 180; // Start with a cyan-ish hue

    class TrailShape {
        x;
        y;
        size;
        color;
        type; // 'triangle' or 'square'
        angle;
        life;

        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 20 + 10;
            this.color = `hsla(${shapeHue}, 70%, 60%, 0.7)`;
            this.type = Math.random() > 0.5 ? 'triangle' : 'square';
            this.angle = Math.random() * Math.PI * 2;
            this.life = 1.0; // 1.0 = full life, 0.0 = dead
        }

        update() {
            this.life -= 0.01;
            this.size *= 0.99;
            this.angle += 0.02;
        }

        draw() {
            if (!ctx || this.life <= 0) return;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = `hsla(${shapeHue}, 70%, 60%, ${this.life * 0.7})`;
            ctx.strokeStyle = `hsla(${shapeHue}, 80%, 70%, ${this.life})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            if (this.type === 'triangle') {
                const s = this.size;
                ctx.moveTo(0, -s / Math.sqrt(3));
                ctx.lineTo(-s / 2, s / (2 * Math.sqrt(3)));
                ctx.lineTo(s / 2, s / (2 * Math.sqrt(3)));
                ctx.closePath();
            } else { // square
                const s = this.size / 2;
                ctx.rect(-s, -s, this.size, this.size);
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    class Ripple {
        x;
        y;
        radius;
        maxRadius;
        hue; // Store hue for consistent color during fade
        life;
        shapeType; // 'circle' or 'square' outlines

        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.radius = 0;
            this.maxRadius = Math.random() * 80 + 40;
            this.hue = shapeHue; // Capture current hue
            this.life = 1.0;
            this.shapeType = Math.random() > 0.5 ? 'circle' : 'square';
        }

        update() {
            this.radius += 2;
            this.life -= 0.02;
        }

        draw() {
            if (!ctx || this.life <= 0 || this.radius >= this.maxRadius) return;
            ctx.strokeStyle = `hsla(${this.hue}, 70%, 60%, ${this.life * 0.8})`;
            ctx.lineWidth = 3 * this.life;
            ctx.beginPath();
            if (this.shapeType === 'circle'){
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            } else { // Square ripple
                const r = this.radius;
                ctx.rect(this.x - r, this.y - r, r*2, r*2);
            }
            ctx.stroke();
        }
    }

    function drawGrid() {
        if (!ctx) return;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x < canvas.width; x += gridCellSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += gridCellSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
    
    let mouseMoveListener;
    let clickListener;

    function handleTrailShapes() {
        const dx = mouseX - lastMousePos.x;
        const dy = mouseY - lastMousePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 10 && trailShapes.length < maxTrailShapes) {
            trailShapes.push(new TrailShape(mouseX, mouseY));
            lastMousePos = { x: mouseX, y: mouseY };
            shapeHue = (shapeHue + 2) % 360; // Shift hue slowly on movement
        }

        for (let i = trailShapes.length - 1; i >= 0; i--) {
            trailShapes[i].update();
            trailShapes[i].draw();
            if (trailShapes[i].life <= 0) {
                trailShapes.splice(i, 1);
            }
        }
    }

    function handleRippleEffects() {
        for (let i = rippleEffects.length - 1; i >= 0; i--) {
            rippleEffects[i].update();
            rippleEffects[i].draw();
            if (rippleEffects[i].life <= 0) {
                rippleEffects.splice(i, 1);
            }
        }
    }

    return {
        init: () => {
            trailShapes = [];
            rippleEffects = [];
            lastMousePos = { x: mouseX, y: mouseY };
            shapeHue = 180;
            
            mouseMoveListener = () => { /* Handled in update via handleTrailShapes */ };
            canvas.addEventListener('mousemove', mouseMoveListener);

            clickListener = (event) => {
                rippleEffects.push(new Ripple(event.clientX, event.clientY));
                shapeHue = (shapeHue + 30) % 360; // Shift hue more dramatically on click
            };
            canvas.addEventListener('click', clickListener);
            console.log("Page 3 Initialized");
        },
        update: () => {
            ctx.fillStyle = 'rgba(10, 10, 20, 0.1)'; // Dark blue, slightly transparent for trails
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawGrid();
            handleTrailShapes();
            handleRippleEffects();
        },
        cleanup: () => {
            trailShapes = [];
            rippleEffects = [];
             if (mouseMoveListener) canvas.removeEventListener('mousemove', mouseMoveListener);
            if (clickListener) canvas.removeEventListener('click', clickListener);
            mouseMoveListener = null;
            clickListener = null;
            console.log("Page 3 Cleaned Up");
        },
        onResize: () => {
            // Grid might need redraw or adjustment if cell size is relative
            // Trail shapes and ripples are coordinate-based, should be fine
        }
    };
})();

// --- Page 4: World History Scroll (Different interaction model) ---
pages.page4 = (() => {
    const container = document.getElementById('page4Container');
    let sectionsData = []; // Will hold { id, title, text, canvasRenderer, element, canvasEl, ctx }
    let sectionElements = [];
    let isInitialized = false;

    // Example data - this could be fetched or defined more dynamically
    const historyData = [
        {
            id: "primordial",
            title: "The Primordial Soup",
            text: "Billions of years ago, Earth was a tumultuous place. Volcanoes erupted, oceans formed, and the first simple organic molecules began to assemble, paving the way for life.",
            bgColor: "#2c3e50",
            particleColor: "#e74c3c",
            renderer: (ctx, sectionCanvas, time) => {
                ctx.clearRect(0, 0, sectionCanvas.width, sectionCanvas.height);
                for (let i = 0; i < 50; i++) {
                    ctx.fillStyle = `rgba(231, 76, 60, ${Math.random() * 0.5 + 0.2})`; // Reddish particles
                    ctx.beginPath();
                    let x = Math.random() * sectionCanvas.width;
                    let y = Math.random() * sectionCanvas.height;
                    let size = Math.random() * 5 + 2;
                    // Add some movement based on time for a dynamic feel
                    x += Math.sin(time / 1000 + i) * 20;
                    y += Math.cos(time / 1000 + i) * 20;
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        },
        {
            id: "ancientCivilizations",
            title: "Rise of Ancient Civilizations",
            text: "Humans formed complex societies. Great empires rose and fell, leaving behind monumental architecture, profound philosophies, and the foundations of modern governance and culture.",
            bgColor: "#b29a68",
            particleColor: "#f1c40f",
            renderer: (ctx, sectionCanvas, time) => {
                ctx.clearRect(0, 0, sectionCanvas.width, sectionCanvas.height);
                const symbolSize = 30;
                const padding = 50;
                for (let x = padding; x < sectionCanvas.width - padding; x += symbolSize * 2) {
                    for (let y = padding; y < sectionCanvas.height - padding; y += symbolSize * 2) {
                        ctx.strokeStyle = `rgba(241, 196, 15, ${0.3 + Math.sin(x * y + time / 500) * 0.2})`; // Goldish symbols
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        // Simple hieroglyph-like symbol
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + symbolSize, y + symbolSize / 2);
                        ctx.lineTo(x, y + symbolSize);
                        ctx.stroke();
                    }
                }
            }
        },
        {
            id: "industrialRevolution",
            title: "The Industrial Revolution",
            text: "A period of unprecedented technological advancement. Steam power, factories, and mass production reshaped societies, economies, and the very fabric of daily life.",
            bgColor: "#7f8c8d", 
            particleColor: "#34495e",
            renderer: (ctx, sectionCanvas, time) => {
                ctx.clearRect(0, 0, sectionCanvas.width, sectionCanvas.height);
                const gearCount = 10;
                const gearRadius = 50;
                const toothCount = 10;
                ctx.fillStyle = "#34495e";
                for(let i=0; i<gearCount; i++) {
                    const centerX = (i * sectionCanvas.width / gearCount) + gearRadius;
                    const centerY = sectionCanvas.height / 2 + Math.sin(i + time/1000) * 50;
                    ctx.beginPath();
                    for(let j=0; j < toothCount * 2; j++) {
                        const angle = (j * Math.PI / toothCount) + (time/2000 * (i%2==0?1:-1));
                        const r = gearRadius * (j%2==0 ? 1 : 0.7);
                        ctx.lineTo(centerX + r * Math.cos(angle), centerY + r * Math.sin(angle));
                    }
                    ctx.closePath();
                    ctx.fill();
                }
            }
        },
        {
            id: "digitalAge",
            title: "The Digital Age",
            text: "The dawn of computers, the internet, and global interconnectedness. Information flows freely, and technology continues to accelerate change at an exponential rate.",
            bgColor: "#0f0f23",
            particleColor: "#00ffea",
            renderer: (ctx, sectionCanvas, time) => {
                ctx.clearRect(0, 0, sectionCanvas.width, sectionCanvas.height);
                ctx.font = "12px 'Courier New', monospace";
                const chars = "01";
                for (let i = 0; i < 100; i++) {
                    ctx.fillStyle = `rgba(0, 255, 234, ${Math.random() * 0.8})`; // Cyan binary
                    const x = Math.random() * sectionCanvas.width;
                    const y = Math.random() * sectionCanvas.height + Math.sin(time / 300 + i) * 20; // Add some wave
                    const char = chars[Math.floor(Math.random() * chars.length)];
                    ctx.fillText(char, x, y);
                }
            }
        },
        {
            id: "future",
            title: "Into the Future",
            text: "What lies ahead? Space exploration, artificial intelligence, climate solutions, and challenges yet unknown. Humanity's journey continues.",
            bgColor: "#1a0033",
            particleColor: "#9b59b6",
            renderer: (ctx, sectionCanvas, time) => {
                ctx.clearRect(0, 0, sectionCanvas.width, sectionCanvas.height);
                // Pulsating stars or nebulae
                for (let i = 0; i < 30; i++) {
                    const x = Math.random() * sectionCanvas.width;
                    const y = Math.random() * sectionCanvas.height;
                    const baseRadius = Math.random() * 30 + 10;
                    const pulse = Math.sin(time / 700 + i) * 10 + baseRadius;
                    const gradient = ctx.createRadialGradient(x, y, 0, x, y, pulse);
                    gradient.addColorStop(0, `rgba(155, 89, 182, ${0.3 + Math.sin(time / 500 + i * 0.5) * 0.2})`); // Purpleish
                    gradient.addColorStop(1, `rgba(155, 89, 182, 0)`);
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, pulse, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    ];

    function createSections() {
        if (!container) return;
        container.innerHTML = ''; // Clear previous sections if any
        sectionsData = []; // Reset processed data
        sectionElements = [];

        historyData.forEach(data => {
            const sectionEl = document.createElement('div');
            sectionEl.className = 'historySection';
            sectionEl.id = data.id;
            sectionEl.style.backgroundColor = data.bgColor || '#111';

            // Create canvas for this section's background effects
            const sectionCanvas = document.createElement('canvas');
            sectionCanvas.className = 'historyCanvas';
            // Set initial canvas size, will be updated on resize and visibility check
            sectionCanvas.width = container.clientWidth; 
            sectionCanvas.height = container.clientHeight; 

            const sectionCtx = sectionCanvas.getContext('2d');

            const textContent = document.createElement('div');
            textContent.className = 'historyTextContent';
            
            const titleEl = document.createElement('h2');
            titleEl.textContent = data.title;
            
            const textEl = document.createElement('p');
            textEl.textContent = data.text;

            textContent.appendChild(titleEl);
            textContent.appendChild(textEl);
            sectionEl.appendChild(sectionCanvas); // Canvas behind text
            sectionEl.appendChild(textContent);   // Text on top
            container.appendChild(sectionEl);

            sectionsData.push({
                id: data.id,
                element: sectionEl,
                canvasEl: sectionCanvas,
                ctx: sectionCtx,
                renderer: data.renderer
            });
            sectionElements.push(sectionEl);
        });
    }

    function resizeSectionCanvas(section) {
        if (section.canvasEl && container) {
            section.canvasEl.width = container.clientWidth; 
            // Make canvas height match the rendered height of the section content, or full viewport
            // This ensures canvas doesn't overflow or get cut off if content is taller/shorter than 100vh
            section.canvasEl.height = Math.max(container.clientHeight, section.element.offsetHeight);
            // console.log(`Resized canvas for ${section.id} to ${section.canvasEl.width}x${section.canvasEl.height}, section offsetHeight: ${section.element.offsetHeight}`);
        }
    }

    function checkVisibility() {
        if (!container) return;
        const containerTop = container.scrollTop;
        const containerBottom = containerTop + container.clientHeight;

        sectionsData.forEach(section => {
            const elemTop = section.element.offsetTop - container.offsetTop; // Position relative to scroll container
            const elemBottom = elemTop + section.element.offsetHeight;
            
            // A section is considered visible if any part of it is in the viewport
            const isVisible = (elemTop < containerBottom && elemBottom > containerTop);

            if (isVisible) {
                if (!section.element.classList.contains('visible')) {
                    section.element.classList.add('visible');
                     // Ensure canvas is correctly sized when it becomes visible
                    resizeSectionCanvas(section);
                }
            } else {
                section.element.classList.remove('visible');
            }
        });
    }
    
    function onScroll() {
        if (currentPage === pages.page4) {
            checkVisibility();
        }
    }
    
    let animationFrameIdPage4 = null;

    function animatePage4() {
        const time = performance.now();
        sectionsData.forEach(section => {
            // Only render if the section's canvas is somewhat visible or likely to become visible soon
            // More sophisticated culling could be done based on checkVisibility status
            if (section.element.classList.contains('visible') && section.renderer && section.ctx) {
                section.renderer(section.ctx, section.canvasEl, time);
            }
        });
        animationFrameIdPage4 = requestAnimationFrame(animatePage4);
    }

    return {
        init: () => {
            if (!container) {
                console.error("Page 4 container not found!");
                return;
            }
            if (!isInitialized) {
                createSections(); // Create DOM elements only once
                isInitialized = true;
            }
            // Always run these on init to ensure correct state when switching to page
            sectionsData.forEach(resizeSectionCanvas); // Resize all canvases on init
            checkVisibility(); // Set initial visibility and trigger animations for visible sections
            
            container.addEventListener('scroll', onScroll);
             if (animationFrameIdPage4) cancelAnimationFrame(animationFrameIdPage4);
            animatePage4();
            console.log("Page 4 Initialized/Refreshed");
        },
        update: () => {
            // Page 4's updates are driven by its own animation loop (animatePage4)
            // and scroll events, so this update function might be minimal or not needed
            // depending on global effects not handled by animatePage4.
        },
        cleanup: () => {
            if (animationFrameIdPage4) {
                cancelAnimationFrame(animationFrameIdPage4);
                animationFrameIdPage4 = null;
            }
            if (container) {
                container.removeEventListener('scroll', onScroll);
                // Optionally hide all sections if not already handled by switchPage
                 sectionsData.forEach(section => section.element.classList.remove('visible'));
            }
            console.log("Page 4 Cleaned Up");
        },
        onResize: () => {
            if (!container || !isInitialized) return;
            sectionsData.forEach(section => {
                resizeSectionCanvas(section);
            });
            checkVisibility(); // Re-check visibility as resize might change what's in view
        }
    };
})();

// --- Main Animation Loop ---
function animate() {
    if (currentPage && currentPage !== pages.page4) {
         // Clear main canvas only if not on page 4 (page 4 handles its own BG/canvases)
        if (ctx) {
            // Default clear for pages 1, 2, 3 unless they fully paint over
            // ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Let individual pages handle their background clearing/drawing for performance
        }
    }

    if (currentPage && currentPage.update) {
        currentPage.update();
    }
    requestAnimationFrame(animate);
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('#pageNav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = e.target.dataset.page;
            switchPage(pageName);
        });
    });

    // Initialize to Page 1 by default
    if (pages.page1) {
        switchPage('page1');
    } else {
        console.error("Default page (page1) not found!");
    }
    
    animate(); // Start the main animation loop
}); 