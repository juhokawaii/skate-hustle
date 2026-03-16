const gameState = {
    hub: {
        coinsActivated: false,
        collectedCoinIndices: [],
        portalUnlocked: false,
        spawnedCoinTotal: 0
    }
};

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
        spawnedCoinTotal: 0
    };
}
