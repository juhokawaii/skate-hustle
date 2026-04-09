import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { getHubProgress, saveHubProgress, isDebugMode, setDebugMode } from './GameState.js';
import { CATS } from './CollisionCategories.js';

export default class HubScene extends Phaser.Scene {
    constructor() { super("HubScene"); }

    preload() {
        this.load.image("player1", "assets/player_sprites/player1.png");
        this.load.image("player2", "assets/player_sprites/player2.png");
        this.load.image("player3", "assets/player_sprites/player3.png");
        this.load.image("player4", "assets/player_sprites/player4.png");
        this.load.image("player5", "assets/player_sprites/player5.png");
        this.load.image("player6", "assets/player_sprites/player6.png");

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
        this.load.image("race_bottom_bw", "assets/backgrounds/race-to-the-bottom-bw.png");
        this.load.image("race_bottom", "assets/backgrounds/race-to-the-bottom.png");
        this.load.image("crypto_bw", "assets/backgrounds/crypto_bw.png");
        this.load.image("crypto", "assets/backgrounds/crypto.png");
        this.load.image("zombies", "assets/backgrounds/zombies.png");
        this.load.image("dealwithit", "assets/backgrounds/dealwithit.png");
        this.load.image("arrow_right", "assets/backgrounds/arrow-light.png");

        this.load.audio("secret", "assets/music/title.mp3");
        this.load.audio("ramp", "assets/music/ramp.mp3");
    }

    create(data = {}) {
        // --- BACKGROUND MUSIC ---
        this.sound.stopAll();
        this.bgmusic = this.sound.add("ramp", { volume: 1.0, loop: true });
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
            ? (data.portal1Pos || { x: 300, y: 1350 })
            : (hasCachedLevel ? (cachedLevel.portal1 || { x: 300, y: 1350 }) : { x: 300, y: 1350 });
        this.racePortalPos = hasInjectedLevel
            ? (data.racePortalPos || { x: 1880, y: 1500 })
            : (hasCachedLevel ? (cachedLevel.racePortal || { x: 1880, y: 1500 }) : { x: 1880, y: 1500 });
        const defaultZombiesPos = {
            x: Math.round((this.portal1Pos.x + this.racePortalPos.x) * 0.5),
            y: Math.round((this.portal1Pos.y + this.racePortalPos.y) * 0.5)
        };
        this.zombiesPortalPos = hasInjectedLevel
            ? (data.zombiesPortalPos || defaultZombiesPos)
            : (hasCachedLevel ? (cachedLevel.zombiesPortal || defaultZombiesPos) : defaultZombiesPos);

        this.portal1Pos = {
            x: this.portal1Pos.x,
            y: this.portal1Pos.y - 100
        };
        this.racePortalPos = {
            x: this.racePortalPos.x,
            y: this.racePortalPos.y - 130
        };
        this.zombiesPortalPos = {
            x: this.zombiesPortalPos.x,
            y: this.zombiesPortalPos.y - 115
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

        this.captureLevelData = false;
        this.legacyCenteredInput = false;
        this.isMapMode = false;
        this.editorHandles = [];
        this.editorHud = null;
        this.editorInspect = null;

        // --- -1. COLLISION CATEGORIES ---
        this.cats = CATS;

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
        this.portal1.setScrollFactor(1, 1);
        this.portal1.enableParallaxVisual(0.85, 0.85, {
            alpha: 0.85
        });

        this.racePortal = new Graffiti(this, this.racePortalPos.x, this.racePortalPos.y, "race_bottom_bw", "race_bottom", this.cats.SENSOR);
        this.racePortal.setScrollFactor(1, 1);
        this.racePortal.enableParallaxVisual(0.85, 0.85, {
            depth: -2,
            alpha: 0.70
        });

        this.ensureGrayscaleTexture('zombies', 'zombies_bw');
        this.zombiesPortal = new Graffiti(this, this.zombiesPortalPos.x, this.zombiesPortalPos.y, 'zombies_bw', 'zombies', this.cats.SENSOR);
        this.zombiesPortal.setScrollFactor(1, 1);
        this.zombiesPortal.enableParallaxVisual(0.85, 0.85, {
            depth: -2,
            alpha: 0.74
        });

        const defaultCryptoPos = this.getCryptoPortalPosition();
        this.cryptoPortalPos = {
            x: Phaser.Math.Clamp(defaultCryptoPos.x - 600, 120, this.worldWidth - 120),
            y: Phaser.Math.Clamp(defaultCryptoPos.y - 150, 120, this.worldHeight - 120)
        };
        this.cryptoPortal = new Graffiti(this, this.cryptoPortalPos.x, this.cryptoPortalPos.y, "crypto_bw", "crypto", this.cats.SENSOR);
        this.cryptoPortal.setScrollFactor(1, 1);
        this.cryptoPortal.enableParallaxVisual(0.85, 0.85);

        // Decorative unlock graffiti on the center ramp wall.
        this.dealWithItGraffiti = this.add.image(4680, 1030, 'dealwithit');
        this.dealWithItGraffiti.setScrollFactor(0.85, 0.85);
        this.dealWithItGraffiti.setDepth(-3);
        this.dealWithItGraffiti.setScale(0.56);
        this.dealWithItGraffiti.setAlpha(0);
        this.dealWithItGraffiti.setVisible(false);
        this.dealWithItGraffitiShown = false;
        this.dealWithItCheatEnabled = false;
        this.dealWithItCheatBuffer = '';
        this.input.keyboard.on('keydown', this.handleDealWithItCheatInput, this);
        this.events.once('shutdown', () => {
            this.input.keyboard.off('keydown', this.handleDealWithItCheatInput, this);
        });


    // --- 2. THE PARK LAYOUT  ---
        this.levelPlatforms.forEach((def) => {
            this.createPlatform(def.x, def.y, def.config, def);
        });

        this.totalCoins = 100;
        this.requiredCoinsToUnlockPortal = 20;
        this.requiredCoinsToUnlockRacePortal = 40;
        this.collectedCoins = 0;
        this.coinsActivated = false;
        this.coinsDropping = false;
        this.portalUnlocked = false;
        this.racePortalUnlocked = false;
        this.sillyCompleted = false;
        this.coins = [];
        this.collectedCoinIndices = new Set();
        this.coinTargets = this.buildCoinTargets(this.totalCoins);
        this.spawnedCoinTotal = this.coinTargets.length;
        this.cryptoHintUntil = 0;
        this.cryptoHintMessage = '';

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
        this.restoreHubProgress();

        // --- BREADCRUMB ARROWS (first-time guidance to Crypto Chase) ---
        // Create flipped arrow texture once
        if (!this.textures.exists('arrow_left')) {
            const source = this.textures.get('arrow_right').getSourceImage();
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const ctx = canvas.getContext('2d');
            ctx.translate(source.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(source, 0, 0);
            this.textures.addCanvas('arrow_left', canvas);
        }

        this.guidanceArrows = [];
        if (!this.coinsActivated) {
            const arrowDefs = [
                { x: 1065, y: 1490, dir: 'right' },
                { x: 1925, y: 1490, dir: 'right' },
                { x: 3090, y: 1640, dir: 'right' },
                { x: 4455, y: 1325, dir: 'right', angle: -40 },
                { x: 5600, y: 1480, dir: 'right', flipY: true, angle: -15 },
                { x: 6025, y: 705,  dir: 'left' },
                { x: 5160, y: 575,  dir: 'left' },
            ];
            arrowDefs.forEach((def) => {
                const tex = def.dir === 'left' ? 'arrow_left' : 'arrow_right';
                const arrow = this.add.image(def.x, def.y, tex);
                arrow.setOrigin(0.5, 1);
                arrow.setDepth(15);
                if (typeof def.angle === 'number') arrow.setAngle(def.angle);
                if (def.flipY) arrow.setFlipY(true);
                arrow.__reached = false;
                this.tweens.add({
                    targets: arrow,
                    alpha: { from: 1, to: 0.3 },
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                this.guidanceArrows.push(arrow);
            });
        }

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
                    portal1Pos: this.portal1Pos,
                    racePortalPos: this.racePortalPos,
                    zombiesPortalPos: this.zombiesPortalPos
                });
            }
        });

        this.input.keyboard.on('keydown-S', () => {
            if (this.isMapMode) {
                this.exportLevelData();
            }
        });

        // Cheat codes: type "debug" to enable debug mode, then "silly" or "bottom" to jump to scenes
        this._cheatBuffer = '';
        const cheatCodes = {
            silly: 'SillySpeedRunScene',
            bottom: 'BottomRaceScene',
            zombie: 'ZombieHordeScene'
        };
        const debugWord = 'debug';
        const cheatWords = Object.keys(cheatCodes);
        const allWords = [debugWord, ...cheatWords];
        const maxCheatLen = allWords.reduce((m, word) => Math.max(m, word.length), 0);
        this.input.keyboard.on('keydown', (event) => {
            const key = (event.key || '').toLowerCase();
            if (!/^[a-z]$/.test(key)) {
                this._cheatBuffer = '';
                return;
            }

            this._cheatBuffer += key;
            if (this._cheatBuffer.length > maxCheatLen) {
                this._cheatBuffer = this._cheatBuffer.slice(-maxCheatLen);
            }

            // DEBUG toggle
            if (this._cheatBuffer === debugWord) {
                const newMode = !isDebugMode();
                setDebugMode(newMode);
                this._cheatBuffer = '';
                if (this.debugLabel) {
                    this.debugLabel.setVisible(newMode);
                }
                this.showEditorToast(newMode ? 'Debug mode ON' : 'Debug mode OFF');
                return;
            }

            // Scene-jump cheats (debug mode only)
            if (isDebugMode() && cheatCodes[this._cheatBuffer]) {
                const targetScene = cheatCodes[this._cheatBuffer];
                this._cheatBuffer = '';
                this.persistHubProgress();
                this.scene.start(targetScene);
                return;
            }

            if (!allWords.some((word) => word.startsWith(this._cheatBuffer))) {
                this._cheatBuffer = key;
                if (!allWords.some((word) => word.startsWith(this._cheatBuffer))) {
                    this._cheatBuffer = '';
                }
            }
        });


    }

    getCryptoPortalPosition() {
        const platformRects = this.levelPlatforms.map((def) => {
            const cfg = def?.config || {};
            const width = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.width || 100);
            const height = cfg.type === 'CIRCLE' ? ((cfg.radius || 50) * 2) : (cfg.height || 100);
            return {
                x: def.x,
                y: def.y,
                width,
                height
            };
        }).filter((rect) => rect.width >= 200 && rect.height <= 80);

        if (platformRects.length === 0) {
            return {
                x: this.worldWidth * 0.75,
                y: this.worldHeight * 0.35
            };
        }

        const minY = Math.min(...platformRects.map((rect) => rect.y));
        const upperFloorPlatforms = platformRects.filter((rect) => rect.y <= (minY + 140));
        const worldMidX = this.worldWidth * 0.5;

        const sorted = upperFloorPlatforms.sort((a, b) => {
            if (b.width !== a.width) {
                return b.width - a.width;
            }
            const aMidX = a.x + (a.width * 0.5);
            const bMidX = b.x + (b.width * 0.5);
            return Math.abs(aMidX - worldMidX) - Math.abs(bMidX - worldMidX);
        });

        const pick = sorted[0] || platformRects[0];
        return {
            x: pick.x + (pick.width * 0.5),
            y: Math.max(140, pick.y - 120)
        };
    }

    createPlatform(x, y, config, defRef = null) {
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

        this.refreshEditorHudScale();

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
            handle.setStrokeStyle(6, 0xffcc00, 1);
            handle.setFillStyle(0xffcc00, 0.15);
            handle.setDepth(3500);
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
            portal1: this.portal1Pos,
            racePortal: this.racePortalPos,
            zombiesPortal: this.zombiesPortalPos,
            platforms: exportPlatforms
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
        this.debugLabel = this.add.text(16, 700, 'Debug mode', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#ff4444',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(2000).setVisible(isDebugMode());
        this.cryptoStatusText = this.add.text(16, 40, "", {
            fontFamily: "monospace",
            fontSize: "18px",
            color: "#9fe8ff",
            stroke: "#000000",
            strokeThickness: 3
        }).setScrollFactor(0);
        this.coinText = this.add.text(16, 40, "Coins: 0", {
            fontFamily: "monospace",
            fontSize: "18px",
            color: "#ffd54a",
            stroke: "#000000",
            strokeThickness: 3
        }).setScrollFactor(0);
        this.coinText.setPosition(16, 64);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    buildCoinTargets(totalCoins) {
        const coinRadius = 9;
        const coinClearance = 12;
        const targets = [];

        const eligiblePlatforms = this.levelPlatforms.filter((def) => {
            const cfg = def?.config || {};
            const width = def?.__editorBounds?.width || cfg.width || ((cfg.radius || 0) * 2);
            const height = def?.__editorBounds?.height || cfg.height || ((cfg.radius || 0) * 2);
            return width >= 60 && height >= 20;
        });

        if (eligiblePlatforms.length === 0) {
            return targets;
        }

        const counts = new Array(eligiblePlatforms.length).fill(Math.floor(totalCoins / eligiblePlatforms.length));
        let remainder = totalCoins % eligiblePlatforms.length;
        for (let i = 0; i < counts.length && remainder > 0; i += 1) {
            counts[i] += 1;
            remainder -= 1;
        }

        eligiblePlatforms.forEach((def, platformIndex) => {
            const cfg = def.config || {};
            const countForPlatform = counts[platformIndex];
            if (countForPlatform <= 0) {
                return;
            }

            const boundsX = def?.__editorBounds?.x ?? def.x;
            const boundsY = def?.__editorBounds?.y ?? def.y;
            const width = def?.__editorBounds?.width || cfg.width || 100;
            const coinY = boundsY - coinRadius - coinClearance;
            const margin = 18;
            const usableWidth = Math.max(10, width - (margin * 2));

            for (let i = 0; i < countForPlatform; i += 1) {
                const t = (i + 1) / (countForPlatform + 1);
                const x = boundsX + margin + (usableWidth * t);
                let safeY = coinY;
                let pushUp = 0;
                const maxPushUp = 260;
                while (this.isCoinInsideAnyPlatform(x, safeY, coinRadius) && pushUp <= maxPushUp) {
                    safeY -= 12;
                    pushUp += 12;
                }

                if (this.isCoinInsideAnyPlatform(x, safeY, coinRadius)) {
                    continue;
                }

                targets.push({ x, y: safeY, radius: coinRadius });
            }
        });

        return targets;
    }

    persistHubProgress() {
        saveHubProgress({
            coinsActivated: this.coinsActivated,
            collectedCoinIndices: Array.from(this.collectedCoinIndices),
            portalUnlocked: this.portalUnlocked,
            spawnedCoinTotal: this.spawnedCoinTotal,
            sillyCompleted: this.sillyCompleted
        });
    }

    updateDealWithItGraffitiVisibility() {
        if (!this.dealWithItGraffiti) {
            return;
        }

        const shouldShow = this.collectedCoins >= 90 || this.dealWithItCheatEnabled;
        if (!shouldShow) {
            this.dealWithItGraffiti.setVisible(false);
            this.dealWithItGraffiti.setAlpha(0);
            this.dealWithItGraffitiShown = false;
            return;
        }

        this.dealWithItGraffiti.setVisible(true);
        if (this.dealWithItGraffitiShown) {
            this.dealWithItGraffiti.setAlpha(1);
            return;
        }

        this.dealWithItGraffiti.setAlpha(0);
        this.tweens.add({
            targets: this.dealWithItGraffiti,
            alpha: 1,
            duration: 720,
            ease: 'Sine.easeOut'
        });
        this.dealWithItGraffitiShown = true;
    }

    handleDealWithItCheatInput(event) {
        if (!isDebugMode()) {
            return;
        }
        const key = typeof event?.key === 'string' ? event.key.toUpperCase() : '';
        if (!key) {
            return;
        }

        if (key === 'BACKSPACE') {
            this.dealWithItCheatBuffer = this.dealWithItCheatBuffer.slice(0, -1);
            return;
        }

        if (!/^[A-Z]$/.test(key)) {
            return;
        }

        const target = 'DEALWITHIT';
        this.dealWithItCheatBuffer = (this.dealWithItCheatBuffer + key).slice(-target.length);
        if (this.dealWithItCheatBuffer !== target) {
            return;
        }

        this.dealWithItCheatEnabled = true;
        this.updateDealWithItGraffitiVisibility();
        this.showEditorToast('DEALWITHIT cheat activated');
    }

    spawnRemainingCoinsFromProgress() {
        this.coins.forEach((coin) => {
            if (coin?.active) {
                coin.destroy();
            }
        });
        this.coins = [];

        this.coinTargets.forEach((target, index) => {
            if (this.collectedCoinIndices.has(index)) {
                return;
            }

            const coin = this.add.circle(target.x, target.y, target.radius, 0xb87333, 1);
            coin.setStrokeStyle(3, 0xfff2a8, 1);
            coin.setDepth(12);
            coin.__collected = false;
            coin.__airdropping = false;
            coin.__coinIndex = index;
            this.coins.push(coin);
        });
    }

    restoreHubProgress() {
        const hubProgress = getHubProgress() || {};
        const savedIndices = Array.isArray(hubProgress.collectedCoinIndices)
            ? hubProgress.collectedCoinIndices
            : [];

        const validIndices = savedIndices.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < this.spawnedCoinTotal);
        this.collectedCoinIndices = new Set(validIndices);
        this.collectedCoins = this.collectedCoinIndices.size;
        this.coinsActivated = !!hubProgress.coinsActivated;
        this.sillyCompleted = !!hubProgress.sillyCompleted;
        this.portalUnlocked = this.collectedCoins >= this.requiredCoinsToUnlockPortal || !!hubProgress.portalUnlocked;
        this.racePortalUnlocked = this.sillyCompleted && this.collectedCoins >= this.requiredCoinsToUnlockRacePortal;

        this.coinText.setText(`Coins: ${this.collectedCoins}`);
        this.updateDealWithItGraffitiVisibility();

        if (this.coinsActivated) {
            this.spawnRemainingCoinsFromProgress();
        }

        this.persistHubProgress();
    }

    activateCoinAirdrop() {
        if (this.coinsActivated || this.coinsDropping) {
            return;
        }

        if (!Array.isArray(this.coinTargets) || this.coinTargets.length === 0) {
            this.showEditorToast('No coin targets available');
            return;
        }

        this.coinsActivated = true;
        this.coinsDropping = true;
        this.collectedCoinIndices.clear();
        this.collectedCoins = 0;
        this.coinText.setText('Coins: 0');
        this.persistHubProgress();

        this.coinTargets.forEach((target, index) => {
            const coin = this.add.circle(target.x, -40, target.radius, 0xb87333, 1);
            coin.setStrokeStyle(3, 0xfff2a8, 1);
            coin.setDepth(12);
            coin.__collected = false;
            coin.__airdropping = true;
            coin.__coinIndex = index;
            this.coins.push(coin);

            const dropDistance = target.y + 40;
            const duration = 320 + Math.min(900, dropDistance * 0.35);
            this.tweens.add({
                targets: coin,
                y: target.y,
                duration,
                ease: 'Cubic.easeIn',
                delay: (index % 15) * 22,
                onComplete: () => {
                    coin.__airdropping = false;
                }
            });
        });

        this.time.delayedCall(1300, () => {
            this.coinsDropping = false;
            this.showEditorToast(`Airdrop complete (${this.spawnedCoinTotal} coins)`);
        });

        this.time.addEvent({
            delay: 650,
            loop: true,
            callback: () => {
                this.coins.forEach((coin, index) => {
                    if (!coin.active || coin.__collected || coin.__airdropping) {
                        return;
                    }
                    this.tweens.add({
                        targets: coin,
                        y: coin.y - 5,
                        duration: 220,
                        yoyo: true,
                        ease: 'Sine.easeInOut',
                        delay: (index % 8) * 18
                    });
                });
            }
        });
    }

    isCoinInsideAnyPlatform(x, y, radius) {
        const MatterLib = Phaser.Physics.Matter.Matter;
        const bodies = this.matter.world.localWorld.bodies.filter((body) => {
            if (!body.isStatic || body.isSensor) {
                return false;
            }
            const category = body.collisionFilter?.category;
            return category === this.cats.GROUND || category === this.cats.ONE_WAY;
        });

        if (bodies.length === 0) {
            return false;
        }

        const samplePoints = [
            { x, y },
            { x: x - radius, y },
            { x: x + radius, y },
            { x, y: y - radius },
            { x, y: y + radius }
        ];

        return samplePoints.some((point) => MatterLib.Query.point(bodies, point).length > 0);
    }

    collectNearbyCoins() {
        if (!this.coinsActivated) {
            return;
        }

        const pickupRadius = 28;
        const pickupRadiusSq = pickupRadius * pickupRadius;
        let progressChanged = false;

        this.coins.forEach((coin) => {
            if (!coin.active || coin.__collected) {
                return;
            }

            if (coin.__airdropping) {
                return;
            }

            const dx = this.player.x - coin.x;
            const dy = this.player.y - coin.y;
            if ((dx * dx) + (dy * dy) > pickupRadiusSq) {
                return;
            }

            coin.__collected = true;
            this.collectedCoins += 1;
            if (Number.isInteger(coin.__coinIndex)) {
                this.collectedCoinIndices.add(coin.__coinIndex);
            }
            this.coinText.setText(`Coins: ${this.collectedCoins}`);
            this.updateDealWithItGraffitiVisibility();
            progressChanged = true;

            this.tweens.add({
                targets: coin,
                scale: 1.8,
                alpha: 0,
                duration: 110,
                onComplete: () => coin.destroy()
            });
        });

        if (!this.portalUnlocked && this.collectedCoins >= this.requiredCoinsToUnlockPortal) {
            this.portalUnlocked = true;
            if (this.portal1.isPlayerTouching) {
                this.setPortalTexture(this.portal1, 'speedrun');
            }
            this.showEditorToast('Portal unlocked');
            progressChanged = true;
        }

        if (!this.racePortalUnlocked && this.sillyCompleted && this.collectedCoins >= this.requiredCoinsToUnlockRacePortal) {
            this.racePortalUnlocked = true;
            this.showEditorToast('Race to the Bottom unlocked');
            progressChanged = true;
        }

        if (progressChanged) {
            this.persistHubProgress();
        }
    }

    updateGuidanceArrows() {
        if (!this.guidanceArrows || this.guidanceArrows.length === 0) return;
        if (this.coinsActivated) {
            this.guidanceArrows.forEach((a) => {
                this.tweens.killTweensOf(a);
                a.destroy();
            });
            this.guidanceArrows = [];
            return;
        }
        const px = this.player.x;
        const py = this.player.y;
        this.guidanceArrows.forEach((arrow) => {
            if (arrow.__reached) return;
            const dx = px - arrow.x;
            const dy = py - arrow.y;
            if (dx * dx + dy * dy < 120 * 120) {
                arrow.__reached = true;
                this.tweens.killTweensOf(arrow);
                arrow.setAlpha(0.3);
                arrow.setTint(0x333333);
                this.tweens.add({
                    targets: arrow,
                    alpha: 0,
                    duration: 1000,
                    onComplete: () => arrow.destroy()
                });
            }
        });
    }

    setPortalTexture(portal, textureKey) {
        if (!portal) {
            return;
        }
        portal.setTexture(textureKey);
        if (portal.visualProxy) {
            portal.visualProxy.setTexture(textureKey);
        }
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

    update() {
        this.player.update();
        this.collectNearbyCoins();
        this.updateDealWithItGraffitiVisibility();
        this.updateGuidanceArrows();
        this.hintText.setText("");
        this.cryptoStatusText.setText('');

        if (!this.portalUnlocked) {
            this.setPortalTexture(this.portal1, 'speedrun_bw');
        } else if (this.portal1.isPlayerTouching) {
            this.setPortalTexture(this.portal1, 'speedrun');
        }

        if (!this.racePortalUnlocked) {
            this.setPortalTexture(this.racePortal, 'race_bottom_bw');
        } else if (this.racePortal.isPlayerTouching) {
            this.setPortalTexture(this.racePortal, 'race_bottom');
        }

        if (this.zombiesPortal && this.zombiesPortal.isPlayerTouching) {
            this.setPortalTexture(this.zombiesPortal, 'zombies');
        } else {
            this.setPortalTexture(this.zombiesPortal, 'zombies_bw');
        }

        if (this.cryptoHintUntil > this.time.now) {
            this.cryptoStatusText.setText(this.cryptoHintMessage);
        }

        if (this.cryptoPortal && this.cryptoPortal.isPlayerTouching) {
            if (!this.coinsActivated) {
                this.hintText.setText('Press ENTER for an airdrop');
            } else {
                this.hintText.setText('Press ENTER to check coins left');
            }

            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                if (!this.coinsActivated) {
                    this.activateCoinAirdrop();
                } else {
                    const coinsLeft = Math.max(0, this.spawnedCoinTotal - this.collectedCoins);
                    this.cryptoHintMessage = `Coins left: ${coinsLeft}`;
                    this.cryptoHintUntil = this.time.now + 1600;
                }
            }
        } else if (this.cryptoHintUntil > this.time.now) {
            this.hintText.setText(this.cryptoHintMessage);
        }

        if (this.racePortal && this.racePortal.isPlayerTouching) {
            if (!this.racePortalUnlocked) {
                const raceReq = this.requiredCoinsToUnlockRacePortal;
                const sillyReq = this.sillyCompleted ? 'done' : 'not done';
                this.hintText.setText(`Race to the Bottom needs ${raceReq} coins (${this.collectedCoins}/${raceReq}) + Silly Speed Run ${sillyReq}`);
                return;
            }

            this.hintText.setText('Press ENTER for Race to the Bottom');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.persistHubProgress();
                this.scene.start('BottomRaceScene');
                return;
            }
        }

        if (this.zombiesPortal && this.zombiesPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER for Zombie Horde');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.persistHubProgress();
                this.scene.start('ZombieHordeScene');
                return;
            }
        }

        if(this.portal1.isPlayerTouching) {
            if (!this.portalUnlocked) {
                this.hintText.setText(`Collect ${this.requiredCoinsToUnlockPortal} coins first (${this.collectedCoins}/${this.requiredCoinsToUnlockPortal})`);
                return;
            }

            this.hintText.setText("Press ENTER to enter the Portal");

            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.persistHubProgress();
                this.scene.start('SillySpeedRunScene');
            }
        }
    }
}