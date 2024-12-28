export class Particle {
    /**@type {number} */ gravity = 0.06;
    /**@type {number} */ alpha = 1;
    /**@type {number} */ easing = Math.random() * 0.2;
    /**@type {number} */ fade = Math.random() * 0.2;
    /**@type {number} */ gridX;
    /**@type {number} */ gridY;
    /**@type {number} */ color;

    /**@type {{x:number, y:number}} */ position;
    /**@type {{x:number, y:number}} */ velocity;
    /**@type {{x:number, y:number}} */ lastPosition;
    /**@type {{y:number}} */ target;

    /**@type {boolean} */ usePhysics = false;
    /**@type {boolean} */ cluster = false;




    constructor(position, target, velocity, marker, usePhysics, cluster = false) {
        this.gridX = marker % 120;
        this.gridY = Math.floor(marker / 120) * 12;
        this.color = marker;
        this.position = {
            x: position.x || 0,
            y: position.y || 0,
        };
        this.velocity = {
            x: velocity.x || 0,
            y: velocity.y || 0,
        };
        this.lastPosition = {
            x: this.position.x,
            y: this.position.y,
        };
        this.target = {
            y: target.y || 0,
        };
        this.usePhysics = usePhysics || false;

        this.cluster = cluster;
    }


    update(factor) {
        this.lastPosition.x = this.position.x;
        this.lastPosition.y = this.position.y;

        if (this.usePhysics) {
            this.velocity.y += this.gravity * factor;
            this.position.y += this.velocity.y * factor;
            this.alpha -= this.fade * factor;
        } else {
            const distance = this.target.y - this.position.y;
            this.position.y += distance * (0.03 + this.easing);
            this.alpha = Math.min(distance * distance * 0.00005, 1);
        }

        this.position.x += this.velocity.x * factor;
        const result = this.alpha < 0.005;
        if (result && this.cluster) {
            this.usePhysics = false;
        }
        return result;
    }


    /**
     *
     * @param {CanvasRenderingContext2D} context
     * @param {HTMLCanvasElement} buffer
     * @param {HTMLImageElement} smallGlow
     */
    render(context, buffer, smallGlow) {
        const x = Math.round(this.position.x);
        const y = Math.round(this.position.y);
        const xVelocity = (x - this.lastPosition.x) * -5;
        const yVelocity = (y - this.lastPosition.y) * -5;

        context.save();
        context.globalCompositeOperation = 'lighter';
        context.globalAlpha = Math.random() * this.alpha;

        context.fillStyle = 'rgb(255 255 255 / 0.3)';
        context.beginPath();
        context.moveTo(this.position.x, this.position.y);
        context.lineTo(this.position.x + 1.5, this.position.y);
        context.lineTo(this.position.x + xVelocity, this.position.y + yVelocity);
        context.lineTo(this.position.x - 1.5, this.position.y);
        context.closePath();
        context.fill();

        context.drawImage(buffer, this.gridX, this.gridY, 12, 12, x - 6, y - 6, 12, 12);
        context.drawImage(smallGlow, x - 3, y - 3);

        context.restore();
    }
}
