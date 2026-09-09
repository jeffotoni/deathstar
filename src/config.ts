export const CONFIG = {
  player: { hull: 100, shield: 120, minSpeed: 24, cruiseSpeed: 62, maxSpeed: 115, boostSpeed: 225, turnRate: 1.35, shieldDelay: 5, shieldRegen: 10 },
  weapons: { laserDamage: 20, laserInterval: 0.13, laserSpeed: 520, plasmaDamage: 105, plasmaInterval: 0.9, plasmaSpeed: 340, burstDamage: 240, burstInterval: 8 },
  maxEnemies: 18,
  maxProjectiles: 220,
  debug: new URLSearchParams(location.search).has('debug'),
};
export const STAGES = [
  { at: 0, title: 'Reconhecimento', objective: 'Familiarize-se com a nave. Intercepte os batedores.', count: 3, interval: 19 },
  { at: 65, title: 'Ecos no cinturão', objective: 'Atravesse o cinturão e elimine as patrulhas.', count: 5, interval: 21 },
  { at: 145, title: 'Linha de ruptura', objective: 'Desfaça as formações. Canhão de plasma disponível.', count: 7, interval: 24 },
  { at: 240, title: 'O cerco', objective: 'Resista à ofensiva. Ruptura energética disponível.', count: 9, interval: 24 },
  { at: 345, title: 'Silêncio no Véu', objective: 'Assinatura colossal detectada. Prepare as armas.', count: 3, interval: 35 },
  { at: 375, title: 'A última sentinela', objective: 'Destrua os subsistemas da nave capital.', count: 4, interval: 32 },
] as const;
