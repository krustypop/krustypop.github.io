import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { experiences } from '../src/data.ts';
import { rng } from '../src/utils/random.ts';
import { type Block, buildingHeight, type Era, eraBlocks, eraOf } from '../src/world/eras.ts';
import { BUILDING } from '../src/world/layout.ts';
import { createCityMaterials } from '../src/world/materials.ts';
import { createWindowBatch } from '../src/world/windows.ts';

const ERAS: Era[] = ['brick', 'render', 'glass'];
const FLOORS = [2, 3, 4, 5, 6, 7, 8];
const F = BUILDING.depth / 2;
const GAP = 0.02; // z-fighting margin

const blockBox = ({ size, pos }: Block) =>
  new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...pos), new THREE.Vector3(...size));

const overlaps = (a: THREE.Box3, b: THREE.Box3) =>
  a.min.x < b.max.x - 1e-6 &&
  b.min.x < a.max.x - 1e-6 &&
  a.min.y < b.max.y - 1e-6 &&
  b.min.y < a.max.y - 1e-6 &&
  a.min.z < b.max.z - 1e-6 &&
  b.min.z < a.max.z - 1e-6;

// The real panes, read back from the window batch of an unrotated building.
function panes(floors: number) {
  const mats = createCityMaterials();
  const batch = createWindowBatch(mats);
  batch.addBuilding(new THREE.Matrix4(), floors, new THREE.Color(), rng(1));
  const parent = new THREE.Group();
  batch.build(parent);
  const boxes: THREE.Box3[] = [];
  const m = new THREE.Matrix4();
  for (const mesh of parent.children as THREE.InstancedMesh[]) {
    if (mesh.material !== mats.windowLit && mesh.material !== mats.windowDark) continue;
    mesh.geometry.computeBoundingBox();
    for (let k = 0; k < mesh.count; k++) {
      mesh.getMatrixAt(k, m);
      boxes.push(mesh.geometry.boundingBox!.clone().applyMatrix4(m));
    }
  }
  return boxes;
}

describe('eras', () => {
  test('the avenue ages with the career: brick, then render, then glass', () => {
    expect([2007, 2010, 2012, 2013].map(eraOf)).toEqual(['brick', 'brick', 'brick', 'brick']);
    expect([2014, 2016, 2019].map(eraOf)).toEqual(['render', 'render', 'render']);
    expect([2020, 2025].map(eraOf)).toEqual(['glass', 'glass']);

    const order = experiences.map((e) => ERAS.indexOf(eraOf(Number(e.start))));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThanOrEqual(order[i - 1]);
    expect(new Set(order).size).toBe(ERAS.length);
  });

  for (const era of ERAS) {
    test(`${era} details never cover a window pane`, () => {
      for (const floors of FLOORS) {
        const glass = panes(floors);
        expect(glass.length).toBeGreaterThan(0);
        for (const block of eraBlocks(era, floors)) {
          const b = blockBox(block);
          for (const p of glass) {
            if (!overlaps(b, p)) continue;
            // Allowed only behind the glass, with a margin against z-fighting.
            const side = p.max.x - p.min.x < p.max.z - p.min.z;
            if (side) {
              if (p.min.x > 0) expect(b.max.x).toBeLessThanOrEqual(p.max.x - GAP);
              else expect(b.min.x).toBeGreaterThanOrEqual(p.min.x + GAP);
            } else expect(b.max.z).toBeLessThanOrEqual(p.max.z - GAP);
          }
        }
      }
    });

    test(`${era} details keep the sign, the door, the blade sign and the roof clear`, () => {
      const keepClear = [
        new THREE.Box3(new THREE.Vector3(-4.8, 3.55, F + 0.06), new THREE.Vector3(4.8, 4.55, F + 0.4)), // storefront sign
        new THREE.Box3(new THREE.Vector3(-1.4, 0, F + 0.04), new THREE.Vector3(1.4, 3.1, F + 0.4)), // door
        ...[-1, 1].map(
          (s) =>
            new THREE.Box3(
              new THREE.Vector3(s * 5.2 - 0.15, 5.6, F + 0.3),
              new THREE.Vector3(s * 5.2 + 0.15, 7.5, F + 3.5),
            ),
        ), // blade sign, either side
      ];
      for (const floors of FLOORS) {
        for (const block of eraBlocks(era, floors)) {
          const b = blockBox(block);
          for (const zone of keepClear) expect(overlaps(b, zone)).toBe(false);
          expect(b.max.y).toBeLessThanOrEqual(buildingHeight(floors)); // roof props stand on the cornice
        }
      }
    });
  }
});
