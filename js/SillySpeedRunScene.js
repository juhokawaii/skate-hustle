import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';

export default class SillySpeedRunScene extends Phaser.Scene {
    constructor() {
        super('SillySpeedRunScene');
    }

    preload() {
        this.load.image('player1', 'assets/player_sprites/player1.png');
        this.load.image('player2', 'assets/player_sprites/player2.png');
        this.load.image('player3', 'assets/player_sprites/player3.png');
        this.load.image('player4', 'assets/player_sprites/player4.png');
        this.load.image('player5', 'assets/player_sprites/player5.png');

        this.load.image('concrete_bg', 'assets/backgrounds/hubworld_background.png');
        this.load.image('platform_texture', 'assets/backgrounds/256x256.png');
        this.load.image('ground', 'assets/backgrounds/ground.png');
        this.load.image('drop', 'assets/backgrounds/drop.png');
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });

        this.load.image('speedrun_bw', 'assets/backgrounds/speedrun_bw.png');
        this.load.image('speedrun', 'assets/backgrounds/speedrun.png');

        this.load.audio('title', 'assets/music/ramp.mp3');
    }

    create() {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('title', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const worldWidth = 1600;
        const worldHeight = 6000;

        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory(),
            SENSOR: this.matter.world.nextCategory()
        };

        this.matter.world.setBounds(0, 0, worldWidth, worldHeight, 1000, true, true, true, true);
        Object.values(this.matter.world.walls).forEach((wall) => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });

        const bg = this.add.tileSprite(0, 0, worldWidth, worldHeight, 'concrete_bg');
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);

        this.finishPortal = new Graffiti(this, 800, 150, 'speedrun_bw', 'speedrun', this.cats.SENSOR);
        this.finishPortal.setScrollFactor(0.85, 0.85);

        // --- THE GAUNTLET ---
        this.createPlatform(worldWidth / 2, 5950, {
            type: 'RECT',
            width: worldWidth,
            height: 100,
            texture: 'ground'
        });

        this.createPlatform(470, 5760, { type: 'CURVE', width: 360, height: 360, friction: 0, angle: 90 });
        this.createPlatform(1130, 5760, { type: 'CURVE', width: 360, height: 360, friction: 0, angle: 0 });
        this.createPlatform(800, 5890, { type: 'RECT', width: 760, height: 120, texture: 'platform_texture' });

        // Bowl side walls
        this.createPlatform(240, 5690, { type: 'RECT', width: 290, height: 420, texture: 'platform_texture' });
        this.createPlatform(1310, 5660, { type: 'RECT', width: 120, height: 620, texture: 'platform_texture' });

        // Side guides into bowl
        this.createPlatform(390, 5810, { type: 'RAMP_RIGHT', width: 220, height: 120, friction: 0, texture: 'platform_texture' });
        this.createPlatform(1210, 5810, { type: 'RAMP_LEFT', width: 220, height: 120, friction: 0, texture: 'platform_texture' });

        this.createPlatform(610, 5480, { type: 'RECT', width: 110, height: 30, bouncy: true });
        this.createPlatform(1020, 5430, { type: 'RAMP_RIGHT', width: 280, height: 120, friction: 0, texture: 'platform_texture' });
        this.createPlatform(740, 5310, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });

        this.createPlatform(980, 5130, { type: 'RECT', width: 180, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(620, 5030, { type: 'RECT', width: 120, height: 30, bouncy: true });
        this.createPlatform(430, 4920, { type: 'RAMP_LEFT', width: 300, height: 130, friction: 0, texture: 'platform_texture' });
        this.createPlatform(850, 4780, { type: 'RECT', width: 250, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1180, 4650, { type: 'RECT', width: 130, height: 30, bouncy: true });

        this.createPlatform(500, 4470, { type: 'CURVE', width: 320, height: 320, friction: 0, angle: 90 });
        this.createPlatform(1100, 4470, { type: 'CURVE', width: 320, height: 320, friction: 0, angle: 0 });
        this.createPlatform(800, 4590, { type: 'RECT', width: 700, height: 80, texture: 'platform_texture' });

        this.createPlatform(610, 4260, { type: 'RECT', width: 240, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1010, 4140, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(770, 4010, { type: 'RECT', width: 110, height: 28, bouncy: true });
        this.createPlatform(1230, 3890, { type: 'RAMP_RIGHT', width: 260, height: 120, friction: 0, texture: 'platform_texture' });
        this.createPlatform(900, 3770, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(480, 3670, { type: 'RECT', width: 140, height: 30, bouncy: true });

        this.createPlatform(350, 3480, { type: 'RAMP_LEFT', width: 260, height: 120, friction: 0, texture: 'platform_texture' });
        this.createPlatform(690, 3340, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1050, 3220, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(780, 3100, { type: 'RECT', width: 130, height: 30, bouncy: true });
        this.createPlatform(1160, 2980, { type: 'RAMP_RIGHT', width: 260, height: 120, friction: 0, texture: 'platform_texture' });

        this.createPlatform(900, 2780, { type: 'CURVE', width: 300, height: 300, friction: 0, angle: 0 });
        this.createPlatform(520, 2670, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(960, 2540, { type: 'RECT', width: 240, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(640, 2420, { type: 'RECT', width: 130, height: 30, bouncy: true });
        this.createPlatform(370, 2300, { type: 'RAMP_LEFT', width: 250, height: 110, friction: 0, texture: 'platform_texture' });

        this.createPlatform(840, 2140, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1200, 2020, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(980, 1890, { type: 'RECT', width: 130, height: 30, bouncy: true });

        this.createPlatform(610, 1710, { type: 'CURVE', width: 260, height: 260, friction: 0, angle: 90 });
        this.createPlatform(960, 1710, { type: 'CURVE', width: 260, height: 260, friction: 0, angle: 0 });
        this.createPlatform(790, 1810, { type: 'RECT', width: 420, height: 60, texture: 'platform_texture' });

        this.createPlatform(760, 1510, { type: 'RECT', width: 220, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(970, 1360, { type: 'RECT', width: 120, height: 30, bouncy: true });
        this.createPlatform(800, 1200, { type: 'RECT', width: 300, height: 30, texture: 'platform_texture' });
        this.createPlatform(650, 980, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(950, 840, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(800, 680, { type: 'RECT', width: 320, height: 30, texture: 'platform_texture' });

        // Side practice lanes (easy recovery / mechanic training)
        // this.createPlatform(180, 5600, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 5450, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 5300, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 5150, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 5000, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 4850, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 4700, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 4550, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 4400, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 4250, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 4100, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 3950, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 3800, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 3650, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 3500, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 3350, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 3200, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 3050, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 2900, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 2750, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 2600, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 2450, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 2300, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 2150, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 2000, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 1850, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 1700, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 1550, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 1400, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 1250, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(180, 1100, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(1420, 950, { type: 'RECT', width: 200, height: 24, isOneWay: true, texture: 'drop' });
        this.createPlatform(800, 520, { type: 'RECT', width: 260, height: 24, isOneWay: true, texture: 'drop' });

        this.player = new Player(this, 800, 5830, this.cats);
        this.player.setDepth(10);

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(400, 200);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

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

        // --- DEBUG MAP VIEW (Press 'M' to toggle) ---
        const debugGrid = this.add.graphics();
        debugGrid.setDepth(1000);
        debugGrid.setVisible(false);

        for (let x = 0; x <= worldWidth; x += 100) {
            const isMajor = x % 500 === 0;
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(x, 0);
            debugGrid.lineTo(x, worldHeight);
            debugGrid.strokePath();
        }

        for (let y = 0; y <= worldHeight; y += 100) {
            const isMajor = y % 500 === 0;
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(0, y);
            debugGrid.lineTo(worldWidth, y);
            debugGrid.strokePath();
        }

        let isMapMode = false;
        this.input.keyboard.on('keydown-M', () => {
            isMapMode = !isMapMode;

            if (isMapMode) {
                this.cameras.main.stopFollow();

                const fitWidthZoom = this.scale.width / worldWidth;
                const fitHeightZoom = this.scale.height / worldHeight;
                const zoomLevel = Math.min(fitWidthZoom, fitHeightZoom);
                this.cameras.main.setZoom(zoomLevel);

                this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
                debugGrid.setVisible(true);
            } else {
                this.cameras.main.setZoom(1);
                this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
                this.cameras.main.setDeadzone(400, 200);
                this.cameras.main.setFollowOffset(0, 100);
                this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
                debugGrid.setVisible(false);
            }
        });
    }

    createPlatform(x, y, config) {
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

        const bodyOptions = {
            isStatic: true,
            friction,
            restitution: bouncy ? 1.2 : 0,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;

        if (type === 'RECT') {
            body = this.matter.add.rectangle(x, y, width, height, bodyOptions);
        }
        else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            const verts = [
                { x: width / 2, y: height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: -height / 2 }
            ];
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            const verts = [
                { x: -width / 2, y: -height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: height / 2 }
            ];
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'CURVE') {
            const segments = 32;
            const verts = [{ x: width / 2, y: height / 2 }];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = -width / 2 + (Math.cos(t * Math.PI / 2) * width);
                const py = -height / 2 + (Math.sin(t * Math.PI / 2) * height);
                verts.push({ x: px, y: py });
            }
            verts.push({ x: width / 2, y: height / 2 });
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'CIRCLE') {
            body = this.matter.add.circle(x, y, radius, bodyOptions);
        }

        if (!body) {
            return;
        }

        this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
        this.matter.body.setPosition(body, { x, y });

        if (isOneWay) {
            body.collisionFilter.category = this.cats.ONE_WAY;
        } else {
            body.collisionFilter.category = this.cats.GROUND;
        }

        if (bouncy) {
            const bouncyWidth = type === 'CIRCLE' ? radius * 2 : width;
            const bouncyHeight = type === 'CIRCLE' ? radius * 2 : height;
            const bumper = this.add.rectangle(x, y, bouncyWidth, bouncyHeight, 0xff2ebd, 1.0);
            bumper.setDepth(-0.8);
            bumper.setAngle(angle);
            return;
        }

        if (isOneWay || type === 'RECT') {
            TextureFactory.styleRectangle(this, x, y, width, height, body, texture);
        }
        else if (
            type === 'CURVE' ||
            type === 'RAMP_LEFT' || type === 'ramp_left' ||
            type === 'RAMP_RIGHT' || type === 'ramp_right'
        ) {
            TextureFactory.styleCurve(this, body, texture);
        }
        else if (type === 'CIRCLE') {
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

        if (!this.timerStopped && this.finishPortal.isPlayerTouching) {
            this.timerStopped = true;
            this.finalTimeMs = this.time.now - this.timerStartedAt;
            this.timerText.setColor('#5dff8b');
        }

        const elapsed = this.timerStopped ? this.finalTimeMs : (this.time.now - this.timerStartedAt);
        const seconds = Math.floor(elapsed / 1000);
        const milliseconds = Math.floor(elapsed % 1000).toString().padStart(3, '0');
        this.timerText.setText(`${seconds}.${milliseconds}`);
    }
}
