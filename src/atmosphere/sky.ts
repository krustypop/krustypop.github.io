import * as THREE from 'three';
import type { AtmosphereState } from './index.ts';

const RADIUS = 300;

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 top, horizon, sunColor, sunDir, moonDir;
  uniform float sunVis, night, time;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1) * 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vDir);
    vec3 col = mix(horizon, top, clamp(dir.y * 1.6 + 0.05, 0.0, 1.0));

    float ds = max(dot(dir, sunDir), 0.0);
    col += sunColor * (pow(ds, 8.0) * 0.35 + pow(ds, 64.0) * 0.6) * sunVis;
    col = mix(col, vec3(1.0, 0.97, 0.88), smoothstep(0.9986, 0.9992, ds) * sunVis);

    float dm = max(dot(dir, moonDir), 0.0);
    col += vec3(0.5, 0.6, 1.0) * pow(dm, 200.0) * 0.25 * night;
    col = mix(col, vec3(0.92, 0.94, 1.0), smoothstep(0.9991, 0.9995, dm) * night);

    // Square "pixel" stars to match the voxel look.
    float s = hash(floor(dir * 260.0));
    float star = step(0.9965, s) * smoothstep(0.02, 0.3, dir.y) * night;
    col += star * (0.55 + 0.45 * sin(time * 2.0 + s * 900.0));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

/** Gradient dome with sun, moon and stars; it follows the camera so it is never reached. */
export function createSky(scene: THREE.Scene) {
  const u = {
    top: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    sunColor: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3() },
    moonDir: { value: new THREE.Vector3() },
    sunVis: { value: 1 },
    night: { value: 0 },
    time: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 32, 16),
    new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: u, vertexShader, fragmentShader }),
  );
  scene.add(dome);

  return {
    update(dt: number, { palette, sunDir, moonDir, sunUp }: AtmosphereState, camera: THREE.Camera) {
      u.top.value.copy(palette.top);
      u.horizon.value.copy(palette.horizon);
      u.sunColor.value.copy(palette.sun);
      u.sunDir.value.copy(sunDir);
      u.moonDir.value.copy(moonDir);
      u.sunVis.value = sunUp;
      u.night.value = palette.night;
      u.time.value += dt;
      dome.position.copy(camera.position);
    },
  };
}
