import { extension_settings } from '../../../../../extensions.js';
import { delay } from '../../../../../utils.js';
import { canvasWithContext } from './canvasWithContext.js';
import { loadImage } from './loadImage.js';
import { Particle } from './Particle.js';
import { Sound } from './Sound.js';

export class FPC {
    /**@type {HTMLCanvasElement} */ canvas;
    /**@type {CanvasRenderingContext2D} */ context;

    /**@type {HTMLCanvasElement} */ buffer;
    /**@type {CanvasRenderingContext2D} */ bufferContext;

    /**@type {HTMLImageElement} */ bigGlow;
    /**@type {HTMLImageElement} */ smallGlow;

    /**@type {{fizz:Sound, pop:Sound}} */ sounds = { fizz:undefined, pop:undefined };

    /**@type {object[]} */ particleList = [];

    /**@type {Promise<void>} */ loadPromise;

    /**@type {number} */ delay = 0;
    /**@type {number} */ lastFrame = performance.now();
    /**@type {number} */ lastLaunch = Number.MIN_SAFE_INTEGER;

    /**@type {boolean} */ isStopping = false;

    /**@type {number} */ quality = 4;

    /**@type {number} */ fpsTime = 1000 / 30;

    /**@type {number[]} */ fpsLog = [30];




    constructor() {
        ({ canvas:this.canvas, context:this.context } = canvasWithContext({
            width: window.innerWidth,
            height: window.innerHeight,
            className: 'stlp--fpc',
        }));
        this.canvas.style.opacity = `${extension_settings.landingPage.fpcOpacity ?? 60}%`;
        ({ canvas:this.buffer, context:this.bufferContext } = canvasWithContext());

        this.sounds.fizz = Sound.create('/scripts/extensions/third-party/SillyTavern-LandingPage/src/FizzPopCrackle/fizz.ogg');
        this.sounds.pop = Sound.create('/scripts/extensions/third-party/SillyTavern-LandingPage/src/FizzPopCrackle/pop.ogg');

        this.loadPromise = this.load();
    }


    async load() {
        await Promise.all([
            loadImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAyNi8xMi8xMcZdNcsAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzVxteM2AAAAw0lEQVQokZXSQUvDQBAF4K8SUgjBSCiFQo89+f9/izfRQ0CQElRCoSWgl7cQcxH3Mrvz5s28mdkNvv3jVKv3DWdMmIO32KFeE74w4B2fIdfo8IEj7qtF5gGvsSOu2KLHJXGnQjgn84AXvCWowSExDR4KYYqMMcHPuffBu+DTXRxzZF2TecRT7CX+G+ZCqNLgNqV7PMY28deoiqQ2ZfuF5sOihz54Wwi7jK5Mo1tN6Yg9doVQx1mmsd7DPni98ftr/LnpH5OqNW1n169XAAAAAElFTkSuQmCC'),
            loadImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAGCAYAAADgzO9IAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEgAACxIB0t1+/AAAABZ0RVh0Q3JlYXRpb24gVGltZQAyNi8xMi8xMcZdNcsAAAAcdEVYdFNvZnR3YXJlAEFkb2JlIEZpcmV3b3JrcyBDUzVxteM2AAAATUlEQVQImV3MPQ2AMBQE4K+EnaUOcFAROEAlTjohoDioh7K8JoRbLveb/DDGACnEhoKMjrpGseDAjgeWCHKYZ3CeQY/mFdzmVf0sG+4XEhkRBqSyQ+IAAAAASUVORK5CYII='),
        ]).then((imgs)=>{
            this.bigGlow = imgs[0];
            this.smallGlow = imgs[1];
        });
        await this.createPalette(12);
    }


    createPalette(gridSize) {
        const size = gridSize * 10;
        this.buffer.width = size;
        this.buffer.height = size;
        this.bufferContext.globalCompositeOperation = 'source-over';

        for (let i = 0; i < 100; i++) {
            const marker = i * gridSize;
            const x = marker % size;
            const y = Math.floor(marker / size) * gridSize;

            this.bufferContext.fillStyle = `hsl(${Math.round(i * 3.6)}, 100%, 60%)`;
            this.bufferContext.fillRect(x,y, gridSize,gridSize);
            this.bufferContext.drawImage(this.bigGlow, x,y, gridSize,gridSize);
        }
    }




    async start() {
        await this.loadPromise;
        this.isStopping = false;
        this.update();
    }

    stop() {
        this.isStopping = true;
        this.particleList = [];
    }




    update() {
        if (this.isStopping) return;

        const now = performance.now();
        const deltaTime = now - this.lastFrame;
        if (deltaTime > this.fpsTime) {
            if (document.hasFocus()) {
                const fps = Math.round(1000 / deltaTime);
                this.fpsLog.push(fps);
                while (this.fpsLog.length > 100) this.fpsLog.shift();
                const avg = Math.round(this.fpsLog.reduce((sum,cur)=>sum + cur,0) / this.fpsLog.length);
                // document.title = `Q: ${this.quality} | FPS: ${fps} (avg: ${avg})`;
                if (this.quality > 2 && avg < 16) {
                    this.quality = Math.max(2, this.quality - 1);
                } else if (this.quality < 4 && avg > 23) {
                    this.quality = Math.min(4, this.quality + 1);
                }
            }
            this.lastFrame = now - (deltaTime % this.fpsTime);
            this.clearContext();
            this.draw(now, deltaTime / this.fpsTime);
        }

        window.requestAnimationFrame(this.update.bind(this));
    }

    clearContext() {
        this.context.fillStyle = 'rgb(0 0 0 / 0.2)';
        this.context.fillRect(0,0, this.canvas.width,this.canvas.height);
    }

    draw(now, factor) {
        if (now - this.lastLaunch > this.delay * (this.quality < 3 ? 2 : 1)) {
            this.delay = Math.random() * 1000 + 100;
            this.lastLaunch = now;
            this.createParticle();
            this.sounds.fizz.play();
        }

        let idx = this.particleList.length;
        while (idx--) {
            const particle = this.particleList[idx];
            if (particle.update(factor)) {
                this.particleList.splice(idx, 1);
                if (!particle.usePhysics) {
                    this.createPop(particle);
                    this.sounds.pop.play();
                }
            }
            particle.render(this.context, this.buffer, this.smallGlow);
        }
    }

    createParticle(position, target, velocity, color, usePhysics, cluster = false) {
        position = position || {};
        target = target || {};
        velocity = velocity || {};

        this.particleList.push(new Particle(
            {
                x: position.x || this.canvas.width * 0.5,
                y: position.y || this.canvas.height  + 10,
            },
            {
                y: target.y || 150 + Math.random() * 100,
            },
            {
                x: velocity.x || Math.random() * this.canvas.width / 100 - this.canvas.width / 200,
                y: velocity.y || 0,
            },
            color || Math.floor(Math.random() * 100) * 12,
            usePhysics,
            cluster,
        ));
    }

    createPop(particle) {
        const rand = Math.random() - (particle.cluster || this.quality < 4 ? 0.1 : 0);
        if (rand < 0.7) {
            this.createCirclePop(particle);
        } else if (rand < 0.9) {
            this.createStarPop(particle);
        } else {
            this.createClusterPop(particle);
        }
    }

    createClusterPop(particle) {
        let count = 100;
        const angle = (Math.PI * 2) / count;
        while (count--) {
            const velocity = 4 + Math.random() * 4;
            const particleAngle = count * angle;
            this.createParticle(
                particle.position,
                null,
                {
                    x: Math.cos(particleAngle) * velocity,
                    y: Math.sin(particleAngle) * velocity,
                },
                null,
                true,
                count % 20 == 0,
            );
        }
    }

    createCirclePop(particle) {
        let count = 100;
        let angle = (Math.PI * 2) / count;
        while (count--) {
            const velocity = 4 + Math.random() * 4;
            const particleAngle = count * angle;
            this.createParticle(
                particle.position,
                null,
                {
                    x: Math.cos(particleAngle) * velocity,
                    y: Math.sin(particleAngle) * velocity,
                },
                particle.color,
                true,
            );
        }
    }

    createStarPop(particle) {
        const points = 6 + Math.round(Math.random() * 15);
        const jump = 3 + Math.round(Math.random() * 7);
        const subdivisions = 10;
        const radius = 80;
        const randomVelocity = -(Math.random() * 3 - 6);

        let start = 0;
        let end = 0;
        let circle = Math.PI * 2;
        let adjustment = Math.random() * circle;

        do {
            start = end;
            end = (end + jump) % points;

            const sAngle = (start / points) * circle - adjustment;
            const eAngle = ((start + jump) / points) * circle - adjustment;

            const startPos = {
                x: particle.position.x + Math.cos(sAngle) * radius,
                y: particle.position.y + Math.sin(sAngle) * radius,
            };

            const endPos = {
                x: particle.position.x + Math.cos(eAngle) * radius,
                y: particle.position.y + Math.sin(eAngle) * radius,
            };

            const diffPos = {
                x: endPos.x - startPos.x,
                y: endPos.y - startPos.y,
                a: eAngle - sAngle,
            };

            for (let i = 0; i < subdivisions; i++) {
                const sub = i / subdivisions;
                const subAngle = sAngle + (sub * diffPos.a);
                this.createParticle(
                    {
                        x: startPos.x + (sub * diffPos.x),
                        y: startPos.y + (sub * diffPos.y),
                    },
                    null,
                    {
                        x: Math.cos(subAngle) * randomVelocity,
                        y: Math.sin(subAngle) * randomVelocity,
                    },
                    particle.color,
                    true,
                );
            }
        } while (end != 0);
    }
}
