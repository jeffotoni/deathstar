import { Matrix, Scene, Vector3 } from '@babylonjs/core';
import { CONFIG, STAGES } from '../config';
import { PlayerShip, type PlayerShipVariant } from '../player/PlayerShip';
import { ProgressionManager } from '../progression/ProgressionManager';
import { Target } from '../weapons/ProjectileManager';
import { getAudioPreferences } from '../audio/AudioManager';
import { formatScore, getLocale, setLocale, stageObjective, stageTitle, t, type Locale } from '../localization/i18n';

export type Screen = 'menu' | 'intro' | 'playing' | 'pause' | 'victory' | 'defeat';
type MarkerView = { root: HTMLDivElement; label: HTMLSpanElement };

export class HUD {
  onStart: (fast: boolean) => void = () => {};
  onResume = () => {};
  onRestart = () => {};
  onShipSelect: (variant: PlayerShipVariant) => void = () => {};
  onVolume: (bus: 'master' | 'music' | 'sfx', value: number) => void = () => {};
  private elements: Record<string, HTMLElement> = {};
  private radar!: CanvasRenderingContext2D;
  private toastTime = 0;
  private toastMessage = '';
  private hitTime = 0;
  private impactTime = 0;
  private threatTime = 0;
  private damageTime = 0;
  private countdownValue = '3';
  private currentScreen: Screen = 'menu';
  private resultData?: { won: boolean; progression: ProgressionManager };
  private root: HTMLElement;
  private stageElements: HTMLElement[] = [];
  private markerViews: MarkerView[] = [];
  private shieldVisible = false;
  private selectedShip: PlayerShipVariant = 'lego';
  debug = CONFIG.debug;

  constructor(private backend: string) {
    this.root = document.querySelector('#ui')!;
    this.render();
  }

  private render() {
    const audioValues = new Map<string, string>();
    this.root.querySelectorAll<HTMLInputElement>('[data-audio]').forEach(input => audioValues.set(input.dataset.audio!, input.value));
    const audioPreferences = getAudioPreferences();
    this.root.innerHTML = `
      <div class="vignette"></div><div id="impact-flash"></div><div id="threat-flash"></div><div id="damage-flash"></div>
      <header class="topbar"><a class="wordmark" href="./" aria-label="${t('brand.start')}"><span class="brand-icon"><i>∨</i></span><span class="brand-name">${t('brand.name')}</span><span class="brand-sub">${t('brand.sub')}</span></a><div class="build"><span class="status-dot"></span> ${t('systems.online')} <span class="divider">/</span> <span id="backend">${this.backend}</span></div><div class="locale-toggle" aria-label="${t('locale.select')}">${this.localeButtons()}</div></header>
      <section id="menu" class="screen menu">
        <div class="menu-hero">
          <div class="menu-copy"><div class="eyebrow"><span class="line"></span> ${t('menu.chapter')}</div><h1>${t('menu.title')}</h1><p class="lead">${t('menu.lead')}</p></div>
          <aside class="ship-preview" aria-label="${t('menu.preview')}">
            <div class="preview-frame"><i></i><i></i><i></i><i></i><span class="preview-axis axis-x"></span><span class="preview-axis axis-y"></span></div>
            <div class="preview-head"><span><i class="status-dot"></i>${t('menu.preview')}</span><b>${t('menu.sector')}</b></div>
            <div class="preview-signal"><span>${t('menu.unknown-signal')}</span><i></i></div>
            <div class="preview-ship-data"><span id="selected-ship-label">${t('menu.ship-selected')}</span><strong id="selected-ship-name">${t(this.selectedShip === 'lego' ? 'menu.lego-name' : 'menu.classic-name')}</strong><small id="selected-ship-role">${t(this.selectedShip === 'lego' ? 'menu.lego-role' : 'menu.classic-role')}</small></div>
            <div class="preview-orbit">${t('menu.orbit')}</div>
          </aside>
        </div>
        <div class="launch-console">
          <div class="ship-picker"><div class="ship-picker-heading"><span class="tiny-label">${t('menu.choose-ship')}</span><span>${t('menu.select-instruction')}</span></div><div class="ship-options">
            ${this.shipOption('lego', '01', 'menu.lego-name', 'menu.lego-role')}
            ${this.shipOption('classic', '02', 'menu.classic-name', 'menu.classic-role')}
          </div></div>
          <div class="launch-panel">
            <div class="launch-ready"><i class="status-dot"></i><span>${t('menu.ready')}</span></div>
            <div class="mission-meta"><span>${t('menu.mission')}</span><span>${t('menu.open-space')}</span><span>${t('menu.duration')}</span></div>
            <details class="mission-options"><summary>${t('menu.advanced')}</summary><label class="test-option"><input id="fast" type="checkbox"><span><b>${t('menu.test-flight')}</b><small>${t('menu.test-flight-description')}</small></span></label></details>
            <button id="start" class="primary launch-primary"><span class="launch-copy">${t('menu.start')}</span><span class="launch-arrow">↗</span></button>
          </div>
          <div class="console-footer"><span>${t('menu.footer-story')}</span><span>${t('menu.footer-prototype')} <b>0.1</b></span></div>
        </div>
      </section>
      <section id="intro" class="screen centered hidden"><div class="eyebrow">${t('intro.recovered')}</div><h2>${t('intro.title')}</h2><p>${t('intro.text')}</p><div id="countdown">${this.countdownValue}</div><span class="tiny-label">${t('intro.launch-sequence')}</span></section>
      <section id="hud" class="hidden">
        <div class="mission-block"><div class="eyebrow">${t('hud.operation')} <span id="mission-time">00:00</span></div><h3 id="stage-title">${stageTitle(0)}</h3><p id="objective">${stageObjective(0)}</p><div class="stage-track">${STAGES.map((_, i) => `<i data-stage="${i}"></i>`).join('')}</div></div>
        <div class="combat-stats"><span class="tiny-label">${t('hud.kills')}</span><strong id="kills">00</strong><span class="tiny-label">${t('hud.score')} <b id="score">00000</b></span></div>
        <div id="boss-info" class="hidden"><span class="eyebrow">${t('hud.capital-ship')}</span><strong id="boss-objective"></strong></div>
        <div id="crosshair"><span></span><i></i><b></b></div><div id="aim-cursor"></div><div id="hitmarker">×</div><div id="threat-warning"><span>${t('hud.incoming')}</span></div><div id="solar-warning"><span>${t('hud.solar-hazard')}</span><i></i></div><div id="markers"></div><div id="target-arrow" class="hidden">△<span>${t('hud.target')}</span></div>
        <div id="toast"><span class="tiny-label">${t('hud.communication')}</span><p id="toast-text"></p></div>
        <div class="bottom-hud">
          <div class="ship-status"><div class="panel-heading"><span class="ship-symbol">⋀</span><div><strong id="hud-ship-name">${t(this.selectedShip === 'lego' ? 'menu.lego-name' : 'menu.classic-name')}</strong><span>${t('hud.ship-status')}</span></div></div><div class="meter-row"><label>${t('hud.shield')}</label><div class="meter"><i id="shield-bar"></i></div><b id="shield-value">120</b></div><div class="meter-row hull"><label>${t('hud.hull')}</label><div class="meter"><i id="hull-bar"></i></div><b id="hull-value">100</b></div><div class="shield-toggle"><kbd>V</kbd><span id="shield-visibility">${t(this.shieldVisible ? 'hud.shield-visible' : 'hud.shield-hidden')}</span></div></div>
          <div class="flight-status"><div><span class="tiny-label">${t('hud.speed')}</span><strong id="speed">062</strong><span class="unit">m/s</span></div><div class="boost-track"><i id="boost-bar"></i></div><div class="flight-caption"><span>${t('hud.boost')}</span><span id="dodge-status">${t('hud.dodge-ready')}</span></div></div>
          <div class="weapons"><span class="tiny-label">${t('hud.weapons')}</span><div class="weapon active"><kbd>LMB</kbd><span>${t('hud.laser')}</span><i>●</i></div><div id="plasma-weapon" class="weapon locked"><kbd>RMB</kbd><span>${t('hud.plasma')}</span><i id="plasma-status">◇</i></div><div id="burst-weapon" class="weapon locked"><kbd>R</kbd><span>${t('hud.burst')}</span><i id="burst-status">◇</i></div></div>
          <div class="radar-panel"><canvas id="radar" width="140" height="140" aria-label="${t('hud.contacts')}"></canvas><span id="contacts">${t('hud.contacts', { count: 0 })}</span></div>
        </div>
        <div class="control-strip"><span><kbd>MOUSE</kbd> ${t('hud.direction')}</span><span><kbd>ARROWS</kbd> ${t('hud.turn-pitch')}</span><span><kbd>W S</kbd> ${t('hud.throttle')}</span><span><kbd>A D</kbd> ${t('hud.roll')}</span><span><kbd>Q E</kbd> ${t('hud.lateral')}</span><span><kbd>ESPAÇO</kbd> ${t('hud.dodge')}</span><span><kbd>F / TAB</kbd> ${t('hud.lock-target')}</span><span><kbd>ESC</kbd> ${t('hud.pause')}</span></div>
        <div id="target-info">${t('hud.no-target')} <span>· ${t('hud.lock')}</span></div><pre id="debug" class="hidden"></pre>
      </section>
      <section id="pause" class="screen centered hidden"><div class="eyebrow">${t('pause.eyebrow')}</div><h2>${t('pause.title')}</h2><p>${t('pause.text')}</p><button id="resume" class="primary">${t('pause.resume')} <span>↗</span></button><div class="locale-toggle pause-locale" aria-label="${t('locale.select')}">${this.localeButtons()}</div><div class="audio-settings">${(['master', 'music', 'sfx'] as const).map(bus => `<label>${t(`audio.${bus}`)}<input data-audio="${bus}" type="range" min="0" max="1" step="0.01" value="${audioValues.get(bus) ?? audioPreferences[bus]}"></label>`).join('')}</div><button id="restart-pause" class="text-button">${t('pause.restart')}</button></section>
      <section id="result" class="screen centered hidden"><div id="result-label" class="eyebrow"></div><h2 id="result-title"></h2><p id="result-text"></p><div id="result-stats"></div><button id="restart" class="primary">${t('result.restart')} <span>↗</span></button></section>
      `;

    this.elements = {};
    for (const element of this.root.querySelectorAll<HTMLElement>('[id]')) this.elements[element.id] = element;
    this.stageElements = Array.from(this.root.querySelectorAll<HTMLElement>('[data-stage]'));
    this.markerViews = [];
    this.radar = (this.elements.radar as HTMLCanvasElement).getContext('2d')!;
    this.elements.start.onclick = () => this.onStart((this.elements.fast as HTMLInputElement).checked);
    this.elements.resume.onclick = () => this.onResume();
    this.elements.restart.onclick = this.elements['restart-pause'].onclick = () => this.onRestart();
    this.root.querySelectorAll<HTMLButtonElement>('[data-ship]').forEach(button => {
      button.onclick = () => this.selectShip(button.dataset.ship as PlayerShipVariant);
    });
    this.root.querySelectorAll<HTMLInputElement>('[data-audio]').forEach(input => {
      const saved = audioValues.get(input.dataset.audio!); if (saved) input.value = saved;
      input.oninput = () => this.onVolume(input.dataset.audio as 'master' | 'music' | 'sfx', Number(input.value));
    });
    this.root.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach(button => {
      button.classList.toggle('active', button.dataset.locale === getLocale());
      button.onclick = () => this.changeLocale(button.dataset.locale as Locale);
    });
    if (this.resultData) this.renderResult(this.resultData.won, this.resultData.progression);
    if (this.toastMessage) this.elements['toast-text'].textContent = this.toastMessage;
  }

  private localeButtons() { return `<button type="button" data-locale="en-US">EN</button><span>/</span><button type="button" data-locale="pt-BR">PT-BR</button>`; }

  private shipOption(variant: PlayerShipVariant, index: string, nameKey: string, roleKey: string) {
    const active = this.selectedShip === variant;
    return `<button type="button" class="ship-option ${active ? 'active' : ''}" data-ship="${variant}" aria-pressed="${active}"><span class="ship-option-head"><b>${t('menu.ship-number')} ${index}</b><i>${t(active ? 'menu.ship-selected' : 'menu.ship-available')}</i></span><strong>${t(nameKey)}</strong><span class="ship-role">${t(roleKey)}</span><small><span>${t('menu.stat-speed')} <b>115</b></span><span>${t('menu.stat-shield')} <b>120</b></span><span>${t('menu.stat-hull')} <b>100</b></span></small></button>`;
  }

  private selectShip(variant: PlayerShipVariant) {
    if (variant === this.selectedShip) return;
    this.selectedShip = variant;
    this.root.querySelectorAll<HTMLButtonElement>('[data-ship]').forEach(button => {
      const active = button.dataset.ship === variant;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      const state = button.querySelector<HTMLElement>('.ship-option-head i');
      if (state) state.textContent = t(active ? 'menu.ship-selected' : 'menu.ship-available');
    });
    this.elements['selected-ship-name'].textContent = t(variant === 'lego' ? 'menu.lego-name' : 'menu.classic-name');
    this.elements['selected-ship-role'].textContent = t(variant === 'lego' ? 'menu.lego-role' : 'menu.classic-role');
    this.elements['selected-ship-label'].textContent = t('menu.ship-selected');
    this.onShipSelect(variant);
  }

  private changeLocale(locale: Locale) {
    if (locale === getLocale()) return;
    setLocale(locale); this.render(); this.show(this.currentScreen);
  }

  show(screen: Screen) {
    this.currentScreen = screen;
    for (const id of ['menu', 'intro', 'hud', 'pause', 'result']) this.elements[id].classList.add('hidden');
    if (screen === 'playing') this.elements.hud.classList.remove('hidden');
    else if (screen === 'victory' || screen === 'defeat') this.elements.result.classList.remove('hidden');
    else this.elements[screen].classList.remove('hidden');
    this.root.classList.toggle('in-flight', screen === 'playing');
    this.root.classList.toggle('is-menu', screen === 'menu');
  }

  countdown(value: string) { this.countdownValue = value; this.elements.countdown.textContent = value; }
  toast(message: string) { this.toastMessage = message; this.elements['toast-text'].textContent = message; this.toastTime = 6; }
  hit(heavy = false) { this.hitTime = heavy ? 0.2 : 0.13; this.impactTime = Math.max(this.impactTime, heavy ? 0.2 : 0.1); this.elements.hitmarker.classList.toggle('heavy', heavy); }
  threat() { this.threatTime = Math.max(this.threatTime, 0.5); }
  solarWarning(heat: number) { const warning = this.elements['solar-warning']; warning.classList.toggle('visible', heat > 0); warning.style.setProperty('--solar-heat', heat.toFixed(3)); }
  shieldVisibility(visible: boolean) { this.shieldVisible = visible; this.elements['shield-visibility'].textContent = t(visible ? 'hud.shield-visible' : 'hud.shield-hidden'); }
  damage() { this.damageTime = 0.35; }

  result(won: boolean, progression: ProgressionManager) {
    this.resultData = { won, progression }; this.show(won ? 'victory' : 'defeat'); this.renderResult(won, progression);
  }

  private renderResult(won: boolean, progression: ProgressionManager) {
    this.elements['result-label'].textContent = t(won ? 'result.victory.label' : 'result.defeat.label');
    this.elements['result-title'].textContent = t(won ? 'result.victory.title' : 'result.defeat.title');
    this.elements['result-text'].textContent = t(won ? 'result.victory.text' : 'result.defeat.text');
    this.elements['result-stats'].textContent = t('result.stats', { kills: progression.kills, score: formatScore(progression.score) });
  }

  update(dt: number, player: PlayerShip, progression: ProgressionManager, targets: Target[], selected: Target | undefined, scene: Scene, plasmaCd: number, burstCd: number, bossObjective?: string) {
    const e = this.elements;
    const text = (id: string, value: string) => { if (e[id].textContent !== value) e[id].textContent = value; };
    text('stage-title', stageTitle(progression.stage)); text('objective', stageObjective(progression.stage));
    text('hud-ship-name', t(player.variant === 'lego' ? 'menu.lego-name' : 'menu.classic-name'));
    text('mission-time', `${Math.floor(progression.elapsed / 60).toString().padStart(2, '0')}:${Math.floor(progression.elapsed % 60).toString().padStart(2, '0')}${progression.fast ? ' · 4×' : ''}`);
    text('kills', progression.kills.toString().padStart(2, '0')); text('score', progression.score.toString().padStart(5, '0'));
    text('speed', Math.round(player.speed).toString().padStart(3, '0')); text('shield-value', Math.ceil(player.health.shield).toString()); text('hull-value', Math.ceil(player.health.hull).toString());
    e.speed.classList.toggle('boosting', player.boosting); e.speed.classList.toggle('accelerating', !player.boosting && player.speedTrend > 2.5); e.speed.classList.toggle('braking', !player.boosting && player.speedTrend < -2.5);
    e['shield-bar'].style.width = `${player.health.shield / CONFIG.player.shield * 100}%`; e['hull-bar'].style.width = `${player.health.hull}%`; e['boost-bar'].style.width = `${player.boost}%`;
    text('dodge-status', player.dodgeCooldown > 0 ? t('hud.dodge-cooldown', { seconds: player.dodgeCooldown.toFixed(1) }) : t('hud.dodge-ready'));
    e['plasma-weapon'].classList.toggle('locked', progression.weaponLevel < 2); e['burst-weapon'].classList.toggle('locked', progression.weaponLevel < 3);
    text('plasma-status', progression.weaponLevel < 2 ? '◇' : plasmaCd > 0 ? plasmaCd.toFixed(1) : '●'); text('burst-status', progression.weaponLevel < 3 ? '◇' : burstCd > 0 ? `${Math.ceil(burstCd)}s` : '●');
    for (const el of this.stageElements) el.classList.toggle('active', Number(el.dataset.stage) <= progression.stage);
    e['boss-info'].classList.toggle('hidden', !bossObjective); text('boss-objective', bossObjective ?? '');
    text('target-info', selected ? `${selected.name.toUpperCase()}  /  ${Math.round(Vector3.Distance(player.position, selected.position))} m` : `${t('hud.no-target')} · ${t('hud.lock')}`);
    this.toastTime -= dt; this.hitTime -= dt; this.impactTime -= dt; this.threatTime -= dt; this.damageTime -= dt;
    e.toast.classList.toggle('visible', this.toastTime > 0); e.hitmarker.style.opacity = this.hitTime > 0 ? '1' : '0'; e['impact-flash'].style.opacity = this.impactTime > 0 ? `${Math.min(0.3, this.impactTime * 1.8)}` : '0'; e['threat-flash'].style.opacity = this.threatTime > 0 ? `${Math.min(0.55, this.threatTime * 2.2)}` : '0'; e['threat-warning'].classList.toggle('visible', this.threatTime > 0); e['damage-flash'].style.opacity = this.damageTime > 0 ? '1' : '0';
    this.drawRadar(player, targets); text('contacts', t('hud.contacts', { count: targets.length })); this.drawMarkers(scene, player, targets, selected);
  }

  aim(x: number, y: number) { this.elements['aim-cursor'].style.left = `${(x + 1) * 50}%`; this.elements['aim-cursor'].style.top = `${(y + 1) * 50}%`; }
  debugInfo(value: string) { this.elements.debug.classList.toggle('hidden', !this.debug); if (this.debug) this.elements.debug.textContent = value; }

  private drawMarkers(scene: Scene, player: PlayerShip, targets: Target[], selected?: Target) {
    const engine = scene.getEngine(), camera = scene.activeCamera!; const width = engine.getRenderWidth(), height = engine.getRenderHeight(); let index = 0; let selectedVisible = false;
    for (const target of targets) {
      const delta = target.position.subtract(camera.position); if (Vector3.Dot(delta, camera.getForwardRay().direction) <= 0) continue;
      const point = Vector3.Project(target.position, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(width, height)); const x = point.x / width * 100, y = point.y / height * 100;
      if (x < 2 || x > 98 || y < 8 || y > 88) continue; const active = target.id === selected?.id; if (active) selectedVisible = true;
      const marker = this.markerViews[index] ?? this.createMarker(); index++;
      const targetName = target.name.toLowerCase();
      const kind = target.id >= 10000 ? 'boss' : targetName.includes('elite') ? 'elite' : targetName.includes('assault') || targetName.includes('assalto') ? 'assault' : 'scout';
      marker.root.dataset.kind = kind;
      marker.root.classList.toggle('selected', active); marker.root.style.left = `${x}%`; marker.root.style.top = `${y}%`; marker.root.hidden = false;
      marker.label.textContent = active ? `${Math.round(Vector3.Distance(player.position, target.position))} m` : ''; marker.label.hidden = !active;
    }
    for (; index < this.markerViews.length; index++) this.markerViews[index].root.hidden = true;
    const arrow = this.elements['target-arrow']; arrow.classList.toggle('hidden', !selected || selectedVisible);
    if (selected && !selectedVisible) { const direction = selected.position.subtract(player.position).normalize(); const x = Vector3.Dot(direction, player.right), y = -Vector3.Dot(direction, player.up); const angle = Math.atan2(y, x); arrow.style.left = `${50 + Math.cos(angle) * 37}%`; arrow.style.top = `${46 + Math.sin(angle) * 30}%`; arrow.style.transform = `rotate(${angle + Math.PI / 2}rad)`; }
  }

  private createMarker(): MarkerView {
    const root = document.createElement('div'); root.className = 'target-marker';
    const icon = document.createElement('i'); root.append(icon);
    const label = document.createElement('span'); root.append(label);
    this.elements.markers.append(root); const marker = { root, label }; this.markerViews.push(marker); return marker;
  }

  private drawRadar(player: PlayerShip, targets: Target[]) {
    const ctx = this.radar; ctx.clearRect(0, 0, 140, 140); ctx.strokeStyle = '#6da7aa44'; ctx.lineWidth = 1;
    for (const radius of [28, 57]) { ctx.beginPath(); ctx.arc(70, 70, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(70, 10); ctx.lineTo(70, 130); ctx.moveTo(10, 70); ctx.lineTo(130, 70); ctx.stroke(); ctx.fillStyle = '#bcefed'; ctx.beginPath(); ctx.moveTo(70, 64); ctx.lineTo(66, 74); ctx.lineTo(74, 74); ctx.fill();
    for (const target of targets) { const d = target.position.subtract(player.position); const x = Vector3.Dot(d, player.right) / 14, y = -Vector3.Dot(d, player.forward) / 14; const factor = Math.min(1, 55 / Math.max(1, Math.hypot(x, y))); const name = target.name.toLowerCase(); ctx.fillStyle = target.id >= 10000 ? '#d6a3ff' : name.includes('elite') ? '#ffd37d' : name.includes('assault') || name.includes('assalto') ? '#ffb078' : '#f09d84'; ctx.fillRect(68 + x * factor, 68 + y * factor, 4, 4); }
  }
}
