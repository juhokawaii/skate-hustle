// --- TUNING CONFIGURATION ---
const PhysicsConfig = {
    mass: 5,
    friction: 0.001,       
    frictionAir: 0.001,    
    
    // Movement
    kickForceStart: 0.015,
    kickForceFast: 0.01,  
    maxKickSpeed: 20,      
    
    // Aerodynamics
    freeRollSpeed: 8,
    dragCoeff: 0.0001,     

    // Jump & Slope
    jumpForce: -0.25,
    slopeStickForce: 0.003, // [TWEAKED] Slight increase to hold the curve better
    
    // VISUALS
    leanSpeed: 0.15,       
    airLeanAngle: -0.25,   
    maxSlopeAngle: 1.6,    // [TWEAKED] Increased to allow full 90 degree vert riding
    bufferSize: 5,
    
    // VERT PHYSICS
    minVertSpeed: 5.0,     
    vertSlopeThreshold: 0.4 
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
        
        // --- 2. COLLISION ---
        this.setCollisionCategory(this.cats.PLAYER);
        this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]);

        this.setOrigin(0.5, 0.8); 
        this.cursors = scene.input.keyboard.createCursorKeys();
        
        this.groundTimer = 0;
        this.angleBuffer = []; 
    }

    update() {
        const isGrounded = this.checkGrounded();
        
        if (isGrounded) this.groundTimer = 6;
        else if (this.groundTimer > 0) this.groundTimer--;
        const hasFooting = this.groundTimer > 0;

        const velX = this.body.velocity.x;
        const velY = this.body.velocity.y;
        
        // Calculate Speed Magnitude
        const speedAbs = Math.sqrt(velX*velX + velY*velY);

        // --- 1. ROTATION LOGIC (With Fakie Fix) ---
        let slopeAngle = 0; 

        if (!hasFooting) {
            // [TWEAK] Don't snap instantly to air angle, blend it slightly or keep inertia
            // But for now, we use the config default
            slopeAngle = PhysicsConfig.airLeanAngle; 
            
            // Clear buffer so we don't average old ground angles when we land
            if (this.angleBuffer.length > 0) this.angleBuffer = []; 
        } 
        else {
            // Only calculate if moving fast enough to determine a "slope"
            if (speedAbs > 0.5) {
                // Determine "Forward" relative to facing direction
                const forwardX = this.flipX ? -velX : velX;
                
                // Calculate Raw Angle
                let rawAngle = Math.atan2(velY, forwardX);

                // [FIX] FAKIE DETECTION
                if (Math.abs(rawAngle) > Math.PI / 2) {
                    if (rawAngle > 0) rawAngle -= Math.PI;
                    else rawAngle += Math.PI;
                }

                // Filter out noise
                if (Math.abs(rawAngle) < PhysicsConfig.maxSlopeAngle) {
                    this.angleBuffer.push(rawAngle);
                }
            }

            if (this.angleBuffer.length > PhysicsConfig.bufferSize) {
                this.angleBuffer.shift();
            }

            if (this.angleBuffer.length > 0) {
                const sum = this.angleBuffer.reduce((a, b) => a + b, 0);
                slopeAngle = sum / this.angleBuffer.length;
            }
        }

        // Apply Rotation
        let visualRotation = this.flipX ? -slopeAngle : slopeAngle;
        
        this.rotation = Phaser.Math.Angle.RotateTo(
            this.rotation, 
            visualRotation, 
            PhysicsConfig.leanSpeed
        );

        // --- 2. PHYSICS FORCES ---
        
        // Drag
        if (speedAbs > PhysicsConfig.freeRollSpeed) {
            const drag = PhysicsConfig.dragCoeff * velX * velX;
            this.applyForce({ x: -Math.sign(velX) * drag, y: 0 });
        }
        
        // Slope Stick (Crucial for Ramps)
        if (hasFooting && !this.cursors.up.isDown) {
             // [FIX] Increased threshold from 1.0 to 1.6 (approx 90 degrees)
             // This ensures we apply stick force even when vertical
             if (Math.abs(slopeAngle) < 1.6) {
                 this.applyForce({ x: 0, y: PhysicsConfig.slopeStickForce });
             }
        }

        if (hasFooting && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.setVelocityY(0);
            this.applyForce({ x: 0, y: PhysicsConfig.jumpForce });
            this.groundTimer = 0; 
            this.y -= 5; 
        }

        // --- 3. INPUT with STALL ---
        
        let kickPower = speedAbs > PhysicsConfig.freeRollSpeed ? PhysicsConfig.kickForceFast : PhysicsConfig.kickForceStart;
        
        // STALL CHECK
        let isStalled = false;
        
        if (hasFooting && Math.abs(slopeAngle) > PhysicsConfig.vertSlopeThreshold) {
            if (velY < 0) { // Going UP
                if (speedAbs < PhysicsConfig.minVertSpeed) {
                    kickPower = 0;
                    isStalled = true;
                }
            }
        }

        if (this.cursors.left.isDown) {
            this.setFlipX(true);
            const forceX = Math.cos(this.rotation) * -kickPower; 
            const forceY = Math.sin(this.rotation) * -kickPower; 
            this.applyForce({ x: forceX, y: forceY });

        } else if (this.cursors.right.isDown) {
            this.setFlipX(false);
            const forceX = Math.cos(this.rotation) * kickPower; 
            const forceY = Math.sin(this.rotation) * kickPower; 
            this.applyForce({ x: forceX, y: forceY });
        }

        // --- 4. PLATFORM LOGIC ---
        if (velY < -2 || this.cursors.down.isDown) {
             this.setCollidesWith([this.cats.GROUND]); 
        } else {
             this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]); 
        }

        this.handleAnimations(hasFooting, speedAbs, isStalled);
    }

    checkGrounded() {
        const radius = this.body.circleRadius;
        const rayLength = radius + 15; // [TWEAK] Slightly longer ray
        const bodies = this.scene.matter.world.localWorld.bodies;
        
        // [FIX] Multi-directional Raycast
        // We cast 3 rays: Center, Down-Left, and Down-Right.
        // This allows us to detect walls/ramps even if the center ray misses.
        const rays = [
            { x: 0, y: 1 },    // Straight Down
            { x: -0.5, y: 1 }, // Down-Left
            { x: 0.5, y: 1 }   // Down-Right
        ];

        for (let dir of rays) {
            // Normalize the vector so diagonal rays aren't longer
            const len = Math.sqrt(dir.x*dir.x + dir.y*dir.y);
            const dx = (dir.x / len) * rayLength;
            const dy = (dir.y / len) * rayLength;

            const startPoint = { x: this.x, y: this.y };
            const endPoint = { x: this.x + dx, y: this.y + dy };

            const hit = this.scene.matter.query.ray(bodies, startPoint, endPoint)
                .filter(c => c.body !== this.body && !c.body.isSensor);
            
            if (hit.length > 0) return true;
        }

        return false;
    }

    handleAnimations(isOnFloor, speedAbs, isStalled) {
        if (!isOnFloor) {
            this.anims.stop();
            this.setTexture("player4"); 
            return;
        }

        if (this.cursors.down.isDown) {
            this.setTexture("player5");
            this.setFriction(0.2); 
            return;
        }
        
        this.setFriction(PhysicsConfig.friction);

        if (this.anims.isPlaying && this.anims.currentAnim.key === "kick") return;

        const isInput = this.cursors.left.isDown || this.cursors.right.isDown;
        const justPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left) || 
                            Phaser.Input.Keyboard.JustDown(this.cursors.right);
        
        if (isInput && justPressed && !isStalled) {
             this.play("kick");
             return;
        }
        
        this.play("idle_pump", true);
    }
}