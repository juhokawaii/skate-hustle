export default class SplashScene extends Phaser.Scene {
    constructor() {
        super('SplashScene');
        this.seenFlagKey = 'skatehustle.seenSplash.v1';
    }

    preload() {
        this.load.image('splash_logo', 'assets/backgrounds/logo-full.png');
        this.load.audio('splash_title', 'assets/music/title.mp3');
    }

    create() {
        if (this.hasSeenSplash()) {
            this.scene.start('HubScene');
            return;
        }

        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0d0d0f);
        bg.setOrigin(0, 0);

        const logo = this.add.image(cx, cy, 'splash_logo');
        logo.setAlpha(0.95);
        logo.setScale(0.9);

        const tipsLabel = this.add.text(16, 16, 'Tips appear here', {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#f4f4f4',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0, 0);

        this.tweens.add({
            targets: logo,
            alpha: { from: 0.85, to: 1.0 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.add.text(cx, cy + 150, 'Arrows do the arrowy things.\nEnter - well duh - enters.\nWatch for tips top left!', {
            fontFamily: 'monospace',
            fontSize: '28px',
            align: 'center',
            color: '#f4f4f4',
            stroke: '#000000',
            strokeThickness: 5,
            lineSpacing: 8
        }).setOrigin(0.5, 0.5);

        const prompt = this.add.text(cx, this.scale.height - 85, 'Press ENTER to enter the hub world', {
            fontFamily: 'monospace',
            fontSize: '26px',
            align: 'center',
            color: '#ffe37a',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5, 0.5);

        this.tweens.add({
            targets: prompt,
            alpha: { from: 0.45, to: 1.0 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.tweens.add({
            targets: tipsLabel,
            alpha: { from: 0.45, to: 1.0 },
            duration: 3500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.splashMusic = this.sound.add('splash_title', { volume: 0.85, loop: true });
        this.splashMusic.play();

        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    update() {
        if (!this.enterKey) {
            return;
        }

        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.markSplashSeen();
            if (this.splashMusic) {
                this.splashMusic.stop();
            }
            this.scene.start('HubScene');
        }
    }

    hasSeenSplash() {
        try {
            return window.localStorage.getItem(this.seenFlagKey) === '1';
        } catch (err) {
            return false;
        }
    }

    markSplashSeen() {
        try {
            window.localStorage.setItem(this.seenFlagKey, '1');
        } catch (err) {
            // Ignore storage failures; splash can still proceed.
        }
    }
}
