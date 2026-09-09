import './style.css';
import { createEngine } from './core/Engine';
import { Game } from './core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const ui = document.querySelector<HTMLDivElement>('#ui')!;
ui.innerHTML = '<div class="centered"><div class="eyebrow">VÉU / ECOS DO EXÍLIO</div><h2>Preparando a travessia.</h2><p>Inicializando os sistemas de voo…</p></div>';
try {
  const { engine, backend } = await createEngine(canvas);
  new Game(engine, canvas, backend);
} catch (error) {
  console.error(error);
  ui.innerHTML = '<div class="centered"><h2>Não foi possível iniciar.</h2><p id="error-detail"></p><button class="primary" onclick="location.reload()">TENTAR NOVAMENTE</button></div>';
  document.querySelector('#error-detail')!.textContent = error instanceof Error ? error.message : String(error);
}
