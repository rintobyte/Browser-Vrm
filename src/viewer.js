import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { Model } from "./model.js";

const canvas = document.getElementById("vrm-canvas");
const canvasParent = canvas.parentElement;

// renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", canvas: canvas, alpha: true });
renderer.setSize(canvasParent.clientWidth, canvasParent.clientHeight);
renderer.setPixelRatio(window.devicePixelRatio);

// camera
const camera = new THREE.PerspectiveCamera(20.0, canvasParent.clientWidth / canvasParent.clientHeight, 0.1, 20.0);
camera.position.set(0.0, 1.3, 1.5);

// camera controls
const cameraControls = new OrbitControls(camera, renderer.domElement);
cameraControls.enablePan = true;
cameraControls.screenSpacePanning = true;
cameraControls.minDistance = 0.5;
cameraControls.maxDistance = 4;
cameraControls.target.set(0.0, 1.3, 0);
cameraControls.update();

// scene
const scene = new THREE.Scene();

// light
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(1.0, 1.0, 1.0).normalize();
light.castShadow = false;
scene.add(light);

// helpers
const helperGroup = new THREE.Group();
helperGroup.name = "debugHelpers";

const gridHelper = new THREE.GridHelper(10, 10);
const axesHelper = new THREE.AxesHelper(5);

helperGroup.add(axesHelper);
helperGroup.add(gridHelper);
scene.add(helperGroup);

// animate
const clock = new THREE.Clock();
clock.start();

let model;

// When the browser window is resized, resize the canvas too
function onWindowResize() {
    if (!renderer) return;

    const parentElement = renderer.domElement.parentElement;
    if (!parentElement) return;

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(parentElement.clientWidth, parentElement.clientHeight);

    if (!camera) return;
    camera.aspect = parentElement.clientWidth / parentElement.clientHeight;
    camera.updateProjectionMatrix();
}

// Load the VRM into the scene
async function loadVrmToScene(vrmUrl, idleAnimUrl) {
    console.log("Loading VRM...")
    if (model?.vrm) {
        unloadVrmFromScene();
    }


    model = new Model(camera);
    await model.loadVRM(vrmUrl, idleAnimUrl); // was here fixing await
    if (!model?.vrm) return;

    scene.add(model.vrm.scene);

    //model.loadAnimation("./animations/idle_loop.vrma");

    console.log("VRM loaded.")
}

// Remove the VRM from the scene
function unloadVrmFromScene() {
    console.log("Unloading VRM...")
    if (model?.vrm) {
        scene.remove(model.vrm.scene);
        model?.unLoadVrm();
    }
    console.log("VRM unloaded.")
}

// Used to fix some bug idk lol
function resetCamera() {
    const headNode = model?.vrm?.humanoid.getNormalizedBoneNode("head");

    if (headNode) {
        const headPos = headNode.getWorldPosition(new THREE.Vector3());
        camera?.position.set(
            camera.position.x,
            headPos.y,
            camera.position.z,
        );
        cameraControls?.target.set(headPos.x, headPos.y, headPos.z);
        cameraControls?.update();
    }
}

function animate() {
    requestAnimationFrame(animate);

    // update vrm components
    if (model) {
        model.update(clock.getDelta());
    }

    // render
    renderer.render(scene, camera);

    // Reset head rotation
    if (model?.vrm?.lookAt?.revertFirstPersonBoneQuat) {
        model.vrm.lookAt.revertFirstPersonBoneQuat();
    }
}

window.addEventListener("resize", () => {
    onWindowResize();
});

loadVrmToScene("./models/example.vrm", "./animations/idle_loop.vrma");
animate();







// Debug menu
const vrmControls = document.getElementById("vrm-controls");
vrmControls.addEventListener("click", (event) => {
    const button = event.target.closest(".ui-button");
    if (!button) return;

    const action = button.dataset.action;
    if (!action) return;

    switch (action) {
        case "toggle-helpers":
            helperGroup.visible = !helperGroup.visible;
            button.classList.toggle("active");
            break;
        case "toggle-lookat-eyegaze":
            model.autoLookAt.toggleEyeGaze(model.vrm);
            button.classList.toggle("active");
            break;
        case "toggle-lookat-headmovement":
            model.autoLookAt.toggleHeadMovement(model.vrm);
            button.classList.toggle("active");
            break;
        case "toggle-lookat-saccades":
            model.autoLookAt.toggleEyeSaccades(model.vrm);
            button.classList.toggle("active");
            break;
        case "toggle-blinking":
            model.autoBlink.toggleAutoBlink();
            button.classList.toggle("active");
            break;
    }
});

document.getElementById("play-anim-btn").addEventListener("click", () => {
    const url = document.getElementById("anim-selector").value;
    const fadeDuration = parseFloat(document.getElementById("anim-fade-duration").value);
    const loopMode = document.getElementById("anim-loop").value;

    model.playAnimation(url, loopMode, fadeDuration);
});