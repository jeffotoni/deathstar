import { Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import { CONFIG } from '../config';
import { ProjectileManager, Target } from '../weapons/ProjectileManager';
import { PlayerShip } from '../player/PlayerShip';
type Kind = 'scout' | 'assault' | 'elite';
type State = 'PATROL' | 'CHASE' | 'ATTACK' | 'EVADE' | 'REPOSITION';

function flightRotation(direction: Vector3) {
  const forward = direction.normalizeToNew();
  const referenceUp = Math.abs(forward.y) > 0.99 ? Vector3.Right() : Vector3.Up();
  const right = Vector3.Cross(referenceUp, forward).normalize();
  const up = Vector3.Cross(forward, right).normalize();
  // These models face local +Z. Babylon's LH look helper aligns local -Z.
  // The RH helper preserves +Z; its up vector must be orthogonal to forward.
  return Quaternion.FromLookDirectionRH(forward, up);
}
export class Enemy implements Target {
  static serial = 0;
  id = ++Enemy.serial;
  root: TransformNode;
  radius: number;
  health: number;
  maxHealth: number;
  name: string;
  cooldown = 2 + Math.random() * 2;
  age = 0;
  state: State = 'PATROL';
  constructor(public kind: Kind, assets: AssetManager, position: Vector3, facing: Vector3) {
    this.root = assets.ship(kind); this.root.position.copyFrom(position); this.root.rotationQuaternion = flightRotation(facing);
    this.health = this.maxHealth = kind === 'scout' ? 60 : kind === 'assault' ? 150 : 110;
    this.radius = kind === 'assault' ? 6 : 4.5;
    this.name = kind === 'scout' ? 'Batedor · Agulha' : kind === 'assault' ? 'Assalto · Bastião' : 'Elite · Espectro';
  }
  get position() { return this.root.position; }
  hit(damage: number) { this.health = Math.max(0, this.health - damage); this.state = 'EVADE'; }
}
export class EnemyManager {
  enemies: Enemy[] = [];
  onDestroyed: (enemy: Enemy) => void = () => {};
  constructor(private assets: AssetManager, private projectiles: ProjectileManager) {}
  spawn(count: number, stage: number, player: PlayerShip) {
    const available = Math.min(count, CONFIG.maxEnemies - this.enemies.length);
    const anchor = player.position.add(player.forward.scale(450 + Math.random() * 180));
    for (let i = 0; i < available; i++) {
      const kind: Kind = stage >= 3 && i % 3 === 0 ? 'elite' : stage >= 1 && i % 2 === 0 ? 'assault' : 'scout';
      const pos = anchor.add(player.right.scale((i - (available - 1) / 2) * 36)).add(player.up.scale(Math.sin(i * 2) * 30));
      if (stage > 2 && i === 0) pos.addInPlace(player.right.scale(260));
      this.enemies.push(new Enemy(kind, this.assets, pos, player.forward.scale(-1)));
    }
  }
  update(dt: number, player: PlayerShip) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.health <= 0) { this.onDestroyed(e); e.root.dispose(); this.enemies.splice(i, 1); continue; }
      e.age += dt; e.cooldown -= dt;
      const distance = Vector3.Distance(e.position, player.position);
      if (distance > 2400) { e.root.dispose(); this.enemies.splice(i, 1); continue; }
      let goal = player.position.add(player.velocity.scale(Math.min(0.7, distance / 500)));
      if (distance < 90 || (e.state === 'EVADE' && Math.sin(e.age * 1.5) > 0)) {
        e.state = 'REPOSITION';
        goal = e.position.add(e.root.getDirection(Vector3.Forward()).scale(170)).add(player.right.scale(Math.sin(e.id) * 80));
      } else if (e.age < 2) { e.state = 'PATROL'; }
      else {
        e.state = distance < 480 ? 'ATTACK' : 'CHASE';
        if (e.kind === 'elite') goal.addInPlace(player.forward.scale(-100));
        goal.addInPlace(player.right.scale(Math.sin(e.age * 0.6 + e.id) * 45));
        goal.addInPlace(player.up.scale(Math.cos(e.age * 0.5 + e.id) * 28));
      }
      const dir = goal.subtract(e.position).normalize();
      const rotation = flightRotation(dir);
      e.root.rotationQuaternion = Quaternion.Slerp(e.root.rotationQuaternion!, rotation, 1 - Math.exp(-dt * (e.kind === 'elite' ? 1.7 : 1.05)));
      const speed = e.kind === 'scout' ? 75 : e.kind === 'assault' ? 58 : 94;
      e.position.addInPlace(e.root.getDirection(Vector3.Forward()).scale(speed * dt));
      if (e.state === 'ATTACK' && e.cooldown <= 0) {
        const aim = player.position.add(player.velocity.scale(distance / 265 * 0.65)).subtract(e.position).normalize();
        if (Vector3.Dot(e.root.getDirection(Vector3.Forward()), aim) > 0.7) {
          this.projectiles.fire(e.position, aim, 'enemy', e.kind === 'assault' ? 15 : 9, 265);
          e.cooldown = (e.kind === 'elite' ? 1.5 : 2.6) + Math.random();
        }
      }
    }
  }
  clear() { for (const e of this.enemies) e.root.dispose(); this.enemies = []; }
}
