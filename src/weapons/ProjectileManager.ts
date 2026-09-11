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
  onPlayerHit: (damage: number, position: Vector3, normal: Vector3) => void = () => {};
  constructor(assets: AssetManager) {
    this.materials = {
      laser: assets.material('laser cyan', '#e1fffb', 6.5),
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
    p.mesh.scaling.set(kind === 'laser' ? 0.68 : kind === 'enemy' ? 0.5 : 2, kind === 'laser' ? 0.68 : kind === 'enemy' ? 0.5 : 2, kind === 'laser' ? 14 : kind === 'burst' ? 8 : kind === 'plasma' ? 4 : 8);
    p.mesh.lookAt(position.add(direction)); p.mesh.setEnabled(true);
  }
  update(dt: number, targets: Target[], player: Vector3, obstacles: Target[] = []) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt; p.previous.copyFrom(p.mesh.position); p.mesh.position.addInPlace(p.velocity.scale(dt));
      if (p.kind === 'enemy') {
        if (segmentDistanceSquared(p.previous, p.mesh.position, player) < 3.6 ** 2) { this.onPlayerHit(p.damage, player.clone(), p.velocity.normalizeToNew().scaleInPlace(-1)); p.life = 0; }
      } else {
        let hitTarget: Target | undefined;
        let hitT = Number.POSITIVE_INFINITY;
        const consider = (target: Target) => {
          if (target.health <= 0) return;
          if (p.kind !== 'laser' && p.kind !== 'plasma' && obstacles.includes(target)) return;
          const segment = p.mesh.position.subtract(p.previous);
          const t = Math.max(0, Math.min(1, Vector3.Dot(target.position.subtract(p.previous), segment) / Math.max(0.0001, segment.lengthSquared())));
          if (t < hitT && segmentDistanceSquared(p.previous, p.mesh.position, target.position) < (target.radius + (p.kind === 'laser' ? 1.6 : 4)) ** 2) { hitTarget = target; hitT = t; }
        };
        for (const target of targets) consider(target);
        if (p.kind === 'laser' || p.kind === 'plasma') for (const obstacle of obstacles) consider(obstacle);
        if (hitTarget) {
          const impact = hitTarget.position.clone(); hitTarget.hit(p.damage); this.onHit(hitTarget, impact, p.kind); p.life = 0;
          if (p.kind === 'plasma' || p.kind === 'burst') {
            const radius = p.kind === 'burst' ? 75 : 25;
            for (const other of targets) if (other !== hitTarget && other.health > 0 && Vector3.Distance(other.position, impact) < radius) other.hit(p.damage * 0.6);
          }
        }
      }
      if (p.life <= 0) p.mesh.setEnabled(false);
    }
  }
  clear() { for (const p of this.pool) { p.life = 0; p.mesh.setEnabled(false); } }
}
