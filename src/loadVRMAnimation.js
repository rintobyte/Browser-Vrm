import { useVRMLoader } from "./loader.js";

export async function loadVRMAnimation(url) {
    const loader = useVRMLoader(); // Get the loader
    const gltfVrma = await loader.loadAsync(url); // Load the vrma file
    const vrmAnimation = gltfVrma.userData.vrmAnimations[0]; // Get the animation

    return vrmAnimation ?? null; // Return the animation or null if the animation doesn't exist
}