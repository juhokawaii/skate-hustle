/**
 * ScribbleInput — a DOM canvas overlay for finger-drawn tag input.
 *
 * Shows a drawing area with 7:1 proportions (matching 7 atlas characters).
 * Returns normalized stroke data (0–1 range) on confirm.
 *
 * Usage:
 *   const scribble = new ScribbleInput();
 *   scribble.show((strokes) => {
 *       // strokes is an array of [{x, y}, ...] arrays, normalized 0–1
 *       // null if cancelled/cleared without confirming
 *   });
 */

export default class ScribbleInput {
    constructor() {
        this.container  = null;
        this.canvas     = null;
        this.ctx        = null;
        this.strokes    = [];
        this.currentStroke = null;
        this.onComplete = null;

        // Drawing config
        this.strokeColor = '#000000';
        this.strokeWidth = 12; // at input scale, matches atlas stroke width when scaled down
        this.bgColor     = 'rgba(0, 0, 0, 0.85)';
    }

    show(callback) {
        this.onComplete = callback;
        this.strokes = [];
        this.currentStroke = null;
        this._createDOM();
    }

    _createDOM() {
        // Container overlay — transparent to show game background
        this.container = document.createElement('div');
        Object.assign(this.container.style, {
            position: 'fixed',
            top: '0', left: '0',
            width: '100%', height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '25000',
            backgroundColor: 'transparent'
        });

        // Title
        const title = document.createElement('div');
        Object.assign(title.style, {
            color: '#000000',
            fontFamily: 'monospace',
            fontSize: '18px',
            marginBottom: '12px',
            textShadow: '0 0 4px rgba(255,255,255,0.8)'
        });
        title.textContent = 'SCRIBBLE YOUR TAG';
        this.container.appendChild(title);

        // Canvas — 3.5:1 ratio (matching 7 atlas characters at full height)
        const screenW = window.innerWidth;
        const canvasW = Math.min(Math.floor(screenW * 0.8), 1960);
        const canvasH = Math.floor(canvasW / 3.5);

        this.canvas = document.createElement('canvas');
        this.canvas.width  = canvasW;
        this.canvas.height = canvasH;
        Object.assign(this.canvas.style, {
            border: '3px dashed rgba(0, 0, 0, 0.5)',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            touchAction: 'none' // prevent scrolling while drawing
        });
        this.container.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.ctx.lineCap  = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.lineWidth   = this.strokeWidth;

        // Buttons row
        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, {
            marginTop: '12px',
            display: 'flex',
            gap: '16px'
        });

        const btnDone = this._createButton('DONE', '#22aa44');
        btnDone.addEventListener('click', () => this._confirm());
        btnRow.appendChild(btnDone);

        const btnClear = this._createButton('CLEAR', '#cc8800');
        btnClear.addEventListener('click', () => this._clear());
        btnRow.appendChild(btnClear);

        this.container.appendChild(btnRow);
        document.body.appendChild(this.container);

        // Touch events on canvas
        this.canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove',  (e) => this._onTouchMove(e),  { passive: false });
        this.canvas.addEventListener('touchend',   (e) => this._onTouchEnd(e),   { passive: false });

        // Mouse fallback (for testing on desktop)
        this._mouseDown = false;
        this.canvas.addEventListener('mousedown', (e) => { this._mouseDown = true; this._onPointerStart(e.offsetX, e.offsetY); });
        this.canvas.addEventListener('mousemove', (e) => { if (this._mouseDown) this._onPointerMove(e.offsetX, e.offsetY); });
        this.canvas.addEventListener('mouseup',   ()  => { this._mouseDown = false; this._onPointerEnd(); });
    }

    _createButton(text, color) {
        const btn = document.createElement('button');
        btn.textContent = text;
        Object.assign(btn.style, {
            padding: '10px 24px',
            fontFamily: 'monospace',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#ffffff',
            backgroundColor: color,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
        });
        return btn;
    }

    _getTouchPos(e) {
        const touch = e.touches[0];
        const rect  = this.canvas.getBoundingClientRect();
        return {
            x: (touch.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (touch.clientY - rect.top)  * (this.canvas.height / rect.height)
        };
    }

    _onTouchStart(e) {
        e.preventDefault();
        const pos = this._getTouchPos(e);
        this._onPointerStart(pos.x, pos.y);
    }

    _onTouchMove(e) {
        e.preventDefault();
        const pos = this._getTouchPos(e);
        this._onPointerMove(pos.x, pos.y);
    }

    _onTouchEnd(e) {
        e.preventDefault();
        this._onPointerEnd();
    }

    _onPointerStart(x, y) {
        this.currentStroke = [{ x, y }];
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    }

    _onPointerMove(x, y) {
        if (!this.currentStroke) return;
        this.currentStroke.push({ x, y });
        const prev = this.currentStroke[this.currentStroke.length - 2];
        this.ctx.beginPath();
        this.ctx.moveTo(prev.x, prev.y);
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    }

    _onPointerEnd() {
        if (this.currentStroke && this.currentStroke.length > 0) {
            this.strokes.push(this.currentStroke);
        }
        this.currentStroke = null;
    }

    _clear() {
        this.strokes = [];
        this.currentStroke = null;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _confirm() {
        // Scale down to display size (245×70) and export as PNG data URL.
        const displayW = 245;
        const displayH = 70;
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width  = displayW;
        exportCanvas.height = displayH;
        const exportCtx = exportCanvas.getContext('2d');
        exportCtx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, 0, 0, displayW, displayH);

        const dataUrl = exportCanvas.toDataURL('image/png');
        const hasContent = this.strokes.length > 0;

        this._destroy();
        if (this.onComplete) this.onComplete(hasContent ? dataUrl : null);
    }

    _destroy() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.canvas = null;
        this.ctx    = null;
    }
}
