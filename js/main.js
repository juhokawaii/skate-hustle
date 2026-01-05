import HubScene from './HubScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    pixelArt: true,
    physics: {
        default: "arcade",
        arcade: { debug: false }
    },
    // Add all your scenes to this array
    scene: [HubScene]
};

new Phaser.Game(config);