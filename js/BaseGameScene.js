import TextureFactory from './TextureFactory.js';
import { isDebugMode } from './GameState.js';

export default class BaseGameScene extends Phaser.Scene {

    // -------------------------------------------------------------------------
    // PRELOAD — shared assets used by every scene
    // -------------------------------------------------------------------------
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
    }

    // -------------------------------------------------------------------------
    // WORLD / CAMERA HELPERS
    // -------------------------------------------------------------------------

    // Call at the top of create() before any editor methods are used.
    initEditorState() {
        this.isMapMode      = false;
        this.editorHandles  = [];
        this.editorHud      = null;
        this.editorInspect  = null;
        this.editorCoords   = null;
        this.editorToast    = null;
        this._mapBuffer     = '';
        this._editorPointerMove = null;
    }

    // Call after setting this.cats = CATS and this.worldWidth/worldHeight.
    setupWorldBounds() {
        this.matter.world.setBounds(0, 0, this.worldWidth, this.worldHeight, 1000, true, true, true, true);
        Object.values(this.matter.world.walls).forEach((wall) => {
            if (wall) wall.collisionFilter.category = this.cats.GROUND;
        });
    }

    // Call after creating this.player.
    setupCamera() {
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(400, 200);
        this.cameras.main.setFollowOffset(0, 100);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    }

    setupDebugLabel() {
        this.debugLabel = this.add.text(16, 700, 'Debug mode', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(2000).setVisible(isDebugMode());
    }

    // -------------------------------------------------------------------------
    // ANIMATIONS — identical across all scenes
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // PLATFORM CREATION
    // -------------------------------------------------------------------------

    // Override in subclass to remap texture keys (e.g. BottomRaceScene).
    // Default implementation returns the key unchanged.
    resolveTexture(key) {
        return key;
    }

    // Requires the following to be set in create() before calling:
    //   this.cats              = CATS
    //   this.captureLevelData  = false  (set true only when capturing editor output)
    //   this.legacyCenteredInput = false  (true only for old centered-coordinate levels)
    createPlatform(x, y, config, defRef = null) {
        if (!config || typeof config !== 'object') return;

        const {
            type     = 'RECT',
            width    = 100,
            height   = 100,
            radius   = 50,
            angle    = 0,
            chamfer  = 0,
            friction = 0.5,
            isOneWay = false,
            bouncy   = false,
            texture  = 'platform_texture'
        } = config;

        const renderWidth  = type === 'CIRCLE' ? radius * 2 : width;
        const renderHeight = type === 'CIRCLE' ? radius * 2 : height;

        let topLeftX = x;
        let topLeftY = y;
        if (this.legacyCenteredInput) {
            topLeftX = x - (renderWidth / 2);
            topLeftY = y - (renderHeight / 2);
        }

        if (this.captureLevelData) {
            this.levelPlatforms.push({ x: topLeftX, y: topLeftY, config: { ...config } });
        }

        const centerX = topLeftX + (renderWidth / 2);
        const centerY = topLeftY + (renderHeight / 2);

        const bodyOptions = {
            isStatic:    true,
            friction,
            restitution: bouncy ? 1.2 : 0,
            chamfer:     chamfer > 0 ? { radius: chamfer } : null
        };

        let body;
        if (type === 'RECT') {
            body = this.matter.add.rectangle(centerX, centerY, width, height, bodyOptions);
        } else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            body = this.matter.add.fromVertices(centerX, centerY, [
                { x:  width / 2, y:  height / 2 },
                { x: -width / 2, y:  height / 2 },
                { x:  width / 2, y: -height / 2 }
            ], bodyOptions);
        } else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            body = this.matter.add.fromVertices(centerX, centerY, [
                { x: -width / 2, y: -height / 2 },
                { x: -width / 2, y:  height / 2 },
                { x:  width / 2, y:  height / 2 }
            ], bodyOptions);
        } else if (type === 'CURVE') {
            const segments = 32;
            const verts = [{ x: width / 2, y: height / 2 }];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                verts.push({
                    x: -width  / 2 + (Math.cos(t * Math.PI / 2) * width),
                    y: -height / 2 + (Math.sin(t * Math.PI / 2) * height)
                });
            }
            verts.push({ x: width / 2, y: height / 2 });
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        } else if (type === 'CIRCLE') {
            body = this.matter.add.circle(centerX, centerY, radius, bodyOptions);
        }

        if (Array.isArray(body)) body = body[0] || null;
        if (!body) return;

        this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
        this.matter.body.setPosition(body, { x: centerX, y: centerY });

        if (defRef) {
            defRef.__editorBounds = {
                x:      body.bounds.min.x,
                y:      body.bounds.min.y,
                width:  body.bounds.max.x - body.bounds.min.x,
                height: body.bounds.max.y - body.bounds.min.y
            };
        }

        body.collisionFilter.category = isOneWay ? this.cats.ONE_WAY : this.cats.GROUND;

        const resolvedTexture = this.resolveTexture(texture);

        if (bouncy) {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, resolvedTexture);
            return;
        }

        if (isOneWay || type === 'RECT') {
            TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, resolvedTexture);
        } else if (
            type === 'CURVE' ||
            type === 'RAMP_LEFT' || type === 'ramp_left' ||
            type === 'RAMP_RIGHT' || type === 'ramp_right'
        ) {
            TextureFactory.styleCurve(this, body, resolvedTexture);
        } else if (type === 'CIRCLE') {
            TextureFactory.styleCircle(this, body, resolvedTexture);
        }
    }

    // -------------------------------------------------------------------------
    // MAP EDITOR — debug grid + keyboard toggle
    // -------------------------------------------------------------------------

    // Call in create() to build the green debug grid graphic.
    // Store the return value if you need a reference (e.g. this.debugGrid = this.buildDebugGrid()).
    buildDebugGrid() {
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
        return debugGrid;
    }

    // Call in create() after buildDebugGrid(), passing the grid as argument.
    // Requires initEditorState() to have been called first.
    // Requires this.player to exist for the map-off camera restore.
    // Requires this.worldWidth / this.worldHeight to be set.
    setupMapEditor(debugGrid) {
        this.input.keyboard.on('keydown', (event) => {
            // Block map editor toggle during text input phases (e.g. PrizePointScene tag entry)
            if (typeof this.inputPhase === 'string' &&
                (this.inputPhase === 'intro' || this.inputPhase === 'tag')) return;

            const k = (event.key || '').toLowerCase();
            if (!/^[a-z]$/.test(k)) { this._mapBuffer = ''; return; }
            this._mapBuffer += k;
            if (this._mapBuffer.length > 3) this._mapBuffer = this._mapBuffer.slice(-3);
            if (this._mapBuffer !== 'map') return;
            this._mapBuffer = '';
            this.isMapMode = !this.isMapMode;

            if (this.isMapMode) {
                this.cameras.main.stopFollow();
                const zoomLevel = Math.min(
                    this.scale.width  / this.worldWidth,
                    this.scale.height / this.worldHeight
                );
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
                this.scene.restart(this.getRestartData());
            }
        });

        this.input.keyboard.on('keydown-S', () => {
            if (this.isMapMode) this.exportLevelData();
        });
    }

    // Override in subclass to include scene-specific portal positions in the
    // restart data passed to scene.restart() when exiting the map editor.
    // Always include worldWidth, worldHeight, levelPlatforms, spawnPoint.
    getRestartData() {
        return {
            worldWidth:     this.worldWidth,
            worldHeight:    this.worldHeight,
            levelPlatforms: this.levelPlatforms,
            spawnPoint:     this.spawnPoint
        };
    }

    // Override in subclass to add scene-specific portal fields to the exported
    // JSON (e.g. finishPortal, returnPortal). Base implementation includes
    // worldWidth, worldHeight, spawn, and platforms.
    getLevelPayload() {
        return {
            worldWidth:  this.worldWidth,
            worldHeight: this.worldHeight,
            spawn:       this.spawnPoint,
            platforms:   this.levelPlatforms.map((def, index) => ({
                ...def,
                id:     def?.id     ?? (index + 1),
                remark: def?.remark ?? def?.config?.remark ?? ''
            }))
        };
    }

    enterMapEditorMode() {
        this.destroyEditorHandles();

        this.editorHud = this.add.text(16, 16,
            'Editor: drag platforms | hover = inspect | S = export JSON | M = apply + exit', {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.editorHud.setScrollFactor(0);
        this.editorHud.setDepth(3000);

        this.editorCoords = this.add.text(16, 44, 'World: 0, 0', {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffff00', stroke: '#000000', strokeThickness: 4
        });
        this.editorCoords.setScrollFactor(0);
        this.editorCoords.setDepth(3000);

        this._editorPointerMove = (pointer) => {
            const cam = this.cameras.main;
            const worldX = Math.round((pointer.x / cam.zoom) + cam.worldView.x);
            const worldY = Math.round((pointer.y / cam.zoom) + cam.worldView.y);
            if (this.editorCoords) this.editorCoords.setText(`World: ${worldX}, ${worldY}`);
        };
        this.input.on('pointermove', this._editorPointerMove);

        this.editorInspect = this.add.text(16, 72, '', {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.editorInspect.setBackgroundColor('rgba(0, 0, 0, 0.75)');
        this.editorInspect.setPadding(8, 6, 8, 6);
        this.editorInspect.setVisible(false);
        this.editorInspect.setScrollFactor(0);
        this.editorInspect.setDepth(3501);

        this.levelPlatforms.forEach((def, index) => {
            const cfg           = def.config || {};
            const fallbackW     = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.width  || 100);
            const fallbackH     = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.height || 100);
            const hasBodyBounds = !!def.__editorBounds;
            const handleX       = hasBodyBounds ? def.__editorBounds.x      : def.x;
            const handleY       = hasBodyBounds ? def.__editorBounds.y      : def.y;
            const handleW       = hasBodyBounds ? def.__editorBounds.width  : fallbackW;
            const handleH       = hasBodyBounds ? def.__editorBounds.height : fallbackH;

            const handle = this.add.rectangle(handleX, handleY, handleW, handleH);
            handle.setOrigin(0, 0);
            handle.setStrokeStyle(3, 0xffcc00, 1);
            handle.setFillStyle(0xffcc00, 0.08);
            handle.setDepth(2500);
            handle.setAngle(hasBodyBounds ? 0 : (cfg.angle || 0));
            handle.setInteractive({ cursor: 'move' });
            this.input.setDraggable(handle);

            handle.__defRef        = def;
            handle.__platformIndex = index;
            handle.__xOffset       = def.x - handleX;
            handle.__yOffset       = def.y - handleY;
            handle.on('pointerover', () => this.showHandleInspect(handle.__defRef, handle.__platformIndex));
            handle.on('pointerout',  () => this.hideHandleInspect());
            this.editorHandles.push(handle);
        });

        this.refreshEditorHudScale();
        this.refreshEditorHandleVisuals();
        this.input.on('drag', this.onEditorDrag, this);
    }

    exitMapEditorMode() {
        this.input.off('drag', this.onEditorDrag, this);
        this.destroyEditorHandles();
    }

    destroyEditorHandles() {
        ['editorHud', 'editorInspect', 'editorCoords', 'editorToast'].forEach((key) => {
            if (this[key]) { this[key].destroy(); this[key] = null; }
        });
        if (this._editorPointerMove) {
            this.input.off('pointermove', this._editorPointerMove);
            this._editorPointerMove = null;
        }
        if (this.editorHandles?.length > 0) {
            this.editorHandles.forEach((h) => h.destroy());
            this.editorHandles = [];
        }
    }

    onEditorDrag(pointer, gameObject, dragX, dragY) {
        if (!this.isMapMode || !gameObject.__defRef) return;

        const snappedX = Math.round(dragX / 10) * 10;
        const snappedY = Math.round(dragY / 10) * 10;
        gameObject.setPosition(snappedX, snappedY);
        gameObject.__defRef.x = snappedX + (gameObject.__xOffset || 0);
        gameObject.__defRef.y = snappedY + (gameObject.__yOffset || 0);
        gameObject.__defRef.__editorBounds = {
            x: snappedX, y: snappedY,
            width: gameObject.width, height: gameObject.height
        };
        this.showHandleInspect(gameObject.__defRef, gameObject.__platformIndex);
    }

    showHandleInspect(def, index) {
        if (!this.editorInspect) return;
        const cfg    = def?.config || {};
        const idText = def?.id != null ? String(def.id) : String((index || 0) + 1);
        const remark = def?.remark || cfg?.remark || '-';
        this.editorInspect.setText(
            `Object #${(index || 0) + 1} | id: ${idText} | type: ${cfg.type || 'RECT'} | remark: ${remark}`
        );
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
        if (!this.editorInspect) return;
        this.refreshInspectScale();
        const zoom = this.cameras.main.zoom || 1;
        this.editorInspect.setPosition(16 / zoom, 54 / zoom);
    }

    refreshInspectScale() {
        if (!this.editorInspect) return;
        this.editorInspect.setScale(1 / (this.cameras.main.zoom || 1));
    }

    refreshEditorHudScale() {
        if (!this.editorHud) return;
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
        if (!this.editorHandles?.length) return;
        const zoom        = this.cameras.main.zoom || 1;
        const strokeWidth = Phaser.Math.Clamp(3 / zoom, 3, 20);
        const fillAlpha   = zoom < 0.25 ? 0.2 : 0.08;
        this.editorHandles.forEach((handle) => {
            handle.setStrokeStyle(strokeWidth, 0xffcc00, 1);
            handle.setFillStyle(0xffcc00, fillAlpha);
        });
    }

    positionEditorToastFixed() {
        if (!this.editorToast) return;
        const zoom = this.cameras.main.zoom || 1;
        this.editorToast.setScale(1 / zoom);
        this.editorToast.setPosition(16 / zoom, 98 / zoom);
    }

    showEditorToast(message) {
        if (this.editorToast) { this.editorToast.destroy(); this.editorToast = null; }

        this.editorToast = this.add.text(16, 44, message, {
            fontFamily: 'monospace', fontSize: '20px',
            color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.editorToast.setBackgroundColor('rgba(0, 0, 0, 0.75)');
        this.editorToast.setPadding(8, 6, 8, 6);
        this.editorToast.setScrollFactor(0);
        this.editorToast.setDepth(3502);
        this.positionEditorToastFixed();

        this.time.delayedCall(1600, () => {
            if (this.editorToast) { this.editorToast.destroy(); this.editorToast = null; }
        });
    }

    exportLevelData() {
        const payload = this.getLevelPayload();
        const text    = JSON.stringify(payload, null, 2);
        console.log(`${this.scene.key} level JSON:\n`, text);

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(()  => this.showEditorToast('JSON copied to clipboard'))
                .catch(() => this.showEditorToast('Exported to console (clipboard blocked)'));
        } else {
            this.showEditorToast('Exported to console (clipboard unavailable)');
        }
    }
}
