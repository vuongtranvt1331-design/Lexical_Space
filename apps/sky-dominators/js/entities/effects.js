/* js/entities/effects.js — ordered classic script; entrypoints declare dependency order. */
class ShockwaveRing {
    constructor(x, y, maxR = 45) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.maxR = maxR;
        this.alpha = 0.9;
        this.active = true;
    }
    update(dt) {
        this.radius += (this.maxR - this.radius) * (0.28 * dt / 16) + 1.2;
        this.alpha -= (0.045 * dt / 16);
        if (this.alpha <= 0 || this.radius >= this.maxR) this.active = false;
    }
    draw(ctx) {
        if (!this.active || this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

class Fireball {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const spd = 1.0 + Math.random() * 3.5;
        this.vx = Math.cos(angle) * spd;
        this.vy = Math.sin(angle) * spd;
        this.radius = 6 + Math.random() * 8;
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= (0.04 * dt / 16);
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.life > 0.5 ? '#facc15' : '#ef4444';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class CombatPopupText {
    constructor(x, y, text, color = '#facc15') {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) {
        this.y -= (0.8 * dt / 16);
        this.life -= (0.02 * dt / 16);
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 11px "Orbitron", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 6;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class AnimatedExplosion {
    constructor(x, y, isBig = false) {
        this.x = x;
        this.y = y;
        this.isBig = isBig;
        this.frameIndex = 0;
        this.timer = 0;
        this.frameDuration = 65; // ~65ms per frame * 5 frames = 325ms total animation
        this.finished = false;
        this.baseSize = isBig ? 104 : 76;
    }

    update(dt) {
        this.timer += dt;
        if (this.timer >= this.frameDuration) {
            this.timer -= this.frameDuration;
            this.frameIndex++;
            if (this.frameIndex >= 5) {
                this.finished = true;
            }
        }
    }

    draw(ctx) {
        if (this.finished) return;
        const frames = (this.isBig && assets.explosionsBig && assets.explosionsBig.length >= 5)
            ? assets.explosionsBig
            : (assets.explosions && assets.explosions.length >= 5 ? assets.explosions : assets.explosionsBig);

        if (frames && frames[this.frameIndex] && frames[this.frameIndex].complete && frames[this.frameIndex].naturalWidth > 0) {
            const img = frames[this.frameIndex];
            const size = this.baseSize;
            ctx.save();
            ctx.imageSmoothingEnabled = false; // preserve crisp original pixel art
            ctx.drawImage(img, this.x - size / 2, this.y - size / 2, size, size);
            ctx.restore();
        } else {
            // Procedural explosion fallback
            ctx.save();
            const radius = (this.baseSize / 2) * (0.8 + this.frameIndex * 0.25);
            ctx.fillStyle = this.frameIndex < 3 ? 'rgba(255, 200, 50, 0.85)' : 'rgba(239, 68, 68, 0.65)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

class DriftCloud {
    constructor(img, x, y, scale, speedX, speedY, alpha) {
        this.img = img;
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.speedX = speedX; // px/s
        this.speedY = speedY; // px/s
        this.alpha = alpha;
        this.width = (img && img.naturalWidth) ? img.naturalWidth : 120;
        this.height = (img && img.naturalHeight) ? img.naturalHeight : 60;
    }

    update(dt) {
        this.x += this.speedX * (dt / 1000);
        this.y += this.speedY * (dt / 1000);
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        const dw = this.width * this.scale;
        const dh = this.height * this.scale;
        if (this.img && this.img.complete && this.img.naturalWidth > 0) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.img, this.x, this.y, dw, dh);
        } else {
            // Soft atmospheric procedural cloud puff fallback
            ctx.fillStyle = 'rgba(240, 248, 255, 0.45)';
            ctx.beginPath();
            ctx.ellipse(this.x + dw / 2, this.y + dh / 2, dw / 2, dh / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class CloudManager {
    constructor() {
        this.clouds = [];
        this.maxClouds = 10;
        this.spawnTimer = 0;
        this.spawnInterval = 2400; // ms between cloud spawns
    }

    init() {
        this.clouds = [];
        // Scatter initial decorative clouds across screen
        for (let i = 0; i < 5; i++) {
            const img = (assets.clouds && assets.clouds.length > 0)
                ? assets.clouds[Math.floor(Math.random() * assets.clouds.length)]
                : null;
            const scale = 0.55 + Math.random() * 0.45;
            const x = Math.random() * (GAME_WIDTH - 60);
            const y = Math.random() * (GAME_HEIGHT - 120);
            const speedX = (Math.random() - 0.5) * 12;
            const speedY = 18 + Math.random() * 22; // drifts gently downwards
            const alpha = 0.40 + Math.random() * 0.25;
            this.clouds.push(new DriftCloud(img, x, y, scale, speedX, speedY, alpha));
        }
    }

    update(dt) {
        this.spawnTimer += dt;
        if (this.spawnTimer >= this.spawnInterval && this.clouds.length < this.maxClouds) {
            this.spawnTimer = 0;
            this.spawnCloud();
        }

        for (const c of this.clouds) {
            c.update(dt);
        }

        // Recycle/remove clouds when they leave the visible screen
        this.clouds = this.clouds.filter(c => {
            const dw = c.width * c.scale;
            return (c.y < GAME_HEIGHT + 80 && c.x + dw > -120 && c.x < GAME_WIDTH + 120);
        });
    }

    spawnCloud() {
        const img = (assets.clouds && assets.clouds.length > 0)
            ? assets.clouds[Math.floor(Math.random() * assets.clouds.length)]
            : null;
        const scale = 0.55 + Math.random() * 0.50;
        const dw = ((img && img.naturalWidth) ? img.naturalWidth : 120) * scale;
        const dh = ((img && img.naturalHeight) ? img.naturalHeight : 60) * scale;
        // Spawn above top viewport
        const x = (Math.random() * (GAME_WIDTH + 80)) - 40;
        const y = -dh - 15;
        const speedX = (Math.random() - 0.5) * 14;
        const speedY = 18 + Math.random() * 24;
        const alpha = 0.40 + Math.random() * 0.25;
        this.clouds.push(new DriftCloud(img, x, y, scale, speedX, speedY, alpha));
    }

    draw(ctx) {
        for (const c of this.clouds) {
            c.draw(ctx);
        }
    }
}
