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
        this.load.json('silly_speedrun_level', 'assets/levels/sillySpeedRunLevel.json');

        this.load.audio('title', 'assets/music/ramp.mp3');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('title', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const cachedLevel = this.cache.json.get('silly_speedrun_level');
        const hasInjectedLevel = Array.isArray(data.levelPlatforms);
        const hasCachedLevel = !!cachedLevel;

        this.worldWidth = hasInjectedLevel
            ? (data.worldWidth || 1600)
            : (hasCachedLevel ? (cachedLevel.worldWidth || 1600) : 1600);
        this.worldHeight = hasInjectedLevel
            ? (data.worldHeight || 6000)
            : (hasCachedLevel ? (cachedLevel.worldHeight || 6000) : 6000);

        this.spawnPoint = hasInjectedLevel
            ? (data.spawnPoint || { x: 800, y: 5830 })
            : (hasCachedLevel ? (cachedLevel.spawn || { x: 800, y: 5830 }) : { x: 800, y: 5830 });
        this.finishPortalPos = hasInjectedLevel
            ? (data.finishPortalPos || { x: 800, y: 150 })
            : (hasCachedLevel ? (cachedLevel.finishPortal || { x: 800, y: 150 }) : { x: 800, y: 150 });

        const sourcePlatforms = hasInjectedLevel
            ? data.levelPlatforms
            : (Array.isArray(cachedLevel?.platforms) ? cachedLevel.platforms : []);
        this.levelPlatforms = sourcePlatforms.map((def) => ({ x: def.x, y: def.y, config: { ...def.config } }));
        this.legacyCenteredInput = false;
        this.captureLevelData = false;
        this.isMapMode = false;
        this.editorHandles = [];
        this.editorHud = null;

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

        this.finishPortal = new Graffiti(this, this.finishPortalPos.x, this.finishPortalPos.y, 'speedrun_bw', 'speedrun', this.cats.SENSOR);
        this.finishPortal.setScrollFactor(0.85, 0.85);

        // --- THE GAUNTLET ---
        this.levelPlatforms.forEach((def) => {
            this.createPlatform(def.x, def.y, def.config);
        });

        this.captureLevelData = false;

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

        // --- DEBUG MAP VIEW (Press 'M' to toggle) ---
        const debugGrid = this.add.graphics();
        debugGrid.setDepth(1000);
        debugGrid.setVisible(false);

        for (let x = 0; x <= this.worldWidth; x += 100) {
            const isMajor = x % 500 === 0;
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(x, 0);
            debugGrid.lineTo(x, this.worldHeight);
            debugGrid.strokePath();
        }

        for (let y = 0; y <= this.worldHeight; y += 100) {
            const isMajor = y % 500 === 0;
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(0, y);
            debugGrid.lineTo(this.worldWidth, y);
            debugGrid.strokePath();
        }

        this.input.keyboard.on('keydown-M', () => {
            this.isMapMode = !this.isMapMode;

            if (this.isMapMode) {
                this.cameras.main.stopFollow();

                const fitWidthZoom = this.scale.width / this.worldWidth;
                const fitHeightZoom = this.scale.height / this.worldHeight;
                const zoomLevel = Math.min(fitWidthZoom, fitHeightZoom);
                this.cameras.main.setZoom(zoomLevel);

                this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);
                debugGrid.setVisible(true);
                this.enterMapEditorMode();
            } else {
                this.exitMapEditorMode();
                this.cameras.main.setZoom(1);
                this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
                this.cameras.main.setDeadzone(400, 200);
                this.cameras.main.setFollowOffset(0, 100);
                this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
                debugGrid.setVisible(false);

                this.scene.restart({
                    worldWidth: this.worldWidth,
                    worldHeight: this.worldHeight,
                    levelPlatforms: this.levelPlatforms,
                    spawnPoint: this.spawnPoint,
                    finishPortalPos: this.finishPortalPos
                });
            }
        });

        this.input.keyboard.on('keydown-S', () => {
            if (this.isMapMode) {
                this.exportLevelData();
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

        const renderWidth = type === 'CIRCLE' ? radius * 2 : width;
        const renderHeight = type === 'CIRCLE' ? radius * 2 : height;

        let topLeftX = x;
        let topLeftY = y;
        if (this.legacyCenteredInput) {
            topLeftX = x - (renderWidth / 2);
            topLeftY = y - (renderHeight / 2);
        }

        if (this.captureLevelData) {
            this.levelPlatforms.push({
                x: topLeftX,
                y: topLeftY,
                config: { ...config }
            });
        }

        const centerX = topLeftX + (renderWidth / 2);
        const centerY = topLeftY + (renderHeight / 2);

        const bodyOptions = {
            isStatic: true,
            friction,
            restitution: bouncy ? 1.2 : 0,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;

        if (type === 'RECT') {
            body = this.matter.add.rectangle(centerX, centerY, width, height, bodyOptions);
        }
        else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            const verts = [
                { x: width / 2, y: height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: -height / 2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        }
        else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            const verts = [
                { x: -width / 2, y: -height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: height / 2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
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
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        }
        else if (type === 'CIRCLE') {
            body = this.matter.add.circle(centerX, centerY, radius, bodyOptions);
        }

        if (!body) {
            return;
        }

        this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
        this.matter.body.setPosition(body, { x: centerX, y: centerY });

        if (isOneWay) {
            body.collisionFilter.category = this.cats.ONE_WAY;
        } else {
            body.collisionFilter.category = this.cats.GROUND;
        }

        if (bouncy) {
            const bumper = this.add.rectangle(centerX, centerY, renderWidth, renderHeight, 0xff2ebd, 1.0);
            bumper.setDepth(-0.8);
            bumper.setAngle(angle);
            return;
        }

        if (isOneWay || type === 'RECT') {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, texture);
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

    enterMapEditorMode() {
        this.destroyEditorHandles();

        this.editorHud = this.add.text(16, 16, 'Editor: drag platforms | S = export JSON | M = apply + exit', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.editorHud.setScrollFactor(0);
        this.editorHud.setDepth(3000);

        this.levelPlatforms.forEach((def) => {
            const cfg = def.config || {};
            const width = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.width || 100);
            const height = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.height || 100);

            const handle = this.add.rectangle(def.x, def.y, width, height);
            handle.setOrigin(0, 0);
            handle.setStrokeStyle(3, 0xffcc00, 1);
            handle.setFillStyle(0x000000, 0.001);
            handle.setDepth(2500);
            handle.setAngle(cfg.angle || 0);
            handle.setInteractive({ cursor: 'move' });
            this.input.setDraggable(handle);

            handle.__defRef = def;
            this.editorHandles.push(handle);
        });

        this.input.on('drag', this.onEditorDrag, this);
    }

    exitMapEditorMode() {
        this.input.off('drag', this.onEditorDrag, this);
        this.destroyEditorHandles();
    }

    destroyEditorHandles() {
        if (this.editorHud) {
            this.editorHud.destroy();
            this.editorHud = null;
        }

        if (this.editorToast) {
            this.editorToast.destroy();
            this.editorToast = null;
        }

        if (this.editorHandles.length > 0) {
            this.editorHandles.forEach((handle) => handle.destroy());
            this.editorHandles = [];
        }
    }

    onEditorDrag(pointer, gameObject, dragX, dragY) {
        if (!this.isMapMode || !gameObject.__defRef) {
            return;
        }

        const snappedX = Math.round(dragX / 10) * 10;
        const snappedY = Math.round(dragY / 10) * 10;
        gameObject.setPosition(snappedX, snappedY);
        gameObject.__defRef.x = snappedX;
        gameObject.__defRef.y = snappedY;
    }

    exportLevelData() {
        const payload = {
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight,
            spawn: this.spawnPoint,
            finishPortal: this.finishPortalPos,
            platforms: this.levelPlatforms
        };

        const text = JSON.stringify(payload, null, 2);
        console.log('SillySpeedRun level JSON:\n', text);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showEditorToast('Silly JSON copied to clipboard'))
                .catch(() => this.showEditorToast('Exported to console (clipboard blocked)'));
        } else {
            this.showEditorToast('Exported to console (clipboard unavailable)');
        }
    }

    showEditorToast(message) {
        if (this.editorToast) {
            this.editorToast.destroy();
            this.editorToast = null;
        }

        this.editorToast = this.add.text(16, 44, message, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.editorToast.setScrollFactor(0);
        this.editorToast.setDepth(3001);

        this.time.delayedCall(1600, () => {
            if (this.editorToast) {
                this.editorToast.destroy();
                this.editorToast = null;
            }
        });
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
