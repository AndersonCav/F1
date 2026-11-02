# Checklist Operacional — Primeiro Deploy Remoto no GitHub Pages

Este documento estabelece o protocolo formal de homologação e validação em produção para o primeiro deploy remoto da aplicação **Portal Formula 1** no GitHub Pages via GitHub Actions.

> [!IMPORTANT]
> **Regra de Homologação:** Nenhuma etapa deste procedimento deve ser executada de forma autônoma. Todo push, commit, merge ou acionamento remoto exige autorização prévia e explícita do usuário.

---

## 1. Verificações Pré-Push (Ambiente Local)

Antes de realizar o `git push origin main` autorizado, execute rigorosamente a lista de checagens abaixo:

- [ ] **1.1. Inspeção da Árvore Git (`git status`)**
  - Confirmar branch ativa: `main` (estritamente).
  - Confirmar ausência de branches paralelas ou divergentes.
  - Verificar que arquivos temporários (`.live-server/`, `node_modules/`, `build-metadata/`, `dist/`) permanecem estritamente ignorados pelo `.gitignore`.

- [ ] **1.2. Confirmação do Conteúdo do Commit**
  - Revisar o diff das alterações (`git diff`).
  - Assegurar que nenhum segredo, chave de API privada, token pessoal ou credencial foi introduzido.
  - Verificar integridade de whitespace (`npm run check:whitespace`).

- [ ] **1.3. Integridade do Pacote de Produção (`dist/`)**
  - Executar compilação limpa: `npm run build`.
  - Confirmar contagem exata de arquivos: **exatamente 27 arquivos**.
  - Executar verificação de exclusão e integridade: `npm run check:dist`.
  - Garantir ausência total de arquivos de desenvolvimento (`tests/`, `scripts/`, `docs/`, `package.json`, etc.).
  - Executar auditoria de orçamento de tamanho: `npm run check:budget` (limite global de 250 KB; total atual ~184,30 KB).

- [ ] **1.4. Integridade do Service Worker e Precache Offline**
  - Confirmar identificador de cache no `sw.js`: `const CACHE_VERSION = 'v5'`.
  - Confirmar contagem de recursos pré-cacheados: **exatamente 25 itens** em `ASSETS_TO_CACHE`.
  - Validar resolução local de todos os 25 recursos via servidor isolado (`node --test tests/dist-integrity.test.js`).

- [ ] **1.5. Execução Integral dos Quality Gates Locais**
  - Sintaxe JavaScript: `npm run check:syntax` (100% de aprovação em todos os 49 arquivos JS/MJS).
  - Content Security Policy: `npm run check:csp` (política idêntica e sem hashes divergentes nas 6 páginas).
  - Regressão nativa do Node: `npm test` (231 testes determinísticos aprovados).
  - Cenários de navegador Chrome: `npm run test:browser` (35 cenários aprovados via Playwright).

---

## 2. Procedimento de Push Autorizado

Somente após a autorização expressa do usuário, execute no terminal:

```bash
git add .gitignore package.json .github/workflows/deploy.yml scripts/ tests/ docs/
git commit -m "Harden deployment concurrency and add revision freshness guard (Phase 3.1)"
git push origin main
```

---

## 3. Verificações Pós-Push (Esteira do GitHub Actions)

Acompanhe a execução do workflow **Deploy to GitHub Pages** na interface do GitHub Actions (`https://github.com/AndersonCav/F1/actions`):

- [ ] **3.1. Job `validate` (Quality Gates & Regression Suite)**
  - Confirmação de execução bem-sucedida em `ubuntu-latest`.
  - Passos aprovados: Sintaxe, CSP, Git Whitespace, 231 testes nativos e 35 testes Playwright Chromium.

- [ ] **3.2. Job `build-and-verify` (Production Build & Artifact Verification)**
  - Compilação do artefato de produção (`npm run build`).
  - Verificação de dist (`npm run check:dist`) e budgets (`npm run check:budget`).
  - Testes em servidor isolado servindo apenas `dist/` sob `/F1/`.
  - Registro de metadados (`scripts/record-build-metadata.mjs`).
  - Upload dos artefatos: `production-dist` e `build-metadata`.

- [ ] **3.3. Job `deploy` (Deploy to GitHub Pages)**
  - Dependência respeitada: executou somente após a aprovação de `validate` e `build-and-verify`.
  - Download seguro dos artefatos correspondentes ao mesmo commit SHA.
  - Passo `Verify deployment revision freshness`:
    - SHA do workflow (`GITHUB_SHA`) comparado com o HEAD atual de `refs/heads/main`.
    - Saída `eligible=true` registrada em log caso as revisões coincidam.
    - Saída `eligible=false` e mensagem `DEPLOYMENT SKIPPED` caso um commit mais recente tenha sido enviado antes da publicação.
  - Deploy efetuado apenas se `eligible == 'true'`.
  - Publicação de páginas via `upload-pages-artifact` apontando estritamente para `dist/` (jamais `.`).

---

## 4. Homologação da Aplicação em Produção (Smoke Tests no GitHub Pages)

Acesse a URL publicada do GitHub Pages (ex.: `https://andersoncav.github.io/F1/`):

- [ ] **4.1. Carregamento e Rota Base**
  - A página inicial (`index.html`) carrega sem erros de console.
  - `<base href>` dinâmico aponta corretamente para `/F1/` (ou caminho base de hospedagem).

- [ ] **4.2. Navegação Primária e Páginas do Shell**
  - `drivers.html` — Carrega tabela/grid de pilotos e controles de ordenação.
  - `teams.html` — Carrega lista de construtores e histórico de pontuação.
  - `champions.html` — Carrega galeria histórica com os 35 campeões mundiais.
  - `calendar.html` — Carrega calendário da temporada com horários convertidos.
  - `404.html` — Testar rota inexistente (ex.: `/F1/rota-invalida`); confirmar mensagem temática e redirecionamento.

- [ ] **4.3. Galeria Histórica e Fotografias dos 35 Campeões**
  - Confirmar que as 35 imagens do Wikimedia Commons carregam ou utilizam o fallback local SVG (`placeholder-driver.svg`) de forma graciosa sem quebras visuais.
  - Confirmar presença de textos alternativos (`alt`), dimensões explícitas e links de atribuição de licença.

- [ ] **4.4. Integração de Dados Jolpica F1 API**
  - Confirmar requisição bem-sucedida aos endpoints esportivos.
  - Validar indicador visual de frescor dos dados e funcionamento do botão de recarga manual.

- [ ] **4.5. Responsividade em Layouts Móveis e Desktop**
  - Testar visualização em viewport móvel (320px e 390px) no DevTools.
  - Garantir ausência de rolagem horizontal desnecessária e legibilidade dos componentes.

- [ ] **4.6. Ciclo de Vida do Service Worker e PWA**
  - Inspecionar aba Application -> Service Workers no DevTools.
  - Confirmar registro do Service Worker com escopo `/F1/`.
  - Confirmar criação do cache `f1-portal:<base>:static-v5` com exatamente 25 itens.
  - Testar atualização: clientes anteriores fecham e o novo worker assume sem corromper estado.

- [ ] **4.7. Suporte e Navegação Offline**
  - No DevTools, marcar a opção `Offline` em Network.
  - Navegar entre as 5 páginas da aplicação; confirmar que todas continuam acessíveis através do shell em cache.

- [ ] **4.8. Auditoria de Segurança e CSP**
  - Abrir o Console do navegador; verificar ausência de violações de Content Security Policy (`EvalError`, scripts inline não autorizados, origens de imagens bloqueadas).

- [ ] **4.9. Rastreabilidade e Log de Execuções Obsoletas**
  - Inspecionar o log do GitHub Actions e confirmar que o commit SHA implantado corresponde com precisão ao commit publicado no GitHub Pages.
  - Caso tenha havido disparos concorrentes durante o push, verificar se a execução obsoleta registrou o aviso `::notice title=Deployment Skipped::`.

---

## 5. Procedimento de Contingência e Recuperação

Caso ocorra falha na execução remota ou na validação de produção:

1. **Identificação da Falha:**
   - Inspecionar detalhadamente o log do GitHub Actions para identificar o job (`validate`, `build-and-verify` ou `deploy`) e o passo causador do erro.
2. **Preservação de Versão:**
   - O GitHub Pages manterá automaticamente a versão publicada anterior funcional caso o pipeline falhe antes do estágio final de publicação.
3. **Proibição de Bypass:**
   - Nunca forçar deploy desativando os quality gates ou relaxando permissões de segurança.
4. **Correção Local:**
   - Reproduzir o problema no ambiente local.
   - Executar os testes determinísticos para validar a correção (`npm run check:all` e `npm run test:browser`).
5. **Revalidação:**
   - Submeter novo commit corretivo na branch `main` após autorização.
