import { extension_settings } from "../../../../../extensions.js";

export class Sound {
    static create(src, loop = false, volume = 1) {
        let key = `${src} | ${loop} | ${volume}`;
        if (!this.cache[key]) {
            this.cache[key] = new Sound(src, loop, volume);
        }
        return this.cache[key];
    }


    constructor(src, loop = false, volume = 1) {
        this.source = src;
        this.loop = loop;
        this.volume = volume;

        this.audioDataPromise = undefined;
        this.bufferPromise = undefined;
        this.bufferSource = undefined;

        this.getBuffer();
    }




    get context() {
        if (!Sound.theAudioContext) {
            Sound.theAudioContext = new AudioContext();
        }
        return Sound.theAudioContext;
    }

    async getAudioData() {
        if (!this.audioDataPromise) {
            this.audioDataPromise = fetch(this.source, { headers: { responseType:'arraybuffer' } }).then(response=>response.arrayBuffer());
        }
        return this.audioDataPromise;
    }

    async getBuffer() {
        if (!this.bufferPromise) {
            this.bufferPromise = new Promise(async (resolve, reject)=>{
                let data = await this.getAudioData();
                this.context.decodeAudioData(data, sb => {
                    resolve(sb);
                }, err=>{
                    console.warn(err);
                });
            });
        }
        return this.bufferPromise;
    }




    async play() {
        if (this.loop) this.stop();
        let src = this.context.createBufferSource();
        src.buffer = await this.getBuffer();
        let volume = this.context.createGain();
        volume.gain.value = extension_settings.landingPage.fpcMute ? 0 : ((extension_settings.landingPage.fpcVolume ?? 15) * Sound.volumeFactor * this.volume);
        volume.connect(this.context.destination);
        src.connect(volume);
        src.start();
        src.loop = this.loop;
        this.bufferSource = src;
    }

    stop() {
        if (this.bufferSource) {
            this.bufferSource.stop();
        }
    }
}
Sound.theAudioContext = undefined;
Sound.volumeFactor = 0.025;
Sound.cache = {};
