import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';

export default class HubScene extends Phaser.Scene {
    constructor() { super("HubScene"); }

    preload() {
        this.load.image("player1", "assets/player_sprites/player1.png");
        this.load.image("player2", "assets/player_sprites/player2.png");
        this.load.image("player3", "assets/player_sprites/player3.png");
        this.load.image("player4", "assets/player_sprites/player4.png");
        this.load.image("player5", "assets/player_sprites/player5.png");

        this.load.image("concrete_bg", "assets/backgrounds/hubworld_background.png");
        this.load.image("platform_texture", "assets/backgrounds/256x256.png");
        this.load.image("ground", "assets/backgrounds/ground.png");
        this.load.image("drop", "assets/backgrounds/drop.png");
        this.load.spritesheet("graffiti", "assets/backgrounds/Atlas.png", {
            frameWidth: 512,
            frameHeight: 512
        });
        this.load.json('hub_level', 'assets/levels/hubLevel.json');

        this.load.image("speedrun_bw", "assets/backgrounds/speedrun_bw.png");
        this.load.image("speedrun", "assets/backgrounds/speedrun.png");

        this.load.audio("secret", "assets/music/title.mp3");
        this.load.audio("title", "assets/music/ramp.mp3");
    }

    create(data = {}) {
        // --- BACKGROUND MUSIC ---
        this.sound.stopAll();
        this.bgmusic = this.sound.add("title", { volume: 1.0, loop: true });
        this.bgmusic.play();

        const cachedLevel = this.cache.json.get('hub_level');
        const hasInjectedLevel = Array.isArray(data.levelPlatforms);
        const hasCachedLevel = !!cachedLevel;

        this.worldWidth = hasInjectedLevel
            ? (data.worldWidth || 6400)
            : (hasCachedLevel ? (cachedLevel.worldWidth || 6400) : 6400);
        this.worldHeight = hasInjectedLevel
            ? (data.worldHeight || 1800)
            : (hasCachedLevel ? (cachedLevel.worldHeight || 1800) : 1800);
        this.spawnPoint = hasInjectedLevel
            ? (data.spawnPoint || { x: 200, y: 950 })
            : (hasCachedLevel ? (cachedLevel.spawn || { x: 200, y: 950 }) : { x: 200, y: 950 });
        this.portal1Pos = hasInjectedLevel
            ? (data.portal1Pos || { x: 300, y: 1250 })
            : (hasCachedLevel ? (cachedLevel.portal1 || { x: 300, y: 1250 }) : { x: 300, y: 1250 });

        const sourcePlatforms = hasInjectedLevel
            ? data.levelPlatforms
            : (Array.isArray(cachedLevel?.platforms) ? cachedLevel.platforms : []);
        this.levelPlatforms = sourcePlatforms.map((def) => ({ x: def.x, y: def.y, config: { ...def.config } }));

        this.captureLevelData = false;
        this.legacyCenteredInput = false;
        this.isMapMode = false;
        this.editorHandles = [];
        this.editorHud = null;

        // --- -1. COLLISION CATEGORIES ---
        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory(), 
            SENSOR: this.matter.world.nextCategory()
        };

        // 0. CREATE THE WALLS
        // Create the invisible box around the world
        this.matter.world.setBounds(0, 0, this.worldWidth, this.worldHeight, 1000, true, true, true, true);

        // Now we can use 'this.cats.GROUND' because we defined it in Step 1.
        Object.values(this.matter.world.walls).forEach(wall => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });    

    
        // --- 1. BACKGROUND AND GRAFFITI---
        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, "concrete_bg");
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);


        
 
        
        this.portal1 = new Graffiti(this, this.portal1Pos.x, this.portal1Pos.y, "speedrun_bw", "speedrun", this.cats.SENSOR);
        this.portal1.setScrollFactor(0.85, 0.85);


    // --- 2. THE PARK LAYOUT  ---
        this.levelPlatforms.forEach((def) => {
            this.createPlatform(def.x, def.y, def.config);
        });

        this.captureLevelData = false;

        // --- 3. PLAYER SPAWN ---
        this.player = new Player(this, this.spawnPoint.x, this.spawnPoint.y, this.cats);
        this.player.setDepth(10);

        // --- 4. CAMERA & ZONES ---
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08); // Looser Lerp
        this.cameras.main.setDeadzone(400, 200);                      // The Chill Box
        this.cameras.main.setFollowOffset(0, 100);                    // Look Up
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);   // World Limits

        this.setupAnims();
        this.setupZones(this.worldWidth, this.worldHeight);

        // --- 5. DEBUG MAP VIEW (Press 'M' to toggle) ---

        // 5.1. Create a custom Graphics grid with THICK lines so it survives the zoom
        const debugGrid = this.add.graphics();
        debugGrid.setDepth(1000);
        debugGrid.setVisible(false);

        // Draw vertical lines
        for (let x = 0; x <= this.worldWidth; x += 100) {
            const isMajor = x % 500 === 0; // Highlight every 500px
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(x, 0);
            debugGrid.lineTo(x, this.worldHeight);
            debugGrid.strokePath();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.worldHeight; y += 100) {
            const isMajor = y % 500 === 0;
            debugGrid.lineStyle(isMajor ? 10 : 4, 0x00ff00, isMajor ? 0.8 : 0.3);
            debugGrid.beginPath();
            debugGrid.moveTo(0, y);
            debugGrid.lineTo(this.worldWidth, y);
            debugGrid.strokePath();
        }

        // 5.2. Wire up the 'M' key to toggle the view
        this.input.keyboard.on('keydown-M', () => {
            this.isMapMode = !this.isMapMode;
            
            if (this.isMapMode) {
                // Turn ON Map Mode
                this.cameras.main.stopFollow();
                
                // Calculate the exact zoom needed to fit 6400px into your game window width
                const fitWidthZoom = this.scale.width / this.worldWidth;
                const fitHeightZoom = this.scale.height / this.worldHeight;
                const zoomLevel = Math.min(fitWidthZoom, fitHeightZoom);
                this.cameras.main.setZoom(zoomLevel);
                
                // Center the camera perfectly in the middle of the world
                this.cameras.main.centerOn(this.worldWidth / 2, this.worldHeight / 2);
                debugGrid.setVisible(true);
                this.enterMapEditorMode();
            } else {
                // Turn OFF Map Mode (Back to normal gameplay)
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
                    portal1Pos: this.portal1Pos
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
            texture = 'platform_texture'
        } = config;

        const renderWidth = type === 'CIRCLE' ? radius * 2 : width;
        const renderHeight = type === 'CIRCLE' ? radius * 2 : height;

        const topLeftX = this.legacyCenteredInput ? (x - (renderWidth / 2)) : x;
        const topLeftY = this.legacyCenteredInput ? (y - (renderHeight / 2)) : y;

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
            friction: friction,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;

        // --- GENERATE PHYSICS SHAPE ---
        if (type === 'RECT') {
            body = this.matter.add.rectangle(centerX, centerY, width, height, bodyOptions);
        }
        else if (type === 'RAMP_LEFT' || type === 'ramp_left') {
            const verts = [
                { x: width/2,  y: height/2 }, 
                { x: -width/2, y: height/2 }, 
                { x: width/2,  y: -height/2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        }
        else if (type === 'RAMP_RIGHT' || type === 'ramp_right') {
            const verts = [
                { x: -width/2, y: -height/2 },
                { x: -width/2, y: height/2 },
                { x: width/2, y: height/2 }
            ];
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        }
        else if (type === 'CURVE') {
            const segments = 32;
            const verts = [{ x: width/2, y: height/2 }];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = -width/2 + (Math.cos(t * Math.PI/2) * width); 
                const py = -height/2 + (Math.sin(t * Math.PI/2) * height);
                verts.push({ x: px, y: py });
            }
            verts.push({ x: width/2, y: height/2 });
            body = this.matter.add.fromVertices(centerX, centerY, verts, bodyOptions);
        }
        else if (type === 'CIRCLE') {
            body = this.matter.add.circle(centerX, centerY, radius, bodyOptions);
        }

        if (body) {
            // Apply Rotation
            this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
            
            // Force Position
            this.matter.body.setPosition(body, { x: centerX, y: centerY });
            
            // Assign Physics Category
            if (isOneWay) {
                body.collisionFilter.category = this.cats.ONE_WAY;
            } else {
                body.collisionFilter.category = this.cats.GROUND;
            }

            // --- VISUALS (UPDATED) ---
            
            // 1. One-Way Platforms (the graphis previously known as the green bars)
            if (isOneWay || type === 'RECT') {
                TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, texture);


                //const graphics = this.add.graphics({ fillStyle: { color: 0x44AA44 } });
                //graphics.fillRect(body.position.x - width/2, body.position.y - height/2, width, height);
            } 
        
            // 2. Rectangles (Floor) 
            /* else if (type === 'RECT') {
                TextureFactory.styleRectangle(this, x, y, width, height, body);
            } */
            
            // 3. Curves / Ramps (Use new method)
            else if (
                type === 'CURVE' ||
                type === 'RAMP_LEFT' || type === 'ramp_left' ||
                type === 'RAMP_RIGHT' || type === 'ramp_right'
            ) {
                TextureFactory.styleCurve(this, body, texture);
            }
            
            // 4. Circles
            else if (type === 'CIRCLE') {
                TextureFactory.styleCircle(this, body, texture);
            }
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
            handle.setStrokeStyle(6, 0xffcc00, 1);
            handle.setFillStyle(0xffcc00, 0.15);
            handle.setDepth(3500);
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
            portal1: this.portal1Pos,
            platforms: this.levelPlatforms
        };

        const text = JSON.stringify(payload, null, 2);
        console.log('Hub level JSON:\n', text);

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showEditorToast('Hub JSON copied to clipboard'))
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
                key: "idle_pump",
                frames: [{ key: "player1" }, { key: "player2" }],
                frameRate: 1.5,
                repeat: -1
            });
        }
        if (!this.anims.exists('kick')) {
            this.anims.create({
                key: "kick",
                frames: [
                    { key: "player2", duration: 50 },
                    { key: "player3", duration: 400 },
                    { key: "player1", duration: 50 }
                ],
                frameRate: 10,
                repeat: 0
            });
        }
    }

    setupZones(worldWidth, worldHeight) {
        this.hintText = this.add.text(16, 16, "", { fontFamily: "monospace", fontSize: "18px" }).setScrollFactor(0);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    update() {
        this.player.update();
        this.hintText.setText("");

        if(this.portal1.isPlayerTouching) {
            this.hintText.setText("Press ENTER to enter the Portal");

            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.scene.start('SillySpeedRunScene');
            }
        }
    }
}