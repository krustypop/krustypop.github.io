import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
const materials = new Map<string, THREE.MeshStandardMaterial>();
const hitMaterial = new THREE.MeshBasicMaterial();

// One shared material per color, so merging groups every same-colored block into one draw call.
export type Vec3 = [number, number, number];
export type ColorInput = THREE.ColorRepresentation;
export type ColoredBlock = [color: ColorInput, size: Vec3, position: Vec3];

export function solid(color: ColorInput) {
  const key = new THREE.Color(color).getHexString();
  if (!materials.has(key)) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    material.userData.solid = true; // never mutated, so mergeStatic may bake its color into vertices
    materials.set(key, material);
  }
  return materials.get(key)!;
}

/** Adds an axis-aligned block to `parent`. `color` may also be a ready-made material. */
export function box(
  parent: THREE.Object3D,
  color: ColorInput | THREE.Material,
  [w, h, d]: Vec3,
  [x, y, z]: Vec3,
  { shadow = true } = {},
) {
  const mesh = new THREE.Mesh(unitBox, color instanceof THREE.Material ? color : solid(color));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Invisible box that keeps a group raycastable once its visible blocks are merged away.
export function hitbox(parent: THREE.Object3D, [w, h, d]: Vec3, [x, y, z]: Vec3) {
  const mesh = new THREE.Mesh(unitBox, hitMaterial);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.visible = false;
  mesh.userData.dynamic = true;
  parent.add(mesh);
  return mesh;
}

/** Merges `[color, size, position]` blocks into one vertex-colored geometry: a multi-color model in one draw call. */
export function coloredBlocks(blocks: ColoredBlock[]) {
  const c = new THREE.Color();
  return mergeGeometries(
    blocks.map(([color, [w, h, d], [x, y, z]]) => {
      const g = unitBox.clone().scale(w, h, d).translate(x, y, z);
      const colors = new Float32Array(g.attributes.position.count * 3);
      c.set(color);
      for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      return g;
    }),
  );
}

// Box whose +Z face shows `texture`; the other five faces are plain `edgeColor`.
export function signBoard([w, h, d]: Vec3, texture: THREE.Texture, edgeColor: ColorInput) {
  const faces = Array(6).fill(solid(edgeColor));
  faces[4] = new THREE.MeshBasicMaterial({ map: texture });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
  board.castShadow = true;
  return board;
}

export function instanced(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  matrices: THREE.Matrix4[],
  colors?: THREE.Color[],
) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  colors?.forEach((c, i) => mesh.setColorAt(i, c));
  // City-wide batches span the whole avenue, so a bounding test would never cull them.
  mesh.frustumCulled = false;
  parent.add(mesh);
  return mesh;
}

const isMergeable = (o: THREE.Object3D): o is THREE.Mesh<THREE.BufferGeometry, THREE.Material> => {
  const { material: m, isMesh, isInstancedMesh } = o as THREE.Mesh & { isInstancedMesh?: boolean };
  return (
    isMesh &&
    !isInstancedMesh &&
    !Array.isArray(m) &&
    !m.transparent &&
    ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial)
  );
};

function pruneEmptyGroups(o: THREE.Object3D) {
  [...o.children].forEach(pruneEmptyGroups);
  if ((o as THREE.Group).isGroup && o.children.length === 0 && !o.userData.target) o.removeFromParent();
}

// Plain `solid()` colors become vertex colors on this one material: a hundred colors, one draw call.
const palette = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

function bakeColor(geometry: THREE.BufferGeometry, color: THREE.Color) {
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// mergeGeometries needs identical attribute sets and indexing within a bucket.
const layoutKey = (g: THREE.BufferGeometry) =>
  `${g.index ? 'i' : 'n'}:${Object.keys(g.attributes).toSorted().join(',')}`;

/**
 * Bakes every static opaque mesh under `root`: `solid()` colors into one vertex-colored mesh per
 * castShadow flag, other materials into one mesh per (material, castShadow) pair.
 * Skips subtrees flagged `userData.dynamic`, then drops the groups left empty.
 */
export function mergeStatic(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const buckets = new Map<
    string,
    { material: THREE.Material; castShadow: boolean; geometries: THREE.BufferGeometry[] }
  >();

  const collect = (o: THREE.Object3D) => {
    if (o.userData.dynamic) return;
    if (isMergeable(o)) {
      const baked = o.material.userData.solid === true;
      const geometry = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (baked) bakeColor(geometry, (o.material as THREE.MeshStandardMaterial).color);
      const material = baked ? palette : o.material;
      const key = `${material.uuid}|${o.castShadow}|${layoutKey(geometry)}`;
      if (!buckets.has(key)) buckets.set(key, { material, castShadow: o.castShadow, geometries: [] });
      buckets.get(key)!.geometries.push(geometry);
      o.removeFromParent();
    }
    [...o.children].forEach(collect);
  };
  collect(root);

  pruneEmptyGroups(root);

  for (const { material, castShadow, geometries } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
}
