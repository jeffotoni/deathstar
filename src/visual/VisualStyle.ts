import { AbstractMesh, Color3, Color4, GlowLayer, Light, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';

import { PAPER_PREFIX, PaperDrawings } from './PaperDrawings';

export type VisualStyle = 'original' | 'draft';

type LightSnapshot = { intensity: number; diffuse: Color3; specular: Color3 };
type Outline = { source: AbstractMesh; mesh: AbstractMesh; localScale?: Vector3; material?: AbstractMesh['material']; billboard?: boolean };
type ShipSketch = { source: TransformNode; root: TransformNode };
type LandmarkSketch = { source: AbstractMesh; root: Mesh; baseScale: Vector3 };

const OUTLINE_PREFIX = PAPER_PREFIX;

/**
 * Presentation-only renderer for the colouring-book mode.
 *
 * Gameplay meshes remain the source of truth for physics and collisions. In
 * draft mode they are hidden, while this class renders independent line-only
 * copies that follow their transforms frame by frame.
 */
export class VisualStyleManager {
  private readonly lightSnapshots = new Map<Light, LightSnapshot>();
  private readonly glowSnapshots = new Map<GlowLayer, number>();
  private readonly sourceVisibility = new Map<AbstractMesh, number>();
  private readonly outlines = new Map<AbstractMesh, Outline>();
  private readonly shipSketches = new Map<TransformNode, ShipSketch>();
  private readonly landmarkSketches = new Map<AbstractMesh, LandmarkSketch>();
  private readonly originalClearColor: Color4;
  private readonly originalExposure: number;
  private readonly originalContrast: number;
  private readonly paperMaterial: StandardMaterial;
  private readonly drawings: PaperDrawings;
  private paperStars?: Mesh;
  private current: VisualStyle = 'original';

  constructor(private readonly scene: Scene) {
    this.originalClearColor = scene.clearColor.clone();
    this.originalExposure = scene.imageProcessingConfiguration.exposure;
    this.originalContrast = scene.imageProcessingConfiguration.contrast;
    for (const light of scene.lights) this.lightSnapshots.set(light, { intensity: light.intensity, diffuse: light.diffuse.clone(), specular: light.specular.clone() });
    for (const layer of scene.effectLayers) if (layer instanceof GlowLayer) this.glowSnapshots.set(layer, layer.intensity);

    // Outline proxies need a material to render, but their faces stay invisible:
    // only Babylon's edge renderer draws the colouring-book line work.
    this.paperMaterial = new StandardMaterial('draft transparent paper', scene);
    this.paperMaterial.alpha = 0;
    this.paperMaterial.disableLighting = true;
    this.paperMaterial.backFaceCulling = false;
    this.paperMaterial.forceDepthWrite = false;

    this.drawings = new PaperDrawings(scene);
  }

  get style() { return this.current; }

  setStyle(style: VisualStyle) {
    if (style === this.current) return;
    this.current = style;
    if (style === 'draft') this.enableDraft();
    else this.restoreOriginal();
  }

  refresh() {
    if (this.current === 'draft') this.sync();
  }

  update() {
    if (this.current === 'draft') this.sync();
  }

  private enableDraft() {
    this.scene.clearColor = Color4.FromHexString('#ffffffff');
    this.scene.imageProcessingConfiguration.exposure = 1;
    this.scene.imageProcessingConfiguration.contrast = 1;
    for (const [light] of this.lightSnapshots) light.intensity = 0;
    for (const [layer] of this.glowSnapshots) layer.intensity = 0;
    for (const mesh of this.scene.meshes) if (this.isPaperBackground(mesh)) this.hideSource(mesh);
    this.createPaperStars();
    this.sync();
  }

  private sync() {
    this.drawings.updateResolution();
    for (const [source] of this.sourceVisibility) if (source.isDisposed()) this.sourceVisibility.delete(source);
    for (const [source, outline] of this.outlines) {
      if (source.isDisposed()) { outline.mesh.dispose(); this.outlines.delete(source); }
    }
    for (const [source, sketch] of this.landmarkSketches) {
      if (source.isDisposed()) { sketch.root.dispose(); this.landmarkSketches.delete(source); }
    }

    for (const source of this.scene.meshes) {
      if (source.name.startsWith(OUTLINE_PREFIX)) continue;
      if (this.isPaperHiddenSource(source)) { this.hideSource(source); continue; }
      if (this.shipRootFor(source)) { this.hideSource(source); continue; }
      if (!this.shouldSketch(source)) continue;
      this.hideSource(source);
      if (this.isSuppressedLandmark(source)) continue;
      if (!source.isEnabled()) {
        this.outlines.get(source)?.mesh.setEnabled(false);
        this.landmarkSketches.get(source)?.root.setEnabled(false);
        continue;
      }
      if (this.isIllustratedLandmark(source)) {
        let sketch = this.landmarkSketches.get(source);
        if (!sketch) {
          sketch = this.createLandmarkSketch(source);
          if (!sketch) continue;
          this.landmarkSketches.set(source, sketch);
        }
        this.copyLandmarkTransform(source, sketch);
        sketch.root.setEnabled(source.isEnabled());
        continue;
      }
      let outline = this.outlines.get(source);
      if (!outline) {
        outline = this.createOutline(source);
        if (!outline) continue;
        this.outlines.set(source, outline);
      }
      this.copyTransform(source, outline.mesh);
      if (outline.material !== source.material) {
        this.paintOutline(outline.mesh, source);
        outline.material = source.material;
      }
      if (source.name.startsWith('solar exclusion ring')) {
        outline.mesh.visibility = Math.min(0.2, (source.material?.alpha ?? 0) * 2);
      }
      outline.mesh.setEnabled(source.isEnabled());
    }
    this.syncShipSketches();
  }

  private shouldSketch(mesh: AbstractMesh) {
    const name = mesh.name.toLowerCase();
    if (mesh.isDisposed() || name.startsWith(OUTLINE_PREFIX) || !mesh.getTotalVertices()) return false;
    // The original sky is replaced by paper and small pen dots. Only a sparse
    // sample of pooled sparks receives drawings, keeping effects lightweight.
    return !this.isPaperHiddenSource(mesh);
  }

  private shipRootFor(mesh: AbstractMesh) {
    let node = mesh.parent as TransformNode | null;
    while (node) {
      if (this.isShipRoot(node)) return node;
      node = node.parent as TransformNode | null;
    }
    return undefined;
  }

  private isShipRoot(node: TransformNode) {
    return /^(player|player-classic|scout|assault|elite)$/.test(node.name);
  }

  private syncShipSketches() {
    for (const [source, sketch] of this.shipSketches) {
      if (source.isDisposed()) { sketch.root.dispose(); this.shipSketches.delete(source); }
    }
    for (const source of this.scene.transformNodes) {
      if (!this.isShipRoot(source) || source.isDisposed()) continue;
      let sketch = this.shipSketches.get(source);
      if (!sketch) {
        sketch = { source, root: this.createShipSketch(source) };
        this.shipSketches.set(source, sketch);
      }
      sketch.root.position.copyFrom(source.position);
      sketch.root.scaling.copyFrom(source.scaling);
      sketch.root.rotation.copyFrom(source.rotation);
      if (source.rotationQuaternion) {
        sketch.root.rotationQuaternion ??= Quaternion.Identity();
        sketch.root.rotationQuaternion.copyFrom(source.rotationQuaternion);
      } else sketch.root.rotationQuaternion = null;
      sketch.root.setEnabled(source.isEnabled());
    }
  }

  private createShipSketch(source: TransformNode) {
    const root = new TransformNode(`${OUTLINE_PREFIX}${source.name}`, this.scene);
    // Player visuals live below the moving "player physics" node. Sharing
    // that parent keeps the line drawing locked to every flight maneuver.
    root.parent = source.parent;
    const enemy = /^(scout|assault|elite)$/.test(source.name);
    const paths: [number, number, number][][] = [];
    const box = (name: string, size: [number, number, number], position: [number, number, number]) => {
      // Twelve fine strokes per block, batched into a single ship drawing.
      const [w, h, d] = size.map(value => value / 2);
      const corners: [number, number, number][] = [
        [-w,-h,-d], [w,-h,-d], [w,h,-d], [-w,h,-d],
        [-w,-h,d], [w,-h,d], [w,h,d], [-w,h,d],
      ].map(p => [p[0] + position[0], p[1] + position[1], p[2] + position[2]]);
      for (const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) paths.push([corners[a], corners[b]]);
      void name;
    };

    if (enemy) {
      box('enemy fuselage', [1.25, 0.8, 5.7], [0, 0, 0.15]);
      box('enemy wing', [5.6, 0.18, 1.65], [0, -0.05, -0.55]);
      box('enemy tail', [2.3, 0.8, 1.25], [0, 0.28, -2.25]);
      box('enemy cockpit', [0.95, 0.48, 1.45], [0, 0.48, 0.9]);
      this.drawings.stroke('enemy ship', paths, 'red', root);
      return root;
    }

    // A deliberately simple LEGO-like line drawing: readable as a child’s
    // spaceship without copying every internal mesh of the 3D model.
    box('player hull', [2.5, 0.76, 3.7], [0, 0, -0.1]);
    box('player nose', [1.65, 0.55, 1.2], [0, 0.03, 2.08]);
    box('player wing plate', [7.15, 0.2, 1.82], [0, -0.08, -0.22]);
    box('player cockpit', [1.2, 0.7, 1.28], [0, 0.7, 0.65]);
    box('player engine left', [0.95, 0.82, 2.5], [-1.22, -0.1, -2.05]);
    box('player engine right', [0.95, 0.82, 2.5], [1.22, -0.1, -2.05]);
    box('player left fin', [0.23, 1.3, 1.35], [-1.03, 0.61, -1.75]);
    box('player right fin', [0.23, 1.3, 1.35], [1.03, 0.61, -1.75]);
    this.drawings.stroke('player ship', paths, 'blue', root);
    return root;
  }

  private isPaperBackground(mesh: AbstractMesh) {
    const name = mesh.name.toLowerCase();
    return name.includes('starfield') || name.includes('nebula dome');
  }

  private isPaperHiddenSource(mesh: AbstractMesh) {
    const name = mesh.name.toLowerCase();
    // Sample the existing effect pools; all remaining sources stay invisible.
    return this.isPaperBackground(mesh) || (name.includes('spark') && mesh.uniqueId % 4 !== 0);
  }

  private hideSource(mesh: AbstractMesh) {
    if (!this.sourceVisibility.has(mesh)) this.sourceVisibility.set(mesh, mesh.visibility);
    mesh.visibility = 0;
  }

  private copyTransform(source: AbstractMesh, outline: AbstractMesh) {
    outline.parent = source.parent;
    outline.position.copyFrom(source.position);
    const entry = this.outlines.get(source);
    outline.scaling.copyFrom(source.scaling);
    if (entry?.localScale) outline.scaling.multiplyInPlace(entry.localScale);
    outline.rotation.copyFrom(source.rotation);
    if (source.rotationQuaternion) {
      outline.rotationQuaternion ??= Quaternion.Identity();
      outline.rotationQuaternion.copyFrom(source.rotationQuaternion);
    } else outline.rotationQuaternion = null;
    if (entry?.billboard) { outline.rotationQuaternion = null; outline.rotation.setAll(0); }
    outline.visibility = 1;
  }

  private createOutline(source: AbstractMesh): Outline | undefined {
    const name = source.name.toLowerCase();
    const bounds = source.getBoundingInfo().boundingBox;
    const size = bounds.maximum.subtract(bounds.minimum);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return undefined;

    const asteroid = /asteroid|meteorite/.test(name);
    const shield = /shield bubble/.test(name);
    const projectile = name.includes('projectile');
    const spark = name.includes('spark');
    let mesh: AbstractMesh;
    let localScale: Vector3 | undefined;
    let billboard = false;
    if (asteroid || shield) {
      mesh = asteroid ? this.drawings.rock(source.uniqueId % 11) : this.drawings.shield();
      localScale = size.scale(0.5);
      if (asteroid) localScale.scaleInPlace(name.includes('meteorite') ? 1.7 : 1.32);
      billboard = true;
    } else if (projectile) {
      mesh = MeshBuilder.CreateCylinder(OUTLINE_PREFIX + name, { height: size.z, diameter: Math.max(.15, size.x * .45), tessellation: 6 }, this.scene);
      (mesh as Mesh).bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
    } else if (spark) {
      mesh = this.drawings.stroke('spark mark', [[[0, -.3, 0], [0, .8, 0]], [[-.3, 0, 0], [.3, 0, 0]]], name.includes('shield') ? 'pencil' : 'gold');
      billboard = true;
      (mesh as Mesh).billboardMode = Mesh.BILLBOARDMODE_ALL;
    } else if (name.startsWith('solar exclusion ring')) {
      const path: [number, number, number][] = [];
      const r = Math.max(size.x, size.z) * .5;
      for (let i = 0; i <= 128; i++) path.push([Math.cos(i * Math.PI / 64) * r, 0, Math.sin(i * Math.PI / 64) * r]);
      mesh = this.drawings.stroke(name, [path], 'gold');
    } else {
      mesh = MeshBuilder.CreateBox(OUTLINE_PREFIX + name, { width: size.x, height: size.y, depth: size.z }, this.scene);
      mesh.material = this.paperMaterial;
      mesh.enableEdgesRendering(0.995);
    }
    mesh.parent = source.parent;
    mesh.isPickable = false;
    this.paintOutline(mesh, source);
    return { source, mesh, localScale, material: source.material, billboard };
  }

  private paintOutline(outline: AbstractMesh, source: AbstractMesh) {
    const identity = `${source.name} ${this.nodeNames(source)} ${source.material?.name ?? ''}`.toLowerCase();
    const enemy = /enemy|hostile|scout|assault|elite|capital|obelisk/.test(identity);
    const warm = /burst|explosion|muzzle/.test(identity);
    if (source.name.includes('projectile')) {
      outline.material = this.drawings.fill(enemy ? '#ba5260' : '#3268b5', 1);
      return;
    }
    // Line drawings already carry shared, unlit palette materials.
    if (/asteroid|meteorite|shield bubble|spark|solar exclusion ring/.test(source.name)) return;
    outline.edgesWidth = 2.2;
    outline.edgesColor = enemy ? new Color4(.73,.32,.38,1)
      : warm ? new Color4(.77,.57,.25,1) : new Color4(.25,.43,.65,1);
  }

  private isIllustratedLandmark(source: AbstractMesh) {
    return ['náris', 'moon', 'náris star'].includes(source.name.toLowerCase());
  }

  private isSuppressedLandmark(source: AbstractMesh) {
    // The sun drawing below includes its own rays; retaining the old corona
    // would produce a second, faint wire sphere around it.
    const name = source.name.toLowerCase();
    return name === 'náris star corona' || name === 'planet rings';
  }

  private createLandmarkSketch(source: AbstractMesh): LandmarkSketch | undefined {
    const name = source.name.toLowerCase();
    const bounds = source.getBoundingInfo().boundingBox;
    const size = bounds.maximum.subtract(bounds.minimum);
    if (size.x <= 0 || size.y <= 0 || size.z <= 0) return undefined;

    const root = this.drawings.landmark(name);
    const baseScale = size.scale(0.5);
    if (name === 'náris star') baseScale.scaleInPlace(1.75);
    return { source, root, baseScale };
  }

  private copyLandmarkTransform(source: AbstractMesh, sketch: LandmarkSketch) {
    // Flat pencil illustrations occupy the same world positions and apparent
    // radii as their source bodies. Billboarding only affects presentation.
    sketch.root.parent = source.parent;
    sketch.root.position.copyFrom(source.position);
    sketch.root.scaling.copyFrom(source.scaling).multiplyInPlace(sketch.baseScale);
  }

  private nodeNames(mesh: AbstractMesh) {
    const names: string[] = [];
    let node: TransformNode | null = mesh.parent as TransformNode | null;
    while (node) { names.push(node.name); node = node.parent as TransformNode | null; }
    return names.join(' ');
  }

  private createPaperStars() {
    if (this.paperStars) return;
    const star = MeshBuilder.CreateIcoSphere(OUTLINE_PREFIX + 'pen stars', { radius: 1, subdivisions: 1 }, this.scene);
    star.material = this.drawings.fill('#6385ae', .75);
    star.isPickable = false;
    star.parent = this.scene.getTransformNodeByName('distant sky');
    const matrices = new Float32Array(330 * 16);
    for (let i = 0; i < 330; i++) {
      const direction = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const size = Math.random() < 0.06 ? 22 : 3.6 + Math.random() * 7;
      Matrix.Compose(new Vector3(size, size, size), Quaternion.Identity(), direction.scale(6500 + Math.random() * 1000)).copyToArray(matrices, i * 16);
    }
    star.thinInstanceSetBuffer('matrix', matrices);
    star.alwaysSelectAsActiveMesh = true;
    this.paperStars = star;
  }

  private restoreOriginal() {
    this.scene.clearColor.copyFrom(this.originalClearColor);
    this.scene.imageProcessingConfiguration.exposure = this.originalExposure;
    this.scene.imageProcessingConfiguration.contrast = this.originalContrast;
    for (const [layer, intensity] of this.glowSnapshots) layer.intensity = intensity;
    for (const [light, snapshot] of this.lightSnapshots) {
      light.intensity = snapshot.intensity;
      light.diffuse.copyFrom(snapshot.diffuse);
      light.specular.copyFrom(snapshot.specular);
    }
    for (const [source, visibility] of this.sourceVisibility) if (!source.isDisposed()) source.visibility = visibility;
    this.sourceVisibility.clear();
    for (const { mesh } of this.outlines.values()) mesh.dispose();
    this.outlines.clear();
    for (const { root } of this.shipSketches.values()) root.dispose();
    this.shipSketches.clear();
    for (const { root } of this.landmarkSketches.values()) root.dispose();
    this.landmarkSketches.clear();
    this.paperStars?.dispose();
    this.paperStars = undefined;
    this.drawings.dispose();
  }
}
