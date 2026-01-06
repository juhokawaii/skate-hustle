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
        const worldWidth = 3000;
        const worldHeight = 1500;
        this.matter.world.setBounds(0, 0, worldWidth, worldHeight);

    // --- 3. PHYSICS OBJECTS (The New Skate Park) ---
    
    // A. The Floor (Standard Rectangle)
    this.createPlatform(worldWidth/2, worldHeight - 50, { 
        type: 'RECT', 
        width: worldWidth, 
        height: 100 
    });

    // B. Smooth "Grind Box" (Rectangle with Chamfer)
    // The rounded corners (radius 20) mean you won't catch your wheels if you hit the side.
    this.createPlatform(600, 1350, { 
        type: 'RECT', 
        width: 300, 
        height: 60, 
        chamfer: 20 
    });

    // C. The "Kicker" (Triangular Ramp)
    // A perfect wedge. No more "lip" issues.
    this.createPlatform(1000, 1300, { 
        type: 'RAMP', 
        width: 400, 
        height: 100 
    });

    // D. The "Quarter Pipe" (Curved Polygon)
    // Generates a smooth 20-segment curve.
    this.createPlatform(1800, 1250, { 
        type: 'CURVE', 
        width: 400, 
        height: 400, 
        curvature: 1.0 // 1.0 = 90 degree arc
    });
        // Player
        this.player = new Player(this, 100, 1200);

        // Camera
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        this.setupAnims();
        this.setupZones(worldWidth, worldHeight);
    }

    /**
     * General Object Factory
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {object} config - { type, width, height, angle, chamfer, ... }
     */

    createPlatform(x, y, config) {
        const { 
            type = 'RECT', 
            width = 100, 
            height = 100, 
            angle = 0, 
            chamfer = 0,
            friction = 0.5
        } = config;

        // 1. Define the Physics Body options
        const bodyOptions = { 
            isStatic: true, 
            friction: friction,
            chamfer: chamfer > 0 ? { radius: chamfer } : null
        };

        let body;

        // --- STEP 1: CREATE PHYSICS BODY ---
        
        if (type === 'RECT') {
            body = this.matter.add.rectangle(x, y, width, height, bodyOptions);
        }
        else if (type === 'RAMP') {
            // Define the shape relative to (0,0)
            const verts = [
                { x: width/2,  y: height/2 }, 
                { x: -width/2, y: height/2 }, 
                { x: width/2,  y: -height/2 }
            ];
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }
        else if (type === 'CURVE') {
            const segments = 20;
            const verts = [{ x: width/2, y: height/2 }]; // Corner
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const px = -width/2 + (Math.cos(t * Math.PI/2) * width); 
                const py = -height/2 + (Math.sin(t * Math.PI/2) * height);
                verts.push({ x: px, y: py });
            }
            verts.push({ x: width/2, y: height/2 }); // Close loop
            
            body = this.matter.add.fromVertices(x, y, verts, bodyOptions);
        }

        // --- STEP 2: APPLY TRANSFORMATIONS ---
        // We set the angle NOW, so the vertices update to their final positions
        if (body) {
            this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
        }

        // --- STEP 3: DRAW VISUALS FROM PHYSICS DATA ---
        if (body) {
            // Create a Graphics object. We do NOT set its x/y because we will 
            // draw using the World Coordinates provided by the body.
            const graphics = this.add.graphics({ fillStyle: { color: 0x666666 } });

            // Helper function to draw a single set of vertices
            const drawVertices = (vertices) => {
                graphics.beginPath();
                vertices.forEach((v, index) => {
                    if (index === 0) graphics.moveTo(v.x, v.y);
                    else graphics.lineTo(v.x, v.y);
                });
                graphics.closePath();
                graphics.fillPath();
            };

            // CHECK FOR COMPOUND BODIES (Important for Curves!)
            // Matter.js decomposes complex shapes (concave curves) into multiple convex parts.
            // We need to draw each "part" separately to see the full shape.
            if (body.parts.length > 1) {
                // Skip part[0] - it is the "Hull" (bounding box) of the whole group
                for (let i = 1; i < body.parts.length; i++) {
                    drawVertices(body.parts[i].vertices);
                }
            } else {
                // Simple shape (Rectangle, Triangle)
                drawVertices(body.vertices);
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
        this.arcadeZone = this.matter.add.rectangle(worldWidth - 250, worldHeight - 150, 200, 200, {
            isStatic: true, isSensor: true
        });
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