import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { isDebugMode } from './GameState.js';
import { CATS } from './CollisionCategories.js';

const SHEET_URL = 'https://script.google.com/macros/s/AKfycbx2KbZOBAP6JI_gAFdrPjd3BFiQD3bu_k5WB__IR_5FtqILujrZfmHi5we0Mm2yIFud/exec';

export default class PrizePointScene extends Phaser.Scene {
    constructor() {
        super('PrizePointScene');
        this.highestLineStorageKey = 'skate_hustle_prize_point_best_line_y';
        this.highestLineBaselineStorageKey = 'skate_hustle_prize_point_line_baseline_y';
        this.bestPixelsUpStorageKey = 'skate_hustle_prize_point_best_pixels_up';
        this.bestSecondsRemainingStorageKey = 'skate_hustle_prize_point_best_seconds_remaining';
        this.leaderboardStorageKey = 'skate_hustle_prize_point_leaderboard';

        // Atlas grid: 8 cols x 6 rows, 560x423 image
        this.atlasCols = 8;
        this.atlasRows = 6;
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
        this.load.image('sponsor_graffiti_1', 'assets/backgrounds/sponsor-graffiti-1.png');
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });

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

        // --- INPUT PHASE: collect player info before gameplay ---
        this.inputPhase = 'intro'; // 'intro' -> 'tag' -> 'nameclass' -> 'playing'
        this.playerTag = '';
        this.playerFullName = '';
        this.playerClass = '';
        this.inputBuffer = '';
        this.maxTagLen = 7;
        this.inputOverlayElements = [];
        this.gameplayPaused = true;

        const cachedLevel = this.cache.json.get('prize_point_level');
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
        this.returnPortalPos = hasInjectedLevel
            ? (data.returnPortalPos || { x: 600, y: 5705 })
            : (hasCachedLevel ? (cachedLevel.returnPortal || { x: 600, y: 5705 }) : { x: 600, y: 5705 });

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

        this.cats = CATS;

        this.matter.world.setBounds(0, 0, this.worldWidth, this.worldHeight, 1000, true, true, true, true);
        Object.values(this.matter.world.walls).forEach((wall) => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });

        this.parkBackground = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'concrete_bg');
        this.parkBackground.setOrigin(0, 0);
        this.parkBackground.setScrollFactor(0.85, 0.85);
        this.parkBackground.setDepth(-10);

        // Compensate visual proxy positions for parallax in tall world
        const viewW = this.scale.width;
        const viewH = this.scale.height;
        const pxFactor = 0.85;
        const followOffY = 100;

        const finCamX = Phaser.Math.Clamp(this.finishPortalPos.x - viewW / 2, 0, this.worldWidth - viewW);
        const finCamY = Phaser.Math.Clamp(this.finishPortalPos.y + followOffY - viewH / 2, 0, this.worldHeight - viewH);

        this.ensureGrayscaleTexture('prize_point_color', 'prize_point_bw');
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

        // --- THE GAUNTLET ---
        this.levelPlatforms.forEach((def) => {
            try {
                this.createPlatform(def.x, def.y, def.config, def);
            } catch (err) {
                console.error('Failed to create prize point platform:', def, err);
            }
        });

        this.captureLevelData = false;

        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
        this.player.setDepth(10);

        this.resetWord = 'reset';
        this.resetBuffer = '';
        this.requestResetHighestLine = false;
        this._resetWordListener = (event) => {
            const key = (event?.key || '').toLowerCase();
            if (!/^[a-z]$/.test(key)) {
                this.resetBuffer = '';
                return;
            }

            this.resetBuffer += key;
            if (this.resetBuffer.length > this.resetWord.length) {
                this.resetBuffer = this.resetBuffer.slice(-this.resetWord.length);
            }

            if (this.resetBuffer === this.resetWord) {
                this.requestResetHighestLine = true;
                this.resetBuffer = '';
            }
        };
        this.input.keyboard.on('keydown', this._resetWordListener);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown', this._resetWordListener);
        });

        this.highestLineGraphics = this.add.graphics();
        this.highestLineGraphics.setDepth(1500);
        this.highestLineGraphics.setVisible(false);
        // Reset green line each run — always starts at player spawn
        this.highestLineBaselineY = this.getPlayerBottomY();
        this.highestLineY = this.highestLineBaselineY;
        this.redrawHighestLine();

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(400, 200);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.setupAnims();

        this.countdownDurationMs = 120000;
        this.remainingTimeMs = this.countdownDurationMs;
        this.runEnded = false;
        this.goalReached = false;
        this.finalRemainingTimeMs = 0;
        this.endScreenText = null;
        this.endScreenElements = [];

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

        this.debugLabel = this.add.text(16, 700, 'Debug mode', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(2000).setVisible(isDebugMode());

        // --- DEBUG MAP VIEW (Press 'M' to toggle) ---
        const debugGrid = this.add.graphics();
        debugGrid.setDepth(1000);
        debugGrid.setVisible(false);
        this.debugGrid = debugGrid;

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
            if (this.inputPhase === 'intro' || this.inputPhase === 'tag' || this.inputPhase === 'nameclass') return;
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
                    finishPortalPos: this.finishPortalPos,
                    returnPortalPos: this.returnPortalPos
                });
            }
        });

        this.input.keyboard.on('keydown-S', () => {
            if (this.isMapMode) {
                this.exportLevelData();
            }
        });

        // Show leaderboard first, then ENTER to start entering a new run tag/name.
        if (data && data.skipIntro) {
            this.setGameplayVisibility(false);
            this.inputPhase = 'tag';
            this.gameplayPaused = true;
            if (this.matter?.world?.pause) {
                this.matter.world.pause();
            }
            this.showInputOverlay();
        } else {
            this.showEntryHighscoreOverlay();
        }
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

        if (isOneWay) {
            body.collisionFilter.category = this.cats.ONE_WAY;
        } else {
            body.collisionFilter.category = this.cats.GROUND;
        }

        if (bouncy) {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, 'ground');
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
            fontSize: '20px',
            color: '#ffff00',
            stroke: '#000000',
            strokeThickness: 4
        });
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
            finishPortal: this.finishPortalPos,
            returnPortal: this.returnPortalPos,
            platforms: exportPlatforms
        };

        const text = JSON.stringify(payload, null, 2);
        console.log('PrizePoint level JSON:\n', text);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showEditorToast('PrizePoint JSON copied to clipboard'))
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

    // --- INPUT PHASE UI ---
    setGameplayVisibility(visible) {
        const snapshot = [...this.children.list];
        snapshot.forEach((child) => {
            if (child === this.parkBackground) {
                return;
            }
            if (this.inputOverlayElements.includes(child)) {
                return;
            }
            if (this.endScreenElements.includes(child)) {
                return;
            }
            if (child instanceof Graffiti) {
                // Graffiti uses a hidden sensor sprite + visualProxy image.
                // Keep sensor hidden always so it never renders in front.
                child.setVisible(false);
                if (child.visualProxy) {
                    child.visualProxy.setVisible(visible);
                }
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

        if (this.matter?.world?.pause) {
            this.matter.world.pause();
        }

        // Intro must show only concrete wall + highscore elements.
        this.setGameplayVisibility(false);

        this.inputPhase = 'intro';
        this.gameplayPaused = true;

        // Show local board immediately, then replace with global if available
        const localTop7 = this.loadLeaderboard();
        this.renderHighscoreBoard(this.inputOverlayElements, 6001, localTop7, null);

        this.fetchGlobalLeaderboard().then(global => {
            if (global && global.length > 0) {
                // Clear current board and re-render with global data
                this.inputOverlayElements.forEach(el => el.destroy());
                this.inputOverlayElements.length = 0;
                this.renderHighscoreBoard(this.inputOverlayElements, 6001, global, null);
            }
        });

        if (this._entryKeyListener) {
            this.input.keyboard.off('keydown', this._entryKeyListener);
        }
        this._entryKeyListener = (event) => {
            if (event.key !== 'Enter') {
                return;
            }
            this.input.keyboard.off('keydown', this._entryKeyListener);
            this._entryKeyListener = null;
            this.startNameEntryFlow();
        };
        this.input.keyboard.on('keydown', this._entryKeyListener);
    }

    renderHighscoreBoard(elements, depth, top7, lastRunInfo) {
        const cx = this.scale.width * 0.5;
        const startY = 70;
        const rowGap = 58;

        const title = this.add.image(cx, startY - 60, 'high_score_title');
        title.setOrigin(0.5, 0);
        title.setScrollFactor(0);
        title.setDepth(depth);
        elements.push(title);

        if (top7.length === 0) {
            const emptyText = this.add.text(cx, startY + 120, 'No scores yet', {
                fontFamily: 'monospace',
                fontSize: '28px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            });
            emptyText.setOrigin(0.5, 0);
            emptyText.setScrollFactor(0);
            emptyText.setDepth(depth);
            elements.push(emptyText);
        } else {
            top7.forEach((entry, index) => {
                const rowY = startY + 200 + (index * rowGap);

                const rankImages = this.renderAtlasText(`${index + 1}`, cx - 310, rowY, depth, 'left');
                elements.push(...rankImages);

                const tagImages = this.renderAtlasText(entry.tag || 'ANON', cx - 80, rowY, depth);
                elements.push(...tagImages);

                const entryScore = entry.score != null ? entry.score : Math.round(entry.pixelsUp + entry.secondsRemaining);
                const scoreImages = this.renderAtlasText(`${entryScore}`, cx + 220, rowY, depth);
                elements.push(...scoreImages);
            });
        }

        // Bottom line: previous run (red, left) + ENTER prompt (right, tweening)
        const bottomY = this.scale.height - 16;

        if (lastRunInfo) {
            const runText = this.add.text(16, bottomY,
                `Score: ${lastRunInfo.score}  (${lastRunInfo.pixelsUp}px + ${lastRunInfo.seconds}s)`, {
                    fontFamily: 'monospace',
                    fontSize: '18px',
                    color: '#ff5d5d',
                    stroke: '#000000',
                    strokeThickness: 3
                });
            runText.setOrigin(0, 1);
            runText.setScrollFactor(0);
            runText.setDepth(depth);
            elements.push(runText);
        }

        const enterText = this.add.text(
            lastRunInfo ? cx + 280 : cx,
            bottomY,
            'Press ENTER for a new run', {
                fontFamily: 'monospace',
                fontSize: '28px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 5
            });
        enterText.setOrigin(lastRunInfo ? 1 : 0.5, 1);
        enterText.setScrollFactor(0);
        enterText.setDepth(depth);
        elements.push(enterText);

        // Tween between white and dark gray
        this.tweens.add({
            targets: enterText,
            alpha: { from: 1, to: 0.35 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    startNameEntryFlow() {
        this.inputPhase = 'tag';
        this.showInputOverlay();
    }

    showInputOverlay() {
        this.clearInputOverlay();
        this.inputBuffer = '';

        if (this.matter?.world?.pause) {
            this.matter.world.pause();
        }

        const cx = this.scale.width * 0.5;
        const cy = this.scale.height * 0.5;

        const dimBg = this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0x000000, 0.7);
        dimBg.setScrollFactor(0);
        dimBg.setDepth(6000);
        this.inputOverlayElements.push(dimBg);

        let promptText;
        if (this.inputPhase === 'tag') {
            promptText = `Enter your tag (max ${this.maxTagLen} chars)\nType and press ENTER`;
        } else {
            promptText = `Enter your full name and class\n(e.g. "Aapo Aalto 1A")\nType and press ENTER`;
        }

        const prompt = this.add.text(cx, cy - 80, promptText, {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        });
        prompt.setOrigin(0.5, 0.5);
        prompt.setScrollFactor(0);
        prompt.setDepth(6001);
        this.inputOverlayElements.push(prompt);

        this.inputDisplay = this.add.text(cx, cy + 20, '_', {
            fontFamily: 'monospace',
            fontSize: '36px',
            color: '#5dff8b',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center'
        });
        this.inputDisplay.setOrigin(0.5, 0.5);
        this.inputDisplay.setScrollFactor(0);
        this.inputDisplay.setDepth(6001);
        this.inputOverlayElements.push(this.inputDisplay);

        if (this._inputKeyListener) {
            this.input.keyboard.off('keydown', this._inputKeyListener);
        }
        this._inputKeyListener = (event) => this.handleInputKey(event);
        this.input.keyboard.on('keydown', this._inputKeyListener);
    }

    handleInputKey(event) {
        if (this.inputPhase !== 'tag' && this.inputPhase !== 'nameclass') {
            return;
        }

        const key = event.key || '';

        if (key === 'Enter') {
            if (this.inputBuffer.length === 0) return;

            if (this.inputPhase === 'tag') {
                this.playerTag = this.inputBuffer.toUpperCase();
                this.inputPhase = 'nameclass';
                this.showInputOverlay();
            } else if (this.inputPhase === 'nameclass') {
                const parts = this.inputBuffer.trim();
                this.playerFullName = parts;
                this.playerClass = '';
                this.inputPhase = 'playing';
                this.clearInputOverlay();
                this.input.keyboard.off('keydown', this._inputKeyListener);
                this._inputKeyListener = null;
                this.setGameplayVisibility(true);
                this.gameplayPaused = false;
                // Reset ENTER key so it doesn't fire portal transition this frame
                this.enterKey.isDown = false;
                this.enterKey._justDown = false;
                if (this.matter?.world?.resume) {
                    this.matter.world.resume();
                }
            }
            return;
        }

        if (key === 'Backspace') {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
        } else if (key.length === 1) {
            const maxLen = this.inputPhase === 'tag' ? this.maxTagLen : 40;
            if (this.inputBuffer.length < maxLen) {
                this.inputBuffer += key;
            }
        }

        if (this.inputDisplay) {
            const display = this.inputBuffer.length > 0
                ? (this.inputPhase === 'tag' ? this.inputBuffer.toUpperCase() : this.inputBuffer) + '_'
                : '_';
            this.inputDisplay.setText(display);
        }
    }

    clearInputOverlay() {
        this.inputOverlayElements.forEach((el) => {
            if (el && el.destroy) el.destroy();
        });
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
        } catch {
            return [];
        }
    }

    saveLeaderboard(board) {
        try {
            localStorage.setItem(this.leaderboardStorageKey, JSON.stringify(board));
        } catch {
            // Ignore
        }
    }

    addLeaderboardEntry(tag, fullName, pixelsUp, secondsRemaining) {
        const board = this.loadLeaderboard();
        const score = Math.round(pixelsUp + secondsRemaining);
        board.push({ tag, fullName, pixelsUp, secondsRemaining, score });
        // Sort by combined score (pixels + time), descending
        board.sort((a, b) => {
            const sa = a.score != null ? a.score : Math.round(a.pixelsUp + a.secondsRemaining);
            const sb = b.score != null ? b.score : Math.round(b.pixelsUp + b.secondsRemaining);
            return sb - sa;
        });
        // Keep top 7
        const top5 = board.slice(0, 7);
        this.saveLeaderboard(top5);

        // Fire-and-forget POST to Google Sheet
        this.postScoreToSheet({ tag, fullName, pixelsUp, secondsRemaining, score });

        return top5;
    }

    postScoreToSheet(entry) {
        fetch(SHEET_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(entry)
        }).catch(() => { /* silent fail — local board is the fallback */ });
    }

    fetchGlobalLeaderboard() {
        return fetch(SHEET_URL)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'ok' && Array.isArray(data.leaderboard)) {
                    return data.leaderboard.map(e => ({
                        tag: String(e.tag || 'ANON'),
                        fullName: String(e.fullName || ''),
                        pixelsUp: Number(e.pixelsUp) || 0,
                        secondsRemaining: Number(e.secondsRemaining) || 0,
                        score: Number(e.score) || 0
                    }));
                }
                return null;
            })
            .catch(() => null);
    }

    // --- ATLAS TEXT RENDERING ---
    renderAtlasText(text, x, y, depth, align) {
        const images = [];
        const upper = text.toUpperCase();
        const effectiveCharWidth = this.atlasCellW * 0.5;
        const totalWidth = upper.length * effectiveCharWidth;
        let cursorX;
        if (align === 'left') {
            cursorX = x;
        } else {
            cursorX = x - totalWidth * 0.5;
        }

        for (let i = 0; i < upper.length; i++) {
            const ch = upper[i];
            if (ch === ' ') {
                cursorX += effectiveCharWidth;
                continue;
            }
            const frameIndex = this.atlasCharMap[ch];
            if (frameIndex == null) {
                cursorX += effectiveCharWidth;
                continue;
            }
            const img = this.add.image(cursorX + effectiveCharWidth * 0.5, y, 'highscore_atlas', frameIndex);
            img.setScrollFactor(0);
            img.setDepth(depth || 5000);
            images.push(img);
            cursorX += effectiveCharWidth;
        }
        return images;
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

    getPlayerBottomY() {
        if (!this.player) {
            return 0;
        }

        if (typeof this.player.getBottomCenter === 'function') {
            return this.player.getBottomCenter().y;
        }

        const h = this.player.displayHeight || this.player.height || 0;
        return this.player.y + (h * 0.5);
    }

    loadHighestLineY() {
        try {
            const raw = localStorage.getItem(this.highestLineStorageKey);
            if (raw == null) {
                return NaN;
            }
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : NaN;
        } catch {
            return NaN;
        }
    }

    saveHighestLineY() {
        try {
            localStorage.setItem(this.highestLineStorageKey, String(this.highestLineY));
        } catch {
            // Ignore storage errors (e.g. private mode restrictions).
        }
    }

    loadHighestLineBaselineY() {
        try {
            const raw = localStorage.getItem(this.highestLineBaselineStorageKey);
            if (raw == null) {
                return NaN;
            }
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : NaN;
        } catch {
            return NaN;
        }
    }

    saveHighestLineBaselineY() {
        try {
            localStorage.setItem(this.highestLineBaselineStorageKey, String(this.highestLineBaselineY));
        } catch {
            // Ignore storage errors (e.g. private mode restrictions).
        }
    }

    loadBestPixelsUp() {
        try {
            const raw = localStorage.getItem(this.bestPixelsUpStorageKey);
            if (raw == null) {
                return 0;
            }
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        } catch {
            return 0;
        }
    }

    saveBestPixelsUp(value) {
        try {
            localStorage.setItem(this.bestPixelsUpStorageKey, String(value));
        } catch {
            // Ignore storage errors (e.g. private mode restrictions).
        }
    }

    loadBestSecondsRemaining() {
        try {
            const raw = localStorage.getItem(this.bestSecondsRemainingStorageKey);
            if (raw == null) {
                return 0;
            }
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        } catch {
            return 0;
        }
    }

    saveBestSecondsRemaining(value) {
        try {
            localStorage.setItem(this.bestSecondsRemainingStorageKey, String(value));
        } catch {
            // Ignore storage errors (e.g. private mode restrictions).
        }
    }

    getCurrentPixelsPushedUp() {
        // Measure the highest point reached during this run (green line)
        const pushed = this.highestLineBaselineY - this.highestLineY;
        return Math.max(0, Math.round(pushed));
    }

    formatTimeMs(ms) {
        const clamped = Math.max(0, ms);
        const seconds = Math.floor(clamped / 1000);
        const milliseconds = Math.floor(clamped % 1000).toString().padStart(3, '0');
        return `${seconds}.${milliseconds}`;
    }

    endRun(goalReached) {
        if (this.runEnded) {
            return;
        }

        this.runEnded = true;
        this.goalReached = goalReached;
        this.finalRemainingTimeMs = this.remainingTimeMs;

        const currentPixelsUp = this.getCurrentPixelsPushedUp();
        const currentSecondsRemaining = goalReached ? (this.finalRemainingTimeMs / 1000) : 0;

        // Update personal bests
        const bestPixelsUp = Math.max(this.loadBestPixelsUp(), currentPixelsUp);
        this.saveBestPixelsUp(bestPixelsUp);
        if (goalReached) {
            const bestSec = Math.max(this.loadBestSecondsRemaining(), currentSecondsRemaining);
            this.saveBestSecondsRemaining(bestSec);
        }

        // Add to leaderboard
        const top5 = this.addLeaderboardEntry(
            this.playerTag || 'ANON',
            this.playerFullName || '',
            currentPixelsUp,
            currentSecondsRemaining
        );

        if (this.matter?.world?.pause) {
            this.matter.world.pause();
        }

        // Hide all children except park background
        const snapshot = [...this.children.list];
        snapshot.forEach((child) => {
            if (child !== this.parkBackground) {
                child.setVisible(false);
            }
        });

        // --- End screen: use shared highscore board ---
        const currentScore = Math.round(currentPixelsUp + currentSecondsRemaining);
        const lastRunInfo = {
            score: currentScore,
            pixelsUp: currentPixelsUp,
            seconds: Math.round(currentSecondsRemaining)
        };
        this.renderHighscoreBoard(this.endScreenElements, 5000, top5, lastRunInfo);

        // Replace with global leaderboard when available
        this.fetchGlobalLeaderboard().then(global => {
            if (global && global.length > 0) {
                this.endScreenElements.forEach(el => el.destroy());
                this.endScreenElements.length = 0;
                this.renderHighscoreBoard(this.endScreenElements, 5000, global, lastRunInfo);
            }
        });
    }

    redrawHighestLine() {
        // Green line hidden — only track position for score calculation
    }

    update() {
        if (this.runEnded) {
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.restart({ skipIntro: true });
            }
            return;
        }

        if (this.gameplayPaused) {
            return;
        }

        // Skip a couple of frames after input phase ends to avoid ENTER leaking
        if (this._inputGraceFrames == null) {
            this._inputGraceFrames = 0;
        }
        if (this._inputGraceFrames < 2) {
            this._inputGraceFrames++;
            return;
        }

        this.player.update();

        const playerBottomY = this.getPlayerBottomY();

        if (this.requestResetHighestLine) {
            this.requestResetHighestLine = false;
            this.highestLineY = playerBottomY;
            this.highestLineBaselineY = playerBottomY;
            this.saveHighestLineY();
            this.saveHighestLineBaselineY();
            this.redrawHighestLine();
        }

        if (playerBottomY < this.highestLineY) {
            this.highestLineY = playerBottomY;
            this.saveHighestLineY();
            this.redrawHighestLine();
        }

        this.remainingTimeMs = Math.max(0, this.remainingTimeMs - this.game.loop.delta);
        this.timerText.setText(this.formatTimeMs(this.remainingTimeMs));

        if (this.returnPortal.isPlayerTouching && Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.scene.start('HubScene');
            return;
        }

        if (this.finishPortal.isPlayerTouching) {
            this.endRun(true);
            return;
        }

        if (this.remainingTimeMs <= 0) {
            this.endRun(false);
            return;
        }
    }
}
