// scene.js — renderer, camera, lights and fog. One setup, used by main.js.
import * as THREE from '../vendor/three.module.min.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x9fd8f0, 120, 420);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 8, 20);

  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x3d7a4a, 0.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8899ff, 0.0);
  moon.position.set(-60, 100, -40);
  scene.add(moon);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, sun, hemi, moon };
}
