import * as THREE from "three";
import { VRM } from "@pixiv/three-vrm";

import { VRMSmoothLookAt } from "../smoothLookAt.js"

export class AutoLookAt {
    lookAtTarget;

    constructor(vrm, camera) {
        // Create an object to use as the lookAtTarget
        this.lookAtTarget = new THREE.Object3D();
        this.lookAtTarget.name = "LookAtTarget";
        camera.add(this.lookAtTarget); // The object should follow camera movement

        // Instantiate the SmoothLookAt and override the one laoded by default
        if (vrm.lookAt) {
            const smoothLookAt = new VRMSmoothLookAt(vrm.humanoid, vrm.lookAt.applier);
            smoothLookAt.copy(vrm.lookAt);
            vrm.lookAt = smoothLookAt;
            vrm.lookAt.target = this.lookAtTarget;
        }
    }

    /**
     * Toggles the eyes of the vrm looking at the camera
     * @param {VRM} vrm
     */
    toggleEyeGaze(vrm) {
        vrm.lookAt.enableEyeGaze = !vrm.lookAt.enableEyeGaze;
    }

    /**
     * Toggles the eye saccades
     * @param {VRM} vrm
     */
    toggleEyeSaccades(vrm) {
        vrm.lookAt.enableSaccades = !vrm.lookAt.enableSaccades;
    }

    /**
     * Toggles the head of the VRM trying to turn towards the camera
     * @param {VRM} vrm
     */
    toggleHeadMovement(vrm) {
        vrm.lookAt.enableHeadMovement = !vrm.lookAt.enableHeadMovement;
    }
}