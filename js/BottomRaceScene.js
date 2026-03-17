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

        this.load.image('bottomrace_wall_texture', 'assets/backgrounds/256x256.png');
        this.load.image('bottomrace_platform_texture', 'assets/backgrounds/hubworld_background.png');
        this.load.image('ground', 'assets/backgrounds/ground.png');
        this.load.image('drop', 'assets/backgrounds/drop.png');
        this.load.image('bottomrace_drop_light', 'assets/backgrounds/drop-light.png');
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });

        this.load.image('silly_top_bw', 'assets/backgrounds/silly_top_bw.png');
        this.load.image('silly_top', 'assets/backgrounds/silly_top.png');
        this.load.image('logo_portal_bw', 'assets/backgrounds/logo-bw.png');
        this.load.image('logo_portal', 'assets/backgrounds/logo.png');
        this.load.json('bottom_race_level', 'assets/levels/bottomRaceLevel.json');

        this.load.audio('title', 'assets/music/ramp.mp3');
    }

    create(data = {}) {
        this.sound.stopAll();
        this.bgmusic = this.sound.add('title', { volume: 0.9, loop: true });
        this.bgmusic.play();

        const cachedLevel = this.cache.json.get('bottom_race_level');
        const hasInjectedLevel = Array.isArray(data.levelPlatforms);
        const hasCachedLevel = !!cachedLevel;

        this.worldWidth = hasInjectedLevel
            ? (data.worldWidth || 1600)
            : (hasCachedLevel ? (cachedLevel.worldWidth || 1600) : 1600);
        this.worldHeight = hasInjectedLevel
            ? (data.worldHeight || 6000)
            : (hasCachedLevel ? (cachedLevel.worldHeight || 6000) : 6000);

        this.spawnPoint = hasInjectedLevel
            ? (data.spawnPoint || { x: 800, y: 190 })
            : (hasCachedLevel ? (cachedLevel.spawn || { x: 800, y: 190 }) : { x: 800, y: 190 });
        this.returnPortalPos = hasInjectedLevel
            ? (data.returnPortalPos || { x: 620, y: 210 })
            : (hasCachedLevel ? (cachedLevel.returnPortal || { x: 620, y: 210 }) : { x: 620, y: 210 });
        this.goalPortalPos = hasInjectedLevel
            ? (data.goalPortalPos || { x: 800, y: 5750 })
            : (hasCachedLevel ? (cachedLevel.goalPortal || { x: 800, y: 5750 }) : { x: 800, y: 5750 });

        const sourcePlatforms = hasInjectedLevel
            ? data.levelPlatforms
            : (Array.isArray(cachedLevel?.platforms) ? cachedLevel.platforms : []);
        this.levelPlatforms = sourcePlatforms.map((def) => ({
            ...def,
            x: def.x,
            y: def.y,
            config: { ...def.config }
        }));
        this.legacyCenteredInput = false;
        this.captureLevelData = false;
        this.isMapMode = false;
        this.editorHandles = [];
        this.editorHud = null;
        this.editorInspect = null;
        this.editorToast = null;

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

        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'bottomrace_wall_texture');
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
                this.createPlatform(def.x, def.y, def.config, def);
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
                    returnPortalPos: this.returnPortalPos,
                    goalPortalPos: this.goalPortalPos
                });
            }
        });

        this.input.keyboard.on('keydown-S', () => {
            if (this.isMapMode) {
                this.exportLevelData();
            }
        });
    }

    createPlatform(x, y, config, defRef = null) {
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
            texture = 'bottomrace_platform_texture'
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

        if (defRef) {
            const minX = body.bounds.min.x;
            const minY = body.bounds.min.y;
            const boundsWidth = body.bounds.max.x - body.bounds.min.x;
            const boundsHeight = body.bounds.max.y - body.bounds.min.y;
            defRef.__editorBounds = {
                x: minX,
                y: minY,
                width: boundsWidth,
                height: boundsHeight
            };
        }

        body.collisionFilter.category = isOneWay ? this.cats.ONE_WAY : this.cats.GROUND;

        if (bouncy) {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, 'bottomrace_platform_texture');
            return;
        }

        const renderTexture = texture === 'platform_texture'
            ? 'bottomrace_platform_texture'
            : (texture === 'drop' ? 'bottomrace_drop_light' : texture);

        if (isOneWay || type === 'RECT') {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, renderTexture);
        } else if (
            type === 'CURVE' ||
            type === 'RAMP_LEFT' || type === 'ramp_left' ||
            type === 'RAMP_RIGHT' || type === 'ramp_right'
        ) {
            TextureFactory.styleCurve(this, body, renderTexture);
        } else if (type === 'CIRCLE') {
            TextureFactory.styleCircle(this, body, renderTexture);
        }
    }

    enterMapEditorMode() {
        this.destroyEditorHandles();

        this.editorHud = this.add.text(16, 16, 'Editor: drag platforms | hover = inspect | S = export JSON | M = apply + exit', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.editorHud.setScrollFactor(0);
        this.editorHud.setDepth(3000);
        this.refreshEditorHudScale();

        this.editorInspect = this.add.text(16, 44, '', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.editorInspect.setBackgroundColor('rgba(0, 0, 0, 0.75)');
        this.editorInspect.setPadding(8, 6, 8, 6);
        this.editorInspect.setVisible(false);
        this.editorInspect.setScrollFactor(0);
        this.editorInspect.setDepth(3501);

        this.levelPlatforms.forEach((def, index) => {
            const cfg = def.config || {};
            const fallbackWidth = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.width || 100);
            const fallbackHeight = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.height || 100);
            const hasBodyBounds = !!def.__editorBounds;
            const handleX = hasBodyBounds ? def.__editorBounds.x : def.x;
            const handleY = hasBodyBounds ? def.__editorBounds.y : def.y;
            const handleWidth = hasBodyBounds ? def.__editorBounds.width : fallbackWidth;
            const handleHeight = hasBodyBounds ? def.__editorBounds.height : fallbackHeight;

            const handle = this.add.rectangle(handleX, handleY, handleWidth, handleHeight);
            handle.setOrigin(0, 0);
            handle.setStrokeStyle(3, 0xffcc00, 1);
            handle.setFillStyle(0x000000, 0.001);
            handle.setDepth(2500);
            handle.setAngle(hasBodyBounds ? 0 : (cfg.angle || 0));
            handle.setInteractive({ cursor: 'move' });
            this.input.setDraggable(handle);

            handle.__defRef = def;
            handle.__platformIndex = index;
            handle.__xOffset = def.x - handleX;
            handle.__yOffset = def.y - handleY;
            handle.on('pointerover', () => {
                this.showHandleInspect(handle.__defRef, handle.__platformIndex);
            });
            handle.on('pointerout', () => {
                this.hideHandleInspect();
            });
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

        if (this.editorInspect) {
            this.editorInspect.destroy();
            this.editorInspect = null;
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
        const offsetX = gameObject.__xOffset || 0;
        const offsetY = gameObject.__yOffset || 0;
        gameObject.__defRef.x = snappedX + offsetX;
        gameObject.__defRef.y = snappedY + offsetY;

        gameObject.__defRef.__editorBounds = {
            x: snappedX,
            y: snappedY,
            width: gameObject.width,
            height: gameObject.height
        };
        this.showHandleInspect(gameObject.__defRef, gameObject.__platformIndex);
    }

    showHandleInspect(def, index) {
        if (!this.editorInspect) {
            return;
        }

        const cfg = def?.config || {};
        const idText = def?.id != null ? String(def.id) : String((index || 0) + 1);
        const remark = def?.remark || cfg?.remark || '-';
        this.editorInspect.setText(`Object #${(index || 0) + 1} | id: ${idText} | type: ${cfg.type || 'RECT'} | remark: ${remark}`);
        this.editorInspect.setVisible(true);
        this.refreshInspectScale();
        this.positionInspectFixed();
    }

    hideHandleInspect() {
        if (this.editorInspect) {
            this.editorInspect.setVisible(false);
            this.editorInspect.setText('');
        }
    }

    positionInspectFixed() {
        if (!this.editorInspect) {
            return;
        }

        this.refreshInspectScale();

        const zoom = this.cameras.main.zoom || 1;
        const fixedX = 16;
        const fixedY = 54;
        this.editorInspect.setPosition(fixedX / zoom, fixedY / zoom);
    }

    refreshInspectScale() {
        if (!this.editorInspect) {
            return;
        }

        const zoom = this.cameras.main.zoom || 1;
        this.editorInspect.setScale(1 / zoom);
    }

    refreshEditorHudScale() {
        if (!this.editorHud) {
            return;
        }

        const zoom = this.cameras.main.zoom || 1;
        this.editorHud.setScale(1 / zoom);
        this.editorHud.setPosition(16 / zoom, 16 / zoom);
    }

    positionEditorToastFixed() {
        if (!this.editorToast) {
            return;
        }

        const zoom = this.cameras.main.zoom || 1;
        this.editorToast.setScale(1 / zoom);
        this.editorToast.setPosition(16 / zoom, 98 / zoom);
    }

    exportLevelData() {
        const exportPlatforms = this.levelPlatforms.map((def, index) => {
            const existingRemark = def?.remark ?? def?.config?.remark;
            return {
                ...def,
                id: def?.id ?? (index + 1),
                remark: existingRemark ?? ''
            };
        });

        const payload = {
            worldWidth: this.worldWidth,
            worldHeight: this.worldHeight,
            spawn: this.spawnPoint,
            goalPortal: this.goalPortalPos,
            returnPortal: this.returnPortalPos,
            platforms: exportPlatforms
        };

        const text = JSON.stringify(payload, null, 2);
        console.log('BottomRace level JSON:\n', text);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showEditorToast('BottomRace JSON copied to clipboard'))
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
