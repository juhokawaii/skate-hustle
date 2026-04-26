export default class Graffiti extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y, keyBW, keyColor, category) {
        // Start with the B&W texture
        super(scene.matter.world, x, y, keyBW);
        
        scene.add.existing(this);
        this.scene = scene;
        this.keyBW = keyBW;
        this.keyColor = keyColor;
        this.visualProxy = null;
        

        // 1. PHYSICS SETUP
        // Static = stays on the wall (no gravity)
        // Sensor = detects player but doesn't stop them (no collision response)
        this.setStatic(true);
        this.setSensor(true);
        this.setDepth(0); // Behind player

        if (category) {
            this.setCollisionCategory(category);
        }

        // 2. STATE
        this.isPlayerTouching = false;

        // 3. COLLISION LISTENERS
        // We listen for the specific 'overlap' start and end events for this object
        this.setOnCollide((data) => {
            // Check if the other object is the player
            // (Assumes player body label is default or 'Circle Body')
            const bodyA = data.bodyA;
            const bodyB = data.bodyB;
            
            // Simple check: Is the other body moving? (Walls are static)
            // Or strictly: check if it belongs to the player class
            if (!bodyA.isStatic || !bodyB.isStatic) {
                this.onEnter();
            }
        });

        this.setOnCollideEnd((data) => {
            if (!data.bodyA.isStatic || !data.bodyB.isStatic) {
                this.onExit();
            }
        });
    }

    enableParallaxVisual(scrollX = 0.85, scrollY = 0.85, options = {}) {
        const visualX = options.x ?? this.x;
        const visualY = options.y ?? this.y;
        const visualDepth = options.depth ?? this.depth;
        const visualAlpha = options.alpha ?? this.alpha;

        if (this.visualProxy) {
            this.visualProxy.destroy();
            this.visualProxy = null;
        }

        this._parallaxScrollX = scrollX;
        this._parallaxScrollY = scrollY;

        this.visualProxy = this.scene.add.image(visualX, visualY, this.texture.key);
        this.visualProxy.setOrigin(this.originX, this.originY);
        this.visualProxy.setDepth(visualDepth);
        this.visualProxy.setAlpha(visualAlpha);
        this.visualProxy.setScale(this.scaleX, this.scaleY);
        this.visualProxy.setScrollFactor(scrollX, scrollY);

        // Hide the world-locked sprite; sensor body will track the visual each frame.
        this.setVisible(false);
        return this;
    }

    onEnter() {
        if (this.isPlayerTouching) return;
        
        this.isPlayerTouching = true;
        this.setTexture(this.keyColor);
        if (this.visualProxy) {
            this.visualProxy.setTexture(this.keyColor);
        }
        
        // Optional: slight pop effect
        // Nah
        /*this.scene.tweens.add({
            targets: this,
            scale: 1.10,
            duration: 100,
            yoyo: true
        }); */
    }

    onExit() {
        this.isPlayerTouching = false;
        this.setTexture(this.keyBW);
        if (this.visualProxy) {
            this.visualProxy.setTexture(this.keyBW);
        }
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.visualProxy && this._parallaxScrollX != null) {
            // Move the sensor body to match where the parallax visual actually appears
            // in world space.  A parallax object at (vx, vy) with scrollFactor s renders
            // at the same screen position as a world-locked object at:
            //   worldX = vx + camera.scrollX * (1 - s)
            const cam = this.scene.cameras.main;
            const worldX = this.visualProxy.x + cam.scrollX * (1 - this._parallaxScrollX);
            const worldY = this.visualProxy.y + cam.scrollY * (1 - this._parallaxScrollY);
            this.setPosition(worldX, worldY);

            this.visualProxy.setRotation(this.rotation);
            this.visualProxy.setScale(this.scaleX, this.scaleY);
        }
    }

    preDestroy() {
        if (this.visualProxy) {
            this.visualProxy.destroy();
            this.visualProxy = null;
        }
        super.preDestroy();
    }
    
}