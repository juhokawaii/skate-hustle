import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { isDebugMode } from './GameState.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';

const HUB_PRIZE_POINT_RETURN_SPAWN = { x: 670, y: 400 };

export default class PrizePointScene extends BaseGameScene {
    constructor() {
        super('PrizePointScene');
        this.bestPixelsUpStorageKey          = 'skate_hustle_prize_point_best_pixels_up';
        this.bestSecondsRemainingStorageKey  = 'skate_hustle_prize_point_best_seconds_remaining';
        this.leaderboardStorageKey           = 'skate_hustle_prize_point_leaderboard';

        // Atlas grid: 8 cols x 6 rows, 560x423 image
        this.atlasCols  = 8;
        this.atlasRows  = 6;
        this.atlasCellW = Math.floor(560 / 8); // 70
        this.atlasCellH = Math.floor(423 / 6); // 70

        // Character map: row by row
        this.atlasChars = [
            'A','B','C','D','E','F','G','H',
            'I','J','K','L','M','N','O','P',
            'Q','R','S','T','U','V','W','X',
            'Y','Z','Å','Ä','Ö','','','',
            '1','2','3','4','5','6','7','8',
            '9','0','','','','','',''
        ];
        this.atlasCharMap = {};
        this.atlasChars.forEach((ch, i) => {
            if (ch) this.atlasCharMap[ch] = i;
        });
    }

    preload() {
        super.preload();
        this.load.image('sponsor_graffiti_1', 'assets/backgrounds/sponsor-graffiti-1.png');
        this.load.image('prize_point_color', 'assets/backgrounds/prize-point.png');
        this.load.json('prize_point_level', 'assets/levels/prizePointLevel.json');
        this.load.audio('run_track', 'assets/music/run.mp3');
        this.load.image('high_score_title', 'assets/backgrounds/high-score-title.png');
        this.load.spritesheet('highscore_atlas', 'assets/backgrounds/highscore-atlas.png', {
            frameWidth: this.atlasCellW,
            frameHeight: this.atlasCellH
        });
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

        const retCamX = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        this.returnPortal = new Graffiti(this, this.returnPortalPos.x, this.returnPortalPos.y, 'prize_point_bw', 'prize_point_bw', this.cats.SENSOR);
        this.returnPortal.setScrollFactor(1, 1);
        this.returnPortal.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.returnPortalPos.x - retCamX * (1 - pxFactor),
            y: this.returnPortalPos.y - retCamY * (1 - pxFactor),
            depth: -2,
            alpha: 0.62
        });

        const sponsorX = 820;
        const sponsorY = 4070;
        this.sponsorGraffiti = this.add.image(sponsorX, sponsorY, 'sponsor_graffiti_1');
        this.sponsorGraffiti.setOrigin(0, 0);
        this.sponsorGraffiti.setAngle(15);
        this.sponsorGraffiti.setScrollFactor(pxFactor, pxFactor);
        this.sponsorGraffiti.setDepth(-2);

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.levelPlatforms.forEach((def) => {
            try {
                this.createPlatform(def.x, def.y, def.config, def);
            } catch (err) {
                console.error('Failed to create prize point platform:', def, err);
            }
        });

        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
        this.player.setDepth(10);

        this.highestLineBaselineY = this.getPlayerBottomY();
        this.highestLineY         = this.highestLineBaselineY;

        this.setupCamera();
        this.setupAnims();
        this.setupDebugLabel();
        // Store reference — setGameplayVisibility needs to control debugGrid visibility
        this.debugGrid = this.buildDebugGrid();
        this.setupMapEditor(this.debugGrid);

        this.countdownDurationMs  = 120000;
        this.remainingTimeMs      = this.countdownDurationMs;
        this.runEnded             = false;
        this.goalReached          = false;
        this.finalRemainingTimeMs = 0;
        this.endScreenText        = null;
        this.endScreenElements    = [];

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

        // Ask only for the run tag before gameplay; highscore board is shown after the run.
        this.setGameplayVisibility(false);
        this.inputPhase     = 'tag';
        this.gameplayPaused = true;
        if (this.matter?.world?.pause) {
            this.matter.world.pause();
        }
        this.showInputOverlay();
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

    // --- INPUT PHASE UI ---
    setGameplayVisibility(visible) {
        const snapshot = [...this.children.list];
        snapshot.forEach((child) => {
            if (child === this.parkBackground)                  return;
            if (this.inputOverlayElements.includes(child))     return;
            if (this.endScreenElements.includes(child))        return;
            if (child instanceof Graffiti) {
                child.setVisible(false);
                if (child.visualProxy) child.visualProxy.setVisible(visible);
                return;
            }
            if (child === this.debugGrid) {
                child.setVisible(this.isMapMode && visible);
                return;
            }
            if (child === this.debugLabel) {
                child.setVisible(isDebugMode() && visible);
                return;
            }
            child.setVisible(visible);
        });
    }

    showEntryHighscoreOverlay() {
        this.clearInputOverlay();
        if (this.matter?.world?.pause) this.matter.world.pause();
        this.setGameplayVisibility(false);
        this.inputPhase     = 'intro';
        this.gameplayPaused = true;
        this.renderHighscoreBoard(this.inputOverlayElements, 6001, this.loadLeaderboard(), null);

        if (this._entryKeyListener) this.input.keyboard.off('keydown', this._entryKeyListener);
        this._entryKeyListener = (event) => {
            if (event.key !== 'Enter') return;
            this.input.keyboard.off('keydown', this._entryKeyListener);
            this._entryKeyListener = null;
            this.startTagEntryFlow();
        };
        this.input.keyboard.on('keydown', this._entryKeyListener);
    }

    renderHighscoreBoard(elements, depth, top7, lastRunInfo) {
        const cx     = this.scale.width * 0.5;
        const startY = 70;
        const rowGap = 58;

        const title = this.add.image(cx, startY - 60, 'high_score_title');
        title.setOrigin(0.5, 0);
        title.setScrollFactor(0);
        title.setDepth(depth);
        elements.push(title);

        if (top7.length === 0) {
            const emptyText = this.add.text(cx, startY + 120, 'No scores yet', {
                fontFamily: 'monospace', fontSize: '28px',
                color: '#ffffff', stroke: '#000000', strokeThickness: 4, align: 'center'
            });
            emptyText.setOrigin(0.5, 0);
            emptyText.setScrollFactor(0);
            emptyText.setDepth(depth);
            elements.push(emptyText);
        } else {
            top7.forEach((entry, index) => {
                const rowY = startY + 200 + (index * rowGap);
                elements.push(...this.renderAtlasText(`${index + 1}`, cx - 310, rowY, depth, 'left'));
                elements.push(...this.renderAtlasText(entry.tag || 'ANON', cx - 80, rowY, depth));
                const entryScore = entry.score != null ? entry.score : Math.round(entry.pixelsUp + entry.secondsRemaining);
                elements.push(...this.renderAtlasText(`${entryScore}`, cx + 220, rowY, depth));
            });
        }

        const bottomY = this.scale.height - 16;

        if (lastRunInfo) {
            const runText = this.add.text(16, bottomY,
                `Score: ${lastRunInfo.score}  (${lastRunInfo.pixelsUp}px + ${lastRunInfo.seconds}s)`, {
                fontFamily: 'monospace', fontSize: '18px',
                color: '#ff5d5d', stroke: '#000000', strokeThickness: 3
            });
            runText.setOrigin(0, 1);
            runText.setScrollFactor(0);
            runText.setDepth(depth);
            elements.push(runText);
        }

        const enterText = this.add.text(
            lastRunInfo ? cx + 280 : cx,
            bottomY,
            lastRunInfo ? 'Press ENTER to return to Hub' : 'Press ENTER for a new run', {
            fontFamily: 'monospace', fontSize: '28px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 5
        });
        enterText.setOrigin(lastRunInfo ? 1 : 0.5, 1);
        enterText.setScrollFactor(0);
        enterText.setDepth(depth);
        elements.push(enterText);

        this.tweens.add({
            targets: enterText,
            alpha: { from: 1, to: 0.35 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    startTagEntryFlow() {
        this.inputPhase = 'tag';
        this.showInputOverlay();
    }

    showInputOverlay() {
        this.clearInputOverlay();
        this.inputBuffer = '';
        if (this.matter?.world?.pause) this.matter.world.pause();

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
            this.input.keyboard.off('keydown', this._inputKeyListener);
            this._inputKeyListener = null;
            this.setGameplayVisibility(true);
            this.gameplayPaused = false;
            this.enterKey.isDown   = false;
            this.enterKey._justDown = false;
            if (this.matter?.world?.resume) this.matter.world.resume();
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
    }

    // --- LEADERBOARD ---
    loadLeaderboard() {
        try {
            const raw = localStorage.getItem(this.leaderboardStorageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    saveLeaderboard(board) {
        try { localStorage.setItem(this.leaderboardStorageKey, JSON.stringify(board)); } catch {}
    }

    addLeaderboardEntry(tag, pixelsUp, secondsRemaining) {
        const board = this.loadLeaderboard();
        const score = Math.round(pixelsUp + secondsRemaining);
        board.push({ tag, pixelsUp, secondsRemaining, score });
        board.sort((a, b) => {
            const sa = a.score != null ? a.score : Math.round(a.pixelsUp + a.secondsRemaining);
            const sb = b.score != null ? b.score : Math.round(b.pixelsUp + b.secondsRemaining);
            return sb - sa;
        });
        const top7 = board.slice(0, 7);
        this.saveLeaderboard(top7);
        return top7;
    }

    // --- ATLAS TEXT RENDERING ---
    renderAtlasText(text, x, y, depth, align) {
        const images           = [];
        const upper            = text.toUpperCase();
        const effectiveCharWidth = this.atlasCellW * 0.5;
        let cursorX = align === 'left' ? x : x - (upper.length * effectiveCharWidth * 0.5);

        for (let i = 0; i < upper.length; i++) {
            const ch = upper[i];
            if (ch === ' ') { cursorX += effectiveCharWidth; continue; }
            const frameIndex = this.atlasCharMap[ch];
            if (frameIndex == null) { cursorX += effectiveCharWidth; continue; }
            const img = this.add.image(cursorX + effectiveCharWidth * 0.5, y, 'highscore_atlas', frameIndex);
            img.setScrollFactor(0);
            img.setDepth(depth || 5000);
            images.push(img);
            cursorX += effectiveCharWidth;
        }
        return images;
    }

    getPlayerBottomY() {
        if (!this.player) return 0;
        if (typeof this.player.getBottomCenter === 'function') return this.player.getBottomCenter().y;
        const h = this.player.displayHeight || this.player.height || 0;
        return this.player.y + (h * 0.5);
    }

    loadBestPixelsUp() {
        try {
            const parsed = Number(localStorage.getItem(this.bestPixelsUpStorageKey));
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        } catch { return 0; }
    }

    saveBestPixelsUp(value) {
        try { localStorage.setItem(this.bestPixelsUpStorageKey, String(value)); } catch {}
    }

    loadBestSecondsRemaining() {
        try {
            const parsed = Number(localStorage.getItem(this.bestSecondsRemainingStorageKey));
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        } catch { return 0; }
    }

    saveBestSecondsRemaining(value) {
        try { localStorage.setItem(this.bestSecondsRemainingStorageKey, String(value)); } catch {}
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

        const bestPixelsUp = Math.max(this.loadBestPixelsUp(), currentPixelsUp);
        this.saveBestPixelsUp(bestPixelsUp);
        if (goalReached) {
            this.saveBestSecondsRemaining(Math.max(this.loadBestSecondsRemaining(), currentSecondsRemaining));
        }

        const top7 = this.addLeaderboardEntry(this.playerTag || 'ANON', currentPixelsUp, currentSecondsRemaining);

        if (this.matter?.world?.pause) this.matter.world.pause();

        const snapshot = [...this.children.list];
        snapshot.forEach((child) => { if (child !== this.parkBackground) child.setVisible(false); });

        const currentScore = Math.round(currentPixelsUp + currentSecondsRemaining);
        this.renderHighscoreBoard(this.endScreenElements, 5000, top7, {
            score:    currentScore,
            pixelsUp: currentPixelsUp,
            seconds:  Math.round(currentSecondsRemaining)
        });
    }

    update() {
        if (this.runEnded) {
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
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

        if (this.returnPortal.isPlayerTouching && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.scene.start('HubScene');
            return;
        }

        if (this.finishPortal.isPlayerTouching) { this.endRun(true); return; }
        if (this.remainingTimeMs <= 0)           { this.endRun(false); return; }
    }
}
