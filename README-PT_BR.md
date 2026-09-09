# VÉU — Ecos do Exílio

[English](README.md)

VÉU é um protótipo de combate espacial 3D para desktop, feito com Babylon.js, TypeScript e Vite. As naves, o cenário, o universo e o áudio são originais e gerados proceduralmente.

## História

Mil anos antes da era dos impérios estelares conhecidos, a Ordem do Limiar apagou suas próprias rotas e desapareceu além dos sistemas mapeados. Kael, seu último navegador exilado, segue um sinal fraco até o cinturão de Náris, onde uma força militar sem nome guarda a única passagem de volta para casa.

Ele chega na Andorinha, um interceptador raro e extremamente ágil. O que começa como um voo de reconhecimento tranquilo se transforma em uma batalha contra esquadrões de caças e contra o Obelisco, uma nave capital colossal que emerge do Véu. Para sobreviver, Kael precisa dominar a nave, desbloquear suas armas e desmontar o Obelisco subsistema por subsistema.

VÉU é um universo de space opera original. O jogo não utiliza naves, personagens, logos, músicas ou efeitos sonoros protegidos de franquias existentes.

## Executar localmente

Requer Node.js 22.12+ ou Node.js 24.

```sh
cd /Users/jeffotoni/gitprojetos/games/death-star
npm install
npm run dev
```

Abra `http://127.0.0.1:5173` e clique em **Iniciar missão**. O áudio começa após o primeiro clique. Para forçar WebGL2 e ativar o diagnóstico, abra `http://127.0.0.1:5173/?renderer=webgl&debug`.

A opção **Voo de teste** avança o tempo da missão em 4×, mantendo movimento, armas, dano e cooldowns normais.

### Derrubar o servidor local

Se o servidor estiver rodando no terminal atual, pressione `Ctrl+C`.

Para localizar e encerrar qualquer processo escutando na porta `5173`:

```sh
lsof -nP -iTCP:5173 -sTCP:LISTEN
kill "$(lsof -tiTCP:5173 -sTCP:LISTEN)"
```

Para encerrar um processo conhecido pelo PID:

```sh
kill 99922
```

Substitua `99922` pelo PID retornado pelo comando `lsof`.

## Controles

| Controle | Ação |
| --- | --- |
| Mouse | Direção; a distância do centro controla a intensidade da curva |
| W / S | Aumentar / reduzir a velocidade de cruzeiro |
| A / D | Rolagem |
| Q / E | Deslocamento lateral |
| Botão esquerdo | Pulso laser duplo |
| Botão direito | Canhão de plasma após desbloqueio |
| R | Ruptura energética após desbloqueio |
| Shift esquerdo | Boost; recarrega ao soltar |
| Espaço | Esquiva com breve invulnerabilidade; recarga de 3 segundos |
| F | Selecionar o contato mais alinhado |
| Tab | Alternar contatos e subsistemas da nave capital |
| Esc | Pausar / continuar |
| M | Silenciar / reativar áudio |
| F3 | Mostrar / ocultar diagnóstico |

Retorne o mouse ao centro para seguir em frente. O jogo não usa pointer lock. A missão pausa quando a janela perde o foco. O plasma causa dano em área; a ruptura energética é um torpedo rápido de grande impacto, com recarga de 8 segundos.

## Missão

1. Reconhecimento: aprender a pilotar e interceptar batedores.
2. Ecos no cinturão: enfrentar patrulhas maiores e caças de assalto.
3. Linha de ruptura: desbloquear o canhão de plasma.
4. O cerco: enfrentar caças de elite e desbloquear a ruptura energética.
5. Silêncio no Véu: os reforços diminuem enquanto a nave capital se aproxima.
6. Obelisco: destruir torres de defesa, geradores de escudo, motores de íons e o reator. Uma reação em cadeia antecede a conclusão da missão.

O escudo regenera após cinco segundos sem receber dano. Destruir um caça recupera sete pontos de escudo; a integridade não regenera. Asteroides e a nave capital causam dano de colisão sem morte instantânea.

## Estrutura do projeto

Os principais módulos são `core` (motor, loop, input e assets), `player` (pilotagem e vida), `enemies` (IA e formações), `weapons` (projéteis e colisão), `world` (ambiente espacial), `effects`, `audio`, `progression`, `boss` e `ui`. As constantes de gameplay ficam em `src/config.ts`; os testes estão em `tests/`; o smoke test de navegador está em `scripts/`.

`AssetManager.ship()` cria modelos temporários usando primitivas. `AssetManager.loadModel(url, parent)` carrega glTF/GLB para futura substituição visual. Os modelos usam eixo frontal local `+Z`; nenhum modelo externo é necessário para jogar.

WebGPU é tentado primeiro, com fallback automático para WebGL2. Use `?renderer=webgl` para forçar WebGL2 e `?debug` para mostrar FPS, posição, velocidade, inimigos ativos, projéteis, meshes ativos e tempo da missão.

## Verificação

```sh
npm test
npm run build
npm run dev
node scripts/browser-smoke.mjs
```

O smoke test requer o servidor local e o Chrome. Ele verifica inicialização, aceleração, boost, direção enquanto dispara, abates reais, pausa, retomada, reinício e erros do navegador. As capturas são salvas em `/private/tmp/veu-menu.png` e `/private/tmp/veu-flight.png`.

A validação atual possui seis testes de lógica passando, incluindo orientação `+Z`, aproximação e ataque dos inimigos. A validação em Chrome/WebGL2 confirmou disparos, direção enquanto dispara, três abates com pontuação, pausa, retomada, reinício e ausência de erros de execução no navegador. O build de produção passou. WebGPU e uma partida completa da batalha contra a nave capital ainda não foram validados neste ambiente.

Para servir o build de produção:

```sh
npm run build
npm run preview
```

## Contribuindo

Contribuições são bem-vindas. Como este é um repositório público, os contribuidores devem trabalhar a partir de um fork. Não envie branches de feature diretamente para o repositório oficial. Mantenha o foco em pilotagem arcade responsiva, feedback de combate legível, performance no navegador e design visual e sonoro original.

Faça um fork de `https://github.com/jeffotoni/deathstar` no GitHub, clone o seu fork e registre o repositório oficial como `upstream`:

```sh
git clone https://github.com/SEU_USUARIO_GITHUB/deathstar.git
cd deathstar
git remote add upstream https://github.com/jeffotoni/deathstar.git
git remote -v
git switch -c feat/descricao-curta
```

Antes de iniciar trabalhos futuros, atualize a sua `main` a partir do repositório oficial:

```sh
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main
git switch -c feat/descricao-curta
```

Faça mudanças focadas e execute as verificações relevantes:

```sh
npm test
npm run build
```

Use Conventional Commits nas mensagens. O tipo descreve a mudança e o escopo identifica a área afetada:

```text
feat(game): add capital ship encounter
fix(input): preserve firing while steering
test(combat): cover projectile splash damage
docs(readme): document local server commands
refactor(weapons): simplify projectile pooling
chore(deps): update Babylon.js packages
```

Faça o commit e envie a branch:

```sh
git add .
git commit -m "feat(game): add capital ship encounter"
git push -u origin feat/descricao-curta
```

Abra o pull request a partir do seu fork para o repositório oficial. Com o GitHub CLI:

```sh
gh pr create \
  --repo jeffotoni/deathstar \
  --base main \
  --head SEU_USUARIO_GITHUB:feat/descricao-curta \
  --title "feat(game): add capital ship encounter" \
  --body "Describe the player-facing result and the validation performed."
```

Sem o GitHub CLI, abra a página de comparação mostrada pelo GitHub depois do push e selecione `jeffotoni/deathstar:main` como branch base.

Um bom PR deve explicar o resultado percebido pelo jogador, listar os principais arquivos ou sistemas alterados, informar os comandos usados na validação e incluir uma captura de tela ou gravação curta quando a mudança afetar visual ou gameplay. Mantenha refatorações sem relação fora do mesmo PR. Responda às revisões com commits adicionais enviados para a mesma branch do seu fork.

### Segurança e configurações do repositório

Os mantenedores devem proteger a branch oficial `main` nas configurações do repositório no GitHub. Recomenda-se exigir pull request, pelo menos uma aprovação, verificações de status passando, resolução das conversas, descarte de aprovações antigas após novas alterações e bloqueio de force push e exclusão da branch.

Mantenha as permissões do Actions como somente leitura por padrão e exija aprovação antes de executar workflows de pull requests vindos de forks quando apropriado. Nunca exponha secrets do repositório a código não confiável de forks. Não faça commit de senhas, chaves de API, certificados, arquivos `.env`, build gerado ou dados pessoais. Relate vulnerabilidades suspeitas em privado ao proprietário do repositório, em vez de abrir uma issue pública com detalhes de exploração.

Consulte o [SECURITY.md](SECURITY.md) para ver a política de denúncia de vulnerabilidades.

## Estado do protótipo

O protótipo possui uma missão completa, com vitória, derrota e reinício. As naves e o áudio são placeholders procedurais funcionais. Texturas artísticas, LODs, controles touch e gamepad ainda não foram implementados. O bundle principal tem aproximadamente 6,3 MB, ou 1,38 MB gzip; a otimização do carregamento permanece pendente.

A meta é 60 FPS em um desktop razoável. WebGL2 é o caminho de referência para diagnóstico. As fontes têm fallback local.

Referências técnicas: [inicialização WebGPU do Babylon.js](https://github.com/BabylonJS/Documentation/blob/master/content/setup/support/webGPU/webGPUBreakingChanges.md) e [carregamento de modelos no Babylon.js](https://doc.babylonjs.com/features/featuresDeepDive/animation/animatedCharacter/).
