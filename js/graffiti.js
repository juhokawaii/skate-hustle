export default class Graffiti extends Phaser.Physics.Matter.Sprite {
    constructor(scene, x, y, keyBW, keyColor, category) {
        // Start with the B&W texture
        super(scene.matter.world, x, y, keyBW);
        
        scene.add.existing(this);
        this.scene = scene;
        this.keyBW = keyBW;
        this.keyColor = keyColor;
        

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

    onEnter() {
        if (this.isPlayerTouching) return;
        
        this.isPlayerTouching = true;
        this.setTexture(this.keyColor);
        
        // Optional: slight pop effect
        this.scene.tweens.add({
            targets: this,
            scale: 1.1,
            duration: 100,
            yoyo: true
        });
    }

    onExit() {
        this.isPlayerTouching = false;
        this.setTexture(this.keyBW);
    }
    
    // Call this in your Scene's update() loop if you want to check for interaction
    checkInteraction() {
        if (this.isPlayerTouching && Phaser.Input.Keyboard.JustDown(this.scene.input.keyboard.addKey('ENTER'))) {
            console.log("Entering portal: " + this.keyColor);
            return true; // Signal to scene to change levels
        }
        return false;
    }
}