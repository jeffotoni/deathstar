import { CONFIG } from '../config';
export class PlayerHealth {
  hull = CONFIG.player.hull;
  shield = CONFIG.player.shield;
  sinceDamage = 10;
  hit(amount: number, shieldActive = true) {
    this.sinceDamage = 0;
    const absorbed = shieldActive ? Math.min(this.shield, amount) : 0;
    this.shield -= absorbed;
    this.hull = Math.max(0, this.hull - (amount - absorbed));
  }
  update(dt: number, shieldActive = true) {
    this.sinceDamage += dt;
    if (shieldActive && this.sinceDamage > CONFIG.player.shieldDelay) this.shield = Math.min(CONFIG.player.shield, this.shield + dt * CONFIG.player.shieldRegen);
  }
}
