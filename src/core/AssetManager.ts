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
  ship(kind: 'player' | 'player-classic' | 'scout' | 'assault' | 'elite') {
    const root = new TransformNode(kind, this.scene);
    if (kind === 'player') return this.legoPlayerShip(root);
    if (kind === 'player-classic') return this.classicPlayerShip(root);
    const hull = this.material('hostile alloy', '#765463');
    const dark = this.material('carbon', '#182533');
    const trim = this.material('hostile trim', '#ff8d66', 0.9);
    const engine = this.material('hostile drive', '#ff7145', 4);
    const body = MeshBuilder.CreateCylinder('tapered fuselage', { height: 5.8, diameterTop: 0.16, diameterBottom: 1.6, tessellation: 6 }, this.scene);
    body.rotation.x = Math.PI / 2; body.parent = root; body.material = hull; body.isPickable = false;
    this.box('keel', root, [0.9, 0.75, 3.2], [0, -0.25, -0.9], dark);
    const cockpit = MeshBuilder.CreateSphere('canopy', { diameter: 1, segments: 12 }, this.scene);
    cockpit.parent = root; cockpit.position.set(0, 0.53, 0.8); cockpit.scaling.set(0.75, 0.64, 2.1);
    cockpit.material = this.material('canopy glass', '#256b78', 0.7); cockpit.isPickable = false;
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
  private classicPlayerShip(root: TransformNode) {
    const hull = this.material('ivory alloy', '#c3d9e7');
    const dark = this.material('carbon', '#182533');
    const trim = this.material('teal trim', '#69f4ee', 0.9);
    const engine = this.material('ion drive', '#73eaff', 4);
    const body = MeshBuilder.CreateCylinder('tapered fuselage', { height: 5.8, diameterTop: 0.16, diameterBottom: 1.6, tessellation: 6 }, this.scene);
    body.rotation.x = Math.PI / 2; body.parent = root; body.material = hull; body.isPickable = false;
    this.box('keel', root, [0.9, 0.75, 3.2], [0, -0.25, -0.9], dark);
    const cockpit = MeshBuilder.CreateSphere('canopy', { diameter: 1, segments: 12 }, this.scene);
    cockpit.parent = root; cockpit.position.set(0, 0.53, 0.8); cockpit.scaling.set(0.75, 0.64, 2.1);
    cockpit.material = this.material('canopy glass', '#256b78', 0.7); cockpit.isPickable = false;
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
    return root;
  }
  private legoPlayerShip(root: TransformNode) {
    const blue = this.material('lego cobalt blue', '#1878ff', 0.18);
    const blueLight = this.material('lego sky blue', '#35c9ff', 0.35);
    const navy = this.material('lego deep blue', '#10366f', 0.08);
    const yellow = this.material('lego golden yellow', '#ffd43b', 0.55);
    const orange = this.material('lego orange accent', '#ff8b2b', 0.75);
    const engine = this.material('lego white thruster', '#f5ffff', 5.2);
    const canopy = this.material('lego cockpit glass', '#72eaff', 1.8);
    canopy.alpha = 0.82; canopy.backFaceCulling = false;

    // The player ship is deliberately made from readable, toy-like blocks.
    this.box('lego lower keel', root, [1.35, 0.55, 3.35], [0, -0.48, -0.35], navy);
    this.box('lego central brick', root, [2.35, 0.78, 3.65], [0, 0, -0.05], blue);
    this.box('lego nose brick', root, [1.7, 0.58, 1.15], [0, 0.02, 2.05], blueLight);
    this.box('lego nose plate', root, [1.05, 0.13, 0.55], [0, 0.39, 2.25], yellow);
    this.box('lego cockpit base', root, [1.55, 0.18, 1.35], [0, 0.43, 0.7], yellow);
    const cockpit = this.box('lego cockpit canopy', root, [1.18, 0.72, 1.25], [0, 0.78, 0.72], canopy);
    cockpit.rotation.x = -0.08;
    this.box('lego rear block', root, [1.9, 0.65, 1.05], [0, 0.1, -1.65], blueLight);
    this.box('lego rear spine', root, [0.62, 0.5, 1.45], [0, 0.58, -1.15], blue);

    for (const side of [-1, 1]) {
      const wing = this.box('lego wing plate', root, [3.25, 0.2, 1.9], [side * 2.05, -0.05, -0.15], blue);
      wing.rotation.y = side * 0.12;
      const wingStripe = this.box('lego yellow wing stripe', root, [2.25, 0.12, 0.42], [side * 2.15, 0.13, 0.42], yellow);
      wingStripe.rotation.y = side * 0.12;
      this.box('lego wing tip', root, [0.62, 0.34, 1.3], [side * 3.55, -0.02, -0.35], blueLight);
      this.box('lego weapon rail', root, [0.28, 0.28, 2.8], [side * 3.15, 0.08, 0.95], navy);
      this.box('lego laser emitter', root, [0.3, 0.3, 0.5], [side * 3.15, 0.08, 2.42], orange);
      this.box('lego engine nacelle', root, [0.95, 0.82, 2.45], [side * 1.22, -0.1, -2.05], navy);
      this.box('lego engine collar', root, [1.02, 0.88, 0.32], [side * 1.22, -0.1, -3.18], yellow);
      const flame = MeshBuilder.CreateCylinder('thruster', { height: 2.45, diameterTop: 0.54, diameterBottom: 0.08, tessellation: 10 }, this.scene);
      flame.parent = root; flame.rotation.x = Math.PI / 2; flame.position.set(side * 1.22, -0.1, -3.75); flame.material = engine; flame.isPickable = false;
      const fin = this.box('lego tail fin', root, [0.22, 1.35, 1.35], [side * 1.03, 0.62, -1.75], blueLight);
      fin.rotation.z = side * -0.28;
    }

    // Visible studs sell the LEGO construction without affecting gameplay.
    for (const [x, z, material] of [
      [-0.72, 1.18, blueLight], [0.72, 1.18, blueLight], [-0.72, 0.1, yellow], [0.72, 0.1, yellow],
      [-1.62, -0.35, blueLight], [1.62, -0.35, blueLight], [-2.55, -0.35, yellow], [2.55, -0.35, yellow],
    ] as [number, number, StandardMaterial][]) {
      const stud = MeshBuilder.CreateCylinder('lego stud', { diameter: 0.3, height: 0.14, tessellation: 12 }, this.scene);
      stud.parent = root; stud.position.set(x, 0.2, z); stud.material = material; stud.isPickable = false;
    }
    const beacon = MeshBuilder.CreateCylinder('lego top beacon', { diameter: 0.28, height: 0.18, tessellation: 12 }, this.scene);
    beacon.parent = root; beacon.position.set(0, 1.22, -0.05); beacon.material = orange; beacon.isPickable = false;
    return root;
  }
  async loadModel(url: string, parent: TransformNode) {
    const result = await ImportMeshAsync(url, this.scene);
    for (const mesh of result.meshes) if (!mesh.parent) mesh.parent = parent;
    return result;
  }
}
