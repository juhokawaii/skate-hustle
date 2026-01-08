import Player from './Player.js';

export default class HubScene extends Phaser.Scene {
    constructor() { super("HubScene"); }

    preload() {
        this.load.image("player1", "assets/player1.png");
        this.load.image("player2", "assets/player2.png");
        this.load.image("player3", "assets/player3.png");
        this.load.image("player4", "assets/player4.png");
        this.load.image("player5", "assets/player5.png");
    }

    create() {
        // --- WORLD SETUP ---
        const worldWidth = 3200;
        const worldHeight = 1800;
        this.matter.world.setBounds(0, 0, worldWidth, worldHeight);

        // --- 1. COLLISION CATEGORIES ---
        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory()
        };

        // --- 2. THE PARK LAYOUT (Based on your Sketch) ---

        // == A. THE FLOOR ==
        // One solid piece of concrete across the bottom
        this.createPlatform(1600, worldHeight - 50, { 
            type: 'RECT', width: 3200, height: 100 
        });


        // == B. LEFT SIDE: THE ROLL-IN (Start Area) ==
        // Corresponds to the raised block on the left of your sketch.
        
        // 1. The solid block tower
        // Position: Far left. Height: ~400px tall.
        this.createPlatform(250, worldHeight - 250, { 
            type: 'RECT', width: 500, height: 400 
        });

        // 2. The Down-Slope (Ramp)
        // This connects the tower to the floor.
        // x = 500 (edge of tower) + 200 (half ramp width) = 700
        // Angle 90 rotates the standard ramp to point DOWN-RIGHT.
        this.createPlatform(700, worldHeight - 250, { 
            type: 'RAMP', width: 400, height: 400, angle: 90 
        });
        
        // 3. A Curve Transition at the bottom of the ramp (Optional smoothing)
        // Helps momentum transition to floor
        this.createPlatform(1000, worldHeight - 100, { 
            type: 'CURVE', width: 200, height: 200, angle: -90 // Bottom-left curve
        });


        // == C. CENTER: GREEN FLOATING PLATFORMS ==
        // Corresponds to the "blacked out rectangles" in your sketch.
        // Staggered height to allow climbing or dropping.

        const platWidth = 300;
        const platHeight = 25;

        // Lowest (Center-Left)
        this.createPlatform(1300, worldHeight - 400, { 
            type: 'RECT', width: platWidth, height: platHeight, isOneWay: true 
        });

        // Middle (Center)
        this.createPlatform(1600, worldHeight - 600, { 
            type: 'RECT', width: platWidth, height: platHeight, isOneWay: true 
        });

        // High (Center-Right)
        this.createPlatform(1300, worldHeight - 800, { 
            type: 'RECT', width: platWidth, height: platHeight, isOneWay: true 
        });

        // Top (Center)
        this.createPlatform(1600, worldHeight - 1000, { 
            type: 'RECT', width: platWidth, height: platHeight, isOneWay: true 
        });

        // == D. RIGHT-CENTER: THE PUMP HUMP ==
        // Replaced the "Two Ramps" with a smooth "Buried Circle".
        
        // We place the circle slightly below the floor level.
        // A radius of 300 gives a very wide, gentle hill.
        // Floor Y is roughly (worldHeight - 100).
        // By placing center at (worldHeight + 50), the top sticks out ~150px.
        this.createPlatform(2250, worldHeight + 50, { 
            type: 'CIRCLE', radius: 300 
        });

        // == D. RIGHT-CENTER: THE PUMP HUMP ==
        // The mound in your sketch. 
        // We create a "Pyramid" shape using two ramps back-to-back.
        
        // Ramp Up
        this.createPlatform(2100, worldHeight - 150, { 
            type: 'RAMP', width: 300, height: 100, angle: 0 
        });
        
        // Ramp Down
        // We position it right next to the first one.
        this.createPlatform(2400, worldHeight - 150, { 
            type: 'RAMP', width: 300, height: 100, angle: 90 
        });


        // == E. FAR RIGHT: THE BIG VERT WALL ==
        // The curved wall at the end of the sketch.
        
        // Large Quarter Pipe
        // Width 600 means a nice gentle curve radius.
        this.createPlatform(2900, worldHeight - 350, { 
            type: 'CURVE', width: 600, height: 600, angle: 0 
        });

        // Vertical Extension (The wall part above the curve)
        this.createPlatform(3180, worldHeight - 850, { 
            type: 'RECT', width: 40, height: 400 
        });


        // --- 3. PLAYER SPAWN ---
        // Spawn on top of the Left Roll-In tower so you have speed immediately.
        this.player = new Player(this, 200, worldHeight - 550, this.cats);


        // --- 4. CAMERA & ZONES ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Put the arcade zone at the top of the highest green platform
        this.arcadeZone = this.matter.add.rectangle(1600, worldHeight - 1100, 100, 100, {
            isStatic: true, isSensor: true
        });
        
        this.setupAnims();
        this.setupZones(worldWidth, worldHeight);
    }

    /**
     * General Object Factory
     */
    createPlatform(x, y, config) {
        const { 
            type = 'RECT', 
            width = 100, 
            height = 100, 
            radius = 50,    // [NEW] Default radius for circles
            angle = 0, 
            chamfer = 0,
            friction = 0.5,
            isOneWay = false 
        } = config;

        const bodyOptions = { 
            isStatic: true, 
            friction: friction,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;

        // --- GENERATE SHAPE ---
        if (type === 'RECT') {
            body = this.matter.add.rectangle(x, y, width, height, bodyOptions);
        }
        else if (type === 'RAMP') {
            const verts = [
                { x: width/2,  y: height/2 }, 
                { x: -width/2, y: height/2 }, 
                { x: width/2,  y: -height/2 }
            ];
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'CURVE') {
            const segments = 20;
            const verts = [{ x: width/2, y: height/2 }];
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = -width/2 + (Math.cos(t * Math.PI/2) * width); 
                const py = -height/2 + (Math.sin(t * Math.PI/2) * height);
                verts.push({ x: px, y: py });
            }
            verts.push({ x: width/2, y: height/2 });
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'CIRCLE') {
            // [NEW] Simple Circle Collider
            // Note: We ignore 'width'/'height' and use 'radius'
            body = this.matter.add.circle(x, y, radius, bodyOptions);
        }

        if (body) {
            // Apply Rotation
            this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
            
            // Force Position (Fixes center-of-mass offsets)
            this.matter.body.setPosition(body, { x: x, y: y });
            
            // Assign Physics Category
            if (isOneWay) {
                body.collisionFilter.category = this.cats.ONE_WAY;
            } else {
                body.collisionFilter.category = this.cats.GROUND;
            }

            // --- VISUALS ---
            const graphics = this.add.graphics({ fillStyle: { color: isOneWay ? 0x44AA44 : 0x666666 } });

            // [NEW] Draw Circle vs Draw Polygon
            if (body.circleRadius) {
                graphics.fillCircle(body.position.x, body.position.y, body.circleRadius);
            } else {
                const drawVertices = (vertices) => {
                    graphics.beginPath();
                    vertices.forEach((v, index) => {
                        if (index === 0) graphics.moveTo(v.x, v.y);
                        else graphics.lineTo(v.x, v.y);
                    });
                    graphics.closePath();
                    graphics.fillPath();
                };

                if (body.parts.length > 1) {
                    for (let i = 1; i < body.parts.length; i++) {
                        drawVertices(body.parts[i].vertices);
                    }
                } else {
                    drawVertices(body.vertices);
                }
            }
        }
    }

    
    setupAnims() {
        this.anims.create({
            key: "idle_pump",
            frames: [{ key: "player1" }, { key: "player2" }],
            frameRate: 3,
            repeat: -1
        });
        this.anims.create({
            key: "kick",
            frames: [
                { key: "player2", duration: 50 },
                { key: "player3", duration: 400 },
                { key: "player1", duration: 50 }
            ],
            frameRate: 10,
            repeat: 0
        });
    }

    setupZones(worldWidth, worldHeight) {
        this.hintText = this.add.text(16, 16, "", { fontFamily: "monospace", fontSize: "18px" }).setScrollFactor(0);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    update() {
        this.player.update();
        this.hintText.setText("");
        if (this.matter.query.collides(this.player.body, [this.arcadeZone]).length > 0) {
            this.hintText.setText("Press ENTER to enter the Arcade");
        }
    }
}