import Player from './Player.js';
import Zombie from './Zombie.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';
import { addEntry, qualifies } from './Leaderboard.js';
import { renderWallLeaderboard } from './WallLeaderboard.js';
import InputManager from './InputManager.js';
import ScribbleInput from './ScribbleInput.js';

export default class ZombieHordeScene extends BaseGameScene {
    constructor() {
        super('ZombieHordeScene');
    }

    preload() {
        super.preload();
        this.load.image('zombie_goal_color', 'assets/backgrounds/zombie-goal.png');
        this.load.spritesheet('zombie_wall_graffiti', 'assets/backgrounds/atlas-zombies.png', {
            frameWidth: 256,
            frameHeight: 256
        });
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
        this.load.json('zombie_horde_level', 'assets/levels/zombieHordeLevel.json');
        this.load.image('zombie_standing', 'assets/player_sprites/zombie-standing.png');
        this.load.image('zombie_walking1', 'assets/player_sprites/zombie-walking1.png');
        this.load.image('zombie_walking2', 'assets/player_sprites/zombie-walking2.png');
        this.load.image('zombie_sitting1', 'assets/player_sprites/zombie-sitting1.png');
        this.load.image('zombie_sitting2', 'assets/player_sprites/zombie-sitting2.png');
        this.load.image('zombie_lying', 'assets/player_sprites/zombie-lying-down.png');
        this.load.audio('run_track', 'assets/music/run.mp3');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('run_track', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const level = loadLevelData(this, 'zombie_horde_level', data, {
            worldWidth:      19200,
            worldHeight:     900,
            spawnPoint:      { x: 180, y: 700 },
            returnPortalPos: { x: 100, y: 700 }
        });
        this.worldWidth      = level.worldWidth;
        this.worldHeight     = level.worldHeight;
        this.spawnPoint      = level.spawnPoint;
        // Intentional override: return portal is pinned relative to spawn rather than
        // using the level JSON value, so the exit is always immediately accessible.
        this.returnPortalPos = { x: this.spawnPoint.x - 80, y: this.spawnPoint.y };

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

        const viewW        = this.scale.width;
        const viewH        = this.scale.height;
        const pxFactor     = 0.85;
        const followOffY   = 100;
        const spawnCamY    = Phaser.Math.Clamp(this.spawnPoint.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        const parallaxCompY = spawnCamY * (1 - pxFactor);

        this.createZombieWallDecorations(pxFactor, parallaxCompY);

        TextureFactory.ensureGrayscaleTexture(this, 'zombie_goal_color', 'zombie_goal_bw');

        // Goal graffiti: keep 600px clear from right wall (image is 600px wide), and place around top third.
        this.goalPos = {
            x: this.worldWidth - 300,
            y: Math.round(this.worldHeight / 3) + 300
        };
        this.goalGraffiti = new Graffiti(this, this.goalPos.x, this.goalPos.y, 'zombie_goal_bw', 'zombie_goal_color', this.cats.SENSOR);
        this.goalGraffiti.setScrollFactor(1, 1);
        const goalCamX = Phaser.Math.Clamp(this.goalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const goalCamY = Phaser.Math.Clamp(this.goalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        this.goalGraffiti.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.goalPos.x - goalCamX * (1 - pxFactor),
            y: this.goalPos.y - goalCamY * (1 - pxFactor),
            depth: -2,
            alpha: 0.9
        });
        this.registerParallaxObject(this.goalGraffiti.visualProxy, pxFactor, pxFactor);

        TextureFactory.ensureGrayscaleTexture(this, 'logo_portal', 'logo_portal_bw');
        this.returnPortal = new Graffiti(this, this.returnPortalPos.x, this.returnPortalPos.y, 'logo_portal_bw', 'logo_portal', this.cats.SENSOR);
        this.returnPortal.setScrollFactor(1, 1);
        const retCamX = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
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
                console.error('Failed to create zombie horde platform:', def, err);
            }
        });

        this.inputManager = new InputManager(this);
        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats, this.inputManager);
        this.player.setDepth(10);

        // Spawn 5 zombies spread across the level
        this.zombies = [];
        const zombieSpacing = (this.worldWidth - 600) / 5;
        for (let i = 0; i < 5; i++) {
            const zx = 300 + (i * zombieSpacing) + Phaser.Math.RND.between(-80, 80);
            const zy = this.spawnPoint.y;
            this.zombies.push(new Zombie(this, zx, zy));
        }

        this.setupCamera();
        this.setupAnims();
        this.setupDebugLabel();
        this.setupMapEditor(this.buildDebugGrid());

        this.hintText = this.add.text(16, 16, '', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(2000);

        // --- ZOMBIE OVERLAP SLOWDOWN ---
        this.zombieOverlapping = false;
        this.zombieOverlapRadius = 50; // sum of player + zombie radii (~35 + ~32, with a little tolerance)
        this.zombieSlowFactor = 0.31;  // 69% reduction → 31% of normal speed

        this.zombieOverlay = this.add.rectangle(
            this.scale.width / 2, this.scale.height / 2,
            this.scale.width, this.scale.height,
            0x00ff00, 1
        );
        this.zombieOverlay.setScrollFactor(0);
        this.zombieOverlay.setDepth(1500);
        this.zombieOverlay.setAlpha(0);

        this.runTimeMs   = 0;
        this.goalReached = false;
        this.runEnded    = false;
        this.timerText   = this.add.text(this.scale.width / 2, 16, this.formatTimeMs(this.runTimeMs), {
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
        this.leaderboardKey = 'ZombieHordeScene';
        this.inputPhase          = 'playing';
        this.playerTag           = '';
        this.inputBuffer         = '';
        this.maxTagLen           = 7;
        this.inputOverlayElements = [];

        const lbSprites = renderWallLeaderboard(this, {
            sceneKey: this.leaderboardKey,
            x: 6780,
            y: 1250,
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
            returnPortalPos: this.returnPortalPos
        };
    }

    getLevelPayload() {
        const base = super.getLevelPayload();
        return { ...base, returnPortal: this.returnPortalPos };
    }

    formatTimeMs(ms) {
        const clamped      = Math.max(0, ms);
        const seconds      = Math.floor(clamped / 1000);
        const milliseconds = Math.floor(clamped % 1000).toString().padStart(3, '0');
        return `${seconds}.${milliseconds}`;
    }

    isCapturingKeyboard() {
        return this.inputPhase === 'tag';
    }

    endRun() {
        if (this.runEnded) return;
        this.runEnded = true;

        const timeMs = Math.round(this.runTimeMs);
        this._pendingTimeMs = timeMs;

        if (qualifies(this.leaderboardKey, timeMs, 'asc')) {
            this.inputPhase = 'tag';
            this.showInputOverlay();
        } else {
            addEntry(this.leaderboardKey, {
                tag: 'ANON',
                score: timeMs,
                detail: { timeMs }
            }, 'asc');
            this.showEndMessage();
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
        this._scribbleInput.show((strokes) => {
            this._scribbleInput = null;
            this.inputPhase = 'playing';

            addEntry(this.leaderboardKey, {
                tag: 'SCRIBBLE',
                score: this._pendingTimeMs,
                detail: { timeMs: this._pendingTimeMs, tag_strokes: strokes }
            }, 'asc');

            this.showEndMessage();
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

            addEntry(this.leaderboardKey, {
                tag: this.playerTag,
                score: this._pendingTimeMs,
                detail: { timeMs: this._pendingTimeMs }
            }, 'asc');

            this.showEndMessage();
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

    showEndMessage() {
        this.hintText.setText('Press ENTER to return to Hub');
    }

    shutdown() {
        this.clearInputOverlay();
        super.shutdown();
    }

    createZombieWallDecorations(scrollFactor = 0.85, parallaxCompY = 0) {
        const floorDef  = this.levelPlatforms.find((def) => def?.config?.texture === 'ground') || null;
        const floorY    = floorDef?.y ?? 800;
        const rng       = Phaser.Math.RND;
        const frameCount = 8;
        const zoneWidth = Math.max(this.scale.width || 1280, 900);
        const usedFramesByZone = new Map();

        const pickUniqueFrameForX = (x) => {
            const zoneIndex = Math.floor(x / zoneWidth);
            if (!usedFramesByZone.has(zoneIndex)) usedFramesByZone.set(zoneIndex, new Set());
            const used = usedFramesByZone.get(zoneIndex);
            if (used.size >= frameCount) return null;
            const available = [];
            for (let i = 0; i < frameCount; i++) {
                if (!used.has(i)) available.push(i);
            }
            const frame = available[rng.between(0, available.length - 1)];
            used.add(frame);
            return frame;
        };

        const addDecoration = (x) => {
            const frame = pickUniqueFrameForX(x);
            if (frame == null) return;

            const scale    = rng.realInRange(0.55, 1.45);
            const halfSize = 128 * scale;
            let y;
            const verticalBandRoll = rng.realInRange(0, 1);
            if (verticalBandRoll < 0.35) {
                y = floorY - halfSize + rng.realInRange(-6, 8);
            } else if (verticalBandRoll < 0.8) {
                y = floorY - halfSize - rng.realInRange(25, 160);
            } else {
                y = floorY - halfSize - rng.realInRange(170, 300);
            }
            y = Phaser.Math.Clamp(y, 110, floorY - 20);

            const alpha  = rng.realInRange(0, 1) < 0.25 ? 1 : rng.realInRange(0.18, 0.85);
            const sprite = this.add.image(x, y - parallaxCompY, 'zombie_wall_graffiti', frame);
            sprite.setScrollFactor(scrollFactor, scrollFactor);
            sprite.setDepth(-6);
            sprite.setScale(scale);
            sprite.setAlpha(alpha);
            sprite.setFlipX(rng.realInRange(0, 1) < 0.35);
            sprite.setAngle(rng.realInRange(-7, 7));
            this.registerParallaxObject(sprite, scrollFactor, scrollFactor);
        };

        let x = 180;
        while (x < this.worldWidth - 160) {
            x += rng.between(190, 470);
            if (rng.realInRange(0, 1) < 0.5) continue;
            addDecoration(x + rng.between(-40, 40));
            if (rng.realInRange(0, 1) < 0.2) {
                addDecoration(x + rng.between(70, 200));
                if (rng.realInRange(0, 1) < 0.25) addDecoration(x + rng.between(210, 330));
            }
        }
    }

    update(time, delta) {
        this.inputManager.update();
        this.player.update();
        if (this.zombies) {
            for (const z of this.zombies) z.update(time, delta);
        }
        this.hintText.setText('');

        // --- Zombie overlap detection ---
        let touching = false;
        if (this.zombies) {
            const px = this.player.x;
            const py = this.player.y;
            const rSq = this.zombieOverlapRadius * this.zombieOverlapRadius;
            for (const z of this.zombies) {
                if (!z.active) continue;
                const dx = px - z.x;
                const dy = py - z.y;
                if (dx * dx + dy * dy < rSq) {
                    touching = true;
                    break;
                }
            }
        }

        if (touching && !this.zombieOverlapping) {
            this.zombieOverlapping = true;
            this.player.moveSpeedMultiplier = this.zombieSlowFactor;
            this.player.maxSpeedMultiplier = 0.1;
            this.tweens.killTweensOf(this.zombieOverlay);
            this.tweens.add({
                targets: this.zombieOverlay,
                alpha: 0.25,
                duration: 150,
                ease: 'Sine.easeOut'
            });
        } else if (!touching && this.zombieOverlapping) {
            this.zombieOverlapping = false;
            this.player.moveSpeedMultiplier = 1.0;
            this.player.maxSpeedMultiplier = 1.0;
            this.tweens.killTweensOf(this.zombieOverlay);
            this.tweens.add({
                targets: this.zombieOverlay,
                alpha: 0,
                duration: 200,
                ease: 'Sine.easeIn'
            });
        }

        if (!this.goalReached) {
            this.runTimeMs += delta;
            this.timerText.setText(this.formatTimeMs(this.runTimeMs));
        }

        if (this.runEnded) {
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene');
            }
            return;
        }

        if (this.goalGraffiti && this.goalGraffiti.isPlayerTouching && !this.goalReached) {
            this.goalReached = true;
            this.timerText.setColor('#5dff8b');
            this.endRun();
            return;
        }

        if (this.returnPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (this.inputManager.justConfirmed()) {
                this.scene.start('HubScene');
            }
        }
    }
}
