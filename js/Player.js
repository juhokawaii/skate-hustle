// --- TUNING CONFIGURATION ---
const PhysicsConfig = {
    mass: 5,
    friction: 0.005,
    frictionAir: 0.0,
    
    // Movement
    kickForceStart: 0.015,
    kickForceFast: 0.005,
    maxKickSpeed: 15,
    
    // Aerodynamics
    freeRollSpeed: 7,
    dragCoeff: 0.00025,

    // Jump & Slope
    jumpForce: -0.25,
    slopeStickForce: 0.02 
};

export default class Player extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y) {
        super(scene.matter.world, x, y, 'player1');
        scene.add.existing(this);

        const { width, height } = this;

        // --- 1. PHYSICS SETUP ---
        const body = scene.matter.add.rectangle(x, y, width * 0.5, height * 0.9, {
            chamfer: { radius: 10 }, 
            friction: PhysicsConfig.friction,      
            frictionStatic: 0.0,  
            frictionAir: PhysicsConfig.frictionAir,     
            restitution: 0        
        });

        this.setExistingBody(body);
        
        // Lock rotation so the physics box never tips over
        this.setFixedRotation(true); 
        this.setMass(PhysicsConfig.mass);
        this.setOrigin(0.5, 0.55);

        this.cursors = scene.input.keyboard.createCursorKeys();
        
        // State
        this.groundTimer = 0; 
    }

    update() {
        // --- 2. GROUND DETECTION (Simplified) ---
        // We just need to know if we can jump/kick.
        const isGrounded = this.checkGrounded();

        if (isGrounded) {
            this.groundTimer = 6; // Coyote time
        } else if (this.groundTimer > 0) {
            this.groundTimer--;
        }
        const hasFooting = this.groundTimer > 0;

        // --- 3. PHYSICS FORCES ---
        const velX = this.body.velocity.x;
        const speedAbs = Math.abs(velX);
        
        // Aerodynamic Drag (Air resistance)
        if (speedAbs > PhysicsConfig.freeRollSpeed) {
            const dragForce = PhysicsConfig.dragCoeff * velX * velX;
            this.applyForce({ x: -Math.sign(velX) * dragForce, y: 0 });
        }

        // Slope Stick (Downforce)
        // Keeps player from flying off ramps when skating down
        if (hasFooting && !this.cursors.up.isDown) {
             this.applyForce({ x: 0, y: PhysicsConfig.slopeStickForce });
        }

        // --- 4. MOVEMENT & JUMP ---
        let currentKickForce = speedAbs > PhysicsConfig.freeRollSpeed ? PhysicsConfig.kickForceFast : PhysicsConfig.kickForceStart;

        if (this.cursors.left.isDown) {
            if (velX > -PhysicsConfig.maxKickSpeed) this.applyForce({ x: -currentKickForce, y: 0 });
            this.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            if (velX < PhysicsConfig.maxKickSpeed) this.applyForce({ x: currentKickForce, y: 0 });
            this.setFlipX(false);
        }

        // Jump
        if (hasFooting && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.setVelocityY(0); 
            // Simple vertical impulse
            this.applyForce({ x: 0, y: PhysicsConfig.jumpForce });
            this.groundTimer = 0; 
            this.y -= 5; // Snap up to clear friction
        }

        this.handleAnimations(hasFooting, speedAbs);
    }

    /**
     * Casts a single ray downwards to check for ground.
     */
    checkGrounded() {
        const rayLength = (this.height * 0.5) + 15; // Distance from center to below feet
        const startPoint = { x: this.x, y: this.y };
        const endPoint = { x: this.x, y: this.y + rayLength };

        const bodies = this.scene.matter.world.localWorld.bodies;
        const hit = this.scene.matter.query.ray(bodies, startPoint, endPoint)
            .filter(c => c.body !== this.body && !c.body.isSensor);

        return hit.length > 0;
    }

    handleAnimations(isOnFloor, speedAbs) {
        if (!isOnFloor) {
            this.anims.stop();
            this.setTexture("player4");
            return;
        }
        if (this.cursors.down.isDown) {
            this.setTexture("player5");
            this.setFriction(0.1); // Brake
            return;
        }
        this.setFriction(PhysicsConfig.friction);

        if (this.anims.isPlaying && this.anims.currentAnim.key === "kick") return;

        const isInput = this.cursors.left.isDown || this.cursors.right.isDown;
        const justPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left) || 
                            Phaser.Input.Keyboard.JustDown(this.cursors.right);
        
        if (speedAbs > 0.5) {
            if (isInput && justPressed && speedAbs < PhysicsConfig.maxKickSpeed) {
                this.play("kick");
            } else {
                this.play("idle_pump", true);
            }
        } else {
            this.play("idle_pump", true);
        }
    }
}