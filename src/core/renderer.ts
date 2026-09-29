import * as THREE from 'three';

// Touch devices trade a little sharpness for frame rate.
const MAX_PIXEL_RATIO = matchMedia('(pointer: coarse)').matches ? 1.5 : 2;
const FOV = { landscape: 55, portrait: 72 };

export function createRenderer(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV.landscape, 1, 0.1, 400);

  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.fov = camera.aspect < 1 ? FOV.portrait : FOV.landscape;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  return { renderer, scene, camera };
}
