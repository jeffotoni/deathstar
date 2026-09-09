import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
type Spark = { mesh: Mesh; velocity: Vector3; life: number; duration: number; size: number };
export class Effects {
  private pool: Spark[] = [];
  shake = 0;
  constructor(assets: AssetManager) {
    const material = assets.material('explosion embers', '#ffbd76', 2.5);
    const source = MeshBuilder.CreateIcoSphere('spark source', { radius: 1, subdivisions: 1 }, assets.scene);
    source.material = material; source.setEnabled(false);
    for (let i = 0; i < 220; i++) {
      const mesh = source.clone('pooled spark'); mesh.setEnabled(false); mesh.isPickable = false;
      this.pool.push({ mesh, velocity: Vector3.Zero(), life: 0, duration: 1, size: 1 });
    }
  }
  explosion(position: Vector3, size = 1) {
    let count = Math.min(50, 15 + Math.floor(size * 7));
    for (const spark of this.pool) {
      if (spark.life > 0) continue;
      spark.mesh.position.copyFrom(position);
      spark.velocity.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().scaleInPlace((10 + Math.random() * 25) * size);
      spark.duration = spark.life = 0.3 + Math.random() * 0.95;
      spark.size = (0.3 + Math.random() * 1.5) * size;
      spark.mesh.setEnabled(true);
      if (--count <= 0) break;
    }
    this.shake = Math.min(0.65, this.shake + size * 0.08);
  }
  update(dt: number) {
    this.shake *= Math.exp(-dt * 8);
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.setEnabled(false); continue; }
      p.mesh.position.addInPlace(p.velocity.scale(dt)); p.velocity.scaleInPlace(Math.exp(-dt * 1.8));
      p.mesh.scaling.setAll(p.size * p.life / p.duration);
      p.mesh.rotation.x += dt * 3;
    }
  }
}
