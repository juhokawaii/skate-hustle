import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';
import { addEntry, qualifies } from './Leaderboard.js';
import { renderWallLeaderboard } from './WallLeaderboard.js';

const LEADERBOARD_KEY = 'BottomRaceScene';

export default class BottomRaceScene extends BaseGameScene {
    constructor() {
        super('BottomRaceScene');
    }

    preload() {
        super.preload();
        this.load.image('bottomrace_wall_texture', 'assets/backgrounds/256x256.png');
        this.load.image('bottomrace_platform_texture', 'assets/backgrounds/hubworld_background.png');
        this.load.image('bottomrace_drop_light', 'assets/backgrounds/drop-light.png');
        this.load.image('silly_top', 'assets/backgrounds/silly_top.png');
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
        this.load.json('bottom_race_level', 'assets/levels/bottomRaceLevel.json');
        this.load.audio('run_track', 'assets/music/run.mp3');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('run_track', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const level = loadLevelData(this, 'bottom_race_level', data, {
            worldWidth:      1600,
            worldHeight:     6000,
            spawnPoint:      { x: 800, y: 190 },
            returnPortalPos: { x: 470, y: 210 },
            goalPortalPos:   { x: 800, y: 5750 }
        });
        this.worldWidth      = level.worldWidth;
        this.worldHeight     = level.worldHeight;
        this.spawnPoint      = level.spawnPoint;
        this.returnPortalPos = level.returnPortalPos;
        // Intentional override: goal portal Y is shifted +120px from level data so the
        // graffiti visual sits at the correct height relative to the bottom platform.
        this.goalPortalPos   = { x: level.goalPortalPos.x, y: level.goalPortalPos.y + 120 };

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

        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'bottomrace_wall_texture');
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);
        this.registerParallaxObject(bg, 0.85, 0.85);

        const viewW      = this.scale.width;
        const viewH      = this.scale.height;
        const pxFactor   = 0.85;
        const followOffY = 100;

        const goalCamX = Phaser.Math.Clamp(this.goalPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const goalCamY = Phaser.Math.Clamp(this.goalPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        const retCamX  = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY  = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        TextureFactory.ensureGrayscaleTexture(this, 'silly_top', 'silly_top_bw');
        this.goalPortal = new Graffiti(this, this.goalPortalPos.x, this.goalPortalPos.y, 'silly_top_bw', 'silly_top', this.cats.SENSOR);
        this.goalPortal.setScrollFactor(1, 1);
        this.goalPortal.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.goalPortalPos.x - goalCamX * (1 - pxFactor),
            y: this.goalPortalPos.y - goalCamY * (1 - pxFactor),
            depth: -2,
            alpha: 0.75
        });
        this.registerParallaxObject(this.goalPortal.visualProxy, pxFactor, pxFactor);

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
                console.error('Failed to create bottom race platform:', def, err);
            }
        });

        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
        this.player.setDepth(10);

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

        this.hintText = this.add.text(16, 16, '', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(2000);

        // --- LEADERBOARD ---
        this.inputPhase           = 'playing';
        this.playerTag            = '';
        this.inputBuffer          = '';
        this.maxTagLen            = 7;
        this.inputOverlayElements = [];

        const lbSprites = renderWallLeaderboard(this, {
            sceneKey: LEADERBOARD_KEY,
            x: 950,
            y: 400,
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

    resolveTexture(key) {
        if (key === 'platform_texture') return 'bottomrace_platform_texture';
        if (key === 'drop')             return 'bottomrace_drop_light';
        return key;
    }

    getRestartData() {
        return {
            worldWidth:      this.worldWidth,
            worldHeight:     this.worldHeight,
            levelPlatforms:  this.levelPlatforms,
            spawnPoint:      this.spawnPoint,
            returnPortalPos: this.returnPortalPos,
            goalPortalPos:   this.goalPortalPos
        };
    }

    getLevelPayload() {
        const base = super.getLevelPayload();
        return { ...base, goalPortal: this.goalPortalPos, returnPortal: this.returnPortalPos };
    }

    update() {
        this.player.update();
        this.hintText.setText('');

        if (this.runEnded) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('HubScene');
            }
            return;
        }

        if (this.returnPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('HubScene');
                return;
            }
        }

        if (!this.timerStopped && this.goalPortal.isPlayerTouching) {
            this.timerStopped = true;
            this.finalTimeMs  = this.time.now - this.timerStartedAt;
            this.timerText.setColor('#5dff8b');
            this.endRun();
            return;
        }

        if (this.goalPortal.isPlayerTouching) {
            this.hintText.setText('Bottom reached. Press ENTER for Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
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
            this.hintText.setText('Bottom reached. Press ENTER for Hub');
        }
    }

    showInputOverlay() {
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

            this.hintText.setText('Bottom reached. Press ENTER for Hub');
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
