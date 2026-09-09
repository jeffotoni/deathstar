import { Color3, Color4, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';

export class SpaceEnvironment {
  private sky: TransformNode;
  private asteroids: { mesh: Mesh; radius: number }[] = [];
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
    const planet = MeshBuilder.CreateSphere('Náris', { diameter: 2000, segments: 48 }, scene);
    planet.parent = this.sky; planet.position.set(2700, 650, 4800);
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
    ring.parent = this.sky; ring.position.copyFrom(planet.position); ring.rotation.set(0.38, 0, -0.43); ring.scaling.y = 0.045;
    ring.material = assets.material('ring dust', '#6b7d82', 0.13);
    const moon = MeshBuilder.CreateSphere('moon', { diameter: 260, segments: 20 }, scene);
    moon.parent = this.sky; moon.position.set(-1900, -600, 4800); moon.material = assets.material('moon rock', '#768294', 0.04);
    const rockMat = assets.material('asteroid rock', '#465362');
    for (let i = 0; i < 65; i++) {
      const radius = 4 + Math.random() ** 2 * 32;
      const mesh = MeshBuilder.CreateIcoSphere('asteroid', { radius, subdivisions: 1, flat: true }, scene);
      mesh.position.set((Math.random() - 0.5) * 2200, (Math.random() - 0.5) * 1300, 200 + Math.random() * 2400);
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      mesh.scaling.set(0.8 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, 0.8 + Math.random() * 0.4);
      mesh.material = rockMat; mesh.isPickable = false; this.asteroids.push({ mesh, radius });
    }
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
    this.sky.position.copyFrom(position);
    for (const rock of this.asteroids) {
      rock.mesh.rotation.y += dt * 0.018;
      if (Vector3.DistanceSquared(rock.mesh.position, position) > 3400 ** 2) {
        const dir = new Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.6, Math.random() - 0.5).normalize();
        rock.mesh.position.copyFrom(position.add(dir.scale(1700 + Math.random() * 600)));
      }
    }
  }
  collide(position: Vector3): Vector3 | null {
    for (const rock of this.asteroids) if (Vector3.DistanceSquared(position, rock.mesh.position) < (rock.radius + 2) ** 2) return position.subtract(rock.mesh.position).normalize();
    return null;
  }
}
