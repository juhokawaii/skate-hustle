import Player from './Player.js';
import Zombie from './Zombie.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';

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
        // Keep the return logo close to spawn for quick exit back to Hub.
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

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.levelPlatforms.forEach((def) => {
            try {
                this.createPlatform(def.x, def.y, def.config, def);
            } catch (err) {
                console.error('Failed to create zombie horde platform:', def, err);
            }
        });

        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
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

        this.runTimeMs   = 0;
        this.goalReached = false;
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
        this.player.update();
        if (this.zombies) {
            for (const z of this.zombies) z.update(time, delta);
        }
        this.hintText.setText('');

        if (!this.goalReached) {
            this.runTimeMs += delta;
            this.timerText.setText(this.formatTimeMs(this.runTimeMs));
        }

        if (this.goalGraffiti && this.goalGraffiti.isPlayerTouching) {
            this.goalReached = true;
            this.hintText.setText('Press ENTER to return to Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('HubScene');
                return;
            }
        }

        if (this.returnPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to return to Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('HubScene');
            }
        }
    }
}
