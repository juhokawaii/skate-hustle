import { setSkin, getSkinLoadEntries, getPreviewPath, setCalibration } from './PlayerSkin.js';

export default class SkinSelectScene extends Phaser.Scene {
    constructor() {
        super('SkinSelectScene');
    }

    preload() {
        this.load.image('concrete_bg', 'assets/backgrounds/hubworld_background.png');

        // Load all 6 frames for each skin under preview-specific keys.
        for (let i = 0; i < 6; i++) {
            this.load.image(`s1_${i + 1}`, getPreviewPath('skin1', i));
            this.load.image(`s2_${i + 1}`, getPreviewPath('skin2', i));
        }
    }

    create() {
        this.selected = 'skin1';

        // Background
        const bg = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'concrete_bg');
        bg.setOrigin(0, 0);

        // Title
        this.add.text(this.scale.width / 2, 100, 'CHOOSE YOUR SKATER', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5, 0.5);

        // Positions
        const centerY = this.scale.height / 2;
        const leftX   = this.scale.width / 2 - 160;
        const rightX  = this.scale.width / 2 + 160;
        this.baseY    = centerY;
        this.leftX    = leftX;
        this.rightX   = rightX;

        // Highlight boxes (behind sprites)
        this.highlight1 = this.add.rectangle(leftX, centerY, 90, 90);
        this.highlight1.setStrokeStyle(4, 0xffcc00, 1);
        this.highlight1.setFillStyle(0xffcc00, 0.0);
        this.highlight1.setDepth(0);

        this.highlight2 = this.add.rectangle(rightX, centerY, 90, 90);
        this.highlight2.setStrokeStyle(4, 0xffcc00, 1);
        this.highlight2.setFillStyle(0xffcc00, 0.0);
        this.highlight2.setDepth(0);

        // --- Animations ---
        // Skin 1 idle pump
        if (!this.anims.exists('s1_idle_pump')) {
            this.anims.create({
                key: 's1_idle_pump',
                frames: [{ key: 's1_1' }, { key: 's1_2' }],
                frameRate: 1.5,
                repeat: -1
            });
        }
        // Skin 2 idle pump
        if (!this.anims.exists('s2_idle_pump')) {
            this.anims.create({
                key: 's2_idle_pump',
                frames: [{ key: 's2_1' }, { key: 's2_2' }],
                frameRate: 1.5,
                repeat: -1
            });
        }

        // --- Sprites (in front of highlight boxes) ---
        // Skin 1: facing right (as-is)
        this.skin1Sprite = this.add.sprite(leftX, centerY, 's1_1');
        this.skin1Sprite.setDepth(1);
        this.skin1Sprite.play('s1_idle_pump');

        // Skin 2: flipped to face left
        this.skin2Sprite = this.add.sprite(rightX, centerY, 's2_1');
        this.skin2Sprite.setDepth(1);
        this.skin2Sprite.setFlipX(true);
        this.skin2Sprite.play('s2_idle_pump');

        // Jump/crouch state
        this.isJumping  = false;
        this.isCrouching = false;

        // Instruction
        this.instructionText = this.add.text(this.scale.width / 2, this.scale.height - 100,
            'LEFT / RIGHT to select    ENTER to confirm', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#aaaaaa',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0.5);

        this.tweens.add({
            targets: this.instructionText,
            alpha: { from: 1, to: 0.4 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.updateHighlight();

        // Input
        this.cursors  = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        // Tilt tracking for calibration on confirm.
        // On iOS, the listener is deferred until permission is granted in confirmSelection().
        this._currentGamma = null;
        this._currentBeta  = null;
        this._onDeviceOrientation = null;

        const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
            && typeof DeviceOrientationEvent.requestPermission === 'function';
        if (!needsPermission) {
            this._startOrientationListener();
        }
    }

    updateHighlight() {
        if (this.selected === 'skin1') {
            this.highlight1.setAlpha(1);
            this.highlight2.setAlpha(0);
            this.skin1Sprite.setAlpha(1.0);
            this.skin2Sprite.setAlpha(0.35);
        } else {
            this.highlight1.setAlpha(0);
            this.highlight2.setAlpha(1);
            this.skin1Sprite.setAlpha(0.35);
            this.skin2Sprite.setAlpha(1.0);
        }
    }

    update() {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
            this.selected = 'skin1';
            this.updateHighlight();
        }
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
            this.selected = 'skin2';
            this.updateHighlight();
        }

        // Jump
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up) && !this.isJumping) {
            this.isJumping = true;
            const prefix = this.selected === 'skin1' ? 's1' : 's2';
            const sprite = this.selected === 'skin1' ? this.skin1Sprite : this.skin2Sprite;

            sprite.anims.stop();
            sprite.setTexture(`${prefix}_4`); // jump frame

            this.tweens.add({
                targets: sprite,
                y: this.baseY - 140,
                duration: 350,
                ease: 'Sine.easeOut',
                yoyo: true,
                onComplete: () => {
                    this.isJumping = false;
                    sprite.play(`${prefix}_idle_pump`);
                }
            });
        }

        // Crouch (hold down)
        if (this.cursors.down.isDown && !this.isJumping) {
            if (!this.isCrouching) {
                this.isCrouching = true;
                const prefix = this.selected === 'skin1' ? 's1' : 's2';
                const sprite = this.selected === 'skin1' ? this.skin1Sprite : this.skin2Sprite;
                sprite.anims.stop();
                sprite.setTexture(`${prefix}_5`); // crouch frame
            }
        } else if (this.isCrouching) {
            this.isCrouching = false;
            const prefix = this.selected === 'skin1' ? 's1' : 's2';
            const sprite = this.selected === 'skin1' ? this.skin1Sprite : this.skin2Sprite;
            sprite.play(`${prefix}_idle_pump`);
        }

        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.confirmSelection();
        }
    }

    confirmSelection() {
        setSkin(this.selected);

        // On iOS 13+, DeviceOrientationEvent.requestPermission() must be called
        // from a user gesture before deviceorientation events will fire.
        const needsPermission = typeof DeviceOrientationEvent !== 'undefined'
            && typeof DeviceOrientationEvent.requestPermission === 'function';

        if (needsPermission) {
            DeviceOrientationEvent.requestPermission()
                .then((state) => {
                    if (state === 'granted') {
                        this._startOrientationListener();
                        // Give a brief moment for orientation data to arrive before calibrating
                        this.time.delayedCall(200, () => this._finishConfirmation());
                    } else {
                        // Permission denied — proceed without tilt (keyboard/touch only)
                        this._finishConfirmation();
                    }
                })
                .catch(() => {
                    // Request failed — proceed without tilt
                    this._finishConfirmation();
                });
        } else {
            this._finishConfirmation();
        }
    }

    _startOrientationListener() {
        if (this._onDeviceOrientation) return; // already listening
        this._onDeviceOrientation = (event) => {
            if (event.gamma != null) this._currentGamma = event.gamma;
            if (event.beta  != null) this._currentBeta  = event.beta;
        };
        window.addEventListener('deviceorientation', this._onDeviceOrientation);
    }

    _finishConfirmation() {
        // Calibrate tilt — capture current phone orientation as neutral.
        if (this._currentGamma != null) {
            setCalibration(this._currentGamma, this._currentBeta);
        }

        // On mobile, enter fullscreen and lock to landscape.
        const isMobile = (navigator.maxTouchPoints || 0) > 0;
        if (isMobile) {
            try {
                this.scale.startFullscreen();
            } catch (_) { /* fullscreen may not be available */ }
            try {
                screen.orientation.lock('landscape').catch(() => {});
            } catch (_) { /* orientation lock may not be supported */ }
        }

        const entries = getSkinLoadEntries(this.selected);
        entries.forEach(({ key, path }) => {
            if (this.textures.exists(key)) {
                this.textures.remove(key);
            }
            this.load.image(key, path);
        });

        this.load.once('complete', () => {
            if (this._onDeviceOrientation) {
                window.removeEventListener('deviceorientation', this._onDeviceOrientation);
                this._onDeviceOrientation = null;
            }
            this.scene.start('SplashScene');
        });
        this.load.start();
    }
}
