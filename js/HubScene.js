import Player from './Player.js';

export default class HubScene extends Phaser.Scene {
    constructor() {
        super("HubScene");
    }

    preload() {
        this.load.image("player1", "assets/player1.png"); // Stand
        this.load.image("player2", "assets/player2.png"); // Pump
        this.load.image("player3", "assets/player3.png"); // Kick
        this.load.image("player4", "assets/player4.png"); // Jump
        this.load.image("player5", "assets/player5.png"); // Brake
    }

    create() {
        const worldWidth = 3000;
        const worldHeight = 720;

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBackgroundColor("#3b3b3b");

        // --- GROUND ---
        const ground = this.add.rectangle(worldWidth / 2, 670, worldWidth, 100, 0x333333);
        this.physics.add.existing(ground, true);

        // --- ANIMATIONS ---
        this.anims.create({
            key: "idle_pump",
            frames: [{ key: "player1" }, { key: "player2" }],
            frameRate: 3,
            repeat: -1
        });

        this.anims.create({
            key: "kick",
            frames: [
                { key: "player2", duration: 50 },  // Wind up
                { key: "player3", duration: 400 }, // HOLD the kick leg out
                { key: "player1", duration: 50 }   // Return
            ],
            frameRate: 10,
            repeat: 0
        });

        // --- PLAYER ---
        this.player = new Player(this, 200, 500);
        this.physics.add.collider(this.player, ground);

        // --- CAMERA ---
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // --- ZONE ---
        this.hintText = this.add.text(16, 16, "", { 
            fontFamily: "monospace", 
            fontSize: "18px",
            fill: "#ffffff"
        }).setScrollFactor(0);
        
        this.arcadeZone = this.add.rectangle(worldWidth - 250, 570, 200, 200, 0x00ff00, 0.1);
        this.physics.add.existing(this.arcadeZone, true);
        
        this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    }

    update() {
        this.player.update();

        // Zone logic
        this.hintText.setText("");
        if (this.physics.overlap(this.player, this.arcadeZone)) {
            this.hintText.setText("Press ENTER to enter the Arcade");
            if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
                console.log("Scene transition would happen here.");
            }
        }
    }
}