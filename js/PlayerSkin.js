/**
 * In-memory skin selection. Resets on page reload.
 *
 * Skin keys are always 'player1'–'player6' in Phaser's texture cache.
 * The file paths change based on which skin is active.
 */

let currentSkin = null; // 'skin1' or 'skin2'

const SKIN_PATHS = {
    skin1: [
        'assets/player_sprites/player1.png',
        'assets/player_sprites/player2.png',
        'assets/player_sprites/player3.png',
        'assets/player_sprites/player4.png',
        'assets/player_sprites/player5.png',
        'assets/player_sprites/player6.png'
    ],
    skin2: [
        'assets/player_sprites/player2-1.png',
        'assets/player_sprites/player2-2.png',
        'assets/player_sprites/player2-3.png',
        'assets/player_sprites/player2-4.png',
        'assets/player_sprites/player2-5.png',
        'assets/player_sprites/player2-6.png'
    ]
};

// The texture keys used everywhere in the game — never change.
const TEXTURE_KEYS = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6'];

export function getSkin() {
    return currentSkin;
}

export function setSkin(skin) {
    currentSkin = skin;
}

/**
 * Returns an array of { key, path } pairs for loading the active skin.
 * @param {string} [skin] - Override skin. Defaults to currentSkin.
 * @returns {{ key: string, path: string }[]}
 */
export function getSkinLoadEntries(skin) {
    const s = skin || currentSkin || 'skin1';
    const paths = SKIN_PATHS[s] || SKIN_PATHS.skin1;
    return TEXTURE_KEYS.map((key, i) => ({ key, path: paths[i] }));
}

/**
 * Preview paths for the select screen (loads under separate keys so both
 * skins can be shown side by side without conflicting with the game keys).
 */
export function getPreviewPath(skin, index) {
    const paths = SKIN_PATHS[skin] || SKIN_PATHS.skin1;
    return paths[index] || paths[0];
}

// -------------------------------------------------------------------------
// TILT CALIBRATION — shared across scenes, resets on page reload
// -------------------------------------------------------------------------

let calibratedGamma = 0;
let calibratedBeta  = 0;

export function setCalibration(gamma, beta) {
    calibratedGamma = gamma;
    calibratedBeta  = beta;
}

export function getCalibration() {
    return { gamma: calibratedGamma, beta: calibratedBeta };
}
