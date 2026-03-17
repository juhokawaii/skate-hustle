import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';

export default class BottomRaceScene extends Phaser.Scene {
    constructor() {
        super('BottomRaceScene');
    }

    preload() {
        this.load.image('player1', 'assets/player_sprites/player1.png');
        this.load.image('player2', 'assets/player_sprites/player2.png');
        this.load.image('player3', 'assets/player_sprites/player3.png');
        this.load.image('player4', 'assets/player_sprites/player4.png');
        this.load.image('player5', 'assets/player_sprites/player5.png');
        this.load.image('player6', 'assets/player_sprites/player6.png');

        this.load.image('concrete_bg', 'assets/backgrounds/hubworld_background.png');
        this.load.image('platform_texture', 'assets/backgrounds/256x256.png');
        this.load.image('ground', 'assets/backgrounds/ground.png');
        this.load.image('drop', 'assets/backgrounds/drop.png');
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });

        this.load.image('silly_top_bw', 'assets/backgrounds/silly_top_bw.png');
        this.load.image('silly_top', 'assets/backgrounds/silly_top.png');
        this.load.image('logo_portal_bw', 'assets/backgrounds/logo-bw.png');
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
        this.load.json('silly_speedrun_level', 'assets/levels/sillySpeedRunLevel.json');

        this.load.audio('title', 'assets/music/ramp.mp3');
    }

    create() {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('title', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const cachedLevel = this.cache.json.get('silly_speedrun_level') || {};
        this.worldWidth = cachedLevel.worldWidth || 1600;
        this.worldHeight = cachedLevel.worldHeight || 6000;

        this.spawnPoint = { x: 800, y: 190 };
        this.returnPortalPos = { x: 620, y: 210 };
        this.goalPortalPos = { x: 800, y: 5750 };

        const sourcePlatforms = Array.isArray(cachedLevel.platforms) ? cachedLevel.platforms : [];
        this.levelPlatforms = sourcePlatforms.map((def) => ({
            ...def,
            x: def.x,
            y: def.y,
            config: { ...def.config }
        }));

        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory(),
            SENSOR: this.matter.world.nextCategory()
        };

        this.matter.world.setBounds(0, 0, this.worldWidth, this.worldHeight, 1000, true, true, true, true);
        Object.values(this.matter.world.walls).forEach((wall) => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });

        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'concrete_bg');
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);

        // Adjusted visual-proxy positions so parallax graffiti aligns with the
        // player in a tall (6000 px) world.  Without adjustment the bottom portal
        // falls off the visible parallax range and the sensor drifts out of reach.
        // Formula: visualPos = targetPos − expectedCamScroll × (1 − parallaxFactor)
        const viewW = this.scale.width;
        const viewH = this.scale.height;
        const pxFactor = 0.85;
        const followOffY = 100;

        const goalCamX = Phaser.Math.Clamp(this.goalPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const goalCamY = Phaser.Math.Clamp(this.goalPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        const retCamX = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        this.goalPortal = new Graffiti(this, this.goalPortalPos.x, this.goalPortalPos.y, 'silly_top_bw', 'silly_top', this.cats.SENSOR);
        this.goalPortal.setScrollFactor(1, 1);
        this.goalPortal.enableParallaxVisual(pxFactor, pxFactor, {
            x: this.goalPortalPos.x - goalCamX * (1 - pxFactor),
            y: this.goalPortalPos.y - goalCamY * (1 - pxFactor),
            depth: -2,
            alpha: 0.75
        });

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
                this.createPlatform(def.x, def.y, def.config);
            } catch (err) {
                console.error('Failed to create bottom race platform:', def, err);
            }
        });

        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
        this.player.setDepth(10);

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(400, 200);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.setupAnims();

        this.timerStartedAt = this.time.now;
        this.timerStopped = false;
        this.finalTimeMs = 0;

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

    createPlatform(x, y, config) {
        if (!config || typeof config !== 'object') {
            return;
        }

        const {
            type = 'RECT',
            width = 100,
            height = 100,
            radius = 50,
            angle = 0,
            chamfer = 0,
            friction = 0.5,
            isOneWay = false,
            bouncy = false,
            texture = 'platform_texture'
        } = config;

        const renderWidth = type === 'CIRCLE' ? radius * 2 : width;
        const renderHeight = type === 'CIRCLE' ? radius * 2 : height;
        const centerX = x + (renderWidth / 2);
        const centerY = y + (renderHeight / 2);

        const bodyOptions = {
            isStatic: true,
            friction,
            restitution: bouncy ? 1.2 : 0,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;
        if (type === 'RECT') {
            body = this.matter.add.rectangle(centerX, centerY, width, height, bodyOptions);
        } else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            body = this.matter.add.fromVertices(centerX, centerY, [
                { x: width / 2, y: height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: -height / 2 }
            ], bodyOptions);
        } else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            body = this.matter.add.fromVertices(centerX, centerY, [
                { x: -width / 2, y: -height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: height / 2 }
            ], bodyOptions);
        } else if (type === 'CURVE') {
            const segments = 32;
            const verts = [{ x: width / 2, y: height / 2 }];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = -width / 2 + (Math.cos(t * Math.PI / 2) * width);
                const py = -height / 2 + (Math.sin(t * Math.PI / 2) * height);
                verts.push({ x: px, y: py });
            }
            verts.push({ x: width / 2, y: height / 2 });
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        } else if (type === 'CIRCLE') {
            body = this.matter.add.circle(centerX, centerY, radius, bodyOptions);
        }

        if (Array.isArray(body)) {
            body = body[0] || null;
        }
        if (!body) {
            return;
        }

        this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
        this.matter.body.setPosition(body, { x: centerX, y: centerY });
        body.collisionFilter.category = isOneWay ? this.cats.ONE_WAY : this.cats.GROUND;

        if (bouncy) {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, 'ground');
            return;
        }

        if (isOneWay || type === 'RECT') {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, texture);
        } else if (
            type === 'CURVE' ||
            type === 'RAMP_LEFT' || type === 'ramp_left' ||
            type === 'RAMP_RIGHT' || type === 'ramp_right'
        ) {
            TextureFactory.styleCurve(this, body, texture);
        } else if (type === 'CIRCLE') {
            TextureFactory.styleCircle(this, body, texture);
        }
    }

    setupAnims() {
        if (!this.anims.exists('idle_pump')) {
            this.anims.create({
                key: 'idle_pump',
                frames: [{ key: 'player1' }, { key: 'player2' }],
                frameRate: 1.5,
                repeat: -1
            });
        }
        if (!this.anims.exists('kick')) {
            this.anims.create({
                key: 'kick',
                frames: [
                    { key: 'player2', duration: 50 },
                    { key: 'player3', duration: 400 },
                    { key: 'player1', duration: 50 }
                ],
                frameRate: 10,
                repeat: 0
            });
        }
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
            this.finalTimeMs = this.time.now - this.timerStartedAt;
            this.timerText.setColor('#5dff8b');
        }

        if (this.goalPortal.isPlayerTouching) {
            this.hintText.setText('Bottom reached. Press ENTER for Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('HubScene');
                return;
            }
        }

        const elapsed = this.timerStopped ? this.finalTimeMs : (this.time.now - this.timerStartedAt);
        const seconds = Math.floor(elapsed / 1000);
        const milliseconds = Math.floor(elapsed % 1000).toString().padStart(3, '0');
        this.timerText.setText(`${seconds}.${milliseconds}`);
    }
}
