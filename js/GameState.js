let debugMode = false;

const HUB_PROGRESS_KEY = 'skate_hustle_hub_progress';
const PRIZE_POINT_KEY = 'skate_hustle_prize_point_unlocked';

const HUB_DEFAULTS = {
    coinsActivated: false,
    collectedCoinIndices: [],
    portalUnlocked: false,
    spawnedCoinTotal: 0,
    sillyCompleted: false
};

export function isDebugMode() {
    return debugMode;
}

export function setDebugMode(enabled) {
    debugMode = enabled;
}

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
            return { ...HUB_DEFAULTS, ...JSON.parse(raw) };
        }
    } catch {
        // Ignore storage parsing errors.
    }
    return { ...HUB_DEFAULTS };
}

export function saveHubProgress(patch) {
    const current = getHubProgress();
    const updated = { ...current, ...patch };
    try {
        localStorage.setItem(HUB_PROGRESS_KEY, JSON.stringify(updated));
    } catch {
        // Ignore storage write errors.
    }
    return updated;
}

export function resetHubProgress() {
    try {
        localStorage.removeItem(HUB_PROGRESS_KEY);
    } catch {
        // Ignore storage removal errors.
    }
}
