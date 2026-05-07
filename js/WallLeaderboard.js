import { getBoard } from './Leaderboard.js';

/**
 * Renders a leaderboard as world-space graffiti on the wall.
 *
 * Requires the scene to have loaded:
 *   - 'highscore_atlas' spritesheet (8 cols × 6 rows, 70×70 cells)
 *   - The title texture specified in options (default: 'high_score_title')
 *
 * @param {Phaser.Scene} scene - The Phaser scene to render into.
 * @param {object} options
 * @param {string}   options.sceneKey       - Leaderboard scene key to load data from.
 * @param {number}   options.x              - World X for the top-left of the score rows.
 * @param {number}   options.y              - World Y for the first score row.
 * @param {string}  [options.titleTexture]  - Texture key for the title image. Default: 'high_score_title'.
 * @param {number}  [options.titleAlpha]    - Alpha for the title image. Default: 0.77.
 * @param {number}  [options.textAlpha]     - Alpha for score text sprites. Default: 0.82.
 * @param {number}  [options.scrollFactor]  - Parallax scroll factor. Default: 0.85.
 * @param {number}  [options.depth]         - Render depth. Default: -3.
 * @param {number}  [options.rowGap]        - Vertical gap between rows. Default: 46.
 * @param {{x: number, y: number}} [options.titleOffset] - Offset from (x, y) for the title. Default: { x: 230, y: -130 }.
 * @param {function} [options.formatRow]    - (entry, index) => string. Overrides default row formatting.
 *
 * @returns {Phaser.GameObjects.GameObject[]} All created sprites (for cleanup if needed).
 */
export function renderWallLeaderboard(scene, options) {
    const {
        sceneKey,
        x,
        y,
        titleTexture = 'high_score_title',
        titleAlpha   = 0.77,
        textAlpha    = 0.82,
        scrollFactor = 0.85,
        depth        = -3,
        rowGap       = 46,
        titleOffset  = { x: 230, y: -130 },
        formatRow    = null
    } = options;

    const board = getBoard(sceneKey);
    if (board.length === 0) return [];

    const allSprites = [];

    // Title image
    const titleImg = scene.add.image(x + titleOffset.x, y + titleOffset.y, titleTexture);
    titleImg.setOrigin(0.5, 0.5);
    titleImg.setDepth(depth);
    titleImg.setScrollFactor(scrollFactor, scrollFactor);
    titleImg.setAlpha(titleAlpha);
    allSprites.push(titleImg);

    // Score rows
    const defaultFormat = (entry, index) => {
        const tag   = entry.tag || 'ANON';
        const score = entry.score != null ? entry.score : 0;
        return `${index + 1} ${tag} ${score}`;
    };

    const defaultScoreFormat = (entry) => {
        return entry.score != null ? `${entry.score}` : '0';
    };

    const formatter = typeof formatRow === 'function' ? formatRow : defaultFormat;
    const charW = ATLAS_CELL_W * 0.5; // 35px per character at display size
    const scribbleWidth  = charW * 7;  // same width as 7 atlas characters
    const scribbleHeight = charW;      // row height matching atlas

    // Fixed column positions
    const rankX    = x;
    const tagX     = x + charW * 2;           // after rank + space
    const scoreRightX = x + charW * 16;       // right edge for score column

    board.slice(0, 7).forEach((entry, i) => {
        const rowY = y + (i * rowGap);

        // Extract score text from formatRow (last space-separated token)
        let scoreText;
        if (typeof formatRow === 'function') {
            const formatted = formatRow(entry, i);
            const tokens = formatted.split(' ');
            scoreText = tokens[tokens.length - 1];
        } else {
            scoreText = defaultScoreFormat(entry);
        }

        // Rank (always atlas)
        const rankSprites = renderWorldAtlasText(scene, `${i + 1}`, rankX, rowY, depth);
        rankSprites.forEach((s) => { s.setScrollFactor(scrollFactor, scrollFactor); s.setAlpha(textAlpha); });
        allSprites.push(...rankSprites);

        if (entry.detail && entry.detail.tag_image) {
            // Render scribble PNG for tag
            const texKey = `scribble_${sceneKey}_${i}`;
            if (scene.textures.exists(texKey)) scene.textures.remove(texKey);
            const img = scene.textures.addBase64(texKey, entry.detail.tag_image);
            // addBase64 is async — use a callback to create the image once loaded
            scene.textures.once(`addtexture-${texKey}`, () => {
                const scribbleImg = scene.add.image(tagX + scribbleWidth * 0.5, rowY, texKey);
                scribbleImg.setDisplaySize(scribbleWidth, scribbleHeight);
                scribbleImg.setDepth(depth);
                scribbleImg.setScrollFactor(scrollFactor, scrollFactor);
                scribbleImg.setAlpha(textAlpha);
            });
        } else if (entry.detail && entry.detail.tag_strokes) {
            // Legacy: render hand-drawn strokes for tag
            const gfx = renderWallScribble(scene, entry.detail.tag_strokes, tagX, rowY - scribbleHeight * 0.5, scribbleWidth, scribbleHeight, depth);
            gfx.setScrollFactor(scrollFactor, scrollFactor);
            gfx.setAlpha(textAlpha);
            allSprites.push(gfx);
        } else {
            // Render tag in atlas font
            const tag = entry.tag || 'ANON';
            const tagSprites = renderWorldAtlasText(scene, tag, tagX, rowY, depth);
            tagSprites.forEach((s) => { s.setScrollFactor(scrollFactor, scrollFactor); s.setAlpha(textAlpha); });
            allSprites.push(...tagSprites);
        }

        // Score (right-aligned)
        const scoreWidth = scoreText.length * charW;
        const scoreX = scoreRightX - scoreWidth;
        const scoreSprites = renderWorldAtlasText(scene, scoreText, scoreX, rowY, depth);
        scoreSprites.forEach((s) => { s.setScrollFactor(scrollFactor, scrollFactor); s.setAlpha(textAlpha); });
        allSprites.push(...scoreSprites);
    });

    return allSprites;
}

// -------------------------------------------------------------------------
// Atlas text rendering (world-space, no scroll factor lock)
// -------------------------------------------------------------------------

// Atlas grid constants (must match the highscore-atlas.png spritesheet)
const ATLAS_CELL_W = Math.floor(560 / 8); // 70
const ATLAS_CELL_H = Math.floor(423 / 6); // 70

const ATLAS_CHARS = [
    'A','B','C','D','E','F','G','H',
    'I','J','K','L','M','N','O','P',
    'Q','R','S','T','U','V','W','X',
    'Y','Z','Å','Ä','Ö','','','',
    '1','2','3','4','5','6','7','8',
    '9','0','','','','','',''
];

const ATLAS_CHAR_MAP = {};
ATLAS_CHARS.forEach((ch, i) => { if (ch) ATLAS_CHAR_MAP[ch] = i; });

/**
 * Render a string as world-positioned atlas sprites.
 *
 * @param {Phaser.Scene} scene
 * @param {string} text
 * @param {number} x       - World X start position.
 * @param {number} y       - World Y position.
 * @param {number} depth
 * @returns {Phaser.GameObjects.Image[]}
 */
export function renderWorldAtlasText(scene, text, x, y, depth) {
    const images = [];
    const upper  = text.toUpperCase();
    const charW  = ATLAS_CELL_W * 0.5;

    let cursorX = x;
    for (let i = 0; i < upper.length; i++) {
        const ch = upper[i];
        if (ch === ' ') { cursorX += charW; continue; }
        const frame = ATLAS_CHAR_MAP[ch];
        if (frame == null) { cursorX += charW; continue; }
        const img = scene.add.image(cursorX + charW * 0.5, y, 'highscore_atlas', frame);
        img.setDepth(depth);
        images.push(img);
        cursorX += charW;
    }
    return images;
}

/**
 * Render a scribble (hand-drawn strokes) as a world-space graphic.
 *
 * @param {Phaser.Scene} scene
 * @param {Array<Array<{x: number, y: number}>>} strokes - Normalized 0–1 stroke data.
 * @param {number} x       - World X position (top-left).
 * @param {number} y       - World Y position (top-left).
 * @param {number} width   - Target render width.
 * @param {number} height  - Target render height.
 * @param {number} depth
 * @returns {Phaser.GameObjects.Graphics}
 */
export function renderWallScribble(scene, strokes, x, y, width, height, depth) {
    const gfx = scene.add.graphics();
    gfx.setDepth(depth || -3);

    // Stroke width proportional to height (matches atlas character stroke at display size)
    const lineWidth = Math.max(2, Math.round(height * 0.12));
    gfx.lineStyle(lineWidth, 0xffffff, 0.82);

    for (const stroke of strokes) {
        if (stroke.length < 2) continue;
        gfx.beginPath();
        gfx.moveTo(x + stroke[0].x * width, y + stroke[0].y * height);
        for (let i = 1; i < stroke.length; i++) {
            gfx.lineTo(x + stroke[i].x * width, y + stroke[i].y * height);
        }
        gfx.strokePath();
    }

    return gfx;
}

/**
 * Render a "best of each scene" summary wall display for the hub.
 *
 * @param {Phaser.Scene} scene
 * @param {object} options
 * @param {string[]} options.sceneKeys    - Scene keys to include.
 * @param {Object<string, string>} options.sceneLabels - Map of sceneKey → short display name.
 * @param {number}   options.x
 * @param {number}   options.y
 * @param {string}  [options.titleTexture]
 * @param {number}  [options.titleAlpha]
 * @param {number}  [options.textAlpha]
 * @param {number}  [options.scrollFactor]
 * @param {number}  [options.depth]
 * @param {number}  [options.rowGap]
 * @param {{x: number, y: number}} [options.titleOffset]
 * @param {function} [options.formatBestRow] - (sceneLabel, entry) => string
 *
 * @returns {Phaser.GameObjects.GameObject[]}
 */
export function renderHubBestOfBests(scene, options) {
    const {
        sceneKeys,
        sceneLabels  = {},
        x,
        y,
        titleTexture = 'high_score_title',
        titleAlpha   = 0.77,
        textAlpha    = 0.82,
        scrollFactor = 0.85,
        depth        = -3,
        rowGap       = 46,
        titleOffset  = { x: 230, y: -130 },
        formatBestRow = null
    } = options;

    const allSprites = [];
    let hasAny = false;

    const rows = [];
    for (const key of sceneKeys) {
        const board = getBoard(key);
        if (board.length === 0) continue;
        hasAny = true;
        const best  = board[0];
        const label = sceneLabels[key] || key;
        rows.push({ label, entry: best });
    }

    if (!hasAny) return allSprites;

    // Title
    const titleImg = scene.add.image(x + titleOffset.x, y + titleOffset.y, titleTexture);
    titleImg.setOrigin(0.5, 0.5);
    titleImg.setDepth(depth);
    titleImg.setScrollFactor(scrollFactor, scrollFactor);
    titleImg.setAlpha(titleAlpha);
    allSprites.push(titleImg);

    const defaultBestFormat = (label, entry) => {
        const tag   = entry.tag || 'ANON';
        const score = entry.score != null ? entry.score : 0;
        return `${label} ${tag} ${score}`;
    };

    const formatter = typeof formatBestRow === 'function' ? formatBestRow : defaultBestFormat;

    rows.forEach((row, i) => {
        const rowY    = y + (i * rowGap);
        const line    = formatter(row.label, row.entry);
        const sprites = renderWorldAtlasText(scene, line, x, rowY, depth);
        sprites.forEach((s) => {
            s.setScrollFactor(scrollFactor, scrollFactor);
            s.setAlpha(textAlpha);
        });
        allSprites.push(...sprites);
    });

    return allSprites;
}
