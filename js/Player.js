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
    slopeStickForce: 0.02,
    
    // Visuals
    leanSpeed: 0.1 
};

export default class Player extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y, cats) {
        super(scene.matter.world, x, y, 'player1');
        scene.add.existing(this);
        
        this.cats = cats;

        const { width } = this;

        // --- 1. PHYSICS SETUP ---
        const radius = width * 0.25;
        
        const body = scene.matter.add.circle(x, y, radius, {
            friction: PhysicsConfig.friction,      
            frictionStatic: 0.0,  
            frictionAir: PhysicsConfig.frictionAir,     
            restitution: 0        
        });

        this.setExistingBody(body);
        this.setFixedRotation(true); 
        this.setMass(PhysicsConfig.mass);
        
        // --- 2. COLLISION FILTER SETUP ---
        this.setCollisionCategory(this.cats.PLAYER);
        this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]);

        // --- 3. VISUAL ALIGNMENT ---
        this.setOrigin(0.5, 0.8); 

        this.cursors = scene.input.keyboard.createCursorKeys();
        
        this.groundTimer = 0; 
    }

    update() {
        // --- GROUND DETECTION ---
        const isGrounded = this.checkGrounded();

        if (isGrounded) this.groundTimer = 6; 
        else if (this.groundTimer > 0) this.groundTimer--;
        const hasFooting = this.groundTimer > 0;

        // --- ONE-WAY PLATFORM LOGIC ---
        const velY = this.body.velocity.y;
        
        if (velY < -1 || this.cursors.down.isDown) {
            this.setCollidesWith([this.cats.GROUND]); 
        } else {
            this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]); 
        }

        // --- PHYSICS FORCES ---
        const velX = this.body.velocity.x;
        const speedAbs = Math.abs(velX);
        
        // Drag
        if (speedAbs > PhysicsConfig.freeRollSpeed) {
            const dragForce = PhysicsConfig.dragCoeff * velX * velX;
            this.applyForce({ x: -Math.sign(velX) * dragForce, y: 0 });
        }

        // Slope Stick
        if (hasFooting && !this.cursors.up.isDown) {
             this.applyForce({ x: 0, y: PhysicsConfig.slopeStickForce });
        }

        // --- MOVEMENT & JUMP ---
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
            this.applyForce({ x: 0, y: PhysicsConfig.jumpForce });
            this.groundTimer = 0; 
            this.y -= 5; 
        }

        // --- VISUAL TILT ---
        let targetRotation = 0;
        if (hasFooting && (Math.abs(velX) > 1 || Math.abs(velY) > 1)) { 
            let angle = Math.atan(velY / velX);
            targetRotation = angle;
        }
        this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetRotation, PhysicsConfig.leanSpeed);

        this.handleAnimations(hasFooting, speedAbs);
    }

    checkGrounded() {
        const radius = this.body.circleRadius;
        const rayLength = radius + 10; 
        
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

        // [RESTORED] BRAKING LOGIC
        // If we are on the floor and holding DOWN, we try to brake.
        // NOTE: If we are on a "Green" platform, the One-Way logic in update() 
        // will cause us to fall instantly, so this frame won't last long.
        // If we are on "Grey" ground, we stay here and the friction kicks in.
        if (this.cursors.down.isDown) {
            this.setTexture("player5");
            this.setFriction(0.2); // High friction to stop
            return;
        }
        
        // Reset friction to normal if not braking
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