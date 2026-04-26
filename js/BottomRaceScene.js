import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';

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
            returnPortalPos: { x: 620, y: 210 },
            goalPortalPos:   { x: 800, y: 5750 }
        });
        this.worldWidth      = level.worldWidth;
        this.worldHeight     = level.worldHeight;
        this.spawnPoint      = level.spawnPoint;
        this.returnPortalPos = level.returnPortalPos;
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

        TextureFactory.ensureGrayscaleTexture(this, 'logo_portal', 'logo_portal_bw');
        this.returnPortal = new Graffiti(this, this.returnPortalPos.x, this.returnPortalPos.y, 'logo_portal_bw', 'logo_portal', this.cats.SENSOR);
        this.returnPortal.setScrollFactor(1, 1);
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
}
