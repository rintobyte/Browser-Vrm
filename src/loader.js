import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { VRMAnimationLoaderPlugin } from "@pixiv/three-vrm-animation";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let loader;

/**
 * @returns {GLTFLoader} A GLTF loader which is used to load VRMs
 */
export function useVRMLoader() {
    if (loader) {
        return loader;
    }

    loader = new GLTFLoader();
    loader.crossOrigin = "anonymous";

    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.register(parser => new VRMAnimationLoaderPlugin(parser));

    return loader;
}