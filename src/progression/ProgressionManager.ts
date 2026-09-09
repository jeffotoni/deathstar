import { STAGES } from '../config';
export class ProgressionManager {
  elapsed = 0;
  stage = 0;
  kills = 0;
  score = 0;
  nextSpawn = 7;
  fast = false;
  onStage: (stage: number) => void = () => {};
  get weaponLevel() { return this.stage >= 3 ? 3 : this.stage >= 2 ? 2 : 1; }
  update(dt: number) {
    this.elapsed += dt * (this.fast ? 4 : 1);
    const stage = STAGES.reduce((value, s, i) => this.elapsed >= s.at ? i : value, 0);
    if (stage !== this.stage) { this.stage = stage; this.onStage(stage); }
    this.nextSpawn -= dt;
  }
  recordKill(kind: string) { this.kills++; this.score += kind === 'elite' ? 300 : kind === 'assault' ? 200 : 100; }
}
