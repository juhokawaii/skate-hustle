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

// -------------------------------------------------------------------------
// PRIZE POINT PERSISTENCE
// -------------------------------------------------------------------------

const PRIZE_POINT_BEST_PIXELS_KEY    = 'skate_hustle_prize_point_best_pixels_up';
const PRIZE_POINT_BEST_SECONDS_KEY   = 'skate_hustle_prize_point_best_seconds_remaining';
const PRIZE_POINT_LEADERBOARD_KEY    = 'skate_hustle_prize_point_leaderboard';

export function loadBestPixelsUp() {
    try {
        const parsed = Number(localStorage.getItem(PRIZE_POINT_BEST_PIXELS_KEY));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    } catch { return 0; }
}

export function saveBestPixelsUp(value) {
    try { localStorage.setItem(PRIZE_POINT_BEST_PIXELS_KEY, String(value)); } catch {}
}

export function loadBestSecondsRemaining() {
    try {
        const parsed = Number(localStorage.getItem(PRIZE_POINT_BEST_SECONDS_KEY));
        return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    } catch { return 0; }
}

export function saveBestSecondsRemaining(value) {
    try { localStorage.setItem(PRIZE_POINT_BEST_SECONDS_KEY, String(value)); } catch {}
}

export function loadLeaderboard() {
    try {
        const raw = localStorage.getItem(PRIZE_POINT_LEADERBOARD_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function saveLeaderboard(board) {
    try { localStorage.setItem(PRIZE_POINT_LEADERBOARD_KEY, JSON.stringify(board)); } catch {}
}
