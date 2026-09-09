import { Color3, MeshBuilder, Scene, StandardMaterial, TransformNode, ImportMeshAsync } from '@babylonjs/core';
import '@babylonjs/loaders/glTF';

/** Model roots face +Z; a GLB can replace the visual without changing gameplay. */
export class AssetManager {
  private materials = new Map<string, StandardMaterial>();
  constructor(public scene: Scene) {}
  material(name: string, hex: string, emission = 0) {
    const cached = this.materials.get(name);
    if (cached) return cached;
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = Color3.FromHexString(hex);
    mat.emissiveColor = mat.diffuseColor.scale(emission);
    mat.specularColor = new Color3(0.45, 0.55, 0.65);
    this.materials.set(name, mat);
    return mat;
  }
  box(name: string, root: TransformNode, size: number[], pos: number[], mat: StandardMaterial) {
    const mesh = MeshBuilder.CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene);
    mesh.parent = root; mesh.position.set(pos[0], pos[1], pos[2]); mesh.material = mat; mesh.isPickable = false;
    return mesh;
  }
  ship(kind: 'player' | 'scout' | 'assault' | 'elite') {
    const root = new TransformNode(kind, this.scene);
    const player = kind === 'player';
    const hull = this.material(player ? 'ivory alloy' : 'hostile alloy', player ? '#a9b9c9' : '#55454c');
    const dark = this.material('carbon', '#182533');
    const trim = this.material(player ? 'teal trim' : 'hostile trim', player ? '#52dbdc' : '#ee7355', 0.6);
    const engine = this.material(player ? 'ion drive' : 'hostile drive', player ? '#73eaff' : '#ff7145', 3);
    const body = MeshBuilder.CreateCylinder('tapered fuselage', { height: 5.8, diameterTop: 0.16, diameterBottom: 1.6, tessellation: 6 }, this.scene);
    body.rotation.x = Math.PI / 2; body.parent = root; body.material = hull; body.isPickable = false;
    this.box('keel', root, [0.9, 0.75, 3.2], [0, -0.25, -0.9], dark);
    const cockpit = MeshBuilder.CreateSphere('canopy', { diameter: 1, segments: 12 }, this.scene);
    cockpit.parent = root; cockpit.position.set(0, 0.53, 0.8); cockpit.scaling.set(0.75, 0.64, 2.1);
    cockpit.material = this.material('canopy glass', '#174556', 0.45); cockpit.isPickable = false;
    for (const side of [-1, 1]) {
      const wing = this.box('swept wing', root, [3, 0.16, 1.8], [side * 1.75, -0.13, -0.6], hull);
      wing.rotation.y = side * 0.35; wing.rotation.z = side * -0.11;
      this.box('wing inlay', root, [2, 0.035, 0.22], [side * 1.95, 0.06, -0.25], trim).rotation.y = side * 0.35;
      this.box('weapon rail', root, [0.25, 0.25, 3.6], [side * 2.75, -0.1, 0], dark);
      this.box('laser emitter', root, [0.16, 0.16, 0.45], [side * 2.75, -0.1, 1.9], trim);
      this.box('engine nacelle', root, [0.8, 0.85, 2.5], [side * 1.12, -0.1, -1.7], dark);
      const flame = MeshBuilder.CreateCylinder('thruster', { height: 2.4, diameterTop: 0.5, diameterBottom: 0.05, tessellation: 10 }, this.scene);
      flame.parent = root; flame.rotation.x = Math.PI / 2; flame.position.set(side * 1.12, -0.1, -3.4); flame.material = engine; flame.isPickable = false;
      const fin = this.box('stabilizer', root, [0.13, 1.2, 1.3], [side * 1.05, 0.6, -1.8], hull); fin.rotation.z = side * -0.35;
    }
    if (kind === 'assault') { root.scaling.setAll(1.5); this.box('armored spine', root, [1.6, 0.9, 2.6], [0, 0.4, -1], dark); }
    if (kind === 'elite') { root.scaling.set(1.3, 0.8, 1.3); this.box('elite crest', root, [0.2, 1.8, 1.6], [0, 0.9, -1], trim); }
    return root;
  }
  async loadModel(url: string, parent: TransformNode) {
    const result = await ImportMeshAsync(url, this.scene);
    for (const mesh of result.meshes) if (!mesh.parent) mesh.parent = parent;
    return result;
  }
}
