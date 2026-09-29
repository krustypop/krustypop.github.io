import * as THREE from 'three';

// Shared by every patched material, so one write updates the whole scene.
const uniforms = {
  fogTime: { value: 0 },
  fogLightDir: { value: new THREE.Vector3(0, 1, 0) },
  fogScatterColor: { value: new THREE.Color() },
  fogHeightDensity: { value: 0.03 },
  fogHaze: { value: 0.005 },
};

// Replaces three's distance fog with a drifting, height-based fog layer.
Object.assign(THREE.ShaderChunk, {
  fog_pars_vertex: /* glsl */ `
    #ifdef USE_FOG
      varying vec3 vFogWorldPos;
    #endif`,
  fog_vertex: /* glsl */ `
    #ifdef USE_FOG
      vec4 fogWorld = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fogWorld = instanceMatrix * fogWorld;
      #endif
      vFogWorldPos = (modelMatrix * fogWorld).xyz;
    #endif`,
  fog_pars_fragment: /* glsl */ `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      uniform vec3 fogScatterColor;
      uniform vec3 fogLightDir;
      uniform float fogTime;
      uniform float fogHeightDensity;
      uniform float fogHaze;
      varying vec3 vFogWorldPos;

      float fogHash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1) * 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float fogNoise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(fogHash(i), fogHash(i + vec3(1, 0, 0)), f.x),
              mix(fogHash(i + vec3(0, 1, 0)), fogHash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(fogHash(i + vec3(0, 0, 1)), fogHash(i + vec3(1, 0, 1)), f.x),
              mix(fogHash(i + vec3(0, 1, 1)), fogHash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      float fogFbm(vec3 p) {
        return 0.6 * fogNoise(p) + 0.4 * fogNoise(p * 2.3 + 7.1);
      }
    #endif`,
  fog_fragment: /* glsl */ `
    #ifdef USE_FOG
      const float FOG_FALLOFF = 0.3;
      vec3 fogRay = vFogWorldPos - cameraPosition;
      float fogDist = length(fogRay);
      vec3 fogDir = fogRay / max(fogDist, 1e-4);

      // Closed-form integral of density * exp(-falloff * height) along the ray.
      float fogDy = FOG_FALLOFF * fogRay.y;
      float fogOptical = fogHeightDensity * exp(-FOG_FALLOFF * cameraPosition.y) * fogDist
        * (abs(fogDy) > 1e-3 ? (1.0 - exp(-fogDy)) / fogDy : 1.0);

      // Wind-blown noise sampled along the ray, so the fog has depth and parallax.
      vec3 fogWind = vec3(0.06, 0.004, 0.025) * fogTime;
      float fogSpan = min(fogDist, 60.0);
      float fogN = 0.0;
      for (int i = 1; i <= 3; i++) {
        vec3 p = cameraPosition + fogDir * fogSpan * (float(i) / 3.0);
        fogN += fogFbm(p * vec3(0.07, 0.2, 0.07) + fogWind);
      }
      fogOptical *= mix(0.2, 2.0, fogN / 3.0);
      fogOptical += fogDist * fogHaze;

      float fogFactor = 1.0 - exp(-fogOptical);
      float fogGlow = pow(max(dot(fogDir, fogLightDir), 0.0), 6.0);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(fogColor, fogScatterColor, fogGlow), fogFactor);
    #endif`,
});

const injectUniforms = (shader: THREE.WebGLProgramParametersWithUniforms) => Object.assign(shader.uniforms, uniforms);

/** Gives every fog-enabled material under `root` the shared uniforms. Run before the first render. */
export function applyFog(root: THREE.Object3D) {
  root.traverse((o) => {
    const { material } = o as Partial<THREE.Mesh>;
    for (const m of ([] as THREE.Material[]).concat(material ?? [])) {
      if ('fog' in m && m.fog && !(m as THREE.ShaderMaterial).isShaderMaterial) m.onBeforeCompile = injectUniforms;
    }
  });
}

export function updateFog(
  dt: number,
  {
    lightDir,
    scatterColor,
    density,
    haze,
  }: { lightDir: THREE.Vector3; scatterColor: THREE.Color; density: number; haze: number },
) {
  uniforms.fogTime.value += dt;
  uniforms.fogLightDir.value.copy(lightDir);
  uniforms.fogScatterColor.value.copy(scatterColor);
  uniforms.fogHeightDensity.value = density;
  uniforms.fogHaze.value = haze;
}
