// --- TUNING CONFIGURATION ---
const PhysicsConfig = {
    mass: 5,
    friction: 0.0011,       
    frictionAir: 0.004,    
    
    // Movement
    kickForceStart: 0.006,
    kickForceFast: 0.004,   
    maxKickSpeed: 20,      
    
    // Aerodynamics
    freeRollSpeed: 8,
    dragCoeff: 0.0001,     

    // Jump & Slope
    jumpForce: 0.25,        
    slopeStickForce: 0.02,  
    
    // VISUALS
    leanSpeed: 0.08,       
    airLeanAngle: -0.25,   
    maxSlopeAngle: 2.5,     
    bufferSize: 15,
    
    // VERT PHYSICS
    minVertSpeed: 2.0,      
    vertSlopeThreshold: 0.8 
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
        const isGrounded = this.checkGrounded(this.rotation);
        
        if (isGrounded) this.groundTimer = 5; 
        else if (this.groundTimer > 0) this.groundTimer--;
        const hasFooting = this.groundTimer > 0;

        const velX = this.body.velocity.x;
        const velY = this.body.velocity.y;
        const speedAbs = Math.sqrt(velX*velX + velY*velY);

        // --- 1. ROTATION LOGIC ---
        
        if (!hasFooting) {
            this.currentSlopeAngle = Phaser.Math.Linear(this.currentSlopeAngle, PhysicsConfig.airLeanAngle, 0.05);
            this.angleBuffer = []; 
        } 
        else {
            // [FIX] INCREASED THRESHOLD from 0.5 to 2.0
            // If we are in that "Equilibrium" jitter zone (speed < 2), 
            // we IGNORE the velocity noise and keep our previous angle.
            if (speedAbs > 2.0) { 
                const forwardX = this.flipX ? -velX : velX;
                let rawAngle = Math.atan2(velY, forwardX);

                // Fakie/Invert Check
                if (Math.abs(rawAngle) > Math.PI / 2) {
                    if (rawAngle > 0) rawAngle -= Math.PI;
                    else rawAngle += Math.PI;
                }

                // Continuity Check (Anti-Jitter)
                const diff = rawAngle - this.currentSlopeAngle;
                if (Math.abs(diff) > 2.0) { 
                     if (diff > 0) rawAngle -= Math.PI;
                     else rawAngle += Math.PI;
                }

                if (Math.abs(rawAngle) < PhysicsConfig.maxSlopeAngle) {
                    this.angleBuffer.push(rawAngle);
                }
                
                if (this.angleBuffer.length > PhysicsConfig.bufferSize) {
                    this.angleBuffer.shift();
                }
                
                if (this.angleBuffer.length > 0) {
                    const sum = this.angleBuffer.reduce((a, b) => a + b, 0);
                    this.currentSlopeAngle = sum / this.angleBuffer.length;
                }
            }
            else {
                // [FIX] STOPPED/STALLED LOGIC
                // If we are flat (angle < 0.5), we straighten up.
                // If we are on a ramp (angle >= 0.5), we DO NOTHING. 
                // We lock the angle to the last known good value.
                if (Math.abs(this.currentSlopeAngle) < 0.5) {
                    this.currentSlopeAngle = Phaser.Math.Linear(this.currentSlopeAngle, 0, 0.1);
                }
                
                // Clear buffer so old movement doesn't average into new movement later
                if (this.angleBuffer.length > 0) this.angleBuffer = [];
            }
        }

        let visualRotation = this.flipX ? -this.currentSlopeAngle : this.currentSlopeAngle;
        
        this.rotation = Phaser.Math.Angle.RotateTo(
            this.rotation, 
            visualRotation, 
            PhysicsConfig.leanSpeed
        );

        // --- 2. PHYSICS FORCES ---
        
        if (speedAbs > PhysicsConfig.freeRollSpeed) {
            const drag = PhysicsConfig.dragCoeff * velX * velX;
            this.applyForce({ x: -Math.sign(velX) * drag, y: 0 });
        }
        
        // Spider-Man Gravity (Stick)
        if (hasFooting && !this.cursors.up.isDown) {
             const stickX = -Math.sin(this.rotation) * PhysicsConfig.slopeStickForce;
             const stickY = Math.cos(this.rotation) * PhysicsConfig.slopeStickForce;
             this.applyForce({ x: stickX, y: stickY });
        }

        // Jump
        if (hasFooting && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
            const jumpX = Math.sin(this.rotation) * PhysicsConfig.jumpForce;
            const jumpY = -Math.cos(this.rotation) * PhysicsConfig.jumpForce;
            
            this.applyForce({ x: jumpX, y: jumpY });
            this.x += jumpX * 10;
            this.y += jumpY * 10;
            this.groundTimer = 0; 
        }

        // --- 3. INPUT (PUMPING LOGIC) ---
        
        let kickPower = speedAbs > PhysicsConfig.freeRollSpeed ? PhysicsConfig.kickForceFast : PhysicsConfig.kickForceStart;
        let kickEfficiency = 1.0;
        
        const slopeAbs = Math.abs(this.currentSlopeAngle);
        const isOnRamp = slopeAbs > 0.25; 
        const isGoingDownhill = velY > 0;

        if (isOnRamp) {
            if (isGoingDownhill) {
                kickEfficiency = 1.0; 
            } else {
                if (speedAbs > 4.0) {
                    kickEfficiency = 0.0; 
                }
            }
        }
        
        // Apex Stall Check
        if (slopeAbs > 0.5 && speedAbs < 2.0) {
            kickEfficiency = 0.0;
        }

        kickPower *= kickEfficiency;

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

        // --- 4. FRICTION & ANIMATION ---
        
        // Zero Friction on Ramps
        if (isOnRamp) {
            this.setFriction(0.0);
        } else {
            this.setFriction(PhysicsConfig.friction);
        }

        if (velY < -2 || this.cursors.down.isDown) {
             this.setCollidesWith([this.cats.GROUND]); 
        } else {
             this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]); 
        }

        this.handleAnimations(hasFooting, speedAbs, kickEfficiency);
    }

    checkGrounded(angle) {
        const radius = this.body.circleRadius;
        const rayLength = radius + 10; 
        const bodies = this.scene.matter.world.localWorld.bodies;
        
        const raysLocal = [
            { x: 0, y: 1 },    
            { x: -0.4, y: 1 }, 
            { x: 0.4, y: 1 }   
        ];

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        for (let r of raysLocal) {
            const rotX = r.x * cos - r.y * sin;
            const rotY = r.x * sin + r.y * cos;

            const len = Math.sqrt(rotX*rotX + rotY*rotY);
            const dx = (rotX / len) * rayLength;
            const dy = (rotY / len) * rayLength;

            const startPoint = { x: this.x, y: this.y };
            const endPoint = { x: this.x + dx, y: this.y + dy };

            const hit = this.scene.matter.query.ray(bodies, startPoint, endPoint)
                .filter(c => c.body !== this.body && !c.body.isSensor);
            
            if (hit.length > 0) return true;
        }

        return false;
    }

    handleAnimations(isOnFloor, speedAbs, kickEfficiency) {
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

        if (this.anims.isPlaying && this.anims.currentAnim.key === "kick") return;

        const isInput = this.cursors.left.isDown || this.cursors.right.isDown;
        const justPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left) || 
                            Phaser.Input.Keyboard.JustDown(this.cursors.right);
        
        if (isInput && justPressed && kickEfficiency > 0.1) {
             this.play("kick");
             return;
        }
        
        this.play("idle_pump", true);
    }
}
