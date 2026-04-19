import Player from './Player.js';
import Zombie from './Zombie.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { isDebugMode } from './GameState.js';
import { CATS } from './CollisionCategories.js';

export default class ZombieHordeScene extends Phaser.Scene {
    constructor() {
        super('ZombieHordeScene');
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
        this.load.image('zombie_goal_color', 'assets/backgrounds/zombie-goal.png');
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });
        this.load.spritesheet('zombie_wall_graffiti', 'assets/backgrounds/atlas-zombies.png', {
            frameWidth: 256,
            frameHeight: 256
        });

        this.load.image('logo_portal_bw', 'assets/backgrounds/logo-bw.png');
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

        const cachedLevel = this.cache.json.get('zombie_horde_level');
        const hasInjectedLevel = Array.isArray(data.levelPlatforms);
        const hasCachedLevel = !!cachedLevel;

        this.worldWidth = hasInjectedLevel
            ? (data.worldWidth || 19200)
            : (hasCachedLevel ? (cachedLevel.worldWidth || 19200) : 19200);
        this.worldHeight = hasInjectedLevel
            ? (data.worldHeight || 900)
            : (hasCachedLevel ? (cachedLevel.worldHeight || 900) : 900);

        this.spawnPoint = hasInjectedLevel
            ? (data.spawnPoint || { x: 180, y: 700 })
            : (hasCachedLevel ? (cachedLevel.spawn || { x: 180, y: 700 }) : { x: 180, y: 700 });
        this.returnPortalPos = hasInjectedLevel
            ? (data.returnPortalPos || { x: 100, y: 700 })
            : (hasCachedLevel ? (cachedLevel.returnPortal || { x: 100, y: 700 }) : { x: 100, y: 700 });

        // Keep the return logo close to spawn for quick exit back to Hub.
        this.returnPortalPos = {
            x: this.spawnPoint.x - 80,
            y: this.spawnPoint.y
        };

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

        this.cats = CATS;

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

        const viewW = this.scale.width;
        const viewH = this.scale.height;
        const pxFactor = 0.85;
        const followOffY = 100;
        const spawnCamY = Phaser.Math.Clamp(this.spawnPoint.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        const parallaxCompY = spawnCamY * (1 - pxFactor);

        this.createZombieWallDecorations(pxFactor, parallaxCompY);

        this.ensureGrayscaleTexture('zombie_goal_color', 'zombie_goal_bw');

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

        this.returnPortal = new Graffiti(this, this.returnPortalPos.x, this.returnPortalPos.y, 'logo_portal_bw', 'logo_portal', this.cats.SENSOR);
        this.returnPortal.setScrollFactor(1, 1);
        const retCamX = Phaser.Math.Clamp(this.returnPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const retCamY = Phaser.Math.Clamp(this.returnPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);
        this.returnPortal.enableParallaxVisual(0.85, 0.85, {
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
            const z = new Zombie(this, zx, zy);
            this.zombies.push(z);
        }

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(400, 200);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.setupAnims();

        this.hintText = this.add.text(16, 16, '', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(2000);

        this.runTimeMs = 0;
        this.goalReached = false;
        this.timerText = this.add.text(this.scale.width / 2, 16, this.formatTimeMs(this.runTimeMs), {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        });
        this.timerText.setOrigin(0.5, 0);
        this.timerText.setScrollFactor(0);
        this.timerText.setDepth(2000);

        this.debugLabel = this.add.text(16, 700, 'Debug mode', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(2000).setVisible(isDebugMode());

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

        this._mapBuffer = '';
        this.input.keyboard.on('keydown', (event) => {
            const k = (event.key || '').toLowerCase();
            if (!/^[a-z]$/.test(k)) { this._mapBuffer = ''; return; }
            this._mapBuffer += k;
            if (this._mapBuffer.length > 3) this._mapBuffer = this._mapBuffer.slice(-3);
            if (this._mapBuffer !== 'map') return;
            this._mapBuffer = '';
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
                    returnPortalPos: this.returnPortalPos
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
            texture = 'platform_texture'
        } = config;

        const renderWidth = type === 'CIRCLE' ? radius * 2 : width;
        const renderHeight = type === 'CIRCLE' ? radius * 2 : height;
        const centerX = x + (renderWidth / 2);
        const centerY = y + (renderHeight / 2);

        const bodyOptions = {
            isStatic: true,
            friction,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;
        if (type === 'RECT') {
            body = this.matter.add.rectangle(centerX, centerY, width, height, bodyOptions);
        } else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            const verts = [
                { x: width / 2, y: height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: -height / 2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        } else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            const verts = [
                { x: -width / 2, y: -height / 2 },
                { x: -width / 2, y: height / 2 },
                { x: width / 2, y: height / 2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
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

        this.editorCoords = this.add.text(16, 44, 'World: 0, 0', {
            fontFamily: 'monospace',
            fontSize: '34px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.editorCoords.setBackgroundColor('rgba(0, 0, 0, 0.75)');
        this.editorCoords.setPadding(10, 8, 10, 8);
        this.editorCoords.setScrollFactor(0);
        this.editorCoords.setDepth(3000);

        this._editorPointerMove = (pointer) => {
            const cam = this.cameras.main;
            const worldX = Math.round((pointer.x / cam.zoom) + cam.worldView.x);
            const worldY = Math.round((pointer.y / cam.zoom) + cam.worldView.y);
            if (this.editorCoords) {
                this.editorCoords.setText(`World: ${worldX}, ${worldY}`);
            }
        };
        this.input.on('pointermove', this._editorPointerMove);

        this.editorInspect = this.add.text(16, 72, '', {
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
            handle.setFillStyle(0xffcc00, 0.08);
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

        this.refreshEditorHandleVisuals();

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

        if (this.editorCoords) {
            this.editorCoords.destroy();
            this.editorCoords = null;
        }
        if (this._editorPointerMove) {
            this.input.off('pointermove', this._editorPointerMove);
            this._editorPointerMove = null;
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

        if (this.editorCoords) {
            this.editorCoords.setScale(1 / zoom);
            this.editorCoords.setPosition(16 / zoom, 50 / zoom);
        }

        if (this.editorInspect) {
            this.editorInspect.setScale(1 / zoom);
            this.editorInspect.setPosition(16 / zoom, 84 / zoom);
        }

        this.refreshEditorHandleVisuals();
    }

    refreshEditorHandleVisuals() {
        if (!this.editorHandles || this.editorHandles.length === 0) {
            return;
        }

        const zoom = this.cameras.main.zoom || 1;
        const strokeWidth = Phaser.Math.Clamp(3 / zoom, 3, 20);
        const fillAlpha = zoom < 0.25 ? 0.2 : 0.08;

        this.editorHandles.forEach((handle) => {
            handle.setStrokeStyle(strokeWidth, 0xffcc00, 1);
            handle.setFillStyle(0xffcc00, fillAlpha);
        });
    }

    createZombieWallDecorations(scrollFactor = 0.85, parallaxCompY = 0) {
        const floorDef = this.levelPlatforms.find((def) => def?.config?.texture === 'ground') || null;
        const floorY = floorDef?.y ?? 800;

        const rng = Phaser.Math.RND;
        const frameCount = 8;
        const zoneWidth = Math.max(this.scale.width || 1280, 900);
        const usedFramesByZone = new Map();

        const pickUniqueFrameForX = (x) => {
            const zoneIndex = Math.floor(x / zoneWidth);
            if (!usedFramesByZone.has(zoneIndex)) {
                usedFramesByZone.set(zoneIndex, new Set());
            }

            const used = usedFramesByZone.get(zoneIndex);
            if (used.size >= frameCount) {
                return null;
            }

            const available = [];
            for (let i = 0; i < frameCount; i++) {
                if (!used.has(i)) {
                    available.push(i);
                }
            }

            const frame = available[rng.between(0, available.length - 1)];
            used.add(frame);
            return frame;
        };

        const addDecoration = (x) => {
            const frame = pickUniqueFrameForX(x);
            if (frame == null) {
                return;
            }

            const scale = rng.realInRange(0.55, 1.45);
            const halfSize = 128 * scale;

            let y;
            const verticalBandRoll = rng.realInRange(0, 1);
            if (verticalBandRoll < 0.35) {
                // Touching the floor/wall seam.
                y = floorY - halfSize + rng.realInRange(-6, 8);
            } else if (verticalBandRoll < 0.8) {
                // Close to ground.
                y = floorY - halfSize - rng.realInRange(25, 160);
            } else {
                // Some higher marks for layering.
                y = floorY - halfSize - rng.realInRange(170, 300);
            }

            y = Phaser.Math.Clamp(y, 110, floorY - 20);

            // About one quarter fully opaque, rest varied/faded.
            const alpha = rng.realInRange(0, 1) < 0.25
                ? 1
                : rng.realInRange(0.18, 0.85);

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
            // Natural spacing variation along the wall.
            x += rng.between(190, 470);

            // Drop about half overall to reduce wall clutter.
            if (rng.realInRange(0, 1) < 0.5) {
                continue;
            }

            addDecoration(x + rng.between(-40, 40));

            // Optional smaller clusters for organic density.
            if (rng.realInRange(0, 1) < 0.2) {
                addDecoration(x + rng.between(70, 200));
                if (rng.realInRange(0, 1) < 0.25) {
                    addDecoration(x + rng.between(210, 330));
                }
            }
        }
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
            returnPortal: this.returnPortalPos,
            platforms: exportPlatforms
        };

        const text = JSON.stringify(payload, null, 2);
        console.log('ZombieHorde level JSON:\n', text);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showEditorToast('ZombieHorde JSON copied to clipboard'))
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
            fontSize: '20px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.editorToast.setBackgroundColor('rgba(0, 0, 0, 0.75)');
        this.editorToast.setPadding(8, 6, 8, 6);
        this.editorToast.setScrollFactor(0);
        this.editorToast.setDepth(3502);
        this.positionEditorToastFixed();

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

    formatTimeMs(ms) {
        const clamped = Math.max(0, ms);
        const seconds = Math.floor(clamped / 1000);
        const milliseconds = Math.floor(clamped % 1000).toString().padStart(3, '0');
        return `${seconds}.${milliseconds}`;
    }

    ensureGrayscaleTexture(sourceKey, targetKey) {
        if (this.textures.exists(targetKey)) {
            return;
        }

        const source = this.textures.get(sourceKey)?.getSourceImage();
        if (!source) {
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(source, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const lum = Math.round((0.299 * r) + (0.587 * g) + (0.114 * b));
            pixels[i] = lum;
            pixels[i + 1] = lum;
            pixels[i + 2] = lum;
        }

        ctx.putImageData(imageData, 0, 0);
        this.textures.addCanvas(targetKey, canvas);
    }

    update(time, delta) {
        this.player.update();
        if (this.zombies) {
            for (const z of this.zombies) {
                z.update(time, delta);
            }
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
