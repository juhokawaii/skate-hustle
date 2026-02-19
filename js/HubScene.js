import Player from './Player.js';
import Graffiti from './graffiti.js';
import TextureFactory from './TextureFactory.js';

export default class HubScene extends Phaser.Scene {
    constructor() { super("HubScene"); }

    preload() {
        this.load.image("player1", "assets/player_sprites/player1.png");
        this.load.image("player2", "assets/player_sprites/player2.png");
        this.load.image("player3", "assets/player_sprites/player3.png");
        this.load.image("player4", "assets/player_sprites/player4.png");
        this.load.image("player5", "assets/player_sprites/player5.png");

        this.load.image("concrete_bg", "assets/backgrounds/hubworld_background.png");
        this.load.image("platform_texture", "assets/backgrounds/256x256.png");
        this.load.image("chaos_monkey_bw", "assets/backgrounds/Chaos_monkey_graffiti_bw.png");
        this.load.image("chaos_monkey", "assets/backgrounds/Chaos_monkey_graffiti.png");

        this.load.audio("secret", "assets/music/title.mp3");
        this.load.audio("title", "assets/music/ramp.mp3");
    }

    create() {
        // --- BACKGROUND MUSIC ---
        this.sound.stopAll();


        // --- WORLD SETUP ---
        const worldWidth = 3200;
        const worldHeight = 1800;

        // --- -1. COLLISION CATEGORIES ---
        this.cats = {
            GROUND: this.matter.world.nextCategory(),
            ONE_WAY: this.matter.world.nextCategory(),
            PLAYER: this.matter.world.nextCategory(), 
            SENSOR: this.matter.world.nextCategory()
        };

        // 0. CREATE THE WALLS
        // Create the invisible box around the world
        this.matter.world.setBounds(0, 0, worldWidth, worldHeight, 1000, true, true, true, true);

        // 3. LABEL THE WALLS (The Fix)
        // Now we can use 'this.cats.GROUND' because we defined it in Step 1.
        Object.values(this.matter.world.walls).forEach(wall => {
            if (wall) {
                wall.collisionFilter.category = this.cats.GROUND;
            }
        });    

        // --- 1. BACKGROUND AND GRAFFITI---
        const bg = this.add.tileSprite(0, 0, worldWidth, worldHeight, "concrete_bg");
        bg.setOrigin(0, 0);
        bg.setScrollFactor(0.85, 0.85);
        bg.setDepth(-10);

        this.bgmusic = this.sound.add("title", { volume: 1.0, loop: true });
        this.bgmusic.play();

        this.portal1 = new Graffiti(this, 1100, 550, "chaos_monkey_bw", "chaos_monkey", this.cats.SENSOR);
        this.portal1.setScrollFactor(0.85, 0.85);

        // --- 2. THE PARK LAYOUT  ---

        // == A. THE FLOOR ==
        this.createPlatform(1600, worldHeight - 50, { 
            type: 'RECT', width: 3200, height: 100 
        });
        
        // == B. HALF PIPE ==
        this.createPlatform(2900, worldHeight - 350, { 
            type: 'CURVE', 
            width: 600, 
            height: 600, 
            friction: 0, 
            angle: 0 
        });
        this.createPlatform(2000, worldHeight - 350, { 
            type: 'CURVE', 
            width: 600, 
            height: 600,
            friction: 0,  
            angle: 90 
        });
        this.createPlatform(2450, worldHeight - 153, { 
            type: 'RECT', 
            width: 1190, 
            height: 108 // Start with 100, increase if the gap is bigger
        });
        this.createPlatform(1755, worldHeight - 460, { 
            type: 'RECT', 
            width: 200, 
            height: 720 // Taller than ramp to hit the floor
        });

        // RIGHT TOWER
        // Position: 2900 (Ramp X) + 300 (Ramp Half) + 100 (Tower Half) = 3300
        // NOTE: This pushes slightly past your world width of 3200!
        this.createPlatform(3145, worldHeight - 460, { 
            type: 'RECT', 
            width: 200, 
            height: 720 
        });

        // == C. FLOATING PLATFORMS ==
        this.createPlatform(1600, worldHeight - 200, { 
            type: 'RECT', width: 300, height: 25, isOneWay: true 
        });
        this.createPlatform(1300, worldHeight - 400, { 
            type: 'RECT', width: 300, height: 25, isOneWay: true 
        });
        this.createPlatform(1600, worldHeight - 600, { 
            type: 'RECT', width: 300, height: 25, isOneWay: true 
        });
        this.createPlatform(1300, worldHeight - 800, { 
            type: 'RECT', width: 300, height: 25, isOneWay: true 
        });

        // --- 3. PLAYER SPAWN ---
        this.player = new Player(this, 200, worldHeight - 850, this.cats);
        this.player.setDepth(10);

        // --- 4. CAMERA & ZONES ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        this.setupAnims();
        this.setupZones(worldWidth, worldHeight);
    }

    createPlatform(x, y, config) {
        const { 
            type = 'RECT', 
            width = 100, 
            height = 100, 
            radius = 50,    
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

        // --- GENERATE PHYSICS SHAPE ---
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
            const segments = 32;
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
            body = this.matter.add.circle(x, y, radius, bodyOptions);
        }

        if (body) {
            // Apply Rotation
            this.matter.body.setAngle(body, Phaser.Math.DegToRad(angle));
            
            // Force Position
            this.matter.body.setPosition(body, { x: x, y: y });
            
            // Assign Physics Category
            if (isOneWay) {
                body.collisionFilter.category = this.cats.ONE_WAY;
            } else {
                body.collisionFilter.category = this.cats.GROUND;
            }

            // --- VISUALS (UPDATED) ---
            
            // 1. One-Way Platforms (Green bars)
            if (isOneWay) {
                const graphics = this.add.graphics({ fillStyle: { color: 0x44AA44 } });
                graphics.fillRect(body.position.x - width/2, body.position.y - height/2, width, height);
            } 
            
            // 2. Rectangles (Floor)
            else if (type === 'RECT') {
                TextureFactory.styleRectangle(this, x, y, width, height, body);
            }
            
            // 3. Curves / Ramps (Use new method)
            else if (type === 'CURVE' || type === 'RAMP') {
                TextureFactory.styleCurve(this, body);
            }
            
            // 4. Circles
            else if (type === 'CIRCLE') {
                const graphics = this.add.graphics({ fillStyle: { color: 0x666666 } });
                graphics.fillCircle(body.position.x, body.position.y, body.circleRadius);
            }
        }
    }
    
    setupAnims() {
        if (!this.anims.exists('idle_pump')) {
            this.anims.create({
                key: "idle_pump",
                frames: [{ key: "player1" }, { key: "player2" }],
                frameRate: 1.5,
                repeat: -1
            });
        }
        if (!this.anims.exists('kick')) {
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
    }

    setupZones(worldWidth, worldHeight) {
        this.hintText = this.add.text(16, 16, "", { fontFamily: "monospace", fontSize: "18px" }).setScrollFactor(0);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    update() {
        this.player.update();
        this.hintText.setText("");

        if(this.portal1.isPlayerTouching) {
            this.hintText.setText("Press ENTER to enter the Portal");
        }
    }
}