import { AbstractEngine, Color3, DirectionalLight, FreeCamera, GlowLayer, HemisphericLight, Quaternion, Scene, Vector3 } from '@babylonjs/core';
import { CONFIG, STAGES } from '../config';
import { AssetManager } from './AssetManager';
import { InputManager } from './InputManager';
import { PlayerShip, type PlayerShipVariant } from '../player/PlayerShip';
import { SpaceEnvironment } from '../world/SpaceEnvironment';
import { ProjectileManager, Target, WeaponKind } from '../weapons/ProjectileManager';
import { EnemyManager } from '../enemies/EnemyManager';
import { Effects } from '../effects/Effects';
import { AudioManager } from '../audio/AudioManager';
import { ProgressionManager } from '../progression/ProgressionManager';
import { CapitalShip } from '../boss/CapitalShip';
import { HUD, Screen } from '../ui/HUD';
import { stageTitle, t } from '../localization/i18n';

export class Game {
  private scene: Scene;
  private camera: FreeCamera;
  private assets: AssetManager;
  private input: InputManager;
  private player: PlayerShip;
  private world: SpaceEnvironment;
  private projectiles: ProjectileManager;
  private enemies: EnemyManager;
  private effects: Effects;
  private audio = new AudioManager();
  private progression = new ProgressionManager();
  private hud: HUD;
  private boss?: CapitalShip;
  private state: Screen = 'menu';
  private selected?: Target;
  private laserCooldown = 0;
  private plasmaCooldown = 0;
  private burstCooldown = 0;
  private collisionCooldown = 0;
  private solarDamageCooldown = 0;
  private introTime = 0;
  private menuTime = 0;
  private debugTimer = 0;
  private muted = false;
  private visualTime = 0;
  private actualTime = 0;
  private selectedShip: PlayerShipVariant = 'lego';

  constructor(private engine: AbstractEngine, canvas: HTMLCanvasElement, backend: string) {
    this.scene = new Scene(engine);
    this.scene.imageProcessingConfiguration.exposure = 1.08;
    this.scene.imageProcessingConfiguration.contrast = 1.1;
    this.scene.skipPointerMovePicking = true;
    this.camera = new FreeCamera('chase camera', new Vector3(0, 7, -25), this.scene);
    this.camera.minZ = 0.4; this.camera.maxZ = 24000; this.camera.fov = 0.92;
    this.camera.inputs.clear();
    const ambient = new HemisphericLight('starlight', new Vector3(0.2, 1, -0.3), this.scene);
    ambient.intensity = 0.65; ambient.diffuse = new Color3(0.66, 0.8, 0.96); ambient.groundColor = new Color3(0.13, 0.17, 0.26);
    const sun = new DirectionalLight('Náris sun', new Vector3(-0.8, -0.35, 0.6), this.scene); sun.intensity = 2.2; sun.diffuse = new Color3(1, 0.84, 0.7);
    const glow = new GlowLayer('energy bloom', this.scene, { mainTextureRatio: 0.45, blurKernelSize: 32 }); glow.intensity = 0.8;
    this.assets = new AssetManager(this.scene);
    this.player = new PlayerShip(this.assets, this.selectedShip);
    this.world = new SpaceEnvironment(this.scene, this.assets);
    this.projectiles = new ProjectileManager(this.assets);
    this.enemies = new EnemyManager(this.assets, this.projectiles);
    this.effects = new Effects(this.assets);
    this.input = new InputManager(canvas);
    this.hud = new HUD(backend);
    this.hud.onStart = (fast) => this.start(fast);
    this.hud.onShipSelect = variant => this.selectShip(variant);
    this.hud.onResume = () => this.resume();
    this.hud.onRestart = () => this.start(this.progression.fast);
    this.hud.onVolume = (bus, volume) => this.audio.setVolume(bus, volume);
    this.input.onPause = () => { if (this.state === 'playing') this.pause(); else if (this.state === 'pause') this.resume(); };
    this.enemies.onDestroyed = (enemy) => {
      this.effects.explosion(enemy.position, enemy.kind === 'assault' ? 2 : 1.2);
      this.audio.explosion(enemy.position, enemy.kind === 'assault' ? 2 : 1.2); this.hud.hit(true); this.progression.recordKill(enemy.kind);
      // A small shield reward keeps sustained combat viable without regenerating hull.
      this.player.health.shield = Math.min(CONFIG.player.shield, this.player.health.shield + 7);
    };
    this.enemies.onTelegraph = enemy => { this.audio.enemyCharge(enemy.position, enemy.kind); this.hud.threat(); };
    this.enemies.onFire = enemy => this.audio.enemyFire(enemy.position, enemy.kind);
    this.projectiles.onHit = (_target, position, kind) => {
      const asteroid = _target.name === 'ASTEROID';
      const destroyedAsteroid = asteroid && _target.health <= 0;
      const heavy = kind !== 'laser' || destroyedAsteroid;
      this.hud.hit(heavy);
      if (destroyedAsteroid) this.audio.asteroidExplosion(position, kind === 'plasma' ? 1.5 : 1);
      else this.audio.hit(position, heavy);
      this.effects.explosion(position, destroyedAsteroid ? (kind === 'plasma' ? 2.2 : 1.35) : kind === 'laser' ? 0.25 : 1.2);
      this.effects.shake = Math.max(this.effects.shake, heavy ? 0.16 : 0.055);
    };
    this.projectiles.onPlayerHit = (damage, position, normal) => this.damage(damage, position, normal);
    this.hud.show('menu');
    engine.runRenderLoop(() => this.frame());
    window.addEventListener('resize', () => engine.resize());
  }
  private selectShip(variant: PlayerShipVariant) {
    if (this.state !== 'menu' || variant === this.selectedShip) return;
    this.selectedShip = variant;
    this.player.root.dispose(); this.player = new PlayerShip(this.assets, variant);
  }
  private start(fast: boolean) {
    this.enemies.clear(); this.projectiles.clear(); this.boss?.dispose(); this.boss = undefined; this.selected = undefined;
    this.player.root.dispose(); this.player = new PlayerShip(this.assets, this.selectedShip);
    this.progression = new ProgressionManager(); this.progression.fast = fast;
    this.progression.onStage = stage => this.enterStage(stage);
    this.laserCooldown = this.plasmaCooldown = this.burstCooldown = this.collisionCooldown = this.solarDamageCooldown = 0;
    this.actualTime = 0; this.introTime = 0; this.state = 'intro'; this.hud.shieldVisibility(this.player.shieldVisible); this.hud.show('intro'); this.input.setEnabled(false); this.audio.start();
    this.camera.position.set(0, 7, -25); this.camera.upVector = Vector3.Up(); this.camera.setTarget(new Vector3(0, 0, 100));
  }
  private launch() {
    this.state = 'playing'; this.hud.show('playing'); this.input.setEnabled(true);
    this.hud.toast(t('toast.launch'));
  }
  private pause() { this.state = 'pause'; this.input.setEnabled(false); this.hud.show('pause'); this.audio.pause(); }
  private resume() { this.state = 'playing'; this.hud.show('playing'); this.input.setEnabled(true); this.audio.start(); }
  private finish(won: boolean) {
    this.state = won ? 'victory' : 'defeat'; this.input.setEnabled(false); this.audio.pause(); this.hud.result(won, this.progression);
  }
  private enterStage(stage: number) {
    this.audio.alert();
    if (stage === 2) this.hud.toast(t('toast.plasma'));
    else if (stage === 3) this.hud.toast(t('toast.burst'));
    else if (stage === 4) { this.hud.toast(t('toast.veil')); }
    else if (stage === 5) {
      this.boss = new CapitalShip(this.assets, this.player);
      this.audio.bossArrival(this.boss.root.position);
      this.boss.onSubsystemDestroyed = (position, phase) => this.audio.bossSubsystem(position, phase);
      this.boss.onFinale = (position, intensity, final) => this.audio.bossFinale(position, intensity, final);
      this.boss.onPhase = message => { this.hud.toast(message); this.audio.alert(); this.audio.bossPhase(this.boss!.root.position, this.boss!.phase); this.selected = this.boss?.targets[0]; };
      this.selected = this.boss.targets[0];
      this.hud.toast(t('toast.obelisk'));
    } else this.hud.toast(stageTitle(stage).toUpperCase());
  }
  private damage(amount: number, impactPosition = this.player.position, impactNormal = this.player.forward.scale(-1)) {
    if (this.player.dodge > 0 || this.state !== 'playing') return;
    this.player.health.hit(amount); this.player.shieldImpact(); this.effects.shieldImpact(impactPosition, impactNormal); this.hud.damage(); this.audio.damage(this.player.position); this.effects.shake = 0.5;
    if (this.player.health.hull <= 0) { this.effects.explosion(this.player.position, 4); this.audio.explosion(this.player.position, 4); this.finish(false); }
  }
  private get targets(): Target[] { return [...this.enemies.enemies.filter(e => e.health > 0), ...(this.boss?.targets ?? [])]; }
  private chooseTarget(cycle: boolean) {
    const targets = this.targets;
    if (!targets.length) { this.selected = undefined; return; }
    if (cycle && this.selected) this.selected = targets[(targets.findIndex(t => t.id === this.selected?.id) + 1) % targets.length];
    else this.selected = targets.sort((a, b) => Vector3.Dot(b.position.subtract(this.player.position).normalize(), this.player.forward) - Vector3.Dot(a.position.subtract(this.player.position).normalize(), this.player.forward))[0];
    this.audio.lock();
  }
  private fire(kind: Exclude<WeaponKind, 'enemy'>) {
    let target = this.selected;
    const forward = this.player.forward;
    const cosine = kind === 'laser' ? 0.977 : kind === 'plasma' ? 0.96 : 0.5;
    const eligible = (t: Target) => t.health > 0 && Vector3.Distance(t.position, this.player.position) < CONFIG.weapons.targetRange && Vector3.Dot(t.position.subtract(this.player.position).normalize(), forward) > cosine;
    if (!target || !eligible(target)) target = this.targets.filter(eligible).sort((a, b) => Vector3.DistanceSquared(a.position, this.player.position) - Vector3.DistanceSquared(b.position, this.player.position))[0];
    const speed = kind === 'laser' ? CONFIG.weapons.laserSpeed : kind === 'plasma' ? CONFIG.weapons.plasmaSpeed : 430;
    const damage = kind === 'laser' ? CONFIG.weapons.laserDamage : kind === 'plasma' ? CONFIG.weapons.plasmaDamage : CONFIG.weapons.burstDamage;
    let aim = this.player.position.add(forward.scale(900));
    if (target) {
      aim = target.position.clone();
      const enemy = this.enemies.enemies.find(e => e.id === target!.id);
      if (enemy) aim.addInPlace(enemy.root.getDirection(Vector3.Forward()).scale((enemy.kind === 'scout' ? 36 : enemy.kind === 'assault' ? 30 : 44) * Math.min(1.35, Vector3.Distance(this.player.position, enemy.position) / speed)));
    }
    const emitterX = this.player.variant === 'lego' ? 3.15 : 2.75;
    for (const side of kind === 'laser' ? [-1, 1] : [0]) {
      const origin = this.player.position.add(this.player.right.scale(side * emitterX)).add(forward.scale(3));
      this.projectiles.fire(origin, aim.subtract(origin).normalize(), kind, damage, speed + this.player.speed * 0.3);
    }
    this.player.weaponFlash(kind === 'laser' ? 1 : kind === 'plasma' ? 1.5 : 2);
    if (kind === 'laser') { this.laserCooldown = CONFIG.weapons.laserInterval; this.audio.laser(this.player.position); this.effects.shake = Math.max(this.effects.shake, 0.025); }
    if (kind === 'plasma') { this.plasmaCooldown = CONFIG.weapons.plasmaInterval; this.audio.plasma(this.player.position); this.effects.shake = 0.13; }
    if (kind === 'burst') { this.burstCooldown = CONFIG.weapons.burstInterval; this.audio.burst(this.player.position); this.effects.shake = 0.25; }
  }
  private chaseCamera(dt: number) {
    const desired = this.player.position.subtract(this.player.forward.scale(this.player.boosting ? 30 : 24)).add(this.player.up.scale(7));
    this.camera.position = Vector3.Lerp(this.camera.position, desired, 1 - Math.exp(-dt * 7));
    if (this.effects.shake > 0.01) this.camera.position.addInPlace(new Vector3(Math.random() - 0.5, Math.random() - 0.5, 0).scale(this.effects.shake));
    this.camera.upVector = Vector3.Lerp(this.camera.upVector, this.player.up, 1 - Math.exp(-dt * 4)).normalize();
    this.camera.setTarget(this.player.position.add(this.player.forward.scale(140)));
    this.camera.fov += ((this.player.boosting ? 1.13 : 0.92) - this.camera.fov) * (1 - Math.exp(-dt * 3));
  }
  private update(dt: number) {
    this.actualTime += dt;
    this.player.update(dt, this.input);
    this.progression.update(dt);
    if (this.input.consume('KeyF')) this.chooseTarget(false);
    if (this.input.consume('Tab')) this.chooseTarget(true);
    if (this.input.consume('KeyV')) this.hud.shieldVisibility(this.player.toggleShield());
    if (this.input.consume('F3')) this.hud.debug = !this.hud.debug;
    if (this.input.consume('KeyM')) { this.muted = !this.muted; this.audio.setMuted(this.muted); }
    const targets = this.targets;
    if (this.selected && !targets.includes(this.selected)) this.selected = undefined;
    this.laserCooldown -= dt; this.plasmaCooldown -= dt; this.burstCooldown -= dt; this.collisionCooldown -= dt;
    if (this.input.fire && this.laserCooldown <= 0) this.fire('laser');
    if (this.input.secondary && this.plasmaCooldown <= 0 && this.progression.weaponLevel >= 2) this.fire('plasma');
    if (this.input.consume('KeyR') && this.burstCooldown <= 0 && this.progression.weaponLevel >= 3) this.fire('burst');
    if (this.progression.nextSpawn <= 0 && (this.boss?.phase ?? 0) < 4) {
      const stage = STAGES[this.progression.stage];
      this.enemies.spawn(stage.count, this.progression.stage, this.player);
      this.progression.nextSpawn = stage.interval;
      if (!this.selected) this.chooseTarget(false);
    }
    this.enemies.update(dt, this.player);
    this.boss?.update(dt, this.player, this.projectiles, this.effects);
    this.projectiles.update(dt, targets, this.player.position, this.world.targets);
    const solarHeat = this.world.solarHeat(this.player.position);
    this.solarDamageCooldown -= dt;
    if (solarHeat > 0 && this.solarDamageCooldown <= 0) {
      this.damage(5 + solarHeat * 18, this.player.position, this.player.position.subtract(this.world.solarPosition).normalize());
      this.solarDamageCooldown = 0.35;
    }
    const rockNormal = this.world.collide(this.player.position);
    const bossCollision = this.boss?.collides(this.player.position);
    if ((rockNormal || bossCollision) && this.collisionCooldown <= 0) {
      this.damage(18 + this.player.speed * 0.1, this.player.position, rockNormal ?? this.player.forward.scale(-1)); this.collisionCooldown = 1.5;
      this.player.position.addInPlace((rockNormal ?? this.player.forward.scale(-1)).scale(20));
      this.player.throttle = CONFIG.player.minSpeed; this.player.velocity.scaleInPlace(-0.25);
    }
    this.world.update(dt, this.player.position); this.effects.update(dt); this.chaseCamera(dt);
    this.audio.update(dt, this.player.speed, this.progression.stage, {
      position: this.player.position, forward: this.player.forward, up: this.player.up, boosting: this.player.boosting,
    }, targets.length, this.selected?.position);
    this.hud.aim(this.input.mouseX, this.input.mouseY);
    this.hud.solarWarning(solarHeat);
    this.hud.update(dt, this.player, this.progression, targets, this.selected, this.scene, this.plasmaCooldown, this.burstCooldown, this.boss?.objective);
    this.debugTimer -= dt;
    if (this.debugTimer < 0) {
      this.debugTimer = 0.3;
      const p = this.player.position;
      this.hud.debugInfo(`FPS ${Math.round(this.engine.getFps())} | ${this.engine.getClassName()}\nPOS ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}\nSPEED ${this.player.speed.toFixed(0)} m/s\nENEMIES ${this.enemies.enemies.length} | SHOTS ${this.projectiles.count}\nMESHES ${this.scene.getActiveMeshes().length}\nSTAGE ${this.progression.stage + 1} | REAL TIME ${this.actualTime.toFixed(0)}s`);
    }
    if (this.boss?.complete) this.finish(true);
  }
  private frame() {
    // Fixed simulation steps preserve collision/AI behavior when a frame stalls.
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
    this.visualTime += dt;
    if (this.state === 'menu') {
      this.menuTime += dt;
      this.player.position.set(0, 0, 0); this.player.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(-0.35 + Math.sin(this.menuTime * 0.13) * 0.1, 0.07, -0.15);
      this.player.visual.rotation.z = Math.sin(this.menuTime * 0.5) * 0.025;
      this.camera.position.set(-15, 9, -23); this.camera.upVector = Vector3.Up(); this.camera.setTarget(new Vector3(-10, 1.2, 3));
      this.world.update(dt, Vector3.Zero());
    } else if (this.state === 'intro') {
      this.introTime += dt;
      this.hud.countdown(this.introTime < 4 ? '…' : this.introTime < 7 ? `${Math.ceil(7 - this.introTime)}` : t('intro.launch'));
      this.chaseCamera(dt);
      if (this.introTime > 7.6) this.launch();
    } else if (this.state === 'playing') {
      let remaining = dt;
      while (remaining > 0 && this.state === 'playing') { const step = Math.min(remaining, 1 / 60); this.update(step); remaining -= step; }
    } else if (this.state === 'victory' || this.state === 'defeat') this.effects.update(dt);
    this.scene.render();
  }
}
