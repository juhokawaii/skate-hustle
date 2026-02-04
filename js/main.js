import HubScene from './HubScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    pixelArt: true,
    physics: {
        default: "matter", // Use Matter physics
        matter: {
            gravity: { y: 1.5 }, // Matter gravity feels different; 1.5 - 2 is a good start
            debug: false,         // Shows the pink lines for hitboxes
            enableSleeping: false
        }
    },
    scene: [HubScene]
};

new Phaser.Game(config);