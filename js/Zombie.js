import { CATS } from './CollisionCategories.js';

/**
 * A physics-driven zombie NPC that wanders the level.
 *
 * States:
 *   standing  – idle, displays zombie-standing
 *   walking   – moves left or right, alternates walking1/walking2
 *   sitting   – transition pose (sitting1 → sitting2)
 *   lying     – on the ground (zombie-lying-down)
 *
 * Sprites all face RIGHT by default; flipX is used for leftward movement.
 */
export default class Zombie extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y) {
        const radius = 32;

        super(scene.matter.world, x, y, 'zombie_standing', null, {
            shape: { type: 'circle', radius },
            friction: 0.0,
            frictionStatic: 0.0,
            frictionAir: 0.0,
            restitution: 0.0,
            density: 0.005
        });

        scene.add.existing(this);
        this.scene = scene;
        this.cats = CATS;
        this.setDepth(8);
        this.setOrigin(0.5, 0.8);
        this.setFixedRotation(true);
        this.setCollisionCategory(this.cats.PLAYER);
        this.setCollidesWith([this.cats.GROUND, this.cats.ONE_WAY]);

        // --- Physics helpers (simplified player-like ground detection) ---
        this.groundTimer = 0;
        this.groundNormal = new Phaser.Math.Vector2(0, -1);

        this.scene.matter.world.on('collisionactive', (event) => {
            for (let i = 0; i < event.pairs.length; i++) {
                const pair = event.pairs[i];
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                if (bodyA !== this.body && bodyB !== this.body) continue;

                const other = bodyA === this.body ? bodyB : bodyA;
                if (other.isSensor) continue;

                const cn = pair.collision.normal;
                let ny = bodyA === this.body ? cn.y : -cn.y;
                if (ny < -0.35) {
                    this.groundTimer = 10;
                }
            }
        });

        // --- Tuning knobs ---
        this.WALK_FORCE = 0.006;      // Much smaller than Player's 0.02
        this.MAX_SPEED = 3.5;         // Player is 20
        this.DRAG = 0.04;
        this.STICKY_FORCE = 0.04;

        // --- State machine ---
        this.state = 'standing';
        this.stateTimer = 0;
        this.stateDuration = 0;
        this.walkDir = 1; // 1 = right, -1 = left

        this.pickNewState();
    }

    // ----------------------------------------------------------------
    //  State scheduling
    // ----------------------------------------------------------------

    pickNewState() {
        const rng = Phaser.Math.RND;
        const roll = rng.realInRange(0, 1);

        if (roll < 0.40) {
            this.enterState('walking', rng.between(2500, 7000));
            this.walkDir = rng.pick([-1, 1]);
        } else if (roll < 0.72) {
            this.enterState('standing', rng.between(1500, 5000));
        } else if (roll < 0.88) {
            this.enterState('sitting', rng.between(2000, 5500));
        } else {
            this.enterState('lying', rng.between(3000, 8000));
        }
    }

    enterState(name, duration) {
        this.state = name;
        this.stateTimer = 0;
        this.stateDuration = duration;

        switch (name) {
            case 'standing':
                this.setTexture('zombie_standing');
                break;
            case 'walking':
                this.setTexture('zombie_walking1');
                break;
            case 'sitting':
                this.setTexture('zombie_sitting1');
                break;
            case 'lying':
                this.setTexture('zombie_lying');
                break;
        }
    }

    // ----------------------------------------------------------------
    //  Per-frame update (call from scene.update)
    // ----------------------------------------------------------------

    update(time, delta) {
        if (this.groundTimer > 0) this.groundTimer--;

        const isGrounded = this.groundTimer > 0;
        const dt = delta || 16;
        this.stateTimer += dt;

        // Ground sticky force (keeps zombie on slopes like the player)
        if (isGrounded) {
            this.applyForce({ x: 0, y: this.STICKY_FORCE });
        }

        switch (this.state) {
            case 'walking':
                this.updateWalking(isGrounded, dt);
                break;
            case 'standing':
                this.updateStanding();
                break;
            case 'sitting':
                this.updateSitting(dt);
                break;
            case 'lying':
                // Just lie there
                break;
        }

        // Drag & speed cap
        this.setVelocity(
            this.body.velocity.x * (1 - this.DRAG),
            this.body.velocity.y * (1 - this.DRAG)
        );
        if (Math.abs(this.body.velocity.x) > this.MAX_SPEED) {
            this.setVelocityX(Math.sign(this.body.velocity.x) * this.MAX_SPEED);
        }

        // Transition when timer runs out
        if (this.stateTimer >= this.stateDuration) {
            // If lying, go through sitting-up transition first
            if (this.state === 'lying') {
                this.enterState('sitting', 800);
                return;
            }
            this.pickNewState();
        }
    }

    // ---- Individual state updates ----

    updateWalking(isGrounded, dt) {
        // Flip based on walk direction
        this.setFlipX(this.walkDir < 0);

        if (isGrounded) {
            this.applyForce({ x: this.WALK_FORCE * this.walkDir, y: 0 });
        }

        // Walking animation: alternate frames at ~3-4 fps with slight jitter
        const walkCycle = Math.floor(this.stateTimer / 280) % 2;
        this.setTexture(walkCycle === 0 ? 'zombie_walking1' : 'zombie_walking2');

        // Random chance to reverse direction mid-walk for headless feel
        if (Phaser.Math.RND.realInRange(0, 1) < 0.0008 * (dt / 16)) {
            this.walkDir *= -1;
        }

        // Turn around at world edges
        if (this.x < 120) this.walkDir = 1;
        if (this.x > this.scene.worldWidth - 120) this.walkDir = -1;
    }

    updateStanding() {
        this.setTexture('zombie_standing');
    }

    updateSitting(dt) {
        // First third: sitting1, middle third: sitting2, last third: sitting1 again (getting up)
        const third = this.stateDuration / 3;
        if (this.stateTimer < third) {
            this.setTexture('zombie_sitting1');
        } else if (this.stateTimer < third * 2) {
            this.setTexture('zombie_sitting2');
        } else {
            this.setTexture('zombie_sitting1');
        }
    }
}
