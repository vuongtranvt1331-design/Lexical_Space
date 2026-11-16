/* js/entities/projectiles.js — ordered classic script; entrypoints declare dependency order. */
class Bullet {
    constructor(x, y, isSpecial = false) {
        this.x = x;
        this.y = y;
        this.speed = -580; // px/s
        this.active = true;
        this.isSpecial = !!isSpecial;
        this.skillGeneration = this.isSpecial ? player.squadronGeneration : null;
        this.attackId = 'shot_'+(++attackSerial);
        this.damage = AIRCRAFT_CONFIGS[player.aircraftIndex].damagePerShot || 1;
        this.attackerKey = AIRCRAFT_CONFIGS[player.aircraftIndex].key;
        this.skinId = player.skinId || 'factory_default';
        this.wraithProjectile = SkySkins.isWraithAttack(this) ? SkySkins.nextWraithProjectile(player) : null;
        this.visualAge = 0;
        this.prevX = x; this.prevY = y;
        this.isHoming = (AIRCRAFT_CONFIGS[player.aircraftIndex] || {}).key === 'reaper';
        this.vx = 0;
        this.vy = this.speed;
        this.homingTarget = null;
    }

    update(dt) {
        this.visualAge += dt;
        this.prevX = this.x; this.prevY = this.y;
        if (this.isHoming) {
            const speed = Math.abs(this.speed);
            const ux = this.vx / speed, uy = this.vy / speed;
            const candidates = getActiveFormationRows().slice(0, 2)
                .flatMap(row => row.aircraft)
                .filter(enemy => {
                    if (!enemy.active || enemy.hp <= 0 || enemy.formation.destroyed || enemy.y >= this.y) return false;
                    const dx = enemy.x - this.x, dy = enemy.y - this.y;
                    const forward = dx * ux + dy * uy;
                    const lateral = Math.abs(dx * uy - dy * ux);
                    return forward > 0 && lateral <= Math.max(30, forward * 0.75);
                });
            if (bossEncounter?.blocksRegular && bossEncounter.canShoot) candidates.push(...bossEncounter.targets().filter(target=>target.y<this.y));
            candidates.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
            this.homingTarget = candidates[0] || null;
            if (this.homingTarget) {
                let angle = Math.atan2(this.vy, this.vx);
                const desired = Math.atan2(this.homingTarget.y - this.y, this.homingTarget.x - this.x);
                const delta = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
                const maxTurn = 3.5 * dt / 1000;
                angle += Math.max(-maxTurn, Math.min(maxTurn, delta));
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
            }
            this.x += this.vx * dt / 1000;
            this.y += this.vy * dt / 1000;
            if (this.x < -20 || this.x > GAME_WIDTH + 20) this.active = false;
        } else {
            this.y += (this.speed * dt / 1000);
        }
        if (this.y < -20) this.active = false;
    }

    draw(ctx) {
        if (this.wraithProjectile) { SkySkins.drawWraithProjectile(ctx,this); return; }
        if (SkySkins.drawProjectile(ctx,this)) return;
        ctx.save();
        if (this.isSpecial) {
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 2, this.y - 14, 4, 18);
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(this.x - 1, this.y - 4, 2, 10);
        } else {
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x - 2, this.y - 10, 4, 14);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(this.x - 1, this.y, 2, 8);
        }
        ctx.restore();
    }
}

class EnemyBullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.speedY = STANDARD_ENEMY_BULLET_SPEED; // px/s downward moderate fair speed
        this.active = true;
    }

    update(dt) {
        this.y += (this.speedY * dt / 1000);
        if (this.y > GAME_HEIGHT + 20) this.active = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#fee2e2';
        ctx.fillRect(this.x - 2, this.y - 6, 4, 12);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(this.x - 1, this.y - 8, 2, 16);
        ctx.restore();
    }
}
