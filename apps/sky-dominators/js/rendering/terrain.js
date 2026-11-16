/* js/rendering/terrain.js — ordered classic script; entrypoints declare dependency order. */
class TerrainRenderer {
    constructor() {
        this.scrollY = 0;
        this.bgImg = null;
        this.scrollSpeed = BACKGROUND_SCROLL_SPEED;
    }

    setScrollSpeed(speed) {
        this.scrollSpeed = speed;
    }

    setBgImage(img) {
        this.bgImg = img;
    }

    update(dt) {
        // Requirement 8: Double from 14 px/s to exactly 28 px/s during active gameplay only (main menu remains 14 px/s)
        this.scrollSpeed = (typeof gameState !== 'undefined' && gameState === 'PLAYING') ? 28 : BACKGROUND_SCROLL_SPEED;
        this.scrollY += (this.scrollSpeed * dt / 1000);
    }

    drawGround(ctx) {
        if (this.bgImg && this.bgImg.complete && this.bgImg.naturalWidth > 0) {
            const scale = GAME_WIDTH / this.bgImg.naturalWidth;
            const renderedH = this.bgImg.naturalHeight * scale;

            const wrapY = this.scrollY % renderedH;
            // Mathematically 0-seam continuous vertical loop
            ctx.drawImage(this.bgImg, 0, wrapY, GAME_WIDTH, renderedH);
            ctx.drawImage(this.bgImg, 0, wrapY - renderedH, GAME_WIDTH, renderedH);
            if (wrapY + renderedH < GAME_HEIGHT) {
                ctx.drawImage(this.bgImg, 0, wrapY + renderedH, GAME_WIDTH, renderedH);
            }
        } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
    }
}

const terrain = new TerrainRenderer();
