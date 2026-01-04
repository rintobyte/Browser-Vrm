import * as THREE from "three";
import { useVRMLoader } from "./loader.js";
import { VRM, VRMUtils } from "@pixiv/three-vrm";
import { createVRMAnimationClip, VRMLookAtQuaternionProxy } from "@pixiv/three-vrm-animation";

import { loadVRMAnimation } from "./loadVRMAnimation.js";

import { AutoLookAt } from "./emoteController/autoLookAt.js";
import { AutoBlink } from "./emoteController/autoBlink.js";

const LOOP_MODES = {
    "once": THREE.LoopOnce,
    "repeat": THREE.LoopRepeat,
    "pingpong": THREE.LoopPingPong
};

export class Model {
    vrm;
    camera;
    mixer;
    // Animations will be cached so playing the same animation over and over doesn't create a new object in memory each time
    animationCache = new Map();
    idleAnimation;
    currentAction;
    autoLookAt;
    autoBlink;

    lookAtTarget;

    /**
     * @param {THREE.PerspectiveCamera} camera 
     */
    constructor(camera) {
        this.camera = camera;
    }

    /**
     * Loads the VRM using the loader- The scene must then load this classes vrm variable
     * @param {string} vrmUrl path to VRM model file
     * @param {string} idleAnimUrl path to the idle animation to loop
     * @returns {VRM} I'm only returning this to make VSCode happy about awaiting for this function to finish
     */
    async loadVRM(vrmUrl, idleAnimUrl) {
        const loader = useVRMLoader();

        try {
            const gltf = await loader.loadAsync(vrmUrl, (progress) => {
                const percentage = (progress.loaded / progress.total) * 100;
                console.log(`Loading VRM... ${percentage.toFixed(2)}%`);
            });

            const vrm = (this.vrm = gltf.userData.vrm);
            vrm.scene.name = "VRMRoot";

            window.vrm = vrm; // Expose to window for debugging lols can be removed at any time

            // Calling these functions greatly improves the performance
            VRMUtils.removeUnnecessaryVertices(gltf.scene);
            VRMUtils.combineSkeletons(gltf.scene);
            VRMUtils.combineMorphs(vrm);

            //Used when playing animations because of how THREE""s mixer plays animations vs the VRM system
            const lookAtQuatProxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
            lookAtQuatProxy.name = "lookAtQuaternionProxy";
            vrm.scene.add(lookAtQuatProxy);

            // Disable frustum culling
            vrm.scene.traverse((obj) => {
                obj.frustumCulled = false;
            });

            VRMUtils.rotateVRM0(vrm); // Make's sure that the VRM model is spawned facing the right way

            // Makes the VRM's eyes look at the camera and blink automatically
            // 'new AutoLookAt()' needs to be called before the idle animation is played or won't work
            this.autoLookAt = new AutoLookAt(vrm, this.camera);
            this.autoBlink = new AutoBlink(vrm.expressionManager);

            // Animation setup
            this.mixer = new THREE.AnimationMixer(vrm.scene); // Used to play animations
            this.idleAnimation = await this.playAnimation(idleAnimUrl, "repeat", 0); // Load the idle animation

            // Return to idle when an animation finishes
            this.mixer.addEventListener("finished", (event) => {
                if (event.action === this.currentAction) {
                    this.#playAnimationAction(this.idleAnimation);
                }
            });

            return vrm;
        } catch (error) {
            console.error("Error loading VRM:", error);
            throw error;
        }
    }

    unLoadVrm() {
        if (this.vrm) {
            VRMUtils.deepDispose(this.vrm.scene);
            this.vrm = null;
        }
    }

    /**
     * Load and play an animation on the VRM model
     * Uses a caching system to prevent the same animation having multiple clips in the animation mixer
     * If the animation to play is currently playing, it is ignored but if the loop mode is different it is updated
     * @param {string} url path to the file location of the animation 
     * @param {number} fadeDuration how long the cross fade is
     * @param {string} loopMode how the animation should loop (once, pingpong, repeat)
     * @returns {THREE.AnimationAction} the animation action that was loaded and played
     */
    async playAnimation(url, loopMode = "once", fadeDuration = 0.5) {
        if (!this.vrm || !this.mixer) {
            throw new Error("You need to load a VRM first!");
        }

        const clip = await this.#getClipFromCache(url);

        const nextAction = this.mixer.clipAction(clip);
        nextAction.enabled = true;
        nextAction.clampWhenFinished = true;
        nextAction.setLoop(LOOP_MODES[loopMode]);

        if (this.currentAction === nextAction) {
            return
        }

        this.#playAnimationAction(nextAction, fadeDuration)

        return nextAction;
    }

    /**
     * Retrieve an animation clip from the cache by URL or load an add it to the cache
     * @param {string} url path to the animation
     * @returns {THREE.AnimationClip}
     */
    async #getClipFromCache(url) {
        // Check if clip is already in the cache
        if (this.animationCache.has(url)) {
            return this.animationCache.get(url);
        }

        const vrmAnimation = await loadVRMAnimation(url);
        if (!vrmAnimation) {
            console.warn("Invalid VRM animation.");
            return;
        }

        const clip = vrmAnimation instanceof THREE.AnimationClip
            ? vrmAnimation
            : createVRMAnimationClip(vrmAnimation, this.vrm);

        this.#normalizeAnimationToOrigin(this.vrm, clip); // Make sure the animation plays starting from (0,0,0)
        this.animationCache.set(url, clip);

        return clip;
    }

    /**
     * Play an animation action with an optional fade in/ out parameter
     * @param {THREE.AnimationAction} nextAction the animation action to play
     * @param {number} fadeDuration how long the fade in/ out is
     * @returns {void}
     */
    #playAnimationAction(nextAction, fadeDuration = 0.5) {
        if (this.currentAction) {
            this.currentAction.fadeOut(fadeDuration);
        }

        nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(fadeDuration).play();

        this.currentAction = nextAction;
    }

    /**
     * Ensures an animation's keyframes start at (0,0,0)
     * Meaning the animation starts at (0,0,0)
     * @param {VRM} vrm Self explanatory
     * @param {THREE.AnimationClip} clip The clip to modify
     */
    #normalizeAnimationToOrigin(vrm, clip) {
        const hipNode = vrm.humanoid?.getNormalizedBoneNode("hips");
        if (!hipNode) return;

        const hipsTrack = clip.tracks.find(track =>
            track.name.endsWith(".position") && track.name.includes(hipNode.name)
        );

        if (hipsTrack) {
            // Capture the VERY FIRST frame's position in this animation
            const startX = hipsTrack.values[0];
            const startY = hipsTrack.values[1];
            const startZ = hipsTrack.values[2];

            clip.tracks.forEach((track) => {
                if (track.name.endsWith(".position") && track instanceof THREE.VectorKeyframeTrack) {
                    for (let i = 0; i < track.values.length; i += 3) {
                        // Normalize the animation so it begins at local 0,0,0
                        track.values[i] -= startX;
                        // track.values[i+1] -= startY; // Optional: keeps character from snapping to floor
                        track.values[i + 2] -= startZ;
                    }
                }
            });
        }
    }

    update(delta) {
        this.mixer?.update(delta);
        this.autoBlink?.update(delta);
        this.vrm?.update(delta);
    }
}