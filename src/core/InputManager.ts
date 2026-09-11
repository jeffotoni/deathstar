export class InputManager {
  keys = new Set<string>();
  pressed = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  fire = false;
  secondary = false;
  enabled = false;
  onPause = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.code === 'Escape' && !e.repeat) this.onPause();
      if (!this.enabled) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    // Babylon prevents pointerdown's default action, suppressing legacy mouse
    // events during a drag. Use pointer events for both steering and weapons.
    canvas.addEventListener('pointermove', (e) => {
      const bounds = canvas.getBoundingClientRect();
      this.mouseX = Math.max(-1, Math.min(1, (e.clientX - bounds.left) / bounds.width * 2 - 1));
      this.mouseY = Math.max(-1, Math.min(1, (e.clientY - bounds.top) / bounds.height * 2 - 1));
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.secondary = true;
    });
    window.addEventListener('pointerup', (e) => {
      this.fire = (e.buttons & 1) !== 0;
      this.secondary = (e.buttons & 2) !== 0;
    });
    // Releasing one button of a multi-button pointer emits pointermove.
    window.addEventListener('pointermove', (e) => {
      if (!(e.buttons & 1)) this.fire = false;
      if (!(e.buttons & 2)) this.secondary = false;
      if (this.enabled && e.target === canvas) {
        this.fire = (e.buttons & 1) !== 0;
        this.secondary = (e.buttons & 2) !== 0;
      }
    });
    window.addEventListener('pointercancel', () => this.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { if (this.enabled) this.onPause(); this.clear(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.enabled) this.onPause(); });
  }
  down(code: string) { return this.keys.has(code); }
  consume(code: string) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }
  clear() { this.keys.clear(); this.pressed.clear(); this.fire = false; this.secondary = false; this.mouseX = 0; this.mouseY = 0; }
  setEnabled(enabled: boolean) { this.enabled = enabled; this.clear(); this.canvas.style.cursor = enabled ? 'none' : 'default'; }
}
