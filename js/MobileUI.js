/**
 * Mobile UI manager.
 *
 * Handles:
 * - "Rotate your phone" overlay when in portrait
 * - Posture indicator showing current tilt relative to calibration
 * - Tap-to-recalibrate on the posture indicator
 * - Landscape detection for axis mapping
 *
 * Only activates on touch devices. Desktop users see nothing.
 */

import { getCalibration, setCalibration } from './PlayerSkin.js';

let instance = null;

export default class MobileUI {
    static init() {
        if (instance) return instance;
        const isMobile = (navigator.maxTouchPoints || 0) > 0;
        if (!isMobile) return null;
        instance = new MobileUI();
        return instance;
    }

    static getInstance() {
        return instance;
    }

    constructor() {
        this.rotateOverlay    = document.getElementById('rotate-overlay');
        this.postureIndicator = document.getElementById('posture-indicator');
        this.postureDot       = document.getElementById('posture-dot');

        this._tiltGamma = 0;
        this._tiltBeta  = 0;
        this._isLandscape = window.innerWidth > window.innerHeight;

        // Show posture indicator
        if (this.postureIndicator) {
            this.postureIndicator.style.display = 'block';
        }

        // Orientation change detection
        this._onResize = () => {
            this._isLandscape = window.innerWidth > window.innerHeight;
            this._updateRotateOverlay();
        };
        window.addEventListener('resize', this._onResize);
        this._updateRotateOverlay();

        // Tilt tracking for posture display
        this._onDeviceOrientation = (event) => {
            if (event.gamma != null) this._tiltGamma = event.gamma;
            if (event.beta  != null) this._tiltBeta  = event.beta;
            this._updatePostureDot();
        };
        window.addEventListener('deviceorientation', this._onDeviceOrientation);

        // Tap posture indicator to recalibrate
        if (this.postureIndicator) {
            this.postureIndicator.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                this._recalibrate();
            }, { passive: true });
        }

        // Animation frame loop for rotate overlay check
        this._rafId = null;
        this._startOrientationWatch();
    }

    /** Is the device currently in landscape? */
    isLandscape() {
        return this._isLandscape;
    }

    /**
     * Get tilt values adjusted for landscape orientation.
     * In landscape, gamma becomes the forward/back axis and beta becomes left/right.
     */
    getLandscapeTilt() {
        const calib = getCalibration();
        if (this._isLandscape) {
            // In landscape: beta controls left/right, gamma controls forward/back
            return {
                leftRight: -(this._tiltBeta - calib.beta),
                forwardBack: this._tiltGamma - calib.gamma
            };
        }
        // Portrait fallback (shouldn't be used during gameplay due to overlay)
        return {
            leftRight: this._tiltGamma - calib.gamma,
            forwardBack: this._tiltBeta - calib.beta
        };
    }

    _updateRotateOverlay() {
        if (!this.rotateOverlay) return;
        if (this._isLandscape) {
            this.rotateOverlay.style.display = 'none';
        } else {
            this.rotateOverlay.style.display = 'flex';
        }
    }

    _updatePostureDot() {
        if (!this.postureDot) return;
        const calib = getCalibration();

        let relX, relY;
        if (this._isLandscape) {
            relX = -(this._tiltBeta - calib.beta);
            relY = this._tiltGamma - calib.gamma;
        } else {
            relX = this._tiltGamma - calib.gamma;
            relY = this._tiltBeta - calib.beta;
        }

        // Map degrees to percentage offset within the indicator (clamp to edges)
        const maxDeg = 30;  // degrees at which dot reaches the edge
        const px = 50 + (Math.max(-maxDeg, Math.min(maxDeg, relX)) / maxDeg) * 45;
        const py = 50 + (Math.max(-maxDeg, Math.min(maxDeg, relY)) / maxDeg) * 45;
        this.postureDot.style.left = `${px}%`;
        this.postureDot.style.top  = `${py}%`;
    }

    _recalibrate() {
        // Save raw sensor values — getLandscapeTilt and _updatePostureDot
        // both subtract calib from raw, so this zeroes out correctly.
        setCalibration(this._tiltGamma, this._tiltBeta);
        // Force an immediate dot update so it snaps to center
        if (this.postureDot) {
            this.postureDot.style.left = '50%';
            this.postureDot.style.top  = '50%';
        }
        // Flash the indicator to confirm
        if (this.postureIndicator) {
            this.postureIndicator.style.outline = '2px solid #22aa44';
            setTimeout(() => {
                this.postureIndicator.style.outline = 'none';
            }, 400);
        }
    }

    _startOrientationWatch() {
        const check = () => {
            this._isLandscape = window.innerWidth > window.innerHeight;
            this._updateRotateOverlay();
            this._rafId = requestAnimationFrame(check);
        };
        this._rafId = requestAnimationFrame(check);
    }

    destroy() {
        window.removeEventListener('resize', this._onResize);
        window.removeEventListener('deviceorientation', this._onDeviceOrientation);
        if (this._rafId) cancelAnimationFrame(this._rafId);
        if (this.postureIndicator) this.postureIndicator.style.display = 'none';
        if (this.rotateOverlay) this.rotateOverlay.style.display = 'none';
        instance = null;
    }
}
