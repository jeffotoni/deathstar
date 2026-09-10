import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3, NullEngine, Scene, TransformNode } from '@babylonjs/core';

Object.defineProperty(globalThis, 'location', { value: { search: '' }, configurable: true });
const { PlayerHealth } = await import('../src/player/PlayerHealth.ts');
const { segmentDistanceSquared, ProjectileManager } = await import('../src/weapons/ProjectileManager.ts');
const { ProgressionManager } = await import('../src/progression/ProgressionManager.ts');
const { AssetManager } = await import('../src/core/AssetManager.ts');
const { CapitalShip } = await import('../src/boss/CapitalShip.ts');
const { PlayerShip } = await import('../src/player/PlayerShip.ts');
const { Effects } = await import('../src/effects/Effects.ts');
const { Subsystem } = await import('../src/boss/CapitalShip.ts');
const { Enemy, EnemyManager } = await import('../src/enemies/EnemyManager.ts');

test('enemy +Z nose faces its target, approaches, and can fire during attack', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const assets = new AssetManager(scene);
  try {
    const shots = new ProjectileManager(assets); const manager = new EnemyManager(assets, shots);
    const player = new PlayerShip(assets);
    assert.equal(player.shieldVisible, false, 'shield starts hidden');
    assert.equal(player.toggleShield(), true, 'V reveals the shield');
    assert.equal(player.toggleShield(), false, 'V hides the shield again');
    for (const facing of [Vector3.Forward(), new Vector3(0, 0, -1), Vector3.Up(), new Vector3(0, -1, 0), new Vector3(1, 0.4, -0.7).normalize()]) {
      const enemy = new Enemy('scout', assets, new Vector3(0, 0, 400), facing);
      enemy.root.computeWorldMatrix(true);
      assert.ok(Vector3.Dot(enemy.root.getDirection(Vector3.Forward()), facing) > 0.999, 'visual nose must match requested facing');
      enemy.root.dispose();
    }
    const enemy = new Enemy('scout', assets, new Vector3(0, 0, 400), new Vector3(0, 0, -1));
    enemy.age = 3; enemy.cooldown = 0; manager.enemies.push(enemy);
    const initialDistance = Vector3.Distance(enemy.position, player.position);
    manager.update(1 / 60, player);
    assert.equal(shots.count, 0, 'enemy telegraph must precede the shot');
    for (let i = 0; i < 60; i++) {
      enemy.root.computeWorldMatrix(true);
      manager.update(1 / 60, player);
    }
    assert.ok(Vector3.Distance(enemy.position, player.position) < initialDistance - 50, 'chase must close distance');
    assert.ok(shots.count > 0, 'aligned enemy must attack');
  } finally { engine.dispose(); }
});

test('rear enemies recover toward the combat volume without firing from behind', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const assets = new AssetManager(scene);
  try {
    const shots = new ProjectileManager(assets); const manager = new EnemyManager(assets, shots); const player = new PlayerShip(assets);
    const enemy = new Enemy('scout', assets, new Vector3(0, 0, -280), Vector3.Forward());
    enemy.age = 3; enemy.cooldown = 0; manager.enemies.push(enemy);
    const initialForwardDistance = Vector3.Dot(enemy.position.subtract(player.position), player.forward);
    for (let i = 0; i < 60; i++) manager.update(1 / 60, player);
    const finalForwardDistance = Vector3.Dot(enemy.position.subtract(player.position), player.forward);
    assert.ok(finalForwardDistance > initialForwardDistance, 'rear enemies must move back toward the readable combat volume');
    assert.equal(shots.count, 0, 'rear enemies must not fire while recovering');
  } finally { engine.dispose(); }
});

test('damage consumes shields first, spills into hull, and respects regeneration delay', () => {
  const health = new PlayerHealth();
  health.hit(140); assert.equal(health.shield, 0); assert.equal(health.hull, 80);
  health.update(4); assert.equal(health.shield, 0);
  health.update(2); assert.equal(health.shield, 20); assert.equal(health.hull, 80);
  health.hit(200); assert.equal(health.hull, 0);
});

test('swept collision catches targets crossed between frames', () => {
  assert.equal(segmentDistanceSquared(new Vector3(0, 0, 0), new Vector3(0, 0, 100), new Vector3(0, 3, 45)), 9);
  assert.equal(segmentDistanceSquared(Vector3.Zero(), Vector3.Zero(), new Vector3(4, 0, 0)), 16);
  assert.equal(segmentDistanceSquared(Vector3.Zero(), new Vector3(0, 0, 10), new Vector3(0, 0, 20)), 100);
});

test('mission unlocks weapons at correct stages and fast mode changes progression only', () => {
  const mission = new ProgressionManager(); const stages: number[] = [];
  mission.onStage = stage => stages.push(stage);
  assert.equal(mission.weaponLevel, 1);
  mission.update(145); assert.equal(mission.stage, 2); assert.equal(mission.weaponLevel, 2);
  mission.update(95); assert.equal(mission.weaponLevel, 3);
  mission.update(135); assert.equal(mission.stage, 5); assert.deepEqual(stages, [2, 3, 5]);
  const fast = new ProgressionManager(); fast.fast = true; fast.update(10);
  assert.equal(fast.elapsed, 40); assert.equal(fast.nextSpawn, -3);
});

test('real projectile pool applies impact, splash, and enemy damage without tunneling', () => {
  const engine = new NullEngine(); const scene = new Scene(engine);
  const shots = new ProjectileManager(new AssetManager(scene));
  const target = new Subsystem(1, 'target', new TransformNode('target', scene), 0, 200);
  target.node.position.set(0, 0, 50); target.node.computeWorldMatrix(true); target.radius = 4;
  const splash = new Subsystem(2, 'splash', new TransformNode('splash', scene), 0, 200);
  splash.node.position.set(10, 0, 50); splash.node.computeWorldMatrix(true); splash.radius = 4;
  shots.fire(Vector3.Zero(), Vector3.Forward(), 'plasma', 100, 1000);
  shots.update(0.1, [target, splash], new Vector3(0, 500, 0));
  assert.equal(target.health, 100); assert.equal(splash.health, 140); assert.equal(shots.count, 0);
  let damage = 0; shots.onPlayerHit = value => damage += value;
  shots.fire(Vector3.Zero(), Vector3.Forward(), 'enemy', 12, 1000);
  shots.update(0.1, [], new Vector3(0, 0, 45)); assert.equal(damage, 12);
  engine.dispose();
});

test('capital ship gates subsystems and completes only after destruction sequence', () => {
  const engine = new NullEngine(); const scene = new Scene(engine); const assets = new AssetManager(scene);
  const player = new PlayerShip(assets); const boss = new CapitalShip(assets, player);
  const shots = new ProjectileManager(assets); const effects = new Effects(assets);
  let destroyed = 0; const phases: number[] = []; let finaleBursts = 0; let finalExplosion = 0;
  boss.onSubsystemDestroyed = () => destroyed++;
  boss.onPhase = () => phases.push(boss.phase);
  boss.onFinale = (_position, _intensity, final) => { finaleBursts++; if (final) finalExplosion++; };
  assert.equal(boss.targets.length, 2); assert.ok(boss.targets.every(t => t.phase === 0));
  for (let phase = 0; phase < 4; phase++) {
    assert.equal(boss.phase, phase);
    for (const target of boss.targets) target.hit(1000);
    boss.update(1 / 60, player, shots, effects);
  }
  assert.equal(boss.phase, 4); assert.equal(boss.complete, false);
  assert.equal(destroyed, 7); assert.deepEqual(phases, [1, 2, 3, 4]);
  for (let i = 0; i < 430; i++) boss.update(1 / 60, player, shots, effects);
  assert.equal(boss.complete, true);
  assert.ok(finaleBursts > 1); assert.equal(finalExplosion, 1);
  engine.dispose();
});
