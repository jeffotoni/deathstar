import { Color3, Color4, Constants, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import type { Target } from '../weapons/ProjectileManager';

export const SOLAR_DANGER_RADIUS = 1800;
const SOLAR_SAFE_DISTANCE = 650;
const SOLAR_BOUNDARY_VISIBLE_DISTANCE = 5200;

export function solarHeatAtDistance(distance: number) {
  return Math.max(0, Math.min(1, (SOLAR_DANGER_RADIUS - distance) / (SOLAR_DANGER_RADIUS - SOLAR_SAFE_DISTANCE)));
}

class AsteroidTarget implements Target {
  health: number;
  maxHealth: number;
  readonly velocity = Vector3.Zero();
  fragmentTime = 0;
  readonly name = 'ASTEROID';
  constructor(public readonly id: number, public readonly mesh: Mesh, public radius: number, public readonly isMeteorite = false, private readonly onDestroyed?: (asteroid: AsteroidTarget) => void) {
    this.maxHealth = Math.max(isMeteorite ? 18 : 55, Math.round(radius * (isMeteorite ? 3.4 : 5.8)));
    this.health = this.maxHealth;
  }
  get position() { return this.mesh.position; }
  hit(damage: number) {
    this.health = Math.max(0, this.health - damage);
    if (this.health === 0) { this.mesh.setEnabled(false); this.onDestroyed?.(this); }
  }
  activate(position: Vector3, radius: number, velocity: Vector3, duration: number) {
    this.radius = radius; this.maxHealth = Math.max(18, Math.round(radius * 3.4)); this.health = this.maxHealth; this.fragmentTime = duration;
    this.position.copyFrom(position); this.velocity.copyFrom(velocity); this.mesh.scaling.setAll(radius); this.mesh.setEnabled(true);
  }
}

export class SpaceEnvironment {
  private sky: TransformNode;
  private asteroids: AsteroidTarget[] = [];
  private meteoritePool: AsteroidTarget[] = [];
  private star: Mesh;
  private corona: Mesh;
  private solarBoundary: Mesh[] = [];
  private solarBoundaryMaterial: StandardMaterial;
  private starTime = 0;
  readonly solarPosition = new Vector3(-1800, 1200, 14000);
  constructor(private scene: Scene, assets: AssetManager) {
    scene.clearColor = new Color4(0.015, 0.024, 0.048, 1);
    this.sky = new TransformNode('distant sky', scene);
    const star = MeshBuilder.CreateSphere('starfield', { diameter: 1, segments: 3 }, scene);
    star.parent = this.sky; star.material = assets.material('starlight', '#d5e5fa', 1); star.isPickable = false;
    const matrices = new Float32Array(2100 * 16);
    for (let i = 0; i < 2100; i++) {
      const dir = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      const size = Math.random() < 0.035 ? 3.4 : 0.7 + Math.random() * 1.3;
      Matrix.Compose(new Vector3(size, size, size), Quaternion.Identity(), dir.scale(6500 + Math.random() * 1000)).copyToArray(matrices, i * 16);
    }
    star.thinInstanceSetBuffer('matrix', matrices); star.alwaysSelectAsActiveMesh = true;
    this.nebula();
    this.star = MeshBuilder.CreateSphere('Náris star', { diameter: 240, segments: 24 }, scene);
    this.star.position.copyFrom(this.solarPosition); this.star.isPickable = false;
    const starMaterial = assets.material('Náris star light', '#fff0a8', 8);
    starMaterial.disableLighting = true; starMaterial.diffuseColor = Color3.Black(); starMaterial.specularColor = Color3.Black(); this.star.material = starMaterial;
    this.corona = MeshBuilder.CreateSphere('Náris star corona', { diameter: 440, segments: 16 }, scene);
    this.corona.position.copyFrom(this.solarPosition); this.corona.isPickable = false;
    const coronaMaterial = assets.material('Náris star corona', '#ffb34d', 2);
    coronaMaterial.disableLighting = true; coronaMaterial.diffuseColor = Color3.Black(); coronaMaterial.specularColor = Color3.Black(); coronaMaterial.alpha = 0.055; coronaMaterial.alphaMode = Constants.ALPHA_ADD; coronaMaterial.backFaceCulling = false; this.corona.material = coronaMaterial;
    const boundaryMaterial = this.solarBoundaryMaterial = assets.material('Náris solar exclusion boundary', '#ffbf67', 2);
    boundaryMaterial.disableLighting = true; boundaryMaterial.diffuseColor = Color3.Black(); boundaryMaterial.specularColor = Color3.Black(); boundaryMaterial.alpha = 0.11; boundaryMaterial.alphaMode = Constants.ALPHA_ADD; boundaryMaterial.backFaceCulling = false; boundaryMaterial.forceDepthWrite = false;
    for (const [name, rotation] of [
      ['horizontal', Vector3.Zero()],
      ['vertical', new Vector3(Math.PI / 2, 0, 0)],
      ['cross', new Vector3(0, 0, Math.PI / 2)],
    ] as [string, Vector3][]) {
      const ring = MeshBuilder.CreateTorus(`solar exclusion ring ${name}`, { diameter: SOLAR_DANGER_RADIUS * 2, thickness: 7, tessellation: 128 }, scene);
      ring.position.copyFrom(this.solarPosition); ring.rotation.copyFrom(rotation); ring.isPickable = false; ring.material = boundaryMaterial;
      this.solarBoundary.push(ring);
    }
    const planet = MeshBuilder.CreateSphere('Náris', { diameter: 2000, segments: 48 }, scene);
    // Landmarks stay in world space so the pilot can pass them and leave them behind.
    planet.position.set(2700, 650, 4800);
    const texture = new DynamicTexture('mineral bands', { width: 1024, height: 512 }, scene, false);
    const ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.fillStyle = '#5a777e'; ctx.fillRect(0, 0, 1024, 512);
    for (let y = 0; y < 512; y++) {
      const light = 25 + Math.sin(y * 0.07) * 8 + Math.sin(y * 0.2) * 2;
      ctx.fillStyle = `hsl(${185 + Math.sin(y * 0.04) * 10}, 18%, ${light}%)`;
      ctx.fillRect(0, y, 1024, 1);
    }
    for (let i = 0; i < 220; i++) { ctx.fillStyle = 'rgba(190,220,218,.035)'; ctx.beginPath(); ctx.ellipse(Math.random() * 1024, Math.random() * 512, 20 + Math.random() * 180, Math.random() * 9, 0, 0, Math.PI * 2); ctx.fill(); }
    texture.update();
    const planetMat = new StandardMaterial('planet surface', scene); planetMat.diffuseTexture = texture; planetMat.specularColor = Color3.Black(); planetMat.emissiveColor = new Color3(0.025, 0.05, 0.06); planet.material = planetMat;
    planet.rotation.z = -0.4;
    const ring = MeshBuilder.CreateTorus('planet rings', { diameter: 2900, thickness: 210, tessellation: 100 }, scene);
    ring.position.copyFrom(planet.position); ring.rotation.set(0.38, 0, -0.43); ring.scaling.y = 0.045;
    ring.material = assets.material('ring dust', '#6b7d82', 0.13);
    const moon = MeshBuilder.CreateSphere('moon', { diameter: 260, segments: 20 }, scene);
    moon.position.set(-1900, -600, 4800); moon.material = assets.material('moon rock', '#768294', 0.04);
    const rockMat = assets.material('asteroid rock', '#465362');
    for (let i = 0; i < 65; i++) {
      const radius = 4 + Math.random() ** 2 * 32;
      const mesh = MeshBuilder.CreateIcoSphere('asteroid', { radius, subdivisions: 1, flat: true }, scene);
      mesh.position.set((Math.random() - 0.5) * 2200, (Math.random() - 0.5) * 1300, 200 + Math.random() * 2400);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      mesh.scaling.set(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 0.8 + Math.random() * 0.4);
      mesh.material = rockMat; mesh.isPickable = false; this.asteroids.push(new AsteroidTarget(20000 + i, mesh, radius, false, asteroid => this.spawnMeteorites(asteroid)));
    }
    const meteoriteSource = MeshBuilder.CreateIcoSphere('meteorite source', { radius: 1, subdivisions: 1, flat: true }, scene);
    meteoriteSource.material = rockMat; meteoriteSource.setEnabled(false);
    for (let i = 0; i < 96; i++) {
      const mesh = meteoriteSource.clone('meteorite');
      if (!mesh) continue;
      mesh.material = rockMat; mesh.isPickable = false; mesh.setEnabled(false);
      const meteorite = new AsteroidTarget(21000 + i, mesh, 1, true);
      this.asteroids.push(meteorite); this.meteoritePool.push(meteorite);
    }
    meteoriteSource.dispose();
  }
  private nebula() {
    const texture = new DynamicTexture('procedural nebula', { width: 1024, height: 512 }, this.scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = '#030713'; ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 95; i++) {
      const x = Math.random() * 1024, y = 200 + Math.sin(x / 170) * 70 + (Math.random() - 0.5) * 150;
      const radius = 40 + Math.random() * 180;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, i % 3 ? 'rgba(30,73,106,.12)' : 'rgba(96,46,76,.10)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    texture.update();
    const dome = MeshBuilder.CreateSphere('nebula dome', { diameter: 19000, segments: 24, sideOrientation: Mesh.BACKSIDE }, this.scene);
    dome.parent = this.sky; dome.isPickable = false;
    const mat = new StandardMaterial('nebula atmosphere', this.scene); mat.emissiveTexture = texture; mat.disableLighting = true; mat.diffuseColor = Color3.Black(); dome.material = mat;
  }
  update(dt: number, position: Vector3) {
    this.starTime += dt;
    const pulse = 1 + Math.sin(this.starTime * 2.4) * 0.025;
    this.corona.scaling.setAll(pulse);
    const solarDistance = Vector3.Distance(position, this.solarPosition);
    const boundaryVisibility = Math.max(0, Math.min(1, (SOLAR_BOUNDARY_VISIBLE_DISTANCE - solarDistance) / (SOLAR_BOUNDARY_VISIBLE_DISTANCE - SOLAR_DANGER_RADIUS)));
    this.solarBoundaryMaterial.alpha = boundaryVisibility * (0.045 + (Math.sin(this.starTime * 1.8) * 0.5 + 0.5) * 0.025);
    this.sky.position.copyFrom(position);
    for (const rock of this.asteroids) {
      if (rock.health <= 0) continue;
      rock.mesh.rotation.y += dt * 0.018;
      if (rock.isMeteorite) {
        rock.fragmentTime -= dt;
        rock.position.addInPlace(rock.velocity.scale(dt)); rock.velocity.scaleInPlace(Math.exp(-dt * 0.22));
        if (rock.fragmentTime <= 0) { rock.health = 0; rock.mesh.setEnabled(false); }
        continue;
      }
      if (Vector3.DistanceSquared(rock.mesh.position, position) > 3400 ** 2) {
        const dir = new Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize();
        rock.mesh.position.copyFrom(position.add(dir.scale(1700 + Math.random() * 600)));
      }
    }
  }
  collide(position: Vector3): Vector3 | null {
    for (const rock of this.asteroids) if (rock.health > 0 && Vector3.DistanceSquared(position, rock.mesh.position) < (rock.radius + 2) ** 2) return position.subtract(rock.mesh.position).normalize();
    return null;
  }
  get targets(): Target[] { return this.asteroids; }
  solarHeat(position: Vector3) { return solarHeatAtDistance(Vector3.Distance(position, this.solarPosition)); }
  private spawnMeteorites(asteroid: AsteroidTarget) {
    const available = this.meteoritePool.filter(meteorite => meteorite.health <= 0);
    const count = Math.min(3, available.length);
    for (let i = 0; i < count; i++) {
      const meteorite = available[i];
      const direction = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      meteorite.activate(asteroid.position.add(direction.scale(Math.max(3, asteroid.radius * 0.35))), Math.max(2.4, Math.min(7.5, asteroid.radius * (0.18 + Math.random() * 0.08))), direction.scale(22 + Math.random() * 30), 9 + Math.random() * 5);
    }
  }
}
