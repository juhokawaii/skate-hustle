import Player from './Player.js';

export default class HubScene extends Phaser.Scene {
    constructor() {
        super("HubScene");
    }

    preload() {
        this.load.image("player1", "assets/player1.png");
        this.load.image("player2", "assets/player2.png");
        this.load.image("player3", "assets/player3.png");
        this.load.image("player4", "assets/player4.png");
        this.load.image("player5", "assets/player5.png");
    }

    create() {
        // --- 1. WORLD GEOMETRY ---
        const worldWidth = 3000;
        const worldHeight = 1500; // Increased height from 720 to 1500

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBackgroundColor("#3b3b3b");

        // --- 2. THE GROUND ---
        // Moved the ground down to the new bottom (1500 - 50)
        const groundY = worldHeight - 50;
        const ground = this.add.rectangle(worldWidth / 2, groundY, worldWidth, 100, 0x333333);
        this.physics.add.existing(ground, true);

        // --- 3. THE PLATFORMS (Climbable Path) ---
        this.platforms = this.physics.add.staticGroup();

        // Staircase leading up
        this.createPlatform(400, groundY - 150, 200, 20); 
        this.createPlatform(700, groundY - 300, 200, 20);
        this.createPlatform(1000, groundY - 450, 250, 20);
        
        // Higher "Rooftop" area
        this.createPlatform(1400, 800, 600, 40); 
        this.createPlatform(1800, 650, 300, 20);
        this.createPlatform(1500, 500, 200, 20);

        // High ledge near the end
        this.createPlatform(2500, 400, 400, 20);

        // --- 4. PLAYER ---
        // Spawn the player near the ground
        this.player = new Player(this, 200, groundY - 200);
        
        this.physics.add.collider(this.player, ground);
        this.physics.add.collider(this.player, this.platforms);

        // --- 5. CAMERA SETUP ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        
        // CRITICAL: Update bounds so the camera can scroll UP to 0
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // --- 6. ANIMATIONS & UI ---
        this.setupAnims();

        this.hintText = this.add.text(16, 16, "", { 
            fontFamily: "monospace", fontSize: "18px", fill: "#ffffff"
        }).setScrollFactor(0);
        
        // Arcade Zone stays at the bottom near the end
        this.arcadeZone = this.add.rectangle(worldWidth - 250, groundY - 100, 200, 200, 0x00ff00, 0.1);
        this.physics.add.existing(this.arcadeZone, true);
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    createPlatform(x, y, width, height) {
        const rect = this.add.rectangle(x, y, width, height, 0x555555);
        this.platforms.add(rect);
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

    update() {
        this.player.update();
        this.hintText.setText("");
        if (this.physics.overlap(this.player, this.arcadeZone)) {
            this.hintText.setText("Press ENTER to enter the Arcade");
        }
    }
}