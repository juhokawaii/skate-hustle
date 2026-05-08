import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';
import { addEntry, qualifies } from './Leaderboard.js';
import { renderWallLeaderboard } from './WallLeaderboard.js';
import InputManager from './InputManager.js';
import ScribbleInput from './ScribbleInput.js';

const HUB_PRIZE_POINT_RETURN_SPAWN = { x: 670, y: 400 };
const LEADERBOARD_KEY = 'PrizePointScene';

export default class PrizePointScene extends BaseGameScene {
    constructor() {
        super('PrizePointScene');
    }

    preload() {
        super.preload();
        this.load.image('sponsor_graffiti_1', 'assets/backgrounds/sponsor-graffiti-1.png');
        this.load.image('prize_point_color', 'assets/backgrounds/prize-point.png');
        this.load.json('prize_point_level', 'assets/levels/prizePointLevel.json');
        this.load.audio('run_track', 'assets/music/run.mp3');
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('run_track', { volume: 0.9, loop: true });
        this.bgmusic.play();

        // --- INPUT PHASE: collect player tag before gameplay ---
        this.inputPhase          = 'intro'; // 'intro' -> 'tag' -> 'playing'
        this.playerTag           = '';
        this.inputBuffer         = '';
        this.maxTagLen           = 7;
        this.inputOverlayElements = [];
        this.gameplayPaused      = true;

        const level = loadLevelData(this, 'prize_point_level', data, {
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

        this.parkBackground = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'concrete_bg');
        this.parkBackground.setOrigin(0, 0);
        this.parkBackground.setScrollFactor(0.85, 0.85);
        this.parkBackground.setDepth(-10);
        this.registerParallaxObject(this.parkBackground, 0.85, 0.85);

        const viewW      = this.scale.width;
        const viewH      = this.scale.height;
        const pxFactor   = 0.85;
        const followOffY = 100;

        const finCamX = Phaser.Math.Clamp(this.finishPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const finCamY = Phaser.Math.Clamp(this.finishPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        TextureFactory.ensureGrayscaleTexture(this, 'prize_point_color', 'prize_point_bw');
        this.finishPortal = new Graffiti(this, this.finishPortalPos.x, this.finishPortalPos.y, 'prize_point_bw', 'prize_point_color', this.cats.SENSOR);
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

        const sponsorX = 820;
        const sponsorY = 4070;
        this.sponsorGraffiti = this.add.image(sponsorX, sponsorY, 'sponsor_graffiti_1');
        this.sponsorGraffiti.setOrigin(0, 0);
        this.sponsorGraffiti.setAngle(15);
        this.sponsorGraffiti.setScrollFactor(pxFactor, pxFactor);
        this.sponsorGraffiti.setDepth(-2);
        this.registerParallaxObject(this.sponsorGraffiti, pxFactor, pxFactor);

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.levelPlatforms.forEach((def) => {
            try {
                this.createPlatform(def.x, def.y, def.config, def);
            } catch (err) {
                console.error('Failed to create prize point platform:', def, err);
            }
        });

        this.inputManager = new InputManager(this);
        this._disposables.push(() => this.inputManager.destroy());
        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats, this.inputManager);
        this.player.setDepth(10);
        this._disposables.push(() => this.player.destroy());

        this.highestLineBaselineY = this.getPlayerBottomY();
        this.highestLineY         = this.highestLineBaselineY;

        this.setupCamera();
        this.setupAnims();
        this.setupDebugLabel();
        this.debugGrid = this.buildDebugGrid();
        this.setupMapEditor(this.debugGrid);

        this.countdownDurationMs  = 120000;
        this.remainingTimeMs      = this.countdownDurationMs;
        this.runEnded             = false;
        this.goalReached          = false;
        this.finalRemainingTimeMs = 0;

        this.timerText = this.add.text(this.scale.width / 2, 16, this.formatTimeMs(this.remainingTimeMs), {
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
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(2000);

        // Start gameplay immediately — tag is only requested post-run if the
        // player qualifies for the top 7 leaderboard.
        const lbSprites = renderWallLeaderboard(this, {
            sceneKey: LEADERBOARD_KEY,
            x: 857,
            y: 2833,
            titleOffset: { x: 230, y: -130 }
        });
        lbSprites.forEach((s) => this.registerParallaxObject(s, 0.85, 0.85));
        this.inputPhase     = 'playing';
        this.gameplayPaused = false;
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

    isCapturingKeyboard() {
        return this.inputPhase === 'tag';
    }

    showInputOverlay() {
        if (this.matter?.world?.pause) this.matter.world.pause();

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

            const detail = { pixelsUp: this._pendingPixelsUp, secondsRemaining: this._pendingSecondsRemaining };
            if (dataUrl) detail.tag_image = dataUrl;

            addEntry(LEADERBOARD_KEY, {
                tag: 'SCRIBBLE',
                score: this._pendingScore,
                detail
            });

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

        const prompt = this.add.text(cx, cy - 80, `Enter your tag (max ${this.maxTagLen} chars)\nType and press ENTER`, {
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
                score: this._pendingScore,
                detail: { pixelsUp: this._pendingPixelsUp, secondsRemaining: this._pendingSecondsRemaining }
            });

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
        if (this._entryKeyListener) {
            this.input.keyboard.off('keydown', this._entryKeyListener);
            this._entryKeyListener = null;
        }
        if (this._inputKeyListener) {
            this.input.keyboard.off('keydown', this._inputKeyListener);
            this._inputKeyListener = null;
        }
    }

    shutdown() {
        this.clearInputOverlay();
        super.shutdown();
    }

    getPlayerBottomY() {
        if (!this.player) return 0;
        if (typeof this.player.getBottomCenter === 'function') return this.player.getBottomCenter().y;
        const h = this.player.displayHeight || this.player.height || 0;
        return this.player.y + (h * 0.5);
    }

    getCurrentPixelsPushedUp() {
        return Math.max(0, Math.round(this.highestLineBaselineY - this.highestLineY));
    }

    formatTimeMs(ms) {
        const clamped      = Math.max(0, ms);
        const seconds      = Math.floor(clamped / 1000);
        const milliseconds = Math.floor(clamped % 1000).toString().padStart(3, '0');
        return `${seconds}.${milliseconds}`;
    }

    endRun(goalReached) {
        if (this.runEnded) return;

        this.runEnded             = true;
        this.goalReached          = goalReached;
        this.finalRemainingTimeMs = this.remainingTimeMs;

        const currentPixelsUp         = this.getCurrentPixelsPushedUp();
        const currentSecondsRemaining = goalReached ? (this.finalRemainingTimeMs / 1000) : 0;

        if (this.matter?.world?.pause) this.matter.world.pause();

        const currentScore = Math.round(currentPixelsUp + currentSecondsRemaining);

        // Store run results for use after tag entry
        this._pendingPixelsUp         = currentPixelsUp;
        this._pendingSecondsRemaining = currentSecondsRemaining;
        this._pendingScore            = currentScore;

        if (qualifies(LEADERBOARD_KEY, currentScore)) {
            this.inputPhase     = 'tag';
            this.gameplayPaused = true;
            this.showInputOverlay();
        } else {
            addEntry(LEADERBOARD_KEY, {
                tag: 'ANON',
                score: currentScore,
                detail: { pixelsUp: currentPixelsUp, secondsRemaining: currentSecondsRemaining }
            });
            this.hintText.setText('Press ENTER to return to Hub');
        }
    }

    update() {
        this.inputManager.update();
        if (this.runEnded) {
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene', { spawnPoint: HUB_PRIZE_POINT_RETURN_SPAWN });
            }
            return;
        }

        if (this.gameplayPaused) return;

        if (this._inputGraceFrames == null) this._inputGraceFrames = 0;
        if (this._inputGraceFrames < 2) { this._inputGraceFrames++; return; }

        this.player.update();

        const playerBottomY = this.getPlayerBottomY();
        if (playerBottomY < this.highestLineY) this.highestLineY = playerBottomY;

        this.remainingTimeMs = Math.max(0, this.remainingTimeMs - this.game.loop.delta);
        this.timerText.setText(this.formatTimeMs(this.remainingTimeMs));

        if (this.returnPortal.isPlayerTouching && this.inputManager.justConfirmed()) {
            this.scene.start('HubScene');
            return;
        }

        if (this.finishPortal.isPlayerTouching) { this.endRun(true); return; }
        if (this.remainingTimeMs <= 0)           { this.endRun(false); return; }
    }
}
