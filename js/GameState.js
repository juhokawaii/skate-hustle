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

const HUB_PROGRESS_KEY = 'skate_hustle_hub_progress';

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
    try {
        const raw = localStorage.getItem(HUB_PROGRESS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            gameState.hub = {
                ...gameState.hub,
                ...(parsed || {})
            };
        }
    } catch {
        // Ignore storage parsing errors.
    }
    return gameState.hub;
}

export function saveHubProgress(patch) {
    gameState.hub = {
        ...gameState.hub,
        ...patch
    };

    try {
        localStorage.setItem(HUB_PROGRESS_KEY, JSON.stringify(gameState.hub));
    } catch {
        // Ignore storage write errors.
    }

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

    try {
        localStorage.removeItem(HUB_PROGRESS_KEY);
    } catch {
        // Ignore storage removal errors.
    }
}
