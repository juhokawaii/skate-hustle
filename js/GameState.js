const gameState = {
    hub: {
        coinsActivated: false,
        collectedCoinIndices: [],
        portalUnlocked: false,
        spawnedCoinTotal: 0,
        sillyCompleted: false
    },
    debugMode: false
};

export function isDebugMode() {
    return gameState.debugMode;
}

export function setDebugMode(enabled) {
    gameState.debugMode = enabled;
}

const PRIZE_POINT_KEY = 'skate_hustle_prize_point_unlocked';

export function isPrizePointUnlocked() {
    return localStorage.getItem(PRIZE_POINT_KEY) === '1';
}

export function setPrizePointUnlocked() {
    localStorage.setItem(PRIZE_POINT_KEY, '1');
}

export function getHubProgress() {
    return gameState.hub;
}

export function saveHubProgress(patch) {
    gameState.hub = {
        ...gameState.hub,
        ...patch
    };
    return gameState.hub;
}

export function resetHubProgress() {
    gameState.hub = {
        coinsActivated: false,
        collectedCoinIndices: [],
        portalUnlocked: false,
        spawnedCoinTotal: 0,
        sillyCompleted: false
    };
}
