import { Particle } from './Particle.js';

export class TextParticle extends Particle {
    /**@type {string} */ text;
    constructor(position, target, velocity, marker, usePhysics, text) {
        super(position, target, velocity, marker, usePhysics, false);

        this.text = text;

        this.gravity *= 0.5;
        this.fade = Math.random() * 0.025;
    }
}
