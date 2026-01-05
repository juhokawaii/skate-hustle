class MainScene extends Phaser.Scene {
    constructor() {
        super("MainScene");
    }

    preload() {
        this.load.image("player1", "assets/player1.png"); // standing
        this.load.image("player2", "assets/player2.png"); // pumping
        this.load.image("player3", "assets/player3.png"); // kicking
        this.load.image("player4", "assets/player4.png"); // jump
        this.load.image("player5", "assets/player5.png"); // brake
    }

    create() {
        const worldWidth = 3000;
        const worldHeight = 720;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBackgroundColor("#3b3b3b");

        // --- GROUND ---
        const groundHeight = 100;
        const groundY = worldHeight - (groundHeight / 2);
        const ground = this.add.rectangle(worldWidth / 2, groundY, worldWidth, groundHeight, 0x333333);
        this.physics.add.existing(ground, true);

        // --- PLAYER ---
        this.player = this.physics.add.sprite(200, groundY - 100, "player1");
        this.player.setCollideWorldBounds(true);
        this.player.setDragX(600); 
        this.player.setMaxVelocity(600, 1200);
        this.player.body.setGravityY(2800); // Heavy gravity for snappier feel

        this.physics.add.collider(this.player, ground);

        // --- CAMERA ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // --- INPUT ---
        this.cursors = this.input.keyboard.createCursorKeys();
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        // --- ANIMATIONS ---
        this.anims.create({
            key: "idle_pump",
            frames: [{ key: "player1" }, { key: "player2" }],
            frameRate: 3,
            repeat: -1
        });

        this.anims.create({
            key: "kick",
            frames: [{ key: "player2" }, { key: "player3" }, { key: "player1" }],
            frameRate: 12,
            repeat: 0
        });

        // --- UI & ZONE ---
        this.hintText = this.add.text(16, 16, "", { fontFamily: "monospace", fontSize: "18px" }).setScrollFactor(0);
        this.arcadeZone = this.add.rectangle(worldWidth - 250, groundY - 100, 200, 200, 0x00ff00, 0.1);
        this.physics.add.existing(this.arcadeZone, true);
    }

    update() {
        const body = this.player.body;
        const isOnFloor = body.blocked.down || body.touching.down;
        const currentSpeed = Math.abs(body.velocity.x);
        
        // 1. Reset UI
        this.hintText.setText("");
        if (this.physics.overlap(this.player, this.arcadeZone)) {
            this.hintText.setText("Press ENTER to enter the Arcade");
        }

        // 2. Horizontal Movement
        if (this.cursors.left.isDown) {
            this.player.setAccelerationX(-900);
            this.player.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.player.setAccelerationX(900);
            this.player.setFlipX(false);
        } else {
            this.player.setAccelerationX(0);
        }

        // 3. Jump Input
        if (isOnFloor && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.player.setVelocityY(-1000);
        }

        // 4. ANIMATION STATE MACHINE (Snappy Logic)
        
        // Priority 1: AIRBORNE
        if (!isOnFloor) {
            this.player.anims.stop(); // Stop any walking/kicking anims
            this.player.setTexture("player4"); // Force jump frame
        } 
        // Priority 2: JUST LANDED / ON GROUND
        else {
            if (currentSpeed > 100 && this.cursors.down.isDown) {
                // Braking
                this.player.anims.stop();
                this.player.setTexture("player5");
                this.player.setDragX(2000); 
            } 
            else if (currentSpeed > 20) {
                // Moving - decide between Kick and Cruise
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim.key !== "kick") {
                    // If we just hit the ground, we might want to kick or just pump
                    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
                        this.player.play("kick", true);
                    } else {
                        this.player.play("idle_pump", true);
                    }
                }
                this.player.setDragX(600);
            } 
            else {
                // Static Idle
                this.player.play("idle_pump", true);
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scene: [MainScene]
};

new Phaser.Game(config);