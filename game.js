// Global game object
let game = {
    state: 'start',
    width: 0,
    height: 0,
    score: 0,
    level: 1,
    lives: 3,
    playerSpeed: 5,
    bulletSpeed: 10,
    enemySpeed: 1,
    enemyDropSpeed: 20,
    enemyBulletSpeed: 5,
    enemyShootingRate: 0.005,
    enemyRows: 4,
    enemyCols: 8,
    enemyPadding: 15,
    enemyDirection: 1,
    enemyMoveDown: false,
    playerSize: 40,
    enemySize: 30,
    bulletSize: 8,
    starCount: 400,  // More stars
    starSpeed: 3,    // Base speed of stars
    stars: [],
    player: null,
    bullets: [],
    enemies: [],
    enemyBullets: [],
    powerUps: [],
    pickupTexts: [],
    transitioning: false
};

let playerExplosionParticles = [];

// Audio Manager
let audioManager = {
    ctx: null,
    musicPlaying: false,
    muted: false,
    volume: 0.6,
    musicVolume: 0.3,
    sfxVolume: 0.5,
    oscillators: [],

    markovMusic: {
        scales: {
            spaceScale: []
        },
        
        transitions: {
            0: [0.1, 0.3, 0.3, 0.1, 0.1, 0.1, 0, 0, 0, 0],
            1: [0.1, 0.1, 0.3, 0.3, 0.1, 0.1, 0, 0, 0, 0],
            2: [0.1, 0.1, 0.1, 0.3, 0.3, 0.1, 0, 0, 0, 0],
            3: [0, 0.1, 0.1, 0.1, 0.3, 0.3, 0.1, 0, 0, 0],
            4: [0, 0, 0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0, 0],
            5: [0, 0, 0, 0.1, 0.2, 0.2, 0.3, 0.2, 0, 0],
            6: [0, 0, 0, 0, 0.1, 0.2, 0.2, 0.3, 0.2, 0],
            7: [0.2, 0, 0, 0, 0, 0.1, 0.2, 0.2, 0.2, 0.1],
            8: [0.3, 0.2, 0, 0, 0, 0, 0.1, 0.2, 0.1, 0.1],
            9: [0.3, 0.3, 0.2, 0, 0, 0, 0, 0.1, 0.1, 0]
        },
        
        currentNote: 4,
        
        getNextNote: function() {
            const probabilities = this.transitions[this.currentNote];
            let random = Math.random();
            let sum = 0;
            
            for (let i = 0; i < probabilities.length; i++) {
                sum += probabilities[i];
                if (random <= sum) {
                    this.currentNote = i;
                    return this.scales.spaceScale[i];
                }
            }
            return this.scales.spaceScale[0];
        }
    },

    levelThemes: {
        getScale: function(level) {
            const scales = {
                1: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25],
                2: [261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25, 587.33, 622.25],
                3: [261.63, 277.18, 329.63, 349.23, 392.00, 415.30, 493.88, 523.25, 554.37, 659.25],
                4: [261.63, 311.13, 349.23, 370.00, 392.00, 466.16, 493.88, 523.25, 622.25, 698.46],
                5: [261.63, 277.18, 293.66, 311.13, 329.63, 349.23, 370.00, 392.00, 415.30, 440.00]
            };
            const themeIndex = ((level - 1) % Object.keys(scales).length) + 1;
            return scales[themeIndex];
        },
        
        getSpeed: function(level) {
            let baseSpeed = 500 - (level * 20); // Base speed for the level
            let threatLevel = audioManager.calculateThreatLevel();
            
            // Adjust speed based on threat level (faster when enemies are closer)
            let adjustedSpeed = baseSpeed * (1 - (threatLevel * 0.7));
            
            // Clamp the speed between 100ms and 500ms
            return Math.min(Math.max(100, adjustedSpeed), 500);
        }
    },

    calculateThreatLevel: function() {
        if (!game.enemies.length) return 0;
        
        // Find the closest enemy
        let closestDistance = game.height;
        let maxDistance = game.height * 0.8; // 80% of screen height
        
        game.enemies.forEach(enemy => {
            let distance = game.player.y - enemy.y;
            if (distance < closestDistance) {
                closestDistance = distance;
            }
        });
        
        // Calculate threat level (0 to 1)
        return Math.max(0, 1 - (closestDistance / maxDistance));
    },

    init: function() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.ctx;
    },

    getAudioContext: function() {
        return this.init();
    },

    playBackgroundMusic: function(level = 1) {
        if (this.muted) return;
        
        const ctx = this.getAudioContext();
        const scale = this.levelThemes.getScale(level);
        
        // Set up Markov chain scale
        this.markovMusic.scales.spaceScale = scale;
        this.markovMusic.currentNote = 4;
        
        const playNote = () => {
            if (!this.musicPlaying || this.muted) return;
            
            // Get current speed based on threat level
            const speed = this.levelThemes.getSpeed(level);
            
            // Get next note frequency using Markov chain
            const baseFreq = this.markovMusic.getNextNote();
            
            // Create oscillators for harmony
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const osc3 = ctx.createOscillator();
            
            const gain1 = ctx.createGain();
            const gain2 = ctx.createGain();
            const gain3 = ctx.createGain();
            
            // Connect oscillators to gains
            osc1.connect(gain1);
            osc2.connect(gain2);
            osc3.connect(gain3);
            
            // Connect gains to destination
            gain1.connect(ctx.destination);
            gain2.connect(ctx.destination);
            gain3.connect(ctx.destination);
            
            // Get threat level for intensity
            const threatLevel = this.calculateThreatLevel();
            
            // Adjust sound based on threat level
            osc1.type = 'sine';
            osc2.type = threatLevel > 0.7 ? 'square' : 'triangle';
            osc3.type = threatLevel > 0.5 ? 'sawtooth' : 'square';
            
            // Set frequencies with harmony
            osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);
            osc2.frequency.setValueAtTime(baseFreq * 0.5, ctx.currentTime);
            osc3.frequency.setValueAtTime(baseFreq * (1.5 + threatLevel * 0.5), ctx.currentTime);
            
            // Adjust volume based on threat level
            const baseVolume = this.musicVolume;
            gain1.gain.setValueAtTime(0.2 * baseVolume, ctx.currentTime);
            gain2.gain.setValueAtTime(0.1 * baseVolume * (1 + threatLevel), ctx.currentTime);
            gain3.gain.setValueAtTime(0.05 * baseVolume * (1 + threatLevel * 2), ctx.currentTime);
            
            // Fade out
            const noteDuration = 0.3 - (threatLevel * 0.15); // Shorter notes when threatened
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDuration);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDuration);
            gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + noteDuration);
            
            // Start and stop oscillators
            osc1.start(ctx.currentTime);
            osc2.start(ctx.currentTime);
            osc3.start(ctx.currentTime);
            
            osc1.stop(ctx.currentTime + noteDuration);
            osc2.stop(ctx.currentTime + noteDuration);
            osc3.stop(ctx.currentTime + noteDuration);
            
            // Add oscillators to tracking array
            this.oscillators.push(
                { osc: osc1, gain: gain1 },
                { osc: osc2, gain: gain2 },
                { osc: osc3, gain: gain3 }
            );
            
            // Schedule next note
            setTimeout(playNote, speed);
        };
        
        this.musicPlaying = true;
        playNote();
    },

    stopMusic: function() {
        if (!this.musicPlaying) return;
        
        const now = this.ctx.currentTime;
        
        this.oscillators.forEach(({ osc, gain }) => {
            gain.gain.setValueAtTime(gain.gain.value, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            setTimeout(() => {
                try {
                    osc.stop();
                    osc.disconnect();
                    gain.disconnect();
                } catch (e) {
                    // Ignore errors if oscillator is already stopped
                }
            }, 200);
        });
        
        this.oscillators = [];
        this.musicPlaying = false;
    },

    createShootSound: function() {
        if (this.muted) return;
        
        const ctx = this.getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.3 * this.sfxVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    },

    createExplosionSound: function() {
        if (this.muted) return;
        
        const ctx = this.getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.5 * this.sfxVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
    },

    createPlayerExplosionSound: function() {
        if (this.muted) return;
        
        const ctx = this.getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(50, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        
        gainNode.gain.setValueAtTime(0.8 * this.sfxVolume, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        
        osc.start();
        osc.stop(ctx.currentTime + 1);
    },

    toggleMute: function() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopMusic();
        } else {
            this.playBackgroundMusic(game.level);
        }
    }
};

// Game setup and main functions
function setupGame() {
    if (game.transitioning) return;
    
    // Clear all game objects
    game.bullets = [];
    game.enemies = [];
    game.enemyBullets = [];
    playerExplosionParticles = [];
    
    // Only reset score if starting new game
    if (game.level === 1) {
        game.score = 0;
    }
    
    // Reset lives only if starting new game or died
    if (game.level === 1 || game.lives <= 0) {
        game.lives = 3;
    }
    
    game.state = 'playing';
    game.transitioning = false;
    
    // Create player
    game.player = {
        x: game.width / 2,
        y: game.height - 60,
        size: game.playerSize
    };
    
    // Create stars with depth
    game.stars = [];
    for (let i = 0; i < game.starCount; i++) {
        game.stars.push({
            x: random(-width, width),
            y: random(-height, height),
            z: random(width),
            pz: 0  // Previous z for trail effect
        });
    }
    
    // Create enemies grid
    for (let row = 0; row < game.enemyRows; row++) {
        for (let col = 0; col < game.enemyCols; col++) {
            game.enemies.push({
                x: col * (game.enemySize + game.enemyPadding) + game.enemySize,
                y: row * (game.enemySize + game.enemyPadding) + game.enemySize,
                size: game.enemySize
            });
        }
    }
}

function setup() {
    const canvas = createCanvas(500, 700);
    canvas.parent('game-container');
    game.width = width;
    game.height = height;
    game.state = 'start';
}

function draw() {
    background(0);
    
    // Star field effect
    push();
    translate(width/2, height/2);
    
    for (let star of game.stars) {
        let x = star.x;
        let y = star.y;
        let z = star.z;
        
        // Store previous position for trail
        star.pz = z;
        
        // Move stars closer (z axis)
        z = z - game.starSpeed;
        
        // Reset star if it passes the screen
        if (z < 1) {
            x = random(-width, width);
            y = random(-height, height);
            z = width;
            star.pz = z;
        }
        
        // Project stars to 2D space
        let sx = map(x/z, 0, 1, 0, width);
        let sy = map(y/z, 0, 1, 0, height);
        
        // Previous position for trail
        let px = map(x/star.pz, 0, 1, 0, width);
        let py = map(y/star.pz, 0, 1, 0, height);
        
        // Update star properties
        star.x = x;
        star.y = y;
        star.z = z;
        
        // Draw star
        stroke(255);
        let size = map(z, 0, width, 3, 0);
        strokeWeight(size);
        
        // Draw trail
        line(px, py, sx, sy);
    }
    pop();

    if (game.state !== 'playing') {
        return;
    }

    // Handle player movement
    if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) { // Left arrow or 'A' key
        game.player.x = Math.max(game.player.size/2, game.player.x - game.playerSpeed);
    }
    if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) { // Right arrow or 'D' key
        game.player.x = Math.min(game.width - game.player.size/2, game.player.x + game.playerSpeed);
    }
    
    // Draw player
    push();
    fill(0, 255, 0);
    noStroke();
    // Draw player ship
    beginShape();
    vertex(game.player.x, game.player.y - game.player.size/2); // Top point
    vertex(game.player.x - game.player.size/2, game.player.y + game.player.size/2); // Bottom left
    vertex(game.player.x, game.player.y + game.player.size/4); // Bottom middle
    vertex(game.player.x + game.player.size/2, game.player.y + game.player.size/2); // Bottom right
    endShape(CLOSE);
    pop();
    
    // Update and draw bullets
    push();
    fill(255, 255, 0);
    noStroke();
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        let bullet = game.bullets[i];
        bullet.y -= game.bulletSpeed;
        
        // Draw bullet with glow effect
        let glowSize = game.bulletSize * 2;
        let glowAlpha = 100;
        fill(255, 255, 0, glowAlpha);
        circle(bullet.x, bullet.y, glowSize);
        fill(255, 255, 255);
        circle(bullet.x, bullet.y, game.bulletSize);
        
        if (bullet.y < 0) {
            game.bullets.splice(i, 1);
        }
    }
    pop();
    
    // Update and draw enemies
    push();
    fill(255, 0, 0);
    noStroke();
    let enemyMoveDown = false;
    game.enemies.forEach(enemy => {
        enemy.x += game.enemySpeed * game.enemyDirection;
        
        if (enemy.x + enemy.size/2 > game.width || enemy.x - enemy.size/2 < 0) {
            enemyMoveDown = true;
        }
        
        // Draw enemy ship
        beginShape();
        vertex(enemy.x, enemy.y - enemy.size/2); // Bottom point
        vertex(enemy.x - enemy.size/2, enemy.y - enemy.size/2); // Bottom left
        vertex(enemy.x, enemy.y + enemy.size/2); // Top middle
        vertex(enemy.x + enemy.size/2, enemy.y - enemy.size/2); // Bottom right
        endShape(CLOSE);
    });
    pop();
    
    if (enemyMoveDown) {
        game.enemies.forEach(enemy => {
            enemy.y += game.enemyDropSpeed;
        });
        game.enemyDirection *= -1;
    }
    
    // Enemy shooting
    game.enemies.forEach(enemy => {
        if (Math.random() < game.enemyShootingRate) {
            game.enemyBullets.push({
                x: enemy.x,
                y: enemy.y,
                size: game.bulletSize
            });
        }
    });
    
    // Update and draw enemy bullets
    push();
    fill(255, 0, 0);
    noStroke();
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        let bullet = game.enemyBullets[i];
        bullet.y += game.enemyBulletSpeed;
        
        // Draw enemy bullet with glow effect
        let glowSize = game.bulletSize * 2;
        let glowAlpha = 100;
        fill(255, 0, 0, glowAlpha);
        circle(bullet.x, bullet.y, glowSize);
        fill(255, 50, 50);
        circle(bullet.x, bullet.y, game.bulletSize);
        
        if (bullet.y > game.height) {
            game.enemyBullets.splice(i, 1);
        }
    }
    pop();
    
    // Draw explosion particles
    if (playerExplosionParticles.length > 0) {
        push();
        noStroke();
        for (let i = playerExplosionParticles.length - 1; i >= 0; i--) {
            const particle = playerExplosionParticles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life -= 0.02;
            
            const alpha = particle.life * 255;
            fill(255, 100, 0, alpha);
            circle(particle.x, particle.y, 5);
            
            if (particle.life <= 0) {
                playerExplosionParticles.splice(i, 1);
            }
        }
        pop();
    }
    
    // Check collisions
    checkCollisions();
    
    // Display score and lives
    push();
    fill(255);
    textSize(20);
    textAlign(LEFT);
    text(`Score: ${game.score}`, 10, 30);
    text(`Lives: ${game.lives}`, 10, 60);
    text(`Level: ${game.level}`, 10, 90);
    pop();
}

function checkCollisions() {
    // Check player bullets hitting enemies
    for (let i = game.bullets.length - 1; i >= 0; i--) {
        for (let j = game.enemies.length - 1; j >= 0; j--) {
            if (collision(game.bullets[i], game.enemies[j])) {
                game.bullets.splice(i, 1);
                game.enemies.splice(j, 1);
                game.score += 100;
                audioManager.createExplosionSound();
                
                if (game.enemies.length === 0) {
                    levelComplete();
                }
                break;
            }
        }
    }
    
    // Check enemy bullets hitting player
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
        if (collision(game.enemyBullets[i], game.player)) {
            game.enemyBullets.splice(i, 1);
            game.lives--;
            
            // Create explosion particles
            for (let j = 0; j < 20; j++) {
                playerExplosionParticles.push({
                    x: game.player.x,
                    y: game.player.y,
                    vx: (Math.random() - 0.5) * 10,
                    vy: (Math.random() - 0.5) * 10,
                    life: 1
                });
            }
            
            if (game.lives <= 0) {
                audioManager.createPlayerExplosionSound();
                gameOver();
            } else {
                audioManager.createExplosionSound();
            }
        }
    }
    
    // Check if enemies reached player level
    game.enemies.forEach(enemy => {
        if (enemy.y + enemy.size/2 > game.player.y) {
            gameOver();
        }
    });
}

function collision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.size/2 &&
           obj1.x > obj2.x - obj2.size/2 &&
           obj1.y < obj2.y + obj2.size/2 &&
           obj1.y > obj2.y - obj2.size/2;
}

function levelComplete() {
    if (game.transitioning) return;
    
    game.transitioning = true;
    game.state = 'levelComplete';
    
    document.getElementById('level-score').textContent = game.score;
    document.getElementById('level-complete-screen').style.display = 'flex';
    
    audioManager.stopMusic();
}

function gameOver() {
    if (game.transitioning) return;
    
    game.transitioning = true;
    game.state = 'over';
    
    // Create final explosion
    for (let i = 0; i < 50; i++) {
        playerExplosionParticles.push({
            x: game.player.x,
            y: game.player.y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1
        });
    }
    
    setTimeout(() => {
        document.getElementById('game-over-screen').style.display = 'flex';
        document.getElementById('final-score').textContent = game.score;
        audioManager.stopMusic();
    }, 1500);
}

function shoot() {
    if (game.state !== 'playing') return;
    
    game.bullets.push({
        x: game.player.x,
        y: game.player.y - game.playerSize/2,
        size: game.bulletSize
    });
    audioManager.createShootSound();
}

function keyPressed() {
    if (keyCode === 32) { // Spacebar
        shoot();
    }
}

// Touch controls
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const fireBtn = document.getElementById('fire-btn');

let touchInterval = null;

leftBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchInterval = setInterval(() => {
        if (game.state === 'playing') {
            game.player.x = Math.max(game.player.size/2, 
                                   game.player.x - game.playerSpeed);
        }
    }, 16);
});

rightBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchInterval = setInterval(() => {
        if (game.state === 'playing') {
            game.player.x = Math.min(game.width - game.player.size/2, 
                                   game.player.x + game.playerSpeed);
        }
    }, 16);
});

leftBtn.addEventListener('touchend', () => {
    clearInterval(touchInterval);
});

rightBtn.addEventListener('touchend', () => {
    clearInterval(touchInterval);
});

fireBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    shoot();
});

// Button handlers
document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('start-screen').style.display = 'none';
    audioManager.init();
    audioManager.playBackgroundMusic(game.level);
    setupGame();
});

document.getElementById('next-level-btn').addEventListener('click', () => {
    document.getElementById('level-complete-screen').style.display = 'none';
    game.level++;
    game.enemySpeed += 0.5;
    game.enemyShootingRate += 0.002;
    game.transitioning = false;
    game.state = 'playing';
    setupGame();
    audioManager.playBackgroundMusic(game.level);
});

document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('game-over-screen').style.display = 'none';
    game.level = 1;
    game.enemySpeed = 1;
    game.enemyShootingRate = 0.005;
    game.transitioning = false;
    game.state = 'playing';
    setupGame();
    audioManager.playBackgroundMusic(1);
});

// Prevent default touch behavior
document.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'BUTTON') {
        e.preventDefault();
    }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });
