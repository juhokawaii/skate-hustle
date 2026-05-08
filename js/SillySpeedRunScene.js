import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { saveHubProgress } from './GameState.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';
import { addEntry, qualifies } from './Leaderboard.js';
import { renderWallLeaderboard } from './WallLeaderboard.js';
import InputManager from './InputManager.js';
import ScribbleInput from './ScribbleInput.js';

const LEADERBOARD_KEY = 'SillySpeedRunScene';

export default class SillySpeedRunScene extends BaseGameScene {
    constructor() {
        super('SillySpeedRunScene');
    }

    preload() {
        super.preload();
        this.load.image('silly_top', 'assets/backgrounds/silly_top.png');
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
        this.load.json('silly_speedrun_level', 'assets/levels/sillySpeedRunLevel.json');
        this.load.audio('run_track', 'assets/music/run.mp3');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('run_track', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const level = loadLevelData(this, 'silly_speedrun_level', data, {
            worldWidth:      1600,
            worldHeight:     6000,
            spawnPoint:      { x: 800, y: 5830 },
            finishPortalPos: { x: 800, y: 150 },
            returnPortalPos: { x: 600, y: 5705 }
        });
        this.worldWidth      = level.worldWidth;
        this.worldHeight     = level.worldHeight;
        this.spawnPoint      = level.spawnPoint;
        this.finishPortalPos = level.finishPortalPos;
        this.returnPortalPos = level.returnPortalPos;

        this.levelPlatforms = level.platforms.map((def) => ({
            ...def,
            x: def.x,
            y: def.y,
            config: { ...def.config }
        }));

        this.cats                = CATS;
        this.legacyCenteredInput = false;
        this.captureLevelData    = false;

        this.initEditorState();
        this.setupWorldBounds();

        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'concrete_bg');
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);
        this.registerParallaxObject(bg, 0.85, 0.85);

        const viewW      = this.scale.width;
        const viewH      = this.scale.height;
        const pxFactor   = 0.85;
        const followOffY = 100;

        const finCamX = Phaser.Math.Clamp(this.finishPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const finCamY = Phaser.Math.Clamp(this.finishPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        TextureFactory.ensureGrayscaleTexture(this, 'silly_top', 'silly_top_bw');
        this.finishPortal = new Graffiti(this, this.finishPortalPos.x, this.finishPortalPos.y, 'silly_top_bw', 'silly_top', this.cats.SENSOR);
        this.finishPortal.setScrollFactor(1, 1);
        this.finishPortal.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.finishPortalPos.x - finCamX * (1 - pxFactor),
            y: this.finishPortalPos.y - finCamY * (1 - pxFactor),
            depth: -2
        });
        this.registerParallaxObject(this.finishPortal.visualProxy, pxFactor, pxFactor);

        const retCamX = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        TextureFactory.ensureGrayscaleTexture(this, 'logo_portal', 'logo_portal_bw');
        this.returnPortal = new Graffiti(this, this.returnPortalPos.x, this.returnPortalPos.y, 'logo_portal_bw', 'logo_portal', this.cats.SENSOR);
        this.returnPortal.setScrollFactor(1, 1);
        this.returnPortal.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.returnPortalPos.x - retCamX * (1 - pxFactor),
            y: this.returnPortalPos.y - retCamY * (1 - pxFactor),
            depth: -2,
            alpha: 0.62
        });
        this.registerParallaxObject(this.returnPortal.visualProxy, pxFactor, pxFactor);

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.levelPlatforms.forEach((def) => {
            try {
                this.createPlatform(def.x, def.y, def.config, def);
            } catch (err) {
                console.error('Failed to create silly platform:', def, err);
            }
        });

        this.inputManager = new InputManager(this);
        this._disposables.push(() => this.inputManager.destroy());
        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats, this.inputManager);
        this.player.setDepth(10);
        this._disposables.push(() => this.player.destroy());

        this.setupCamera();
        this.setupAnims();
        this.setupDebugLabel();
        this.setupMapEditor(this.buildDebugGrid());

        this.timerStartedAt = this.time.now;
        this.timerStopped   = false;
        this.finalTimeMs    = 0;
        this.runEnded       = false;

        this.timerText = this.add.text(this.scale.width / 2, 16, '00.000', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        });
        this.timerText.setOrigin(0.5, 0);
        this.timerText.setScrollFactor(0);
        this.timerText.setDepth(2000);

        // --- LEADERBOARD ---
        this.inputPhase           = 'playing';
        this.playerTag            = '';
        this.inputBuffer          = '';
        this.maxTagLen            = 7;
        this.inputOverlayElements = [];
        this.hintText = this.add.text(16, 16, '', {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(2000);

        const lbSprites = renderWallLeaderboard(this, {
            sceneKey: LEADERBOARD_KEY,
            x: 500,
            y: 3200,
            formatRow: (entry, index) => {
                const tag = entry.tag || 'ANON';
                const timeMs = entry.detail?.timeMs ?? entry.score;
                const secs = Math.floor(timeMs / 1000);
                const ms   = Math.floor(timeMs % 1000).toString().padStart(3, '0');
                return `${index + 1} ${tag} ${secs}.${ms}`;
            }
        });
        lbSprites.forEach((s) => this.registerParallaxObject(s, 0.85, 0.85));
    }

    getRestartData() {
        return {
            worldWidth:      this.worldWidth,
            worldHeight:     this.worldHeight,
            levelPlatforms:  this.levelPlatforms,
            spawnPoint:      this.spawnPoint,
            finishPortalPos: this.finishPortalPos,
            returnPortalPos: this.returnPortalPos
        };
    }

    getLevelPayload() {
        const base = super.getLevelPayload();
        return { ...base, finishPortal: this.finishPortalPos, returnPortal: this.returnPortalPos };
    }

    update() {
        this.inputManager.update();
        this.player.update();
        this.hintText.setText('');

        if (this.runEnded) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene');
            }
            return;
        }

        if (this.returnPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene');
                return;
            }
        }

        if (!this.timerStopped && this.finishPortal.isPlayerTouching) {
            this.timerStopped  = true;
            this.finalTimeMs   = this.time.now - this.timerStartedAt;
            this.timerText.setColor('#5dff8b');
            saveHubProgress({ sillyCompleted: true });
            this.endRun();
            return;
        }

        if (this.finishPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene');
                return;
            }
        }

        const elapsed      = this.timerStopped ? this.finalTimeMs : (this.time.now - this.timerStartedAt);
        const seconds      = Math.floor(elapsed / 1000);
        const milliseconds = Math.floor(elapsed % 1000).toString().padStart(3, '0');
        this.timerText.setText(`${seconds}.${milliseconds}`);
    }

    isCapturingKeyboard() {
        return this.inputPhase === 'tag';
    }

    endRun() {
        if (this.runEnded) return;
        this.runEnded = true;

        const timeMs = Math.round(this.finalTimeMs);
        this._pendingTimeMs = timeMs;

        if (qualifies(LEADERBOARD_KEY, timeMs, 'asc')) {
            this.inputPhase = 'tag';
            this.showInputOverlay();
        } else {
            addEntry(LEADERBOARD_KEY, {
                tag: 'ANON',
                score: timeMs,
                detail: { timeMs }
            }, 'asc');
            this.hintText.setText('Press ENTER to return to Hub');
        }
    }

    showInputOverlay() {
        const isMobile = (navigator.maxTouchPoints || 0) > 0;
        if (isMobile) {
            this._showScribbleInput();
        } else {
            this._showKeyboardInput();
        }
    }

    _showScribbleInput() {
        this._scribbleInput = new ScribbleInput();
        this._scribbleInput.show((dataUrl) => {
            this._scribbleInput = null;
            this.inputPhase = 'playing';

            addEntry(LEADERBOARD_KEY, {
                tag: 'SCRIBBLE',
                score: this._pendingTimeMs,
                detail: { timeMs: this._pendingTimeMs, tag_image: dataUrl }
            }, 'asc');

            this.hintText.setText('Press ENTER to return to Hub');
        });
    }

    _showKeyboardInput() {
        this.clearInputOverlay();
        this.inputBuffer = '';

        const cx = this.scale.width * 0.5;
        const cy = this.scale.height * 0.5;

        const dimBg = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.7);
        dimBg.setScrollFactor(0);
        dimBg.setDepth(6000);
        this.inputOverlayElements.push(dimBg);

        const prompt = this.add.text(cx, cy - 80, `Top 7! Enter your tag (max ${this.maxTagLen} chars)\nType and press ENTER`, {
            fontFamily: 'monospace', fontSize: '28px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center'
        });
        prompt.setOrigin(0.5, 0.5);
        prompt.setScrollFactor(0);
        prompt.setDepth(6001);
        this.inputOverlayElements.push(prompt);

        this.inputDisplay = this.add.text(cx, cy + 20, '_', {
            fontFamily: 'monospace', fontSize: '36px',
            color: '#5dff8b', stroke: '#000000', strokeThickness: 5, align: 'center'
        });
        this.inputDisplay.setOrigin(0.5, 0.5);
        this.inputDisplay.setScrollFactor(0);
        this.inputDisplay.setDepth(6001);
        this.inputOverlayElements.push(this.inputDisplay);

        if (this._inputKeyListener) this.input.keyboard.off('keydown', this._inputKeyListener);
        this._inputKeyListener = (event) => this.handleInputKey(event);
        this.input.keyboard.on('keydown', this._inputKeyListener);
    }

    handleInputKey(event) {
        if (this.inputPhase !== 'tag') return;

        const key = event.key || '';

        if (key === 'Enter') {
            if (this.inputBuffer.length === 0) return;
            this.playerTag  = this.inputBuffer.toUpperCase();
            this.inputPhase = 'playing';
            this.clearInputOverlay();

            addEntry(LEADERBOARD_KEY, {
                tag: this.playerTag,
                score: this._pendingTimeMs,
                detail: { timeMs: this._pendingTimeMs }
            }, 'asc');

            this.hintText.setText('Press ENTER to return to Hub');
            return;
        }

        if (key === 'Backspace') {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
        } else if (key.length === 1 && this.inputBuffer.length < this.maxTagLen) {
            this.inputBuffer += key;
        }

        if (this.inputDisplay) {
            this.inputDisplay.setText(this.inputBuffer.length > 0 ? this.inputBuffer.toUpperCase() + '_' : '_');
        }
    }

    clearInputOverlay() {
        this.inputOverlayElements.forEach((el) => { if (el?.destroy) el.destroy(); });
        this.inputOverlayElements = [];
        this.inputDisplay = null;
        if (this._inputKeyListener) {
            this.input.keyboard.off('keydown', this._inputKeyListener);
            this._inputKeyListener = null;
        }
    }

    shutdown() {
        this.clearInputOverlay();
        super.shutdown();
    }
}
