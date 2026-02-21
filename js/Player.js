export default class Player extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y, cats) {
        // 1. CONFIGURATION
        const radius = 35; 
        
        super(scene.matter.world, x, y, 'player1', null, {
            shape: { type: 'circle', radius: radius },
            friction: 0.0,
            frictionStatic: 0.0, 
            frictionAir: 0.0,
            restitution: 0.0,    
            density: 0.005       
        });

        scene.add.existing(this);
        this.setDepth(100);
        this.cats = cats;

        // 2. SETUP
        this.setOrigin(0.5, 0.8); 
        this.setFixedRotation(true); 
        this.setCollisionCategory(this.cats.PLAYER);
        this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY, this.cats.SENSOR]);

        this.cursors = scene.input.keyboard.createCursorKeys();

        // State & Vectors
        this.groundNormal = new Phaser.Math.Vector2(0, -1);
        this.smoothedNormal = new Phaser.Math.Vector2(0, -1);
        this.groundTimer = 0;
        this.rampDragGraceTimer = 0;
        
        // [NEW] Visual Buffer for smoother animations
        this.airFrameBuffer = 0; 
        
        // 3. COLLISION SENSOR
        this.scene.matter.world.on('collisionactive', (event) => {
            const pairs = event.pairs;
            let normalSumX = 0;
            let normalSumY = 0;
            let contactCount = 0;

            for (let i = 0; i < pairs.length; i++) {
                const bodyA = pairs[i].bodyA;
                const bodyB = pairs[i].bodyB;

                if (bodyA === this.body || bodyB === this.body) {
                    const other = (bodyA === this.body) ? bodyB : bodyA;
                    if (!other.isSensor) {
                        const contactNormal = pairs[i].collision.normal;
                        let normalX;
                        let normalY;

                        if (bodyA === this.body) {
                            normalX = contactNormal.x;
                            normalY = contactNormal.y;
                        } else {
                            normalX = -contactNormal.x;
                            normalY = -contactNormal.y;
                        }

                        // Ignore ceilings so underside bumps don't overwrite ride normals.
                        if (normalY <= 0.2) {
                            normalSumX += normalX;
                            normalSumY += normalY;
                            contactCount++;
                        }
                    }
                }
            }

            if (contactCount > 0) {
                this.groundTimer = 10; // Physics buffer
                const invLength = 1 / Math.max(0.0001, Math.hypot(normalSumX, normalSumY));
                this.groundNormal.set(normalSumX * invLength, normalSumY * invLength);
            }
        });
    }

    update() {
        // --- TUNING KNOBS ---
        const PADDLE_FORCE = 0.02;   
        const JUMP_FORCE = 15.0;     
        const STICKY_FORCE = 0.05; 
        const WALL_STEEP_THRESHOLD = 0.8;
        const WALL_RIDE_MIN_SPEED = 3.5;
        const WALL_RELEASE_PUSH = 0.004;
        
        const DRAG_FLAT = 0.02;   
        const DRAG_RAMP = 0.0;    
        const DRAG_AIR = 0.005;      
        const RAMP_DRAG_GRACE_FRAMES = 6;
        const MAX_SPEED = 20;        
        
        // --- TIMERS ---
        if (this.groundTimer > 0) this.groundTimer--;
        const isGrounded = (this.groundTimer > 0);
        
        // [NEW] Update Visual Air Buffer
        // If we are grounded, reset the counter.
        // If we are in the air, start counting up.
        if (isGrounded) {
            this.airFrameBuffer = 0;
        } else {
            this.airFrameBuffer++;
        }

        const isJumping = Phaser.Input.Keyboard.JustDown(this.cursors.up);

        const rawTangent = { x: -this.groundNormal.y, y: this.groundNormal.x };
        const tangentVelocity =
            (this.body.velocity.x * rawTangent.x) +
            (this.body.velocity.y * rawTangent.y);
        const tangentSpeedAbs = Math.abs(tangentVelocity);
        const wallSteepness = Math.abs(this.groundNormal.x);
        const isSteepWall = isGrounded && (wallSteepness > WALL_STEEP_THRESHOLD);
        const isWallStalled = isSteepWall && (tangentSpeedAbs < WALL_RIDE_MIN_SPEED);
        const canUseGroundAssist = isGrounded && !isWallStalled;

        // --- 1. ROTATION ---
        if (canUseGroundAssist) {
            this.smoothedNormal.x = Phaser.Math.Linear(this.smoothedNormal.x, this.groundNormal.x, 0.15);
            this.smoothedNormal.y = Phaser.Math.Linear(this.smoothedNormal.y, this.groundNormal.y, 0.15);
        } else {
            this.smoothedNormal.x = Phaser.Math.Linear(this.smoothedNormal.x, 0, 0.05);
            this.smoothedNormal.y = Phaser.Math.Linear(this.smoothedNormal.y, -1, 0.05);
        }

        const targetAngle = Math.atan2(this.smoothedNormal.y, this.smoothedNormal.x) + (Math.PI / 2);
        this.rotation = targetAngle;


        // --- 2. MOVEMENT ---
        const tangent = { x: -this.smoothedNormal.y, y: this.smoothedNormal.x };
        const forceX = tangent.x * PADDLE_FORCE;
        const forceY = tangent.y * PADDLE_FORCE;
        
        // The magical video game thrusters while in the air 
        const AIR_CONTROL = 0.35; 
        
        if (this.cursors.left.isDown) {
            this.setFlipX(true);
            if (canUseGroundAssist) {
                this.applyForce({ x: -forceX, y: -forceY });
            } else {
                // Use the variable here instead of hardcoded 0.1
                this.applyForce({ x: -forceX * AIR_CONTROL, y: -forceY * AIR_CONTROL });
            }
        } 
        else if (this.cursors.right.isDown) {
            this.setFlipX(false);
            if (canUseGroundAssist) {
                this.applyForce({ x: forceX, y: forceY });
            } else {
                // And here
                this.applyForce({ x: forceX * AIR_CONTROL, y: forceY * AIR_CONTROL });
            }
        }


        // --- 3. STICKY FORCE ---
        if (isGrounded && !isJumping) {
            if (isWallStalled) {
                this.applyForce({
                    x: this.groundNormal.x * WALL_RELEASE_PUSH,
                    y: this.groundNormal.y * WALL_RELEASE_PUSH
                });
            } else {
                this.applyForce({ 
                    x: -this.groundNormal.x * STICKY_FORCE, 
                    y: -this.groundNormal.y * STICKY_FORCE 
                });
            }
        }


        // --- 4. BRAKE ---
        if (this.cursors.down.isDown && isGrounded) {
            this.setVelocity(this.body.velocity.x * 0.90, this.body.velocity.y * 0.90);
        }

        // --- 5. JUMP ---
        if (canUseGroundAssist && isJumping) {
            this.setVelocity(
                this.body.velocity.x + (this.smoothedNormal.x * JUMP_FORCE),
                this.body.velocity.y + (this.smoothedNormal.y * JUMP_FORCE)
            );
            this.groundTimer = 0; 
            // [TRICK] Force immediate visual switch so jump feels responsive
            this.airFrameBuffer = 100; 
        }

        // --- 6. DRAG & CAP ---
        let currentDrag = DRAG_AIR;
        if (canUseGroundAssist) {
            const slopeSteepness = Math.abs(this.smoothedNormal.x);
            if (slopeSteepness > 0.1) {
                this.rampDragGraceTimer = RAMP_DRAG_GRACE_FRAMES;
            } else if (this.rampDragGraceTimer > 0) {
                this.rampDragGraceTimer--;
            }

            const keepRampFeel = (slopeSteepness > 0.1) || (this.rampDragGraceTimer > 0);
            currentDrag = keepRampFeel ? DRAG_RAMP : DRAG_FLAT;
        } else {
            this.rampDragGraceTimer = 0;
        }

        this.setVelocity(
            this.body.velocity.x * (1 - currentDrag),
            this.body.velocity.y * (1 - currentDrag)
        );
        
        if (this.body.speed > MAX_SPEED) {
            const scale = MAX_SPEED / this.body.speed;
            this.setVelocity(this.body.velocity.x * scale, this.body.velocity.y * scale);
        }
        
        // --- 7. PLATFORMS ---
        if (this.body.velocity.y < -2.0) {
            this.setCollidesWith([this.cats.GROUND, this.cats.SENSOR]);
        } 
        else if (this.cursors.down.isDown) {
            this.setCollidesWith([this.cats.GROUND, this.cats.SENSOR]);
        }
        else {
            this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY, this.cats.SENSOR]);
        }

        this.handleAnimations(isGrounded);
    }
    
    handleAnimations(isGrounded) {
        
        const isJumpingFast = (this.body.velocity.y < -5.0);
        
        // [CHANGE] Increased threshold from 5 to 8
        const isAirStable = (this.airFrameBuffer > 8);

        if (!isGrounded && (isAirStable || isJumpingFast)) {
            this.anims.stop();
            this.setTexture("player4"); 
            return;
        }

        if (this.cursors.down.isDown) {
            this.setTexture("player5"); 
            return;
        }
        
        const isInput = this.cursors.left.isDown || this.cursors.right.isDown;
        const currentSpeed = this.body.speed;

        // Kick Speed Limit: 4.0
        if (isInput && currentSpeed < 4.0) {
             this.play("kick", true);
        } else {
             this.play("idle_pump", true);
        }
    }
}