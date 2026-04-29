/**
 * Shared leaderboard persistence for all scenes.
 *
 * Each scene gets its own localStorage key:
 *   skate_hustle_lb_{sceneKey}
 *
 * Entry shape (universal):
 *   { tag: string, score: number, detail: object }
 *
 * `score` is the primary sort value.
 * Sort direction is per-scene:
 *   'desc' (default) — higher score is better (e.g. points)
 *   'asc'            — lower score is better  (e.g. time)
 *
 * `detail` holds scene-specific metadata (timeMs, pixelsUp, etc.)
 * that the scene can use for display formatting.
 */

const STORAGE_PREFIX = 'skate_hustle_lb_';
const MAX_ENTRIES = 7;

function storageKey(sceneKey) {
    return STORAGE_PREFIX + sceneKey;
}

/**
 * Load the top entries for a scene.
 * @param {string} sceneKey - Scene identifier (e.g. 'PrizePointScene')
 * @returns {Array<{tag: string, score: number, detail: object}>}
 */
export function getBoard(sceneKey) {
    try {
        const raw = localStorage.getItem(storageKey(sceneKey));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Save a board array to localStorage.
 * @param {string} sceneKey
 * @param {Array} board
 */
export function saveBoard(sceneKey, board) {
    try {
        localStorage.setItem(storageKey(sceneKey), JSON.stringify(board));
    } catch {
        // Ignore storage write errors.
    }
}

/**
 * Add an entry to a scene's leaderboard.
 * Sorts by score, trims to MAX_ENTRIES, and persists.
 *
 * @param {string} sceneKey
 * @param {{tag: string, score: number, detail?: object}} entry
 * @param {'desc'|'asc'} [sortDir='desc'] - 'desc' = higher is better, 'asc' = lower is better.
 * @returns {Array} The updated top entries.
 */
export function addEntry(sceneKey, entry, sortDir = 'desc') {
    const board = getBoard(sceneKey);
    board.push({
        tag:    entry.tag || 'ANON',
        score:  entry.score,
        detail: entry.detail || {}
    });
    if (sortDir === 'asc') {
        board.sort((a, b) => a.score - b.score);
    } else {
        board.sort((a, b) => b.score - a.score);
    }
    const trimmed = board.slice(0, MAX_ENTRIES);
    saveBoard(sceneKey, trimmed);
    return trimmed;
}

/**
 * Check whether a score would qualify for the top entries.
 * @param {string} sceneKey
 * @param {number} score
 * @param {'desc'|'asc'} [sortDir='desc'] - 'desc' = higher is better, 'asc' = lower is better.
 * @returns {boolean}
 */
export function qualifies(sceneKey, score, sortDir = 'desc') {
    const board = getBoard(sceneKey);
    if (board.length < MAX_ENTRIES) return true;
    if (sortDir === 'asc') {
        const highest = board.reduce((max, e) => Math.max(max, e.score), -Infinity);
        return score < highest;
    }
    const lowest = board.reduce((min, e) => Math.min(min, e.score), Infinity);
    return score > lowest;
}

/**
 * Get the #1 entry from every scene that has leaderboard data.
 * Useful for the hub "best of bests" display.
 *
 * @param {string[]} sceneKeys - Array of scene keys to check.
 * @returns {Object<string, {tag: string, score: number, detail: object}>}
 *   Map of sceneKey → best entry. Scenes with no data are omitted.
 */
export function getBestPerScene(sceneKeys) {
    const result = {};
    for (const key of sceneKeys) {
        const board = getBoard(key);
        if (board.length > 0) {
            result[key] = board[0];
        }
    }
    return result;
}

/**
 * Clear a scene's leaderboard. Useful for debug/reset.
 * @param {string} sceneKey
 */
export function clearBoard(sceneKey) {
    try {
        localStorage.removeItem(storageKey(sceneKey));
    } catch {
        // Ignore.
    }
}
