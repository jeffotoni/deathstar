import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
type Spark = { mesh: Mesh; velocity: Vector3; life: number; duration: number; size: number };
export class Effects {
  private pool: Spark[] = [];
  private shieldPool: Spark[] = [];
  shake = 0;
  constructor(assets: AssetManager) {
    const explosionSource = MeshBuilder.CreateIcoSphere('spark source', { radius: 1, subdivisions: 1 }, assets.scene);
    explosionSource.material = assets.material('explosion embers', '#ffbd76', 2.5); explosionSource.setEnabled(false);
    const shieldSource = MeshBuilder.CreateIcoSphere('shield spark source', { radius: 1, subdivisions: 1 }, assets.scene);
    shieldSource.material = assets.material('shield sparks', '#f5fcff', 3.2); shieldSource.setEnabled(false);
    for (let i = 0; i < 220; i++) this.pool.push(this.spark(explosionSource, 'pooled spark'));
    for (let i = 0; i < 80; i++) this.shieldPool.push(this.spark(shieldSource, 'pooled shield spark'));
    explosionSource.dispose(); shieldSource.dispose();
  }
  private spark(source: Mesh, name: string): Spark {
    const mesh = source.clone(name); mesh.setEnabled(false); mesh.isPickable = false;
    return { mesh, velocity: Vector3.Zero(), life: 0, duration: 1, size: 1 };
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
  shieldImpact(position: Vector3, normal: Vector3) {
    const direction = normal.lengthSquared() > 0.001 ? normal.normalizeToNew() : Vector3.Up();
    const reference = Math.abs(direction.y) < 0.9 ? Vector3.Up() : Vector3.Right();
    const tangent = Vector3.Cross(reference, direction).normalize();
    const bitangent = Vector3.Cross(direction, tangent).normalize();
    let count = 18;
    for (const spark of this.shieldPool) {
      if (spark.life > 0) continue;
      const spread = tangent.scale((Math.random() - 0.5) * 34).add(bitangent.scale((Math.random() - 0.5) * 34));
      spark.mesh.position.copyFrom(position); spark.velocity.copyFrom(direction.scale(20 + Math.random() * 28).add(spread));
      spark.duration = spark.life = 0.18 + Math.random() * 0.3; spark.size = 0.25 + Math.random() * 0.7; spark.mesh.setEnabled(true);
      if (--count <= 0) break;
    }
  }
  private updatePool(pool: Spark[], dt: number) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.setEnabled(false); continue; }
      p.mesh.position.addInPlace(p.velocity.scale(dt)); p.velocity.scaleInPlace(Math.exp(-dt * 1.8));
      p.mesh.scaling.setAll(p.size * p.life / p.duration);
      p.mesh.rotation.x += dt * 3;
    }
  }
  update(dt: number) {
    this.shake *= Math.exp(-dt * 8);
    this.updatePool(this.pool, dt); this.updatePool(this.shieldPool, dt);
  }
}
