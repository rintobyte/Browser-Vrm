import * as THREE from "three";
import { VRMExpressionManager } from "@pixiv/three-vrm";

// Random value between min and max
function getRandomBlinkInterval(min, max) {
    return min + Math.random() * (max - min);
}

// Biased value towards the min
function getBlinkHold(min, max) {
    return THREE.MathUtils.lerp(min, max, Math.random() ** 2);
}

export class AutoBlink {
    expressionManager; // 

    isAutoBlink = true; // Should this code run --> should probably be disabled for certain animations
    timeUntilBlink = 0; // The time until the VRM shuts or opens their eyes

    blinkPhase = "open"; // Are the VRM's eyes open, closing or closed
    blinkTargetValue = 0; // 0 or 1: should the eyes be shut or open
    blinkValueDamped = 0; // Used to animate the blink

    // Values which change how the blink feels
    config = {
        blinkIntervalMin: 2.0, // Min time between blinks
        blinkIntervalMax: 8.0, // Max time between blnks
        blinkHoldMin: 0.04, // Min time eyes are shut for
        blinkHoldMax: 0.08, // Max time eyes are shut for
        openSmoothFactor: 25.0, // How smooth/ quick the opening is
        closeSmoothFactor: 40.0 // How smooth/ quick the closing is
    };

    /**
     * @param {VRMExpressionManager} expressionManager the VRM's expression manager
     */
    constructor(expressionManager) {
        this.expressionManager = expressionManager;
    }

    /**
     * Turns automatic blinking ON/OFF
     *
     * It would look unnatural if you applied an emote when the eyes are closed (blink is 1),
     * So returns the number of seconds until the eyes open so you can wait before applying an emote
     * @param {boolean} isAuto
     * @returns the number of seconds until the eyes open.
     */
    setEnable(isAuto) {
        this.isAutoBlink = isAuto;

        // If the eyes are closed, returns the time until the eyes open.
        if (!this.isEyesOpen) {
            return this.timeUntilBlink;
        }

        return 0;
    }

    update(delta) {
        this.timeUntilBlink -= delta;

        if (this.timeUntilBlink <= 0) {
            if (this.blinkPhase === "open" && this.isAutoBlink) {
                this.startClosingEyes();
            } else if (this.blinkPhase === "closed") {
                this.startOpeningEyes();
            }
        }

        const smoothFactor = this.blinkPhase === "closing" ? this.config.closeSmoothFactor : this.config.openSmoothFactor;
        const k = 1.0 - Math.exp(-smoothFactor * delta);
        this.blinkValueDamped += (this.blinkTargetValue - this.blinkValueDamped) * k;

        this.expressionManager.setValue("blink", this.blinkValueDamped);

        // When the eyes are fully close, change the state to closed
        if (this.blinkPhase === "closing" && Math.abs(this.blinkValueDamped - 1) < 0.01) {
            this.blinkPhase = "closed";
            this.timeUntilBlink = getBlinkHold(this.config.blinkHoldMin, this.config.blinkHoldMax); // How long eyes are closed whilst blinking
        }
    }

    // Start closing the eyes
    startClosingEyes() {
        this.blinkPhase = "closing";
        this.blinkTargetValue = 1;
    }

    // Start opening the eyes
    startOpeningEyes() {
        this.blinkPhase = "open";
        this.timeUntilBlink = getRandomBlinkInterval(this.config.blinkIntervalMin, this.config.blinkIntervalMax); // Time between blinks
        this.blinkTargetValue = 0;
    }

    // Toggle the value, used for a GUI will (probably) be removed later
    toggleAutoBlink() {
        return this.setEnable(this.isAutoBlink = !this.isAutoBlink);
    }
}