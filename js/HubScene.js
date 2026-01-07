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

        // --- 1. DEFINE COLLISION CATEGORIES ---
        // We create unique bitmasks for different types of objects
        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory()
        };

        // --- 2. PHYSICS OBJECTS ---
        
        // A. The Floor
        this.createPlatform(worldWidth/2, worldHeight - 50, { 
            type: 'RECT', width: worldWidth, height: 100 
        });

        // B. Grind Box
        this.createPlatform(600, 1350, { 
            type: 'RECT', width: 300, height: 60, chamfer: 20 
        });

        // C. The Kicker (Ramp)
        this.createPlatform(1000, 1300, { 
            type: 'RAMP', width: 400, height: 100 
        });

        // D. The Quarter Pipe
        this.createPlatform(1800, 1250, { 
            type: 'CURVE', width: 400, height: 400, curvature: 1.0 
        });

        // E. [NEW] Floating Platform (One-Way)
        // You can jump through this from below, or drop through it with DOWN key
        this.createPlatform(1400, 1100, { 
            type: 'RECT', width: 200, height: 20, isOneWay: true 
        });

        // --- 3. PLAYER ---
        // We pass 'this.cats' so the player knows what to collide with
        this.player = new Player(this, 100, 1200, this.cats);

        // --- 4. CAMERA & ZONES ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        this.setupAnims();
        this.setupZones(worldWidth, worldHeight);
    }

    /**
     * General Object Factory
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {object} config - { type, width, height, angle, isOneWay, ... }
     */
    createPlatform(x, y, config) {
        const { 
            type = 'RECT', 
            width = 100, 
            height = 100, 
            angle = 0, 
            chamfer = 0,
            friction = 0.5,
            isOneWay = false // [NEW] Flag for pass-through platforms
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

        if (body) {
            // --- TRANSFORM & CATEGORIZE ---
            this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
            
            // [NEW] Assign Physics Category
            if (isOneWay) {
                body.collisionFilter.category = this.cats.ONE_WAY;
            } else {
                body.collisionFilter.category = this.cats.GROUND;
            }

            // --- VISUALS ---
            const graphics = this.add.graphics({ fillStyle: { color: isOneWay ? 0x44AA44 : 0x666666 } });

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