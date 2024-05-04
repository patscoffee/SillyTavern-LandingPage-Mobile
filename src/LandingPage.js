import { characters } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { groups } from '../../../../group-chats.js';
import { executeSlashCommands } from '../../../../slash-commands.js';
import { debounce, delay, isTrueBoolean } from '../../../../utils.js';
import { debounceAsync, log } from '../index.js';
import { Card } from './Card.js';

export class LandingPage {
    /**@type {Card[]}*/ cards = [];

    /**@type {Object}*/ settings;

    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLVideoElement}*/ video;
    /**@type {HTMLVideoElement}*/ intro;
    /**@type {Boolean}*/ isStartingVideo;

    /**@type {Boolean}*/ isInputting = false;
    /**@type {String}*/ input = '';
    /**@type {Number}*/ inputTime = 0;
    /**@type {HTMLElement}*/ inputDisplayContainer;
    /**@type {HTMLElement}*/ inputDisplay;
    /**@type {Function}*/ handeInputBound;

    /**@type {Function}*/ updateBackgroundDebounced;

    /**@type {number}*/ cacheBuster;
    /**@type {Promise}*/ bgResultUpdatePromise;
    /**@type {boolean[]}*/ bgResultList = [];
    /**@type {Object.<string,boolean>}*/ videoUrlCache = {};
    /**@type {Object.<string,boolean>}*/ introUrlCache = {};
    /**@type {Object.<string,string>}*/ videoCache = {};




    constructor() {
        this.settings = Object.assign({
            isEnabled: true,
            displayStyle: 'Bottom',
            cardHeight: 200,
            showFavorites: true,
            onlyFavorites: false,
            highlightFavorites: true,
            numCards: 5,
            numAvatars: 4,
            showExpression: true,
            extensions: ['png'],
            expression: 'joy',
            menuList: [],
            lastChat: { character:null, group:null },
            hideTopBar: true,
            bgList: [],
        }, extension_settings.landingPage ?? {});
        extension_settings.landingPage = this.settings;
        if (this.settings.hideTopBar) {
            document.body.classList.add('stlp--hideTopBar');
        }

        this.handeInputBound = this.handleInput.bind(this);
        this.updateBackgroundDebounced = debounceAsync(async()=>{
            await this.preloadBackgrounds();
            await this.updateBgResultList();
            await this.updateBackground();
        }, 1000);

        this.cacheBuster = new Date().getTime();
        this.updateBgResultList();
    }


    async load() {
        log('LandingPage.load');
        this.isStartingVideo = false;
        if (this.settings.numCards > 0) {
            const compCards = (a,b)=>{
                if (this.settings.showFavorites) {
                    if (a.fav && !b.fav) return -1;
                    if (!a.fav && b.fav) return 1;
                }
                return b.date_last_chat - a.date_last_chat;
            };
            const cards = await Promise.all(
                [...characters, ...groups]
                    .filter(it=>!this.settings.onlyFavorites || it.fav)
                    .toSorted(compCards)
                    .slice(0, this.settings.numCards)
                    .map(it=>{
                        const card = new Card(it);
                        card.onOpenChat = ()=>{
                            this.dom.classList.add('stlp--busy');
                        };
                        return card.load();
                    }),
            );
            this.cards = cards;
        } else {
            this.cards = [];
        }
        log('LandingPage.load COMPLETED', this);
    }

    async updateBgResultList() {
        log('LandingPage.updateBgresultList');
        if (this.bgResultUpdatePromise) {
            await this.bgResultUpdatePromise;
            log('LandingPage.updateBgresultList COMPLETED OLD PROMISE');
            return;
        }
        const { promise, resolve } = Promise.withResolvers();
        this.bgResultUpdatePromise = promise;
        this.bgResultList = [];
        for (const item of this.settings.bgList) {
            let val = (await executeSlashCommands(item.command))?.pipe;
            let result;
            try { result = isTrueBoolean(val); } catch { /* empty */ }
            this.bgResultList.push(result);
            if (result) break;
        }
        resolve();
        this.bgResultUpdatePromise = null;
        log('LandingPage.updateBgresultList COMPLETED');
    }

    async preloadBackgrounds() {
        log('LandingPage.preloadBackgrounds');
        await Promise.all(this.settings.bgList.map(async(bg)=>this.preloadMedia(bg.url)));
        log('LandingPage.preloadBackgrounds COMPLETED');
    }
    async preloadMedia(url, intro = false) {
        log('LandingPage.preloadMedia', intro ? 'intro' : '', url);
        if (this.videoCache[url]) return;
        const baseUrl = url;
        try {
            url = `${baseUrl}?t=${this.cacheBuster}`;
            if (!this.videoUrlCache[baseUrl]) {
                log('video check not cached', intro ? 'intro' : '', baseUrl);
                const resp = await fetch(url, {
                    method: 'HEAD',
                });
                this.videoUrlCache[baseUrl] = resp.ok;
                if (!resp.ok) {
                    log('LandingPage.preloadMedia ABORTED', intro ? 'intro' : '', baseUrl);
                    return;
                }
                log('video check done', intro ? 'intro' : '', baseUrl);
            }
            const media = await fetch(url);
            const blob = await media.blob();
            this.videoCache[baseUrl] = URL.createObjectURL(blob);
            if (!intro && /\.mp4$/i.test(baseUrl)) {
                const baseUrlIntro = baseUrl.replace(/(\.[^.]+)$/, '-Intro$1');
                this.preloadMedia(baseUrlIntro, true);
            }
        } catch {
            return;
        }
        log('LandingPage.preloadMedia COMPLETED', intro ? 'intro' : '', baseUrl);
    }


    async updateBackground() {
        if (!this.dom) return;
        if (this.isStartingVideo) return;
        log('LandingPage.updateBackground');
        this.isStartingVideo = true;
        await this.bgResultUpdatePromise ?? Promise.resolve();
        const idx = this.bgResultList.indexOf(true);
        this.updateBgResultList();
        if (idx == -1) {
            log('no bg true');
            this.isStartingVideo = false;
            return;
        }
        let bg = this.settings.bgList[idx];
        log('bg decided');
        if (bg) {
            let missingBlob = false;
            const baseUrl = bg.url;
            const url = `${baseUrl}?t=${this.cacheBuster}`;
            if (/\.mp4$/i.test(bg.url)) {
                const baseUrlIntro = bg.url.replace(/(\.[^.]+)$/, '-Intro$1');
                const urlIntro = `${baseUrlIntro}?t=${this.cacheBuster}`;
                if (!this.videoUrlCache[baseUrl]) {
                    log('video check not cached');
                    const resp = await fetch(url, {
                        method: 'HEAD',
                    });
                    this.videoUrlCache[baseUrl] = resp.ok;
                    if (!resp.ok) {
                        this.video.src = '';
                        this.dom.style.backgroundImage = '';
                        toastr.warning(`Could not find background: ${baseUrl}`);
                        this.isStartingVideo = false;
                        log('LandingPage.updateBackground ABORTED');
                        return;
                    }
                    log('video check done');
                }
                this.dom.style.backgroundImage = '';
                if (this.introUrlCache[baseUrlIntro] === undefined) {
                    log('intro check not cached');
                    const respIntro = await fetch(urlIntro, {
                        method: 'HEAD',
                    });
                    this.introUrlCache[baseUrlIntro] = respIntro.ok;
                    log('intro check done');
                }
                if (this.introUrlCache[baseUrlIntro]) {
                    this.video.style.opacity = '0';
                    this.video.autoplay = false;
                    if (this.videoCache[baseUrl]) {
                        log('video from blob');
                        this.video.src = this.videoCache[baseUrl];
                    } else {
                        log('video from url');
                        missingBlob = true;
                        this.video.src = url;
                    }
                    await new Promise(resolve=>{
                        log('  play intro');
                        this.intro.src = this.videoCache[baseUrlIntro] ?? urlIntro;
                        if (this.videoCache[baseUrlIntro]) {
                            log('intro from blob');
                            this.intro.src = this.videoCache[baseUrlIntro];
                        } else {
                            log('intro from url');
                            missingBlob = true;
                            this.intro.src = urlIntro;
                        }
                        const resolver = ()=>{
                            this.intro.removeEventListener('ended', resolve);
                            this.intro.removeEventListener('error', resolve);
                            resolve();
                        };
                        this.intro.addEventListener('ended', resolver, { once:true });
                        this.intro.addEventListener('error', resolver, { once:true });
                    });
                    log('  play video');
                    this.video.play();
                    this.video.style.opacity = '1';
                    await delay(100);
                    this.intro.style.opacity = '0';
                    this.intro.src = '';
                } else {
                    this.video.style.opacity = '1';
                    if (this.videoCache[baseUrl]) {
                        log('video from blob');
                        this.video.src = this.videoCache[baseUrl];
                    } else {
                        log('video from url');
                        missingBlob = true;
                        this.video.src = url;
                    }
                }
            } else {
                this.video.src = '';
                if (this.videoCache[baseUrl]) {
                    log('img from blob');
                    this.dom.style.backgroundImage = `url("${this.videoCache[baseUrl]}")`;
                } else {
                    log('img from url');
                    missingBlob = true;
                    this.dom.style.backgroundImage = `url("${url}")`;
                }
            }
            if (missingBlob) {
                log('missing blob -> preload');
                this.preloadBackgrounds();
            }
        } else {
            this.video.src = '';
            this.dom.style.backgroundImage = '';
        }
        this.isStartingVideo = false;
        log('LandingPage.updateBackground COMPLETED');
    }




    async render() {
        this.dom?.remove();
        const container = document.createElement('div'); {
            container.classList.add('stlp--container');
            container.style.setProperty('--stlp--cardHeight', `${this.settings.cardHeight}px`);
            container.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
            // await delay(1);
            container.style.transition = 'transition: background-color 200ms';
            const intro = document.createElement('video'); {
                this.intro = intro;
                intro.classList.add('stlp--intro');
                intro.loop = false;
                intro.muted = true;
                intro.autoplay = true;
                intro.addEventListener('play', ()=>log('intro.play'));
                intro.addEventListener('playing', ()=>log('intro.playing'));
                container.append(intro);
            }
            const video = document.createElement('video'); {
                this.video = video;
                video.classList.add('stlp--video');
                video.loop = true;
                video.muted = true;
                video.autoplay = true;
                video.addEventListener('play', ()=>log('video.play'));
                video.addEventListener('playing', ()=>log('video.playing'));
                container.append(video);
            }
            this.dom = container;
        }

        window.addEventListener('keyup', this.handeInputBound);

        return this.dom;
    }
    unrender() {
        window.removeEventListener('keyup',this.handeInputBound);
        this.dom?.remove();
        this.dom = null;
        this.isStartingVideo = false;
    }

    async renderContent() {
        const container = this.dom;
        const wrap = document.createElement('div'); {
            wrap.classList.add('stlp--wrapper');
            if (this.settings.highlightFavorites) {
                wrap.classList.add('stlp--highlightFavorites');
            }
            wrap.setAttribute('data-displayStyle', this.settings.displayStyle);
            const root = document.createElement('div'); {
                root.classList.add('stlp--cards');
                const els = await Promise.all(this.cards.map(async(card)=>{
                    return await card.render(this.settings);
                }));
                els.forEach(it=>root.append(it));
                wrap.append(root);
            }
            container.append(wrap);
        }
        const menu = document.createElement('ul'); {
            menu.classList.add('stlp--menu');
            this.settings.menuList.forEach(item=>{
                const li = document.createElement('li'); {
                    li.classList.add('stlp--item');
                    li.setAttribute('data-stlp--label', item.label);
                    li.textContent = item.label;
                    li.addEventListener('click', async()=>{
                        await executeSlashCommands(item.command);
                    });
                    menu.append(li);
                }
            });
            container.append(menu);
        }
        const inputDisplayContainer = document.createElement('div'); {
            this.inputDisplayContainer = inputDisplayContainer;
            inputDisplayContainer.classList.add('stlp--inputDisplayContainer');
            const inputDisplay = document.createElement('div'); {
                this.inputDisplay = inputDisplay;
                inputDisplay.classList.add('stlp--inputDisplay');
                inputDisplayContainer.append(inputDisplay);
            }
        }
    }




    endInput() {
        this.isInputting = false;
        this.input = '';
        this.inputTime = 0;
        this.inputDisplay.textContent = '';
        this.inputDisplayContainer.remove();
    }
    /**
     *
     * @param {KeyboardEvent} evt
     * @returns
     */
    handleInput(evt) {
        let key = evt.key;
        if (this.isInputting) {
            if (key == 'Escape') {
                this.endInput();
                return;
            }
            if (key == 'Enter' && !evt.shiftKey) {
                document.querySelector('#send_textarea').value = this.input;
                document.querySelector('#send_but').click();
                this.endInput();
                return;
            }
            if (key == 'Backspace') {
                this.input = this.input.slice(0, -1);
                key = '';
            }
        }
        if (key == 'Enter' && evt.shiftKey) key = '\n';
        if (key.length > 1 || evt.ctrlKey || evt.altKey) return;
        if (!this.isInputting) {
            log('ACTIVE', document.activeElement);
            if (document.activeElement != document.body) return;
            this.isInputting = true;
            this.dom.append(this.inputDisplayContainer);
        }
        this.input += key;
        this.inputTime = new Date().getTime();
        this.inputDisplay.textContent = this.input;
    }
}
