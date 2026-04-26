/**
 * Resolves level data from three sources in priority order:
 *   1. Injected data (scene.restart / scene.start with data object)
 *   2. Cached JSON (loaded via this.load.json in preload)
 *   3. Hardcoded defaults
 *
 * @param {Phaser.Scene} scene
 * @param {string} cacheKey - Key used in this.load.json
 * @param {object} injected - The data object passed to create()
 * @param {object} defaults - Fallback values. Portal keys must match the JSON field names.
 *   Special keys: worldWidth, worldHeight, spawn (-> spawnPoint), platforms.
 *   All other keys are treated as portal positions and looked up by their JSON name,
 *   with the injected data key being the same name suffixed with 'Pos' if needed.
 *
 * @returns {{ worldWidth, worldHeight, spawnPoint, platforms, ...portalPositions }}
 */
export function loadLevelData(scene, cacheKey, injected, defaults) {
    const cached = scene.cache.json.get(cacheKey) || {};
    const hasInjected = Array.isArray(injected?.levelPlatforms);
    const src = hasInjected ? injected : cached;

    const resolve = (injectedKey, cachedKey, fallback) =>
        src[injectedKey] ?? src[cachedKey] ?? fallback;

    const result = {
        worldWidth:  src.worldWidth  ?? defaults.worldWidth,
        worldHeight: src.worldHeight ?? defaults.worldHeight,
        spawnPoint:  src.spawnPoint  ?? src.spawn ?? defaults.spawnPoint,
        platforms: hasInjected
            ? injected.levelPlatforms
            : (Array.isArray(cached.platforms) ? cached.platforms : [])
    };

    // Resolve all portal positions defined in defaults
    const skip = new Set(['worldWidth', 'worldHeight', 'spawnPoint', 'platforms']);
    for (const key of Object.keys(defaults)) {
        if (skip.has(key)) continue;
        // injected uses e.g. 'returnPortalPos', JSON uses e.g. 'returnPortal'
        const injectedKey = key;
        const cachedKey = key.replace(/Pos$/, '');
        result[key] = resolve(injectedKey, cachedKey, defaults[key]);
    }

    return result;
}
