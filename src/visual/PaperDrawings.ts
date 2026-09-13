import { Color3, CreateGreasedLine, GreasedLineMeshMaterialType, type IGreasedLineMaterial, Mesh, MeshBuilder, Scene, StandardMaterial, TransformNode, Vector2 } from '@babylonjs/core';

export const PAPER_PREFIX = 'draft outline · ';
type Point = [number, number, number];
export type Ink = 'blue' | 'red' | 'graphite' | 'pencil' | 'faint' | 'gold';
const INKS: Record<Ink, [string, number]> = {
  blue: ['#3268b5', 1.25], red: ['#ba5260', 1.35], graphite: ['#969a9f', 1.15],
  pencil: ['#b1b4b8', 1.05], faint: ['#d2d4d7', 1], gold: ['#dcae45', 1.15],
};

/** Code-native illustrations. Geometry is made once; strokes have pixel widths
 * so a nearby planet never becomes a set of thick black tubes. */
export class PaperDrawings {
  private readonly strokes = new Map<Ink, { material: StandardMaterial; line: IGreasedLineMaterial }>();
  private readonly fills = new Map<string, StandardMaterial>();
  private readonly resolution = new Vector2();

  constructor(private readonly scene: Scene) {}

  updateResolution() {
    const engine = this.scene.getEngine();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    if (width === this.resolution.x && height === this.resolution.y) return;
    this.resolution.set(width, height);
    for (const { line } of this.strokes.values()) line.resolution = this.resolution;
  }

  stroke(name: string, paths: Point[][], ink: Ink, parent?: TransformNode) {
    const material = this.strokes.get(ink);
    const mesh = CreateGreasedLine(PAPER_PREFIX + name, {
      points: paths.map(path => path.flat()),
    }, { createAndAssignMaterial: !material, materialType: GreasedLineMeshMaterialType.MATERIAL_TYPE_STANDARD,
      color: Color3.FromHexString(INKS[ink][0]), colors: [Color3.White()], useColors: false,
      width: INKS[ink][1], sizeAttenuation: true }, this.scene);
    if (material) mesh.material = material.material;
    else {
      const created = mesh.material as StandardMaterial;
      created.backFaceCulling = false;
      created.disableLighting = true;
      created.emissiveColor = Color3.White();
      const line = mesh.greasedLineMaterial!;
      line.resolution = new Vector2(this.scene.getEngine().getRenderWidth(), this.scene.getEngine().getRenderHeight());
      this.strokes.set(ink, { material: created, line });
    }
    mesh.parent = parent ?? null;
    mesh.isPickable = false;
    return mesh;
  }

  /** StandardMaterial without lighting uses emissive, not diffuse, for the
   * displayed color. Do not darken this color to simulate transparency. */
  fill(hex: string, alpha: number) {
    const key = `${hex}/${alpha}`;
    let material = this.fills.get(key);
    if (!material) {
      material = new StandardMaterial(PAPER_PREFIX + key, this.scene);
      material.disableLighting = true;
      material.diffuseColor = Color3.Black();
      material.emissiveColor = Color3.FromHexString(hex);
      material.specularColor = Color3.Black();
      material.alpha = alpha;
      material.backFaceCulling = false;
      material.disableDepthWrite = alpha < 1;
      this.fills.set(key, material);
    }
    return material;
  }

  private disc(root: Mesh, radius: number, hex: string, alpha: number) {
    const disc = MeshBuilder.CreateDisc(PAPER_PREFIX + 'pencil wash', { radius, tessellation: 96 }, this.scene);
    disc.parent = root;
    disc.position.z = 0.02;
    disc.material = this.fill(hex, alpha);
    disc.isPickable = false;
  }

  private ellipse(rx: number, ry = rx, cx = 0, cy = 0, tilt = 0): Point[] {
    const points: Point[] = [];
    for (let i = 0; i <= 96; i++) {
      const a = i / 96 * Math.PI * 2;
      // Deterministic pencil irregularity: no animated noise or shimmering.
      const wobble = 1 + 0.0025 * Math.sin(a * 7) + 0.0015 * Math.sin(a * 13);
      const x = rx * Math.cos(a) * wobble, y = ry * Math.sin(a) * wobble;
      points.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt), 0]);
    }
    return points;
  }

  landmark(name: string) {
    const root = new Mesh(PAPER_PREFIX + 'illustration · ' + name, this.scene);
    root.billboardMode = Mesh.BILLBOARDMODE_ALL;
    root.isPickable = false;
    if (name === 'náris') {
      this.disc(root, 1.05, '#fafafa', 0.1);
      this.stroke('Saturn silhouette', [this.ellipse(1.05)], 'pencil', root);
      const rings: Point[][] = [];
      for (const radius of [1.46, 1.26]) {
        const path = this.ellipse(radius, radius * 0.36, 0, 0, -0.30);
        let arc: Point[] = [];
        // Hide only the back half that crosses the globe; the front half
        // passes across it, like two ellipses drawn around a circle by hand.
        for (let i = 0; i < path.length; i++) {
          const p = path[i];
          const back = i < 48 && p[0] ** 2 + p[1] ** 2 < 1.05 ** 2;
          if (back) { if (arc.length > 1) rings.push(arc); arc = []; }
          else arc.push(p);
        }
        if (arc.length > 1) rings.push(arc);
      }
      this.stroke('Saturn two rings', rings, 'pencil', root);
      this.stroke('Saturn pencil shading', this.hatching(), 'faint', root);
    } else if (name === 'moon') {
      this.disc(root, 1, '#f5f5f5', 0.16);
      this.stroke('moon silhouette and craters', [this.ellipse(1), this.ellipse(.20, .15, -.3, .28), this.ellipse(.12, .1, .38, -.22)], 'pencil', root);
      this.stroke('moon pencil shading', this.hatching(), 'faint', root);
    } else {
      this.disc(root, 1, '#ffdb56', .9);
      const paths = [this.ellipse(1)];
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        paths.push([[Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0], [Math.cos(a) * 1.43, Math.sin(a) * 1.43, 0]]);
      }
      this.stroke('sun contour and rays', paths, 'gold', root);
    }
    return root;
  }

  private hatching(): Point[][] {
    return Array.from({ length: 5 }, (_, i) => {
      const x = .3 + i * .1, y = -.77 + i * .07;
      return [[x, y, -.005], [x + .12, y + .10, -.005]];
    });
  }

  rock(seed: number) {
    const contour: Point[] = [];
    for (let i = 0; i <= 32; i++) {
      const a = i * Math.PI / 16;
      const radius = .9 + .09 * Math.sin(a * 3 + seed) + .045 * Math.cos(a * 7 + seed);
      contour.push([Math.cos(a) * radius, Math.sin(a) * radius, 0]);
    }
    const mesh = this.stroke('graphite rock', [contour,
      [[-.42, .33, 0], [-.2, .16, 0], [-.24, -.06, 0]],
      [[.40, -.48, 0], [.55, -.30, 0]], [[.51, -.43, 0], [.66, -.25, 0]],
    ], 'graphite');
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    return mesh;
  }

  shield() {
    const mesh = this.stroke('shield graphite outline', [this.ellipse(1),
      this.ellipse(.995, .99, .004, -.005),
    ], 'pencil');
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    return mesh;
  }

  /** Call only after disposing the meshes. All drawings share this small palette. */
  dispose() {
    for (const { material } of this.strokes.values()) material.dispose(false, true);
    for (const material of this.fills.values()) material.dispose();
    this.strokes.clear(); this.fills.clear(); this.resolution.set(0, 0);
  }
}
