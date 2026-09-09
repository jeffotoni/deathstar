import { TransformNode, Vector3 } from '@babylonjs/core';
import { AssetManager } from '../core/AssetManager';
import { PlayerShip } from '../player/PlayerShip';
import { ProjectileManager, Target } from '../weapons/ProjectileManager';
import { Effects } from '../effects/Effects';
export class Subsystem implements Target {
  health: number;
  radius = 15;
  constructor(public id: number, public name: string, public node: TransformNode, public phase: number, public maxHealth: number) { this.health = maxHealth; }
  get position() { return this.node.getAbsolutePosition(); }
  hit(damage: number) { this.health = Math.max(0, this.health - damage); }
}
export class CapitalShip {
  root: TransformNode;
  parts: Subsystem[] = [];
  phase = 0;
  deathTime = 0;
  complete = false;
  private fireTimer = 2;
  private explosionTimer = 0;
  onPhase: (message: string) => void = () => {};
  constructor(assets: AssetManager, player: PlayerShip) {
    this.root = new TransformNode('Obelisco capital ship', assets.scene);
    this.root.position.copyFrom(player.position.add(player.forward.scale(750)));
    const hull = assets.material('capital armor', '#3f4c5c');
    const dark = assets.material('capital carbon', '#172330');
    const glow = assets.material('capital energy', '#ff9d5f', 1.8);
    assets.box('central armored bridge', this.root, [120, 38, 240], [0, 0, 0], hull);
    assets.box('ventral spine', this.root, [55, 45, 310], [0, -28, 0], dark);
    for (const side of [-1, 1]) {
      const arm = assets.box('outrigger hull', this.root, [55, 64, 330], [side * 105, -5, 0], hull); arm.rotation.z = side * 0.13;
      assets.box('cross brace', this.root, [240, 22, 35], [0, 0, side * 65], dark);
      assets.box('hangar', this.root, [38, 18, 2], [side * 105, -7, -167], glow);
      for (let j = 0; j < 6; j++) assets.box('armor ribs', this.root, [59, 4, 9], [side * 105, 29, -130 + j * 50], dark);
      const turret = new TransformNode('defense turret', assets.scene); turret.parent = this.root; turret.position.set(side * 83, 44, -100);
      assets.box('turret base', turret, [24, 17, 24], [0, 0, 0], glow);
      assets.box('turret barrel', turret, [7, 7, 38], [0, 7, -15], hull);
      this.parts.push(new Subsystem(10000 + this.parts.length, 'Torre de defesa', turret, 0, 300));
      const shield = new TransformNode('shield generator', assets.scene); shield.parent = this.root; shield.position.set(side * 107, 40, 50);
      assets.box('shield chamber', shield, [23, 28, 26], [0, 0, 0], assets.material('shield violet', '#ae8bfd', 2));
      this.parts.push(new Subsystem(10000 + this.parts.length, 'Gerador de escudo', shield, 1, 400));
      const engine = new TransformNode('capital engine', assets.scene); engine.parent = this.root; engine.position.set(side * 104, -5, -183);
      assets.box('engine core', engine, [27, 30, 12], [0, 0, 0], assets.material('capital drive', '#63dfea', 2.5));
      this.parts.push(new Subsystem(10000 + this.parts.length, 'Motor de íons', engine, 2, 370));
    }
    const core = new TransformNode('reactor', assets.scene); core.parent = this.root; core.position.set(0, 33, -110);
    assets.box('reactor core', core, [30, 24, 35], [0, 0, 0], glow);
    this.parts.push(new Subsystem(10010, 'Reator principal', core, 3, 800));
    this.root.computeWorldMatrix(true);
  }
  get targets() { return this.parts.filter(p => p.phase === this.phase && p.health > 0); }
  get objective() { return ['Destrua as duas torres de defesa', 'Desative os geradores de escudo', 'Destrua os motores de íons', 'Exponha e destrua o reator', 'Afaste-se. Reação em cadeia!'][this.phase]; }
  update(dt: number, player: PlayerShip, projectiles: ProjectileManager, effects: Effects) {
    for (const p of this.parts) if (p.health <= 0 && p.node.isEnabled()) { effects.explosion(p.position, 4); p.node.setEnabled(false); }
    if (this.phase < 4 && this.targets.length === 0) { this.phase++; this.onPhase(this.objective); }
    if (this.phase === 4) {
      this.deathTime += dt; this.explosionTimer -= dt; this.root.rotation.z += dt * this.deathTime * 0.008;
      if (this.explosionTimer <= 0) { effects.explosion(this.root.position.add(new Vector3((Math.random() - 0.5) * 220, Math.random() * 40, (Math.random() - 0.5) * 260)), 4 + this.deathTime); this.explosionTimer = 0.35; }
      if (this.deathTime > 7) { effects.explosion(this.root.position, 25); this.root.setEnabled(false); this.complete = true; }
      return;
    }
    this.fireTimer -= dt;
    if (this.fireTimer < 0) {
      this.fireTimer = this.phase === 0 ? 1.8 : 2.8;
      for (const side of [-1, 1]) {
        const origin = this.root.position.add(new Vector3(side * 95, 35, -110));
        const dir = player.position.add(player.velocity.scale(0.5)).subtract(origin).normalize();
        projectiles.fire(origin, dir, 'enemy', 18, 230);
      }
    }
  }
  collides(position: Vector3) {
    if (this.phase >= 4) return false;
    const p = position.subtract(this.root.position);
    return (Math.abs(p.x) < 63 && Math.abs(p.y) < 25 && Math.abs(p.z) < 125) || (Math.abs(Math.abs(p.x) - 105) < 30 && Math.abs(p.y + 5) < 35 && Math.abs(p.z) < 168);
  }
  dispose() { this.root.dispose(); }
}
