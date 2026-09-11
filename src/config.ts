export const CONFIG = {
  player: { hull: 100, shield: 120, minSpeed: 24, cruiseSpeed: 62, maxSpeed: 115, boostSpeed: 225, turnRate: 1.35, shieldDelay: 5, shieldRegen: 10 },
  weapons: { laserDamage: 20, laserInterval: 0.13, laserSpeed: 640, laserLife: 5, targetRange: 1750, plasmaDamage: 105, plasmaInterval: 0.9, plasmaSpeed: 340, burstDamage: 240, burstInterval: 8 },
  enemies: { spawnDistance: 600, spawnSpread: 160, fireCharge: 0.42, projectileSpeed: 240, scoutDamage: 8, assaultDamage: 12, eliteDamage: 14 },
  maxEnemies: 18,
  maxProjectiles: 220,
  debug: new URLSearchParams(location.search).has('debug'),
};
export const STAGES = [
  { at: 0, count: 3, interval: 22 },
  { at: 65, count: 5, interval: 24 },
  { at: 145, count: 6, interval: 27 },
  { at: 240, count: 8, interval: 28 },
  { at: 345, count: 3, interval: 38 },
  { at: 375, count: 4, interval: 36 },
] as const;
