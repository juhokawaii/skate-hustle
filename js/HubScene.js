import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { getHubProgress, saveHubProgress, isDebugMode, setDebugMode, setPrizePointUnlocked } from './GameState.js';
import { CATS } from './CollisionCategories.js';
import { loadLevelData } from './loadLevelData.js';
import BaseGameScene from './BaseGameScene.js';

export default class HubScene extends BaseGameScene {
    constructor() { super('HubScene'); }

    preload() {
        super.preload();
        this.load.json('hub_level', 'assets/levels/hubLevel.json');
        this.load.image("speedrun", "assets/backgrounds/speedrun.png");
        this.load.image("race_bottom", "assets/backgrounds/race-to-the-bottom.png");
        this.load.image("crypto", "assets/backgrounds/crypto.png");
        this.load.image("zombies", "assets/backgrounds/zombies.png");
        this.load.image("dealwithit", "assets/backgrounds/dealwithit.png");
        this.load.image("arrow_right", "assets/backgrounds/arrow-light.png");
        this.load.image("prize_point_color", "assets/backgrounds/prize-point.png");
        this.load.audio("secret", "assets/music/title.mp3");
        this.load.audio("ramp", "assets/music/ramp.mp3");
    }

    create(data = {}) {
        // --- BACKGROUND MUSIC ---
        this.sound.stopAll();
        this.bgmusic = this.sound.add("ramp", { volume: 1.0, loop: true });
        this.bgmusic.play();

        const level = loadLevelData(this, 'hub_level', data, {
            worldWidth:          6400,
            worldHeight:         1800,
            spawnPoint:          { x: 200, y: 950 },
            portal1Pos:          { x: 300, y: 1350 },
            racePortalPos:       { x: 1880, y: 1500 },
            zombiesPortalPos:    { x: 0, y: 0 },
            prizePointPortalPos: { x: 500, y: 400 }
        });
        this.worldWidth  = level.worldWidth;
        this.worldHeight = level.worldHeight;
        this.spawnPoint  = data.spawnPoint || level.spawnPoint;

        this.portal1Pos    = { x: level.portal1Pos.x,    y: level.portal1Pos.y - 100 };
        this.racePortalPos = { x: level.racePortalPos.x, y: level.racePortalPos.y - 130 };

        const defaultZombiesPos = {
            x: Math.round((level.portal1Pos.x + level.racePortalPos.x) * 0.5),
            y: Math.round((level.portal1Pos.y + level.racePortalPos.y) * 0.5)
        };
        const resolvedZombies = level.zombiesPortalPos.x ? level.zombiesPortalPos : defaultZombiesPos;
        this.zombiesPortalPos    = { x: resolvedZombies.x,    y: resolvedZombies.y - 115 };
        this.prizePointPortalPos = { x: 500, y: 400 };

        this.levelPlatforms = level.platforms.map((def) => ({
            ...def,
            x: def.x,
            y: def.y,
            config: { ...def.config }
        }));

        this.cats                = CATS;
        this.captureLevelData    = false;
        this.legacyCenteredInput = false;

        this.initEditorState();
        this.setupWorldBounds();

    
        // --- 1. BACKGROUND AND GRAFFITI---
        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, "concrete_bg");
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);


        
 
        
        TextureFactory.ensureGrayscaleTexture(this, 'speedrun', 'speedrun_bw');
        this.portal1 = new Graffiti(this, this.portal1Pos.x, this.portal1Pos.y, "speedrun_bw", "speedrun", this.cats.SENSOR);
        this.portal1.setScrollFactor(1, 1);
        this.portal1.enableParallaxVisual(0.85, 0.85, {
            alpha: 0.85
        });

        TextureFactory.ensureGrayscaleTexture(this, 'race_bottom', 'race_bottom_bw');
        this.racePortal = new Graffiti(this, this.racePortalPos.x, this.racePortalPos.y, "race_bottom_bw", "race_bottom", this.cats.SENSOR);
        this.racePortal.setScrollFactor(1, 1);
        this.racePortal.enableParallaxVisual(0.85, 0.85, {
            depth: -2,
            alpha: 0.70
        });

        TextureFactory.ensureGrayscaleTexture(this, 'zombies', 'zombies_bw');
        this.zombiesPortal = new Graffiti(this, this.zombiesPortalPos.x, this.zombiesPortalPos.y, 'zombies_bw', 'zombies', this.cats.SENSOR);
        this.zombiesPortal.setScrollFactor(1, 1);
        this.zombiesPortal.enableParallaxVisual(0.85, 0.85, {
            depth: -2,
            alpha: 0.74
        });

        TextureFactory.ensureGrayscaleTexture(this, 'prize_point_color', 'prize_point_bw');
        this.prizePointPortal = new Graffiti(this, this.prizePointPortalPos.x, this.prizePointPortalPos.y, 'prize_point_bw', 'prize_point_color', this.cats.SENSOR);
        this.prizePointPortal.setScrollFactor(1, 1);
        this.prizePointPortal.enableParallaxVisual(0.85, 0.85, {
            depth: -2,
            alpha: 0.85
        });

        const defaultCryptoPos = this.getCryptoPortalPosition();
        this.cryptoPortalPos = {
            x: Phaser.Math.Clamp(defaultCryptoPos.x - 600, 120, this.worldWidth - 120),
            y: Phaser.Math.Clamp(defaultCryptoPos.y - 150, 120, this.worldHeight - 120)
        };
        TextureFactory.ensureGrayscaleTexture(this, 'crypto', 'crypto_bw');
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
        this.setupCamera();

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

        this.setupMapEditor(this.buildDebugGrid());

        // Cheat codes: type "debug" to enable debug mode, then "silly" or "bottom" to jump to scenes
        this._cheatBuffer = '';
        const cheatCodes = {
            silly: 'SillySpeedRunScene',
            bottom: 'BottomRaceScene',
            zombie: 'ZombieHordeScene',
            prize: 'PrizePointScene'
        };
        const businessWord = 'business';
        const debugWord = 'debug';
        const cheatWords = Object.keys(cheatCodes);
        const allWords = [debugWord, businessWord, ...cheatWords];
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

            // BUSINESS unlock — permanently enters Prize Point
            if (this._cheatBuffer.endsWith(businessWord)) {
                setPrizePointUnlocked();
                this._cheatBuffer = '';
                this.persistHubProgress();
                this.scene.start('PrizePointScene');
                return;
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

    getRestartData() {
        return {
            worldWidth:          this.worldWidth,
            worldHeight:         this.worldHeight,
            levelPlatforms:      this.levelPlatforms,
            spawnPoint:          this.spawnPoint,
            portal1Pos:          this.portal1Pos,
            racePortalPos:       this.racePortalPos,
            zombiesPortalPos:    this.zombiesPortalPos,
            prizePointPortalPos: this.prizePointPortalPos
        };
    }

    getLevelPayload() {
        const base = super.getLevelPayload();
        return {
            ...base,
            portal1:          this.portal1Pos,
            racePortal:       this.racePortalPos,
            zombiesPortal:    this.zombiesPortalPos,
            prizePointPortal: this.prizePointPortalPos
        };
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

    setupZones(worldWidth, worldHeight) {
        this.hintText = this.add.text(16, 16, "", { fontFamily: "monospace", fontSize: "18px" }).setScrollFactor(0);
        this.setupDebugLabel();
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

        if (this.prizePointPortal && this.prizePointPortal.isPlayerTouching) {
            this.hintText.setText('Press ENTER for Prize Point');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.persistHubProgress();
                this.scene.start('PrizePointScene');
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