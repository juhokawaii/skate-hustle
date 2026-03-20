import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';
import { CATS } from './CollisionCategories.js';

export default class SplashScene extends Phaser.Scene {
    constructor() {
        super('SplashScene');
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
        this.load.spritesheet('graffiti', 'assets/backgrounds/Atlas.png', {
            frameWidth: 512,
            frameHeight: 512
        });

        this.load.image('logo_portal_bw', 'assets/backgrounds/logo-full-bw.png');
        this.load.image('logo_portal', 'assets/backgrounds/logo-full.png');
    }

    create() {
        this.worldWidth = 1280;
        this.worldHeight = 720;
        this.cats = CATS;

        this.matter.world.setBounds(0, 0, this.worldWidth, this.worldHeight, 1000, true, true, true, true);
        Object.values(this.matter.world.walls).forEach((wall) => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });

        const bg = this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, 'concrete_bg');
        bg.setOrigin(0, 0);
        bg.setDepth(-10);

        this.createPlatform(0, this.worldHeight - 60, this.worldWidth, 60);

        this.portal = new Graffiti(this, 1170, 390, 'logo_portal_bw', 'logo_portal', this.cats.SENSOR);
        this.portal.setScrollFactor(1, 1);
        this.portal.enableParallaxVisual(1, 1, {
            depth: -2,
            alpha: 1
        });
        this.portal.setScale(0.9);

        this.portalActivated = false;
        this.setPortalTexture('logo_portal_bw');

        this.player = new Player(this, 180, 560, this.cats);
        this.player.setDepth(10);

        this.setupAnims();

        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(260, 120);
        this.cameras.main.setFollowOffset(0, 70);
        this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);

        this.hintText = this.add.text(16, 16, '', { fontFamily: 'monospace', fontSize: '18px' }).setScrollFactor(0);
        this.hintText.setDepth(2000);

        this.instructionText = this.add.text(28, 80, '', {
            fontFamily: 'monospace',
            fontSize: '28px',
            align: 'left',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            wordWrap: { width: Math.floor(this.scale.width * 0.46), useAdvancedWrap: true }
        });
        this.instructionText.setOrigin(0, 0);
        this.instructionText.setScrollFactor(0);
        this.instructionText.setDepth(2100);

        const step0Style = {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        };
        const step0HighlightStyle = {
            ...step0Style,
            fontSize: '30px'
        };
        this.step0PrefixText = this.add.text(28, 80, 'Look at the ', step0Style);
        this.step0PrefixText.setOrigin(0, 0);
        this.step0PrefixText.setScrollFactor(0);
        this.step0PrefixText.setDepth(2100);
        this.step0PrefixText.setVisible(false);

        this.step0HighlightText = this.add.text(28 + this.step0PrefixText.width, 80, 'TOP LEFT', step0HighlightStyle);
        this.step0HighlightText.setOrigin(0, 0);
        this.step0HighlightText.setScrollFactor(0);
        this.step0HighlightText.setDepth(2100);
        this.step0HighlightText.setVisible(false);

        this.step0SuffixText = this.add.text(28, 124, "\nYou'll find info and tips there\nNow press RIGHT to go collect your first coin", {
            ...step0Style,
            align: 'left',
            wordWrap: { width: Math.floor(this.scale.width * 0.46), useAdvancedWrap: true }
        });
        this.step0SuffixText.setOrigin(0, 0);
        this.step0SuffixText.setScrollFactor(0);
        this.step0SuffixText.setDepth(2100);
        this.step0SuffixText.setVisible(false);

        this.instructionHighlightTween = this.tweens.add({
            targets: this.step0HighlightText,
            alpha: { from: 0.45, to: 1.0 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            paused: true
        });

        this.step3HighlightText = this.add.text(28, 128, 'Turn up the volume, and', {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.step3HighlightText.setOrigin(0, 0);
        this.step3HighlightText.setScrollFactor(0);
        this.step3HighlightText.setDepth(2100);
        this.step3HighlightText.setVisible(false);

        this.step3HighlightTween = this.tweens.add({
            targets: this.step3HighlightText,
            alpha: { from: 0.45, to: 1.0 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            paused: true
        });

        this.coinText = this.add.text(16, 40, 'Coins: 0', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffd54a',
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0);
        this.coinText.setDepth(2000);

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

        this.tutorialStep = 0;
        this.collectedCoins = 0;
        this.requiredBrakeFrames = 18;
        this.downHeldFrames = 0;
        this.coinA = null;
        this.coinB = null;

        this.setInstructionForStep(0);
        this.spawnTutorialCoinA();
    }

    createPlatform(x, y, width, height) {
        const centerX = x + (width / 2);
        const centerY = y + (height / 2);
        const body = this.matter.add.rectangle(centerX, centerY, width, height, {
            isStatic: true,
            friction: 0.8
        });

        body.collisionFilter.category = this.cats.GROUND;
        TextureFactory.styleRectangle(this, centerX, centerY, width, height, body, 'ground');
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

    spawnTutorialCoinA() {
        if (this.coinA?.active) {
            this.coinA.destroy();
        }
        const firstCoinY = this.worldHeight - 60 - 22;
        this.coinA = this.add.circle(860, firstCoinY, 12, 0xb87333, 1);
        this.coinA.setStrokeStyle(3, 0xfff2a8, 1);
        this.coinA.setDepth(12);
    }

    spawnTutorialCoinB() {
        if (this.coinB?.active) {
            this.coinB.destroy();
        }
        this.coinB = this.add.circle(260, 468, 12, 0xb87333, 1);
        this.coinB.setStrokeStyle(3, 0xfff2a8, 1);
        this.coinB.setDepth(12);
    }

    collectCoinIfNearby(coin, useDeckBottom = false) {
        if (!coin || !coin.active) {
            return false;
        }

        const probeX = this.player.x;
        const probeY = useDeckBottom ? (this.player.y + 22) : this.player.y;
        const dx = probeX - coin.x;
        const dy = probeY - coin.y;
        const pickupRadius = 32;
        if ((dx * dx) + (dy * dy) > (pickupRadius * pickupRadius)) {
            return false;
        }

        this.collectedCoins += 1;
        this.coinText.setText(`Coins: ${this.collectedCoins}`);
        this.tweens.add({
            targets: coin,
            scale: 1.8,
            alpha: 0,
            duration: 120,
            onComplete: () => coin.destroy()
        });
        return true;
    }

    setInstructionForStep(step) {
        if (step === 0) {
            this.instructionText.setVisible(false);
            this.step0PrefixText.setVisible(true);
            this.step0HighlightText.setVisible(true);
            this.step0SuffixText.setVisible(true);
            this.instructionHighlightTween.resume();
            return;
        }

        this.instructionHighlightTween.pause();
        this.step0HighlightText.setAlpha(1);
        this.step0PrefixText.setVisible(false);
        this.step0HighlightText.setVisible(false);
        this.step0SuffixText.setVisible(false);
        this.step3HighlightTween.pause();
        this.step3HighlightText.setAlpha(1);
        this.step3HighlightText.setVisible(false);
        this.instructionText.setVisible(true);

        if (step === 1) {
            this.instructionText.setText('Good. Now move LEFT and press UP to jump. Use your deck to collect the next coin.');
            return;
        }
        if (step === 2) {
            this.instructionText.setText('Got it. Hold DOWN to brake and stabilize your board.');
            return;
        }
        if (step === 3) {
            this.instructionText.setText('Go to the graffiti to light it up.\n\n\nTHEN PRESS ENTER.');
            this.step3HighlightText.setVisible(true);
            this.step3HighlightTween.resume();
        }
    }

    advanceTutorialStep(nextStep) {
        if (nextStep <= this.tutorialStep) {
            return;
        }

        this.tutorialStep = nextStep;
        this.setInstructionForStep(this.tutorialStep);

        if (this.tutorialStep === 1) {
            this.spawnTutorialCoinB();
        } else if (this.tutorialStep === 3) {
            this.portalActivated = true;
            this.setPortalTexture('logo_portal');
        }
    }

    setPortalTexture(textureKey) {
        if (!this.portal) {
            return;
        }

        this.portal.setTexture(textureKey);
        if (this.portal.visualProxy) {
            this.portal.visualProxy.setTexture(textureKey);
        }
    }

    enterHubScene() {
        this.scene.start('HubScene');
    }

    update() {
        this.player.update();

        if (!this.portalActivated) {
            this.setPortalTexture('logo_portal_bw');
        } else {
            this.setPortalTexture(this.portal.isPlayerTouching ? 'logo_portal' : 'logo_portal_bw');
        }

        if (this.portal.isPlayerTouching) {
            this.hintText.setText('Press ENTER to enter the Hub');
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                this.enterHubScene();
                return;
            }
        } else {
            this.hintText.setText('Tutorial room active');
        }

        if (this.tutorialStep === 0 && this.collectCoinIfNearby(this.coinA, false)) {
            this.advanceTutorialStep(1);
        }

        if (this.tutorialStep === 1 && this.collectCoinIfNearby(this.coinB, true)) {
            this.advanceTutorialStep(2);
        }

        if (this.tutorialStep === 2) {
            if (this.downKey.isDown) {
                this.downHeldFrames += 1;
            } else {
                this.downHeldFrames = 0;
            }

            if (this.downHeldFrames >= this.requiredBrakeFrames) {
                this.advanceTutorialStep(3);
            }
        }
    }
}
