import { Mesh, MeshBuilder, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import { CONFIG } from '../config';
export type WeaponKind = 'laser' | 'plasma' | 'burst' | 'enemy';
export type Target = { id: number; position: Vector3; radius: number; health: number; name: string; hit: (damage: number) => void };
type Projectile = { mesh: Mesh; velocity: Vector3; previous: Vector3; life: number; damage: number; kind: WeaponKind };
export function segmentDistanceSquared(a: Vector3, b: Vector3, point: Vector3) {
  const segment = b.subtract(a);
  const t = Math.max(0, Math.min(1, Vector3.Dot(point.subtract(a), segment) / Math.max(0.0001, segment.lengthSquared())));
  return Vector3.DistanceSquared(a.add(segment.scale(t)), point);
}
export class ProjectileManager {
  private pool: Projectile[] = [];
  private materials;
  onHit: (target: Target, position: Vector3, kind: WeaponKind) => void = () => {};
  onPlayerHit: (damage: number) => void = () => {};
  constructor(assets: AssetManager) {
    this.materials = {
      laser: assets.material('laser cyan', '#b9fff8', 4.5),
      plasma: assets.material('plasma violet', '#d09dff', 4),
      burst: assets.material('burst gold', '#fff3b2', 5),
      enemy: assets.material('enemy laser', '#ff715e', 2.8),
    };
    for (let i = 0; i < CONFIG.maxProjectiles; i++) {
      const mesh = MeshBuilder.CreateSphere('pooled projectile', { diameter: 1, segments: 4 }, assets.scene);
      mesh.setEnabled(false); mesh.isPickable = false;
      this.pool.push({ mesh, velocity: Vector3.Zero(), previous: Vector3.Zero(), life: 0, damage: 0, kind: 'laser' });
    }
  }
  get count() { return this.pool.filter(p => p.life > 0).length; }
  fire(position: Vector3, direction: Vector3, kind: WeaponKind, damage: number, speed: number) {
    const p = this.pool.find(p => p.life <= 0); if (!p) return;
    p.mesh.position.copyFrom(position); p.previous.copyFrom(position); p.velocity.copyFrom(direction).scaleInPlace(speed);
    p.kind = kind; p.damage = damage; p.life = kind === 'enemy' ? 5 : kind === 'laser' ? CONFIG.weapons.laserLife : 3;
    p.mesh.material = this.materials[kind];
    p.mesh.scaling.set(kind === 'laser' ? 0.45 : kind === 'enemy' ? 0.35 : 2, kind === 'laser' ? 0.45 : kind === 'enemy' ? 0.35 : 2, kind === 'laser' ? 8 : kind === 'burst' ? 8 : kind === 'plasma' ? 4 : 6);
    p.mesh.lookAt(position.add(direction)); p.mesh.setEnabled(true);
  }
  update(dt: number, targets: Target[], player: Vector3) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt; p.previous.copyFrom(p.mesh.position); p.mesh.position.addInPlace(p.velocity.scale(dt));
      if (p.kind === 'enemy') {
        if (segmentDistanceSquared(p.previous, p.mesh.position, player) < 3.6 ** 2) { this.onPlayerHit(p.damage); p.life = 0; }
      } else {
        for (const target of targets) {
          if (target.health <= 0) continue;
          if (segmentDistanceSquared(p.previous, p.mesh.position, target.position) < (target.radius + (p.kind === 'laser' ? 1.6 : 4)) ** 2) {
            const impact = target.position.clone(); target.hit(p.damage); this.onHit(target, impact, p.kind); p.life = 0;
            if (p.kind === 'plasma' || p.kind === 'burst') {
              const radius = p.kind === 'burst' ? 75 : 25;
              for (const other of targets) if (other !== target && other.health > 0 && Vector3.Distance(other.position, impact) < radius) other.hit(p.damage * 0.6);
            }
            break;
          }
        }
      }
      if (p.life <= 0) p.mesh.setEnabled(false);
    }
  }
  clear() { for (const p of this.pool) { p.life = 0; p.mesh.setEnabled(false); } }
}
