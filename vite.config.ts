import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  // Local development stays at http://127.0.0.1:5173.
  // GitHub Pages serves this project under /deathstar/.
  base: command === 'build' ? '/deathstar/' : '/',
}));
