export default class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'player1');

        // Add to scene and enable physics
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Physics Configuration
        this.setCollideWorldBounds(true);
        this.setDragX(600);
        this.setMaxVelocity(600, 1200);
        this.body.setGravityY(2800);

        // Input Setup
        this.cursors = scene.input.keyboard.createCursorKeys();
        
        // State tracking for the "Landing" feel
        this.wasInAir = false;
    }

    update() {
        const body = this.body;
        const isOnFloor = body.blocked.down || body.touching.down;
        const currentSpeed = Math.abs(body.velocity.x);

        // --- 1. MOVEMENT INPUT ---
        if (this.cursors.left.isDown) {
            this.setAccelerationX(-900);
            this.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            this.setAccelerationX(900);
            this.setFlipX(false);
        } else {
            this.setAccelerationX(0);
        }

        // --- 2. JUMP INPUT ---
        if (isOnFloor && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.setVelocityY(-1000);
        }

        // --- 3. LANDING DETECTION ---
        if (isOnFloor && this.wasInAir) {
            this.onLand();
        }
        this.wasInAir = !isOnFloor;

        // --- 4. ANIMATION STATE MACHINE ---
        this.handleAnimations(isOnFloor, currentSpeed);
    }

    handleAnimations(isOnFloor, currentSpeed) {
        // Priority 1: AIRBORNE
        if (!isOnFloor) {
            this.anims.stop();
            this.setTexture("player4");
            return;
        }

        // Priority 2: BRAKE / TAIL-DOWN
        // Logic: If Down is held, force the tail-down texture even at 0 speed.
        if (this.cursors.down.isDown) {
            this.anims.stop();
            this.setTexture("player5");
            // Only apply heavy drag if we are actually moving
            if (currentSpeed > 0) {
                this.setDragX(2500);
            }
            return; 
        }

        // Reset drag to normal if not braking
        this.setDragX(600);

        // Priority 3: KICKING
        // Don't interrupt the kick animation while it is playing
        if (this.anims.isPlaying && this.anims.currentAnim.key === "kick") {
            return; 
        }

        // Priority 4: ROLLING
        if (currentSpeed > 20) {
            // Check for new kick input
            if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || 
                Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
                this.play("kick");
            } else {
                this.play("idle_pump", true);
            }
        } 
        // Priority 5: IDLE
        else {
            this.play("idle_pump", true);
        }
    }

    onLand() {
        // Impact feel: slight camera shake
        this.scene.cameras.main.shake(50, 0.003);
        // Instant visual fix for "jump lingering"
        this.setTexture("player1");
    }
}