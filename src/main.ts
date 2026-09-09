import './style.css';
import './readability.css';
import { createEngine } from './core/Engine';
import { Game } from './core/Game';
import { t } from './localization/i18n';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
ui.innerHTML = `<div class="centered"><div class="eyebrow">VÉU / ${t('brand.sub')}</div><h2>${t('boot.title')}</h2><p>${t('boot.text')}</p></div>`;
try {
  const { engine, backend } = await createEngine(canvas);
  new Game(engine, canvas, backend);
} catch (error) {
  console.error(error);
  ui.innerHTML = `<div class="centered"><h2>${t('boot.error')}</h2><p id="error-detail"></p><button class="primary" onclick="location.reload()">${t('boot.retry')}</button></div>`;
  document.querySelector('#error-detail')!.textContent = error instanceof Error ? error.message : String(error);
}
