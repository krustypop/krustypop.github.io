import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { radialTexture } from '../gfx/textures.ts';
import { SIDEWALK_Y } from './layout.ts';
import type { XZ } from './types.ts';

const BEAM_HEIGHT = SIDEWALK_Y + 4.7;
const BEAM_RADIUS = 1.9;
const POOL_SIZE = 4.6;
const POOL_Y = 0.18; // above the curb, so the pool never sinks into it
const POOL_OPACITY = 0.32;

const beamMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { intensity: { value: 0 }, color: { value: new THREE.Color('#ffd98a') } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying float vHeight;
      varying float vFacing;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vHeight = uv.y;
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float intensity;
      uniform vec3 color;
      varying float vHeight;
      varying float vFacing;
      void main() {
        gl_FragColor = vec4(color, pow(vHeight, 1.4) * pow(vFacing, 1.5) * 0.3 * intensity);
      }`,
  });

/** Fake volumetric cones through the fog plus a glow pool under each bulb, one draw call each. */
export function createLampLights(scene: THREE.Object3D, bulbs: XZ[]) {
  const cone = new THREE.ConeGeometry(BEAM_RADIUS, BEAM_HEIGHT, 16, 1, true);
  const beams = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(
    mergeGeometries(bulbs.map((b) => cone.clone().translate(b.x, BEAM_HEIGHT / 2, b.z))),
    beamMaterial(),
  );

  const plane = new THREE.PlaneGeometry(POOL_SIZE, POOL_SIZE).rotateX(-Math.PI / 2);
  const pools = new THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>(
    mergeGeometries(bulbs.map((b) => plane.clone().translate(b.x, POOL_Y, b.z))),
    new THREE.MeshBasicMaterial({
      map: radialTexture('255,190,100'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  scene.add(beams, pools);

  return {
    setNight(night: number) {
      beams.material.uniforms.intensity.value = night;
      pools.material.opacity = night * POOL_OPACITY;
    },
  };
}
