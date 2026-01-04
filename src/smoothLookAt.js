import * as THREE from "three";
import { VRMLookAt } from "@pixiv/three-vrm";

const _v3A = new THREE.Vector3();
const _quatAA = new THREE.Quaternion();
const _eulerAA = new THREE.Euler();

const SACCADE_MIN_INTERVAL = 0.5; // Minimum time before a saccade can occur
const SACCADE_MAX_INTERVAL = 1.5; // Time from the last saccade which the next saccade must occur before
const SACCADE_RADIUS = 5.0; // Saccade radius in degrees

const HEAD_INFLUENCE = 0.4; // How much the head tries to turn towards the camera (should be from 0 to 1)
const HEAD_RESPONSIVENESS = 0.4; // How smoothe the head movement is

function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

export class VRMSmoothLookAt extends VRMLookAt {
    yawDamped = 0; // Damped yaw that get applied
    pitchDamped = 0; // Damped pitch that get applied

    saccadeYawDamped = 0; // Damped saccade yaw that get applied
    saccadePitchDamped = 0; // Damped saccade pitch that get applied

    saccadeYaw = 0; // Yaw of the saccade
    saccadePitch = 0; // Pitch of the saccade
    saccadeTimer = 0; // Time since last saccade
    nextSaccadeTime = 0; // Time until the next saccade

    tempFirstPersonBoneQuat = new THREE.Quaternion(); // Used to reset the head position after rendering

    enableEyeGaze = true; // Should the eyes try gaze at the camera
    enableSaccades = true; // Should the eyes have random saccades
    enableHeadMovement = true; // Should the head try to look at the camera

    // Values which change how the autoLookAt feels
    config = {
        smoothFactor: 10, // Factor used for animation

        yawLimit: 40, // Maximum yaw for lookAt (degrees)
        pitchLimit: 30, // Maximum pitch for lookAt (degrees)

        // Buffer for extra degrees that the eyes stay at the limits before resetting
        // Gives a more realistic effect
        yawBuffer: 15,
        pitchBuffer: 15
    }

    constructor(humanoid, applier) {
        super(humanoid, applier);

        const head = this.humanoid.getRawBoneNode("head");
        this.tempFirstPersonBoneQuat.copy(head.quaternion);
    }

    update(delta) {
        if (this.target && this.autoUpdate) {
            /* ---Handle eye gaze--- */
            if (this.enableEyeGaze) {
                this.lookAt(this.target.getWorldPosition(_v3A));
                const isBeyondYaw = Math.abs(this._yaw) > this.config.yawLimit + this.config.yawBuffer;
                const isBeyondPitch = Math.abs(this._pitch) > this.config.pitchLimit + this.config.pitchBuffer;

                // Limit angles- if no longer in the fov + buffer:
                if (isBeyondYaw || isBeyondPitch) {
                    // lose interest (reset eyes)
                    this._yaw = 0.0;
                    this._pitch = 0.0;
                } else {
                    // otherwise clamp the yaw to the limit
                    this._yaw = Math.max(-this.config.yawLimit, Math.min(this.config.yawLimit, this._yaw));
                    this._pitch = Math.max(-this.config.pitchLimit, Math.min(this.config.pitchLimit, this._pitch));
                }
            } else {
                this._yaw = 0.0;
                this._pitch = 0.0;
            }


            /* ---Handle eye saccades--- */
            if (this.enableSaccades) {
                if (this.saccadeTimer > this.nextSaccadeTime) {

                    // 20% chance to just return to centre
                    if (Math.random() < 0.2) {
                        this.saccadeYaw = 0.0;
                        this.saccadePitch = 0.0;
                    } else {
                        this.saccadeYaw = (2.0 * Math.random() - 1.0) * SACCADE_RADIUS;
                        this.saccadePitch = (2.0 * Math.random() - 1.0) * SACCADE_RADIUS;
                    }

                    this.saccadeTimer = 0.0;
                    this.nextSaccadeTime = randomBetween(SACCADE_MIN_INTERVAL, SACCADE_MAX_INTERVAL);

                    // If a component of the saccade would cause the VRM to look outside the limit, scale it down to just hit the limit
                    if (Math.abs(this._yaw + this.saccadeYaw) >= this.config.yawLimit) {
                        const min = -this.config.yawLimit - this._yaw;
                        const max = this.config.yawLimit - this._yaw;
                        this.saccadeYaw = Math.max(min, Math.min(max, this.saccadeYaw));
                    }
                    if (Math.abs(this._pitch + this.saccadePitch) >= this.config.pitchLimit) {
                        const min = -this.config.pitchLimit - this._pitch;
                        const max = this.config.pitchLimit - this._pitch;
                        this.saccadePitch = Math.max(min, Math.min(max, this.saccadePitch));
                    }
                }
                this.saccadeTimer += delta;
            } else {
                // Reset saccade yaw and pitch
                this.saccadeYaw = 0.0;
                this.saccadePitch = 0.0;
            }

            /* ---Apply the eye movement--- */
            const k = 1.0 - Math.exp(-this.config.smoothFactor * delta);

            // Animate the yaw and pitch
            this.yawDamped += (this._yaw - this.yawDamped) * k;
            this.pitchDamped += (this._pitch - this.pitchDamped) * k;

            // Animate the saccades separately to not affect the head movement
            this.saccadeYawDamped += (this.saccadeYaw - this.saccadeYawDamped) * k;
            this.saccadePitchDamped += (this.saccadePitch - this.saccadePitchDamped) * k;

            // Apply the animated angles
            this.applier.applyYawPitch(this.yawDamped + this.saccadeYawDamped, this.pitchDamped + this.saccadePitchDamped);
            this._needsUpdate = false; // there is no need to update the eye gaze twice

            /* ---Handle head movement--- */
            const head = this.humanoid.getRawBoneNode("head");
            if (this.enableHeadMovement) {
                _eulerAA.set(
                    -(this.pitchDamped * HEAD_INFLUENCE) * THREE.MathUtils.DEG2RAD,
                    (this.yawDamped * HEAD_INFLUENCE) * THREE.MathUtils.DEG2RAD,
                    0.0,
                    VRMLookAt.EULER_ORDER
                );
                _quatAA.setFromEuler(_eulerAA);

                // Apply head movement
                this.tempFirstPersonBoneQuat.copy(head.quaternion);
                head.quaternion.slerp(_quatAA, HEAD_RESPONSIVENESS);
                head.updateMatrixWorld();
            }
        }

        if (this._needsUpdate) {
            this._needsUpdate = false;
            this.applier.applyYawPitch(this._yaw, this._pitch);
        }
    }

    /** Call the function after rendering to return the head rotation to normal */
    revertFirstPersonBoneQuat() {
        if (this.target) {
            const head = this.humanoid.getNormalizedBoneNode("head");
            head.quaternion.copy(this.tempFirstPersonBoneQuat);
            head.updateMatrixWorld();
        }
    }
}

/*
            if (this.enableHeadMovement) {
                _eulerAA.set(
                    -(this.pitchDamped * HEAD_INFLUENCE) * THREE.MathUtils.DEG2RAD,
                    (this.yawDamped * HEAD_INFLUENCE) * THREE.MathUtils.DEG2RAD,
                    0.0,
                    VRMLookAt.EULER_ORDER
                );
                _quatAA.setFromEuler(_eulerAA);

                // Apply head movement
                this.tempFirstPersonBoneQuat.copy(head.quaternion);
                head.quaternion.slerp(_quatAA, HEAD_RESPONSIVENESS);
                head.updateMatrixWorld();
            }
*/