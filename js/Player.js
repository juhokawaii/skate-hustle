// --- TUNING CONFIGURATION ---
const PhysicsConfig = {
    mass: 5,
    friction: 0.002,       
    frictionAir: 0.004,    
    
    // Movement
    kickForceStart: 0.008,
    kickForceFast: 0.005,  
    maxKickSpeed: 20,      
    
    // Aerodynamics
    freeRollSpeed: 8,
    dragCoeff: 0.0001,     

    // Jump & Slope
    jumpForce: -0.25,
    slopeStickForce: 0.003, 
    
    // VISUALS
    leanSpeed: 0.08,       
    airLeanAngle: -0.25,   
    maxSlopeAngle: 1.6,    
    bufferSize: 15,
    
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
        this.currentSlopeAngle = 0; 
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

        // --- 1. ROTATION LOGIC ---
        
        if (!hasFooting) {
            // In Air: Lean back slightly
            this.currentSlopeAngle = Phaser.Math.Linear(this.currentSlopeAngle, PhysicsConfig.airLeanAngle, 0.1);
            this.angleBuffer = []; 
        } 
        else {
            // [FIX] We need significant horizontal motion to calculate a slope.
            if (speedAbs > 0.5 && Math.abs(velX) > 0.1) {
                
                // Determine "Forward" relative to facing direction
                const forwardX = this.flipX ? -velX : velX;
                
                let rawAngle = Math.atan2(velY, forwardX);

                // Fakie/Invert Check
                if (Math.abs(rawAngle) > Math.PI / 2) {
                    if (rawAngle > 0) rawAngle -= Math.PI;
                    else rawAngle += Math.PI;
                }

                // Noise Filter
                if (Math.abs(rawAngle) < PhysicsConfig.maxSlopeAngle) {
                    this.angleBuffer.push(rawAngle);
                }
                
                // Average the buffer
                if (this.angleBuffer.length > PhysicsConfig.bufferSize) {
                    this.angleBuffer.shift();
                }
                
                if (this.angleBuffer.length > 0) {
                    const sum = this.angleBuffer.reduce((a, b) => a + b, 0);
                    this.currentSlopeAngle = sum / this.angleBuffer.length;
                }
            }
            else {
                // Stopped Logic: Decay angle back to 0
                this.currentSlopeAngle = Phaser.Math.Linear(this.currentSlopeAngle, 0, 0.1);
                if (this.angleBuffer.length > 0) this.angleBuffer = [];
            }
        }

        // Apply Rotation
        let visualRotation = this.flipX ? -this.currentSlopeAngle : this.currentSlopeAngle;
        
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
        
        // Slope Stick
        if (hasFooting && !this.cursors.up.isDown) {
             if (Math.abs(this.currentSlopeAngle) < 1.6) {
                 this.applyForce({ x: 0, y: PhysicsConfig.slopeStickForce });
             }
        }

        if (hasFooting && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            this.setVelocityY(0);
            this.applyForce({ x: 0, y: PhysicsConfig.jumpForce });
            this.groundTimer = 0; 
            this.y -= 5; 
        }

        // --- 3. INPUT with SLOPE PENALTY ---
        
        let kickPower = speedAbs > PhysicsConfig.freeRollSpeed ? PhysicsConfig.kickForceFast : PhysicsConfig.kickForceStart;
        
        // [NEW] Slope Penalty
        // Math.cos(0) = 1 (Full power on flat)
        // Math.cos(90 deg) = 0 (No power on vert)
        // We use Math.max to ensure we never get a negative multiplier
        let slopePenalty = Math.max(0, Math.cos(this.currentSlopeAngle));
        
        // Make it a bit harsher: if angle > 45 degrees, power drops fast
        // (Optional: remove the power of 2 for a linear drop off)
        slopePenalty = slopePenalty * slopePenalty; 

        kickPower *= slopePenalty;

        // Stall logic (Failsafe)
        let isStalled = false;
        if (hasFooting && Math.abs(this.currentSlopeAngle) > PhysicsConfig.vertSlopeThreshold) {
            if (velY < 0 && speedAbs < PhysicsConfig.minVertSpeed) {
                // If we are too slow on a slope, cut power completely to ensure slide back
                kickPower = 0;
                isStalled = true;
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
        const rayLength = radius + 15; 
        const bodies = this.scene.matter.world.localWorld.bodies;
        
        const rays = [
            { x: 0, y: 1 },    
            { x: -0.5, y: 1 }, 
            { x: 0.5, y: 1 }   
        ];

        for (let dir of rays) {
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
        
        // Only allow kick anim if we actually have kick power (not stalled/too steep)
        if (isInput && justPressed && !isStalled && Math.cos(this.currentSlopeAngle) > 0.3) {
             this.play("kick");
             return;
        }
        
        this.play("idle_pump", true);
    }
}