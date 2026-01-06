// --- TUNING CONFIGURATION ---
const PhysicsConfig = {
    mass: 5,
    friction: 0.005,        // Slightly higher for stability on slopes
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
    slopeStickForce: 0.02,   // Increased slightly to prevent "launching" off ramps
    rotationLerp: 0.15       // How fast we align to the slope (0.1 = slow, 1.0 = instant)
};

export default class Player extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y) {
        super(scene.matter.world, x, y, 'player1');
        scene.add.existing(this);

        const { width, height } = this;

        // --- 1. PHYSICS SETUP ---
        // We create a Chamfered Rectangle (smooth corners)
        const body = scene.matter.add.rectangle(x, y, width * 0.5, height * 0.9, {
            chamfer: { radius: 10 }, 
            friction: PhysicsConfig.friction,      
            frictionStatic: 0.0,  
            frictionAir: PhysicsConfig.frictionAir,     
            restitution: 0        
        });

        this.setExistingBody(body);
        
        // [FIX] Lock Physics Rotation. 
        // We will manually rotate the body to match the slope. 
        // This prevents the physics engine from tumbling us over.
        this.setFixedRotation(true); 
        
        this.setMass(PhysicsConfig.mass);
        this.setOrigin(0.5, 0.55);

        this.cursors = scene.input.keyboard.createCursorKeys();
        
        // State
        this.groundTimer = 0; 
        this.targetRotation = 0;
    }

    update() {
        // --- 2. DUAL RAYCAST SENSOR (The Fix) ---
        // We cast two rays (Left and Right) to find the exact geometry slope.
        // This works for Rotated Boxes AND Procedural Curves.
        
        const rayGap = (this.width * 0.5) * 0.4; // Distance from center to ray origin
        const rayLength = (this.height * 0.5) + 20; // How far down to check

        // Calculate world positions for rays (ignoring current player rotation for stability)
        const startLeft  = { x: this.x - rayGap, y: this.y };
        const startRight = { x: this.x + rayGap, y: this.y };
        const endLeft    = { x: this.x - rayGap, y: this.y + rayLength };
        const endRight   = { x: this.x + rayGap, y: this.y + rayLength };

        const bodies = this.scene.matter.world.localWorld.bodies;
        
        // Cast Rays
        const hitLeft = this.scene.matter.query.ray(bodies, startLeft, endLeft)
            .filter(c => c.body !== this.body && !c.body.isSensor)[0];
            
        const hitRight = this.scene.matter.query.ray(bodies, startRight, endRight)
            .filter(c => c.body !== this.body && !c.body.isSensor)[0];

        // Determine Ground State
        // We are grounded if EITHER ray hits something close enough
        const isGrounded = !!(hitLeft || hitRight);

        if (isGrounded) {
            this.groundTimer = 6;
        } else if (this.groundTimer > 0) {
            this.groundTimer--;
        }
        const hasFooting = this.groundTimer > 0;

        // --- 3. CALCULATE SLOPE ANGLE ---
        // [FIX] Added checks for .point to prevent crash on "grazing" hits
        if (hitLeft && hitRight && hitLeft.point && hitRight.point) {
            
            // Both feet on ground: Calculate exact angle between contact points
            const yDiff = hitRight.point.y - hitLeft.point.y;
            const xDiff = hitRight.point.x - hitLeft.point.x;
            this.targetRotation = Math.atan2(yDiff, xDiff);

        } else if (isGrounded) {
            // One foot hanging off...
            // (Keep existing logic)
        } else {
            // In Air: Rotate back to upright (0)
            this.targetRotation = 0;
        }
        
        // Apply Rotation Smoothly
        // Phaser.Math.Angle.RotateTo handles the "wrapping" (so 359° doesn't spin wildly to 1°)
        const nextAngle = Phaser.Math.Angle.RotateTo(this.rotation, this.targetRotation, PhysicsConfig.rotationLerp);
        this.setRotation(nextAngle);


        // --- 4. PHYSICS FORCES ---
        const velX = this.body.velocity.x;
        const speedAbs = Math.abs(velX);
        
        // Aerodynamic Drag
        if (speedAbs > PhysicsConfig.freeRollSpeed) {
            const dragForce = PhysicsConfig.dragCoeff * velX * velX;
            this.applyForce({ x: -Math.sign(velX) * dragForce, y: 0 });
        }

        // Stick to Slope (Downforce)
        // Prevents flying off when going down a ramp quickly
        if (hasFooting && !this.cursors.up.isDown) {
             this.applyForce({ x: 0, y: PhysicsConfig.slopeStickForce });
        }

        // --- 5. MOVEMENT & JUMP ---
        let currentKickForce = speedAbs > PhysicsConfig.freeRollSpeed ? PhysicsConfig.kickForceFast : PhysicsConfig.kickForceStart;

        if (this.cursors.left.isDown) {
            if (velX > -PhysicsConfig.maxKickSpeed) this.applyForce({ x: -currentKickForce, y: 0 });
            this.setFlipX(true);
        } else if (this.cursors.right.isDown) {
            if (velX < PhysicsConfig.maxKickSpeed) this.applyForce({ x: currentKickForce, y: 0 });
            this.setFlipX(false);
        }

        if (hasFooting && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.setVelocityY(0); 
            // Jump uses the Player's "Up" vector, so you jump Perpendicular to the slope
            // If you prefer jumping straight up, remove the rotation math here.
            const jumpVec = new Phaser.Math.Vector2(0, PhysicsConfig.jumpForce).rotate(this.rotation);
            this.applyForce(jumpVec);
            
            this.groundTimer = 0; 
            this.y -= 5; // Snap up slightly to clear ground
        }

        this.handleAnimations(hasFooting, speedAbs);
    }

    handleAnimations(isOnFloor, speedAbs) {
        if (!isOnFloor) {
            this.anims.stop();
            this.setTexture("player4");
            return;
        }
        if (this.cursors.down.isDown) {
            this.setTexture("player5");
            this.setFriction(0.1); 
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