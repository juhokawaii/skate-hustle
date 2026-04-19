import SplashScene from './SplashScene.js';
import HubScene from './HubScene.js';
import SillySpeedRunScene from './SillySpeedRunScene.js';
import BottomRaceScene from './BottomRaceScene.js';
import ZombieHordeScene from './ZombieHordeScene.js';
import PrizePointScene from './PrizePointScene.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    pixelArt: true,
    scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        fullscreenTarget: 'game-container'
    },
    physics: {
        default: "matter", // Use Matter physics
        matter: {
            gravity: { y: 1.5 }, // Matter gravity feels different; 1.5 - 2 is a good start
            positionIterations: 12, 
            velocityIterations: 8, 
            debug: false,         // Shows the pink lines for hitboxes
            enableSleeping: false
        }
    },
    scene: [SplashScene, HubScene, SillySpeedRunScene, BottomRaceScene, ZombieHordeScene, PrizePointScene]
};

const game = new Phaser.Game(config);

game.scale.on('enterfullscreen', () => {
    game.scale.scaleMode = Phaser.Scale.FIT;
    game.scale.refresh();
});

game.scale.on('leavefullscreen', () => {
    game.scale.scaleMode = Phaser.Scale.NONE;
    game.scale.resize(1280, 720);
    game.canvas.style.width = '1280px';
    game.canvas.style.height = '720px';
    game.scale.refresh();
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') {
        const activeScenes = game.scene.getScenes(true);
        const prizePointScene = activeScenes.find((scene) => scene?.scene?.key === 'PrizePointScene');
        if (prizePointScene && (prizePointScene.inputPhase === 'tag' || prizePointScene.inputPhase === 'nameclass')) {
            return;
        }

        if (game.scale.isFullscreen) {
            game.scale.stopFullscreen();
        } else {
            game.scale.startFullscreen();
        }
    }
});