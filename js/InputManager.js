/**
 * Input abstraction layer.
 *
 * Keyboard mode: wraps Phaser cursor keys (existing behavior).
 * Touch mode:    deviceorientation for tilt (left/right/brake),
 *                tap for jump, tap-on-portal for confirm.
 *
 * Mode is auto-detected via navigator.maxTouchPoints.
 * Both modes expose the same interface so Player.js and scenes
 * don't need to know which input source is active.
 */

import { getCalibration, setCalibration } from './PlayerSkin.js';
import MobileUI from './MobileUI.js';

export default class InputManager {
    /**
     * @param {Phaser.Scene} scene
     */
    constructor(scene) {
        this.scene   = scene;
        this.isMobile = (navigator.maxTouchPoints || 0) > 0;

        // --- Keyboard (always available as fallback) ---
        this.cursors  = scene.input.keyboard.createCursorKeys();
        this.enterKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        // Edge-trigger tracking
        this._prevUp    = false;
        this._prevEnter = false;
        this._justUp    = false;
        this._justEnter = false;

        // --- Touch / Tilt state ---
        this._tiltGamma    = 0;   // left-right tilt (degrees)
        this._tiltBeta     = 0;   // front-back tilt (degrees)
        this._tapJump      = false; // true on the frame a tap occurred
        this._tapConfirm   = false; // true on the frame a two-finger tap occurred
        this._touchActive  = false; // any touch currently held

        // Tuning
        this.TILT_DEAD_ZONE  = 5;   // degrees of gamma ignored around neutral
        this.TILT_MAX        = 30;  // degrees at which tilt is "full"
        this.BRAKE_THRESHOLD = 15;  // beta degrees forward from neutral to trigger brake

        if (this.isMobile) {
            this._initTilt();
            this._initTouch();
        }
    }

    // -----------------------------------------------------------------
    //  TILT (deviceorientation)
    // -----------------------------------------------------------------

    _initTilt() {
        this._onDeviceOrientation = (event) => {
            if (event.gamma != null) this._tiltGamma = event.gamma;
            if (event.beta  != null) this._tiltBeta  = event.beta;
        };
        window.addEventListener('deviceorientation', this._onDeviceOrientation);
    }

    /**
     * Capture current tilt as the neutral resting position.
     * Prefer calling setCalibration() from SkinSelectScene instead.
     * This method is kept for manual recalibration if needed.
     */
    calibrate() {
        setCalibration(this._tiltGamma, this._tiltBeta);
    }

    /** Relative left-right tilt after calibration, clamped to [-1, 1]. Landscape-aware. */
    _relativeGamma() {
        const mobileUI = MobileUI.getInstance();
        let raw;
        if (mobileUI) {
            raw = mobileUI.getLandscapeTilt().leftRight;
        } else {
            const calib = getCalibration();
            raw = this._tiltGamma - calib.gamma;
        }
        if (Math.abs(raw) < this.TILT_DEAD_ZONE) return 0;
        const sign    = raw > 0 ? 1 : -1;
        const clamped = Math.min(Math.abs(raw) - this.TILT_DEAD_ZONE, this.TILT_MAX - this.TILT_DEAD_ZONE);
        return sign * (clamped / (this.TILT_MAX - this.TILT_DEAD_ZONE));
    }

    /** Relative forward tilt after calibration. Landscape-aware. */
    _relativeBeta() {
        const mobileUI = MobileUI.getInstance();
        if (mobileUI) {
            return mobileUI.getLandscapeTilt().forwardBack;
        }
        const calib = getCalibration();
        return this._tiltBeta - calib.beta;
    }

    // -----------------------------------------------------------------
    //  TOUCH
    // -----------------------------------------------------------------

    _initTouch() {
        // Single tap = jump, two-finger tap = confirm/enter portal.
        // Use native DOM events for reliable multi-touch detection.
        const canvas = this.scene.game.canvas;

        this._onTouchStart = (event) => {
            this._touchActive = true;
            if (event.touches.length >= 2) {
                this._tapConfirm = true;
            } else {
                this._tapJump = true;
            }
        };
        this._onTouchEnd = (event) => {
            if (event.touches.length === 0) {
                this._touchActive = false;
            }
        };
        canvas.addEventListener('touchstart', this._onTouchStart, { passive: true });
        canvas.addEventListener('touchend', this._onTouchEnd, { passive: true });
    }

    // -----------------------------------------------------------------
    //  PER-FRAME UPDATE
    // -----------------------------------------------------------------

    /**
     * Call once per frame (at the start of update) to refresh
     * edge-triggered states like justJumped / justConfirmed.
     */
    update() {
        // Keyboard edge detection
        const upNow    = this.cursors.up.isDown;
        const enterNow = this.enterKey.isDown;

        this._justUp    = (upNow && !this._prevUp)       || this._tapJump;
        this._justEnter = (enterNow && !this._prevEnter)  || this._tapConfirm;

        this._prevUp    = upNow;
        this._prevEnter = enterNow;

        // Clear single-frame touch flags after they've been consumed
        this._tapJump    = false;
        this._tapConfirm = false;
    }

    // -----------------------------------------------------------------
    //  PUBLIC INTERFACE
    // -----------------------------------------------------------------

    /** True while left is held (keyboard) or phone tilted left (mobile). */
    isLeft() {
        if (this.cursors.left.isDown) return true;
        if (this.isMobile) return this._relativeGamma() < -0.15;
        return false;
    }

    /** True while right is held (keyboard) or phone tilted right (mobile). */
    isRight() {
        if (this.cursors.right.isDown) return true;
        if (this.isMobile) return this._relativeGamma() > 0.15;
        return false;
    }

    /** True while up is held (keyboard) or touch held (mobile, for jetpack). */
    isUp() {
        if (this.cursors.up.isDown) return true;
        if (this.isMobile) return this._touchActive;
        return false;
    }

    /** True while down/brake is held (keyboard) or phone tilted forward (mobile). */
    isBrake() {
        if (this.cursors.down.isDown) return true;
        if (this.isMobile) return this._relativeBeta() > this.BRAKE_THRESHOLD;
        return false;
    }

    /** True on the frame jump was triggered (up key pressed or screen tapped). */
    justJumped() {
        return this._justUp;
    }

    /** True on the frame confirm was triggered (enter key or two-finger tap). */
    justConfirmed() {
        return this._justEnter;
    }

    /** Reset confirm state to prevent carry-over from overlays/input phases. */
    resetConfirm() {
        this._prevEnter  = true;
        this._justEnter  = false;
        this._tapConfirm = false;
        this.enterKey.isDown    = false;
        this.enterKey._justDown = false;
    }

    /** Clean up event listeners. Call on scene shutdown if needed. */
    destroy() {
        if (this._onDeviceOrientation) {
            window.removeEventListener('deviceorientation', this._onDeviceOrientation);
            this._onDeviceOrientation = null;
        }
        if (this._onTouchStart) {
            const canvas = this.scene.game.canvas;
            canvas.removeEventListener('touchstart', this._onTouchStart);
            canvas.removeEventListener('touchend', this._onTouchEnd);
            this._onTouchStart = null;
            this._onTouchEnd = null;
        }
    }
}
