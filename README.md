# VÉU / Echoes of Exile

[Português (Brasil)](README-PT_BR.md)

VÉU is a desktop 3D space combat prototype built with Babylon.js, TypeScript, and Vite. Ships, environment, universe, and audio are original and procedural.

## Story

One thousand years before the age of the known stellar empires, the Order of the Threshold erased its own routes and disappeared beyond the mapped systems. Kael, its last exiled navigator, follows a faint signal into the Náris Belt, where an unnamed military force is guarding the only passage home.

He arrives in the Andorinha, a rare and highly agile interceptor. What begins as a quiet reconnaissance flight becomes a battle against escalating fighter squadrons and the Obelisk, a colossal capital ship emerging from the Veil. To survive, Kael must master the ship, unlock its weapons, and dismantle the Obelisk subsystem by subsystem.

VÉU is an original space-opera universe. It does not use protected ships, characters, logos, music, or sound effects from existing franchises.

## Run locally

Requires Node.js 22.12+ or Node.js 24.

```sh
cd /Users/jeffotoni/gitprojetos/games/death-star
npm install
npm run dev
```

Open `http://127.0.0.1:5173` and click **Start Mission**. Audio starts after the first click. To force WebGL2 and enable diagnostics, open `http://127.0.0.1:5173/?renderer=webgl&debug`.

The **Test Flight** option advances mission time at 4× speed while keeping movement, weapons, damage, and cooldowns unchanged.

### Deploy with GitHub Pages

The repository includes `.github/workflows/deploy.yml`. In GitHub, go to `Settings → Pages`, select `GitHub Actions` as the source, and save. Every push to `main` builds the Vite app and publishes `dist/` at [https://jeffotoni.github.io/deathstar/](https://jeffotoni.github.io/deathstar/). The workflow requests only the read, Pages write, and deployment identity permissions required by GitHub Pages.

### Stop the local server

If the server is running in the current terminal, press `Ctrl+C`.

To find and stop any process listening on port `5173`:

```sh
lsof -nP -iTCP:5173 -sTCP:LISTEN
kill "$(lsof -tiTCP:5173 -sTCP:LISTEN)"
```

To stop a known process by PID:

```sh
kill 99922
```

Replace `99922` with the PID returned by `lsof`.

## Controls

| Control | Action |
| --- | --- |
| Mouse | Steer; distance from center controls turn intensity |
| W / S | Increase / reduce cruise speed |
| A / D | Roll |
| Q / E | Strafe |
| Left mouse button | Dual laser pulse |
| Right mouse button | Plasma cannon after unlock |
| R | Energy rupture after unlock |
| Left Shift | Boost; recharges when released |
| Space | Dodge with brief invulnerability; 3-second cooldown |
| F | Select the most aligned contact |
| Tab | Cycle contacts and capital-ship subsystems |
| Esc | Pause / resume |
| M | Mute / unmute audio |
| F3 | Show / hide diagnostics |

Return the mouse to the center to fly straight. Pointer lock is not used. The mission pauses when the window loses focus. Plasma deals area damage; energy rupture is a fast, high-impact torpedo with an 8-second cooldown.

## Mission

1. Reconnaissance: learn to fly and intercept scouts.
2. Echoes in the Belt: face larger patrols and assault fighters.
3. Breakthrough Line: unlock the plasma cannon.
4. The Siege: face elite fighters and unlock energy rupture.
5. Silence in the Veil: reinforcements thin out as the capital ship approaches.
6. Obelisk: destroy defense turrets, shield generators, ion engines, and the reactor. A chain reaction precedes mission completion.

The shield regenerates after five seconds without damage. Destroying a fighter restores seven shield points; hull integrity does not regenerate. Asteroids and the capital ship deal collision damage without instant kills.

## Project structure

The main modules are `core` (engine, loop, input, assets), `player` (flight and health), `enemies` (AI and formations), `weapons` (pooled projectiles and collision), `world` (space environment), `effects`, `audio`, `progression`, `boss`, and `ui`. Gameplay constants live in `src/config.ts`; combat and progression tests are in `tests/`; the browser smoke test is in `scripts/`.

`AssetManager.ship()` creates temporary primitive models. `AssetManager.loadModel(url, parent)` loads glTF/GLB for future visual replacement. Models face local `+Z`; no external model is required to play.

WebGPU is attempted first, with automatic WebGL2 fallback. Use `?renderer=webgl` to force WebGL2 and `?debug` to show FPS, position, speed, active enemies, projectiles, active meshes, and mission time.

## Verification

```sh
npm test
npm run build
npm run dev
node scripts/browser-smoke.mjs
```

The smoke test requires the local server and Chrome. It checks startup, acceleration, boost, steering while firing, real kills, pause, resume, restart, and browser errors. Screenshots are written to `/private/tmp/veu-menu.png` and `/private/tmp/veu-flight.png`.

Current validation: six logic tests pass, including enemy `+Z` orientation, approach, and attacks. Chrome/WebGL2 validation confirmed firing, steering while firing, three kills with score, pause, resume, restart, and no browser runtime errors. The production build passes. WebGPU and a complete browser playthrough of the capital-ship battle have not been validated in this environment.

To serve the production build:

```sh
npm run build
npm run preview
```

## Contributing

Contributions are welcome. This is a public repository, so contributors should work from a fork. Do not push feature branches directly to the official repository. Keep the game focused on responsive arcade flight, readable combat feedback, browser performance, and original visual and audio design.

Fork `https://github.com/jeffotoni/deathstar` on GitHub, then clone your fork and register the official repository as `upstream`:

```sh
git clone https://github.com/YOUR_GITHUB_USERNAME/deathstar.git
cd deathstar
git remote add upstream https://github.com/jeffotoni/deathstar.git
git remote -v
git switch -c feat/short-description
```

Before starting future work, update your local `main` from the official repository:

```sh
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch -c feat/short-description
```

Make focused changes, then run the relevant checks:

```sh
npm test
npm run build
```

Use Conventional Commits for commit messages. The type describes the change and the scope identifies the affected area:

```text
feat(game): add capital ship encounter
fix(input): preserve firing while steering
test(combat): cover projectile splash damage
docs(readme): document local server commands
refactor(weapons): simplify projectile pooling
chore(deps): update Babylon.js packages
```

Commit and push the branch:

```sh
git add .
git commit -m "feat(game): add capital ship encounter"
git push -u origin feat/short-description
```

Open the pull request from your fork to the official repository. With GitHub CLI:

```sh
gh pr create \
  --repo jeffotoni/deathstar \
  --base main \
  --head YOUR_GITHUB_USERNAME:feat/short-description \
  --title "feat(game): add capital ship encounter" \
  --body "Describe the player-facing result and the validation performed."
```

Without GitHub CLI, open the compare page shown by GitHub after the push and select `jeffotoni/deathstar:main` as the base branch.

A good PR should explain the player-facing result, list the main files or systems changed, include the commands used for validation, and attach a screenshot or short recording when the change affects visuals or gameplay. Keep unrelated refactors out of the same PR. Address review feedback with additional commits pushed to the same fork branch.

### Security and repository settings

Maintainers should protect the official `main` branch in GitHub repository settings. Recommended settings are: require pull requests, require at least one approval, require passing status checks, require conversation resolution, dismiss stale approvals after new changes, and disable force pushes and branch deletion.

Keep Actions permissions read-only by default and require approval before workflows from fork pull requests run when appropriate. Never expose repository secrets to untrusted fork code. Do not commit passwords, API keys, certificates, `.env` files, generated build output, or personal data. Report suspected vulnerabilities privately to the repository owner instead of opening a public issue with exploit details.

See [SECURITY.md](SECURITY.md) for the vulnerability reporting policy.

## Prototype status

The prototype has one complete mission with victory, defeat, and restart states. Ships and audio are functional procedural placeholders. Artistic textures, LODs, touch controls, and gamepad controls are not implemented yet. The main bundle is approximately 6.3 MB, or 1.38 MB gzip; loading optimization remains pending.

The target is 60 FPS on a reasonable desktop. WebGL2 is the reference diagnostic path. Google Fonts have local fallbacks.

Technical references: [Babylon.js WebGPU initialization](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUBreakingChanges.md) and [Babylon.js model loading](https://doc.babylonjs.com/features/featuresDeepDive/animation/animatedCharacter/).
