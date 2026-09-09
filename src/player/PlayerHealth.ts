import { CONFIG } from '../config';
export class PlayerHealth {
  hull = CONFIG.player.hull;
  shield = CONFIG.player.shield;
  sinceDamage = 10;
  hit(amount: number) {
    this.sinceDamage = 0;
    const absorbed = Math.min(this.shield, amount);
    this.shield -= absorbed;
    this.hull = Math.max(0, this.hull - (amount - absorbed));
  }
  update(dt: number) {
    this.sinceDamage += dt;
    if (this.sinceDamage > CONFIG.player.shieldDelay) this.shield = Math.min(CONFIG.player.shield, this.shield + dt * CONFIG.player.shieldRegen);
  }
}
