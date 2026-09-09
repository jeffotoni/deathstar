import { Mesh, MeshBuilder, Quaternion, TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import { CONFIG } from '../config';
import { ProjectileManager, Target } from '../weapons/ProjectileManager';
import { PlayerShip } from '../player/PlayerShip';
import { enemyName } from '../localization/i18n';
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
  private muzzleFlash: Mesh;
  radius: number;
  health: number;
  maxHealth: number;
  cooldown = 2 + Math.random() * 2;
  chargeTime = 0;
  private shotFlashTime = 0;
  age = 0;
  state: State = 'PATROL';
  readonly maneuverPhase = this.id * 1.37;
  readonly maneuverSide = (this.id % 5 - 2) * 110;
  readonly maneuverHeight = (this.id % 3 - 1) * 75;
  readonly combatRange: number;
  constructor(public kind: Kind, assets: AssetManager, position: Vector3, facing: Vector3) {
    this.root = assets.ship(kind); this.root.position.copyFrom(position); this.root.rotationQuaternion = flightRotation(facing);
    this.muzzleFlash = MeshBuilder.CreateSphere('enemy weapon charge', { diameter: 0.9, segments: 8 }, assets.scene);
    this.muzzleFlash.parent = this.root; this.muzzleFlash.position.z = 3.1; this.muzzleFlash.material = assets.material('enemy muzzle flash', '#fff0c4', 7); this.muzzleFlash.setEnabled(false); this.muzzleFlash.isPickable = false;
    this.health = this.maxHealth = kind === 'scout' ? 60 : kind === 'assault' ? 150 : 110;
    this.radius = kind === 'assault' ? 6 : 4.5;
    this.combatRange = kind === 'elite' ? 430 : kind === 'assault' ? 370 : 320;
  }
  get name() { return enemyName(this.kind); }
  get position() { return this.root.position; }
  hit(damage: number) { this.health = Math.max(0, this.health - damage); this.state = 'EVADE'; this.chargeTime = 0; this.shotFlashTime = 0; this.muzzleFlash.setEnabled(false); }
  startCharge(duration: number) { this.chargeTime = duration; this.shotFlashTime = 0; this.muzzleFlash.setEnabled(true); this.muzzleFlash.scaling.setAll(0.4); }
  cancelCharge() { this.chargeTime = 0; this.shotFlashTime = 0; this.muzzleFlash.setEnabled(false); }
  flashShot() { this.chargeTime = 0; this.shotFlashTime = 0.09; this.muzzleFlash.setEnabled(true); this.muzzleFlash.scaling.setAll(1.35); }
  updateCharge(dt: number) {
    if (this.chargeTime > 0) {
      this.chargeTime = Math.max(0, this.chargeTime - dt);
      const progress = 1 - this.chargeTime / CONFIG.enemies.fireCharge;
      this.muzzleFlash.scaling.setAll(0.4 + progress * 0.85);
    }
    if (this.shotFlashTime > 0) { this.shotFlashTime = Math.max(0, this.shotFlashTime - dt); if (this.shotFlashTime === 0) this.muzzleFlash.setEnabled(false); }
    else if (this.chargeTime === 0) this.muzzleFlash.setEnabled(false);
  }
}
export class EnemyManager {
  enemies: Enemy[] = [];
  onDestroyed: (enemy: Enemy) => void = () => {};
  onTelegraph: (enemy: Enemy) => void = () => {};
  onFire: (enemy: Enemy) => void = () => {};
  constructor(private assets: AssetManager, private projectiles: ProjectileManager) {}
  spawn(count: number, stage: number, player: PlayerShip) {
    const available = Math.min(count, CONFIG.maxEnemies - this.enemies.length);
    const anchor = player.position.add(player.forward.scale(CONFIG.enemies.spawnDistance + Math.random() * CONFIG.enemies.spawnSpread));
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
      e.updateCharge(dt);
      const distance = Vector3.Distance(e.position, player.position);
      if (distance > 2400) { e.root.dispose(); this.enemies.splice(i, 1); continue; }
      // Keep the encounter readable: enemies orbit a moving combat volume in
      // front of the player instead of diving through the player and attacking
      // from behind. The changing offsets preserve 360-degree movement while
      // giving the player a reliable space in which to see the maneuvers.
      const maneuverTime = e.age * 0.55 + e.maneuverPhase;
      const combatPoint = player.position
        .add(player.forward.scale(e.combatRange + Math.sin(maneuverTime * 0.73) * 55))
        .add(player.right.scale(e.maneuverSide + Math.sin(maneuverTime) * 140))
        .add(player.up.scale(e.maneuverHeight + Math.cos(maneuverTime * 0.81) * 90))
        .add(player.velocity.scale(0.55));
      const relative = e.position.subtract(player.position);
      const forwardDistance = Vector3.Dot(relative, player.forward);
      const tooClose = distance < 150;
      const behindPlayer = forwardDistance < -50;
      let goal = distance > e.combatRange && !behindPlayer
        ? player.position.add(player.forward.scale(e.combatRange)).add(player.velocity.scale(0.55))
        : combatPoint;
      if (tooClose || behindPlayer || (e.state === 'EVADE' && Math.sin(e.age * 1.5) > 0)) {
        e.state = 'REPOSITION';
        goal = combatPoint;
      } else if (e.age < 2) { e.state = 'PATROL'; }
      else {
        e.state = distance < 760 ? 'ATTACK' : 'CHASE';
      }
      const motionDirection = goal.subtract(e.position).normalize();
      const aimPoint = player.position.add(player.velocity.scale(Math.min(0.7, distance / 500)));
      const facingDirection = e.state === 'ATTACK' ? aimPoint.subtract(e.position).normalize() : motionDirection;
      const rotation = flightRotation(facingDirection);
      e.root.rotationQuaternion = Quaternion.Slerp(e.root.rotationQuaternion!, rotation, 1 - Math.exp(-dt * (e.kind === 'elite' ? 1.7 : 1.05)));
      const speed = e.kind === 'scout' ? 75 : e.kind === 'assault' ? 58 : 94;
      e.position.addInPlace(motionDirection.scale(speed * dt));
      if (e.state !== 'ATTACK' && e.chargeTime > 0) e.cancelCharge();
      if (e.state === 'ATTACK') {
        const aim = player.position.add(player.velocity.scale(distance / 265 * 0.65)).subtract(e.position).normalize();
        const inFrontHemisphere = Vector3.Dot(relative.normalize(), player.forward) > -0.1;
        const canFire = inFrontHemisphere && Vector3.Dot(e.root.getDirection(Vector3.Forward()), aim) > 0.7;
        if (e.chargeTime > 0) {
          if (e.chargeTime <= dt && canFire) {
            this.projectiles.fire(e.position, aim, 'enemy', e.kind === 'scout' ? CONFIG.enemies.scoutDamage : e.kind === 'assault' ? CONFIG.enemies.assaultDamage : CONFIG.enemies.eliteDamage, CONFIG.enemies.projectileSpeed);
            e.flashShot(); this.onFire(e); e.cooldown = (e.kind === 'elite' ? 2.2 : e.kind === 'assault' ? 3.4 : 3.1) + Math.random() * 0.8;
          } else if (e.chargeTime <= dt) {
            e.chargeTime = 0; e.cooldown = 0.35;
          }
        } else if (e.cooldown <= 0 && canFire) {
          e.startCharge(CONFIG.enemies.fireCharge); this.onTelegraph(e);
        }
      }
    }
  }
  clear() { for (const e of this.enemies) e.root.dispose(); this.enemies = []; }
}
