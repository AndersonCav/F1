# Phase 4 — UX, Accessibility, SEO & Performance

## 1. Phase Status

`PHASE_4_COMPLETE_WITH_DEBT`

Implementação e validação locais concluídas em 02/11/2026, America/Sao_Paulo. As pendências são homologação pública após uma futura publicação autorizada, evidência de campo e avaliação assistiva em dispositivos reais. Nenhum commit, push, merge, deploy, workflow ou alteração de configuração do repositório foi executado.

A branch permaneceu `main`. HEAD inicial/final: `f2b3bb18ff50d648091f1a92b17df198172c2823`. Árvore inicialmente limpa, sem alterações staged. O resultado permanece integralmente unstaged para revisão.

## 2. Initial UX and Performance Audit

O [baseline documentado antes das alterações de interface](BASELINE.md) registra severidade, impacto e finalidade de cada correção. A instalação inicial passou em `npm ci`; os 243 testes existentes passaram. A produção foi aberta por Chrome e comparada ao código local. O HTML público corresponde ao HEAD inicial, conforme hash normalizado em [production-performance.json](validation/production-performance.json).

Foram capturadas as seis páginas em 320, 390, 768, 1024 e 1440 px antes e depois. O baseline inclui 30 capturas locais e 30 públicas. O resultado inclui 30 cenários locais controlados e 30 cenários contra `dist/` com provedores reais, com capturas de viewport e de página inteira; a galeria também tem imagens do meio/fim. `preview/` contém uma rodada intermediária de diagnóstico e não representa o resultado final.

Principais defeitos: contador quebrado em várias linhas, bandeiras sem dimensões, três colunas comprimindo nomes e KPIs, rótulos móveis cortados, painel de cache sobre conteúdo, vermelho de baixo contraste em texto pequeno, foco perdido na expansão, galeria anunciada inteira por aria-live, opção de poles sem dados, promessa social de tempo real e fonte duplicada via @import.

O Chrome público, sem mocks e com throttling, apresentou LCP mediano de **2.200 s**, CLS mediano de **0.322128**, FCP de **0.880 s**, bloqueio diagnóstico de **31 ms** e mediana de **348822 bytes** transferidos na janela observada. São dados de laboratório da versão pública anterior; não representam usuários reais. As três execuções e recursos estão no JSON citado. Nenhuma medição da produção foi apresentada como resultado de uma versão ainda não publicada.

## 3. Design Improvements

| Página | Alteração e propósito | Trade-off |
| --- | --- | --- |
| Início | Hero mais curto; temporada/etapa explícitas; data local, circuito e localização precedem o contador; rótulo deixa claro o horário programado. Pódio com posição e nome completo, imagens dimensionadas e intervalos honestos. Tabelas têm caption, cabeçalhos com scope, pontos alinhados e links para detalhes. | Reserva de espaço reduz CLS; estados muito curtos podem deixar espaço livre. Mapas deixam de aparecer no mobile; bandeiras permanecem decorativas quando o país já está escrito. |
| Pilotos | Duas colunas legíveis no desktop; posição e pontos visíveis, número permanente secundário; identidade verificada na borda. Busca, contagem, URL e sort se compõem. Poles desabilitadas e explicadas; URL antiga `sort=poles` normaliza para classificação. | Menos cards por linha para preservar leitura. Poles continuam sem valores, conforme a fonte. |
| Equipes | Pontos/posição correntes em destaque; pilotos participantes mantidos; vitórias e títulos históricos apenas nos detalhes com corte em 2025; menu de ordenação explicita esse corte. Temporada visível. | Dados históricos exigem abrir detalhes; nenhuma regra de identidade ou vínculo foi alterada. |
| Campeões | Retratos com proporção estável e enquadramento superior; quantidade de títulos com texto real e concordância; busca de nome com normalização de acentos, composta com filtros e URL. Renderização imediata dos dados locais. História/créditos em details/summary nativo. | Crédito requer uma expansão, acessível por teclado. Todos os 70 links de autor/licença e os 35 registros permanecem no DOM. |
| Calendário | Datas em time, fuso preservado pela função existente, cards com etapa destacada e rótulo de resultado; concluídas mantêm contraste. Link leva e move foco à próxima corrida. Foco preservado ao mudar status no horário previsto. | Agrupamento mensal e filtros adicionais não foram adicionados: o salto resolve a dificuldade de encontrar o próximo evento sem multiplicar controles. |
| 404 | Mensagem direta em português, botão de retorno confortável, noindex e resolução de assets em URLs aninhadas preservada. | Sem canonical para uma página inexistente; link `rel=home` fornece a base ao bootstrap seguro. |

A navegação preserva os cinco destinos, sidebar a partir de 1024 px e barra inferior nas larguras menores. `aria-current=page`, indicador por forma/fundo e cor, links com área mínima de 44 px, safe-area e espaço de rolagem protegem foco e conteúdo. Não foi introduzido drawer.

O feedback de dados foi movido para o fluxo do main, com timestamp real mais antigo e distinção entre cache desatualizado e API. “Atualizar” substitui “RELOAD” e fica desabilitado durante a navegação. Retry também bloqueia repetição e devolve o foco ao resultado ou ao novo botão de erro. Estados vazios são distintos de falha, temporadas não publicadas são explícitas e falhas parciais de classificação/resultados são comunicadas. Nenhuma requisição de API foi adicionada ao fluxo normal.

O CSS mantém os tokens escuros e #e10600 da marca. #ff7772 é usado onde texto vermelho precisa de contraste. Foram removidos o @import duplicado, Roboto Mono externo, seletores órfãos como countdown-timer, redefinições duplicadas de detalhes, opacidade das corridas concluídas e overrides de logos. Skeletons são estáticos; a regra de movimento reduzido permanece. Não houve framework, backend ou dependência de produção.

### Evidência comparável por página

As capturas controladas usam exatamente as mesmas fixtures de layout antes/depois, fonte remota com CSS vazio e fallback local para imagens externas. Seus números e associações são sintéticos, inclusive nomes de eventos/circuitos: não constituem evidência esportiva. Use a coluna com provedores reais para a aparência com fotos e dados publicados. Capturas integrais longas podem mostrar imagens abaixo da dobra ainda não carregadas; as capturas de viewport/meio/fim e a auditoria de fotos reais complementam essa limitação do lazy loading.

| Página | Largura | Antes, controlado | Depois, controlado | Depois, rede real |
| --- | --- | --- | --- | --- |
| `index.html` | 390 | [Original](before/local-index-390.png) | [Atualizado](after/local-index-390.png) | [Atual com provedores reais](after-live/local-index-390-viewport.png) |
| `index.html` | 768 | [Original](before/local-index-768.png) | [Atualizado](after/local-index-768.png) | [Atual com provedores reais](after-live/local-index-768-viewport.png) |
| `index.html` | 1440 | [Original](before/local-index-1440.png) | [Atualizado](after/local-index-1440.png) | [Atual com provedores reais](after-live/local-index-1440-viewport.png) |
| `drivers.html` | 390 | [Original](before/local-drivers-390.png) | [Atualizado](after/local-drivers-390.png) | [Atual com provedores reais](after-live/local-drivers-390-viewport.png) |
| `drivers.html` | 768 | [Original](before/local-drivers-768.png) | [Atualizado](after/local-drivers-768.png) | [Atual com provedores reais](after-live/local-drivers-768-viewport.png) |
| `drivers.html` | 1440 | [Original](before/local-drivers-1440.png) | [Atualizado](after/local-drivers-1440.png) | [Atual com provedores reais](after-live/local-drivers-1440-viewport.png) |
| `teams.html` | 390 | [Original](before/local-teams-390.png) | [Atualizado](after/local-teams-390.png) | [Atual com provedores reais](after-live/local-teams-390-viewport.png) |
| `teams.html` | 768 | [Original](before/local-teams-768.png) | [Atualizado](after/local-teams-768.png) | [Atual com provedores reais](after-live/local-teams-768-viewport.png) |
| `teams.html` | 1440 | [Original](before/local-teams-1440.png) | [Atualizado](after/local-teams-1440.png) | [Atual com provedores reais](after-live/local-teams-1440-viewport.png) |
| `champions.html` | 390 | [Original](before/local-champions-390.png) | [Atualizado](after/local-champions-390.png) | [Atual com provedores reais](after-live/local-champions-390-viewport.png) |
| `champions.html` | 768 | [Original](before/local-champions-768.png) | [Atualizado](after/local-champions-768.png) | [Atual com provedores reais](after-live/local-champions-768-viewport.png) |
| `champions.html` | 1440 | [Original](before/local-champions-1440.png) | [Atualizado](after/local-champions-1440.png) | [Atual com provedores reais](after-live/local-champions-1440-viewport.png) |
| `calendar.html` | 390 | [Original](before/local-calendar-390.png) | [Atualizado](after/local-calendar-390.png) | [Atual com provedores reais](after-live/local-calendar-390-viewport.png) |
| `calendar.html` | 768 | [Original](before/local-calendar-768.png) | [Atualizado](after/local-calendar-768.png) | [Atual com provedores reais](after-live/local-calendar-768-viewport.png) |
| `calendar.html` | 1440 | [Original](before/local-calendar-1440.png) | [Atualizado](after/local-calendar-1440.png) | [Atual com provedores reais](after-live/local-calendar-1440-viewport.png) |
| `404.html` | 390 | [Original](before/local-404-390.png) | [Atualizado](after/local-404-390.png) | [Atual com provedores reais](after-live/local-404-390-viewport.png) |
| `404.html` | 768 | [Original](before/local-404-768.png) | [Atualizado](after/local-404-768.png) | [Atual com provedores reais](after-live/local-404-768-viewport.png) |
| `404.html` | 1440 | [Original](before/local-404-1440.png) | [Atualizado](after/local-404-1440.png) | [Atual com provedores reais](after-live/local-404-1440-viewport.png) |

320 e 1024 px também estão nos diretórios `before/`, `after/` e `after-live/`. A [galeria real](live-images/desktop-first.png), seu [meio](live-images/desktop-middle.png), [fim](live-images/desktop-last.png) e a [folha de identidade das 35 fotos](live-images/identity-contact-sheet.png) comprovam o conteúdo visual. Os cenários de nomes longos, pontuação grande, imagem realmente abortada, busca vazia, API indisponível e recuperação são verificações controladas de navegador, e não capturas escolhidas para ocultar falhas.

## 4. Accessibility Results

- 12 auditorias axe-core **4.11.4**, integração @axe-core/playwright **4.11.0**, em seis páginas × 390/1440 px: **zero violações detectadas** nas regras WCAG 2 A/AA, 2.1 A/AA, 2.2 AA e boas práticas executadas. Piloto/equipe e um crédito de campeão foram auditados expandidos.
- O axe deixou 74 ocorrências de contraste como `incomplete` sobre fundos com gradientes/grid, contando as duas larguras. Essas ocorrências não foram omitidas: estão no [JSON completo](validation/browser-results.json). A pré-carga CSS do axe foi desabilitada porque tentava buscar a folha de fonte via connect-src; a CSP da aplicação não foi relaxada.
- Checagem complementar: **75 amostras** de cores computadas, com combinações conservadoras de paradas de gradiente e sobreposição do grid. Menor contraste textual: **4.97:1**; menor indicador necessário: **3.37:1**. Limites aplicados: 4,5:1 para texto normal, 3:1 para texto grande e indicadores. Cores, fundos, razões e seletores estão no mesmo JSON.
- Enter, Espaço e Tab verificam expansão de piloto/equipe sem recriar o botão, aria-expanded/aria-controls, fechamento de outro card, details/summary dos créditos, salto ao próximo GP, foco na mudança de status e após retry. Não há cards inteiros como botões nem links aninhados em controles.
- Busca e ordenação preservam foco nos campos, query string e estado da expansão do piloto filtrado. aria-live deixou de envolver galerias inteiras; anúncios curtos são consolidados. O contador não é uma região viva.
- Reflow em 320, 375, 390, 768, 1024 e paisagem 844×390; texto ampliado para 200% em 320 px; nenhum overflow horizontal. Isso é ampliação de texto via CSS e teste de viewport, não certificação de zoom da interface de um navegador real.
- Skip link com foco no main, foco visível e acima da barra inferior, imagens alternativas, controles nomeados, rótulos claros, cabeçalhos e captions foram validados. Inspeção visual assistida das capturas confirmou hierarquia, recortes, nomes longos e alinhamento nas seis páginas.

Não houve teste com NVDA, VoiceOver, TalkBack ou instalação de app no sistema operacional. Não é uma declaração formal de conformidade WCAG. A avaliação assistiva e de zoom real permanece como P2.

## 5. SEO Improvements

As cinco páginas indexáveis têm títulos/descrições únicos, canonical exato, og:url correspondente, metadados sociais coerentes sem tempo real, og:locale pt_BR, dimensões e texto alternativo da imagem, e Twitter summary_large_image. Todos os documentos mantêm pt-BR e um h1. A 404 tem descrição própria, `noindex,follow`, não tem canonical e não aparece no sitemap.

- [sitemap.xml](../../sitemap.xml): exatamente raiz `/F1/`, drivers.html, teams.html, champions.html e calendar.html; sem URLs de teste, desenvolvimento ou 404 e sem lastmod inventado.
- [robots.txt](../../robots.txt): permite `/F1/` e indica a URL absoluta do sitemap. Importante: robôs consultam `/robots.txt` na raiz do host. O arquivo em `/F1/robots.txt` não configura o host inteiro. Não houve modificação de outro repositório/raiz. As páginas também vinculam o sitemap, permitindo descoberta por link.
- [social-preview.png](../../assets/images/social-preview.png): PNG original 1200×630, **37.094 bytes**, portal/linhas geométricas e texto próprios. Sem foto, logotipo oficial ou arte promocional copiada. Fonte editável e gerador: [brand-source.svg](brand-source.svg), [create-brand-assets.mjs](../../scripts/create-brand-assets.mjs).
- Microdados schema.org/WebSite no início descrevem o portal e sua URL. Não foi criado Event, SearchAction ou Organization com informações ou afiliação inventadas.
- Cabeçalhos e descrições estáticos e noscript dão contexto útil sem JS. Não são resultados pré-renderizados que possam ficar desatualizados. Os dados dinâmicos continuam dependendo de JS; não houve gerador de site.

Todos os assets novos e o sitemap respondem 200 no servidor exclusivo de `dist/`. As URLs públicas novas responderam **404** na consulta final porque o deploy foi proibido. Isso está registrado em [public-availability.json](validation/public-availability.json); não foi alegada disponibilidade pública da nova arte. Essa verificação pós-publicação é P1 pendente.

## 6. Performance Before and After

Comparação da home **local**, build isolado antes/depois, Chrome **156.0.8078.80**, viewport 390×844, timezone America/Sao_Paulo, três contextos frios por versão, Service Worker bloqueado. CDP: CPU 4× mais lenta, latência 150 ms, download 200.000 B/s, upload 93.750 B/s. Janela de observação: load + 5 s. API e imagens usam as mesmas fixtures; CSS remoto de fonte é vazio. Os recursos internos continuam sendo transferidos pelo HTTP local. A máquina de trabalho é compartilhada e os valores têm variação de laboratório.

| Métrica | Antes | Depois | Observação |
| --- | ---: | ---: | --- |
| LCP, mediana | 1.480 s | 0.632 s | Laboratório controlado; não campo |
| CLS, mediana | 0.274909 | 0.015791 | Janela medida; abaixo de 0,1 no ensaio final |
| TBT diagnóstico, mediana | 14 ms | 12 ms | Soma de max(0, duração−50ms) de long tasks; não TBT calculado pelo Lighthouse |
| FCP, mediana | 0.692 s | 0.632 s | Mesmo ambiente e mocks |
| INP de campo | Não disponível | Não disponível | Sem alegação baseada em interações simuladas |
| Pacote de produção, bruto | 188.726 B (184,30 KiB) | 239.669 B (234,05 KiB) | Limite 250 KiB preservado |
| CSS total bruto | 22.081 B | 17.074 B | CSS consolidado, menos 5.007 B |
| JS total bruto, incluindo SW | 136.981 B | 143.119 B | Controles, foco e estados adicionais |
| Transferência CSS interna observada | 22.681 B | 17.674 B | ResourceTiming inclui overhead local |
| Transferência JS interna observada | 105.912 B | 109.075 B | Módulos carregados na home |
| Requisições de recursos na janela | 29 | 28 | Inclui API, imagem e favicon; não são todas críticas |
| Folhas CSS no caminho de estilo | 4 | 3 | Duas locais + fonte HTML; @import removido |
| Folhas Google Fonts | 2 | 1 | Apenas Titillium Web 400/600/700/900; monospace do sistema |
| Imagens na comparação local | Fixtures | Fixtures | Bytes externos não são uma medição representativa |
| Scores Lighthouse | Não executado | Não executado | Usado diagnóstico Chrome/CDP equivalente; nenhum score fabricado |

Fontes brutas: [antes](before/results.json), [depois](after/results.json), [produção anterior real](validation/production-performance.json). O script `node scripts/audit-phase4.mjs <rótulo>` reproduz capturas e laboratório para o estado local atual; `--production` acrescenta capturas públicas e `--live-local` usa os provedores reais nas capturas. `node scripts/measure-phase4-production.mjs` mede somente a versão pública. Reproduzir o baseline original exige o HEAD registrado, preservado no Git; não execute com rótulo `before` sobre uma versão alterada esperando obter a revisão antiga.

Aumento bruto total: **50.943 bytes**. As três artes somam **39.682 bytes**, dos quais **2.588 bytes** são ícones críticos. A imagem social não é baixada pela UI nem faz parte do precache. Os budgets de HTML 12 KiB, CSS 35 KiB, JS 200 KiB e total 250 KiB não foram aumentados. O limite de contagem do shell foi atualizado de 25 para 27 com justificativa explícita.

## 7. PWA Improvements

Manifesto: nome F1 Portal, descrição honesta, lang pt-BR, id/start_url `./index.html`, scope `./`, theme #e10600 e fundo #0c0c0f. Dois PNGs originais, 192×192 (**628 B**) e 512×512 (**1960 B**), `any maskable`, desenho dentro da área segura central. Favicon e apple-touch-icon usam o PNG local; não houve prompt de instalação.

O Chrome interpretou o manifesto sem erros e sem erros de instalabilidade em perfil persistente de teste isolado: [manifest-browser.json](validation/manifest-browser.json). O start URL e o scope foram resolvidos sob `/F1/`. Nenhum perfil pessoal foi modificado e nenhum app foi instalado no sistema operacional.

Service Worker v6: os 25 recursos existentes mais dois ícones, **27 recursos / 196.995 bytes brutos**. PNG entrou na verificação MIME. A arte social, robots, sitemap e o próprio worker permanecem fora do precache obrigatório. O build contém exatamente 32 arquivos allowlisted; verificador rejeita ausência ou arquivo extra, inclusive trocas que mantenham a contagem.

Upgrade real do v5 publicado no HEAD inicial para v6 foi testado: ícone ausente faz a nova instalação falhar atomicamente, cache v5 sobrevive, retry instala v6 em waiting, clientes antigos mantêm a versão anterior até fechar, nova ativação remove só o cache da aplicação e preserva cache de outro mount/preferências. Depois todas as seis páginas e os dois ícones funcionam offline. Upgrades históricos v13, v3 e v4 também passaram. Isolamento e CSP foram preservados.

## 8. Automated Test Results

| Comando/categoria | Resultado exato | Relação com os totais |
| --- | --- | --- |
| npm ci | Passou; 4 pacotes instalados; 0 vulnerabilidades reportadas | Dependências de desenvolvimento apenas |
| npm run check:syntax | 56 arquivos aprovados | Arquivos, não testes |
| npm run check:csp | 6 documentos sincronizados | Incluído também em testes de integridade |
| npm run check:whitespace e git diff --check | Passaram | Nenhuma alteração staged |
| npm test | **253 / 253** | Antes: 243; inclui cenários de dist e seu navegador controlado |
| npm run test:browser | **60 / 60** | Antes: 35; 4 contêineres + 56 subtestes; 25 nós novos da Fase 4 incluem seu contêiner |
| Acessibilidade axe | **12 auditorias**, 0 violações detectadas | Subconjunto dos 60 |
| Contraste computado | **1 cenário / 75 amostras** | Subconjunto dos 60; teclado/reflow também estão nos 60 |
| SEO | **8 testes** de metadados/sitemap/404/WebSite | Subconjunto dos 253; +1 PWA e +1 fontes = 10 testes nativos novos |
| npm run build / check:dist | **32 arquivos**; 27 recursos offline resolvidos | Validação também embutida no npm test |
| Produção exclusiva dist | Verificador, HTTP, Chromium/CSP, navegação, axe, ícones e offline passaram | Incluído nos dois runners; sem servir arquivos de source por acidente |
| node --test tests/service-worker.test.js | **17 / 17** | Reexecução de subconjunto dos 253; não somar |
| npm run check:budget | **234,05 / 250 KiB**, todos os limites aprovados | Sem aumento de budgets de bytes |
| npm run test:api:live | **7 / 7** | Suíte externa separada |
| npm run audit:images:live | **5 / 5**; **35 / 35 fotos reais** aprovadas | Suíte externa separada, hashes e decodificação |
| npm run test:browser:live | **7 / 7** | Seis páginas com rede real; suíte externa separada |

Os totais primários são **253 + 60 = 313 nós de teste** reportados pelos runners, incluindo seus contêineres. Categorias e reexecuções de subconjuntos não são testes adicionais. As três suítes live acrescentam 19 nós em execuções externas separadas. Logs e exit codes: [commands.json](validation/commands.json), [nativos](validation/node-tests.txt), [browser](validation/controlled-browser.txt), [SW](validation/service-worker.txt), [API real](validation/live-api.txt), [fotos reais](validation/live-images.txt), [navegação real](validation/live-browser.txt).

As respostas abortadas de algumas imagens no teste live de navegação ocorreram ao trocar páginas com imagens lazy em andamento; os probes diretos retornaram 200 e a auditoria dedicada decodificou todas as 35 fotos sem fallback. Isso não foi classificado como regressão nem como indisponibilidade do provedor.

Dados e proteções preservados byte a byte após normalização de fim de linha: histórico de campeões, metadados de piloto/construtor/circuito, snapshots históricos, api.js, data-model.js, season.js, ambos workflows e verificação de freshness/proveniência. Evidência: [preserved-contracts.json](validation/preserved-contracts.json). Os relatórios anteriores que os testes regravaram foram restaurados aos bytes da árvore inicial; os resultados atuais relevantes foram copiados para esta fase.

## 9. Files Changed

**31 arquivos rastreados modificados; 285 arquivos novos**, incluindo evidências. O inventário completo com status está em [files-changed.json](files-changed.json) e [git-status.txt](validation/git-status.txt). Nenhum arquivo de documentação, teste ou gerador entrou no artefato.

<details>
<summary>Arquivos rastreados modificados</summary>

- `404.html`
- `assets/css/styles-v7.css`
- `assets/js/calendar.js`
- `assets/js/champions.js`
- `assets/js/drivers-v10.js`
- `assets/js/main-v10.js`
- `assets/js/static-data.js`
- `assets/js/teams-v10.js`
- `assets/js/ui-utils.js`
- `calendar.html`
- `champions.html`
- `drivers.html`
- `index.html`
- `manifest.json`
- `package-lock.json`
- `package.json`
- `scripts/build.mjs`
- `scripts/check-budget.mjs`
- `scripts/verify-dist.mjs`
- `sw.js`
- `teams.html`
- `tests/browser/champion-images.browser.mjs`
- `tests/browser/champion-images.live.mjs`
- `tests/browser/phase1.browser.mjs`
- `tests/browser/phase2.browser.mjs`
- `tests/champion-images.test.js`
- `tests/dist-integrity.test.js`
- `tests/helpers/http-server.js`
- `tests/helpers/sw-harness.js`
- `tests/quality-gates.test.js`
- `tests/service-worker.test.js`

</details>

<details>
<summary>Todos os arquivos novos, incluindo capturas e logs</summary>

- `assets/images/icon-192.png`
- `assets/images/icon-512.png`
- `assets/images/social-preview.png`
- `docs/phase-4/BASELINE.md`
- `docs/phase-4/REPORT.md`
- `docs/phase-4/after-live/local-404-1024-viewport.png`
- `docs/phase-4/after-live/local-404-1024.png`
- `docs/phase-4/after-live/local-404-1440-viewport.png`
- `docs/phase-4/after-live/local-404-1440.png`
- `docs/phase-4/after-live/local-404-320-viewport.png`
- `docs/phase-4/after-live/local-404-320.png`
- `docs/phase-4/after-live/local-404-390-viewport.png`
- `docs/phase-4/after-live/local-404-390.png`
- `docs/phase-4/after-live/local-404-768-viewport.png`
- `docs/phase-4/after-live/local-404-768.png`
- `docs/phase-4/after-live/local-calendar-1024-viewport.png`
- `docs/phase-4/after-live/local-calendar-1024.png`
- `docs/phase-4/after-live/local-calendar-1440-viewport.png`
- `docs/phase-4/after-live/local-calendar-1440.png`
- `docs/phase-4/after-live/local-calendar-320-viewport.png`
- `docs/phase-4/after-live/local-calendar-320.png`
- `docs/phase-4/after-live/local-calendar-390-viewport.png`
- `docs/phase-4/after-live/local-calendar-390.png`
- `docs/phase-4/after-live/local-calendar-768-viewport.png`
- `docs/phase-4/after-live/local-calendar-768.png`
- `docs/phase-4/after-live/local-champions-1024-last.png`
- `docs/phase-4/after-live/local-champions-1024-middle.png`
- `docs/phase-4/after-live/local-champions-1024-viewport.png`
- `docs/phase-4/after-live/local-champions-1024.png`
- `docs/phase-4/after-live/local-champions-1440-last.png`
- `docs/phase-4/after-live/local-champions-1440-middle.png`
- `docs/phase-4/after-live/local-champions-1440-viewport.png`
- `docs/phase-4/after-live/local-champions-1440.png`
- `docs/phase-4/after-live/local-champions-320-last.png`
- `docs/phase-4/after-live/local-champions-320-middle.png`
- `docs/phase-4/after-live/local-champions-320-viewport.png`
- `docs/phase-4/after-live/local-champions-320.png`
- `docs/phase-4/after-live/local-champions-390-last.png`
- `docs/phase-4/after-live/local-champions-390-middle.png`
- `docs/phase-4/after-live/local-champions-390-viewport.png`
- `docs/phase-4/after-live/local-champions-390.png`
- `docs/phase-4/after-live/local-champions-768-last.png`
- `docs/phase-4/after-live/local-champions-768-middle.png`
- `docs/phase-4/after-live/local-champions-768-viewport.png`
- `docs/phase-4/after-live/local-champions-768.png`
- `docs/phase-4/after-live/local-drivers-1024-viewport.png`
- `docs/phase-4/after-live/local-drivers-1024.png`
- `docs/phase-4/after-live/local-drivers-1440-viewport.png`
- `docs/phase-4/after-live/local-drivers-1440.png`
- `docs/phase-4/after-live/local-drivers-320-viewport.png`
- `docs/phase-4/after-live/local-drivers-320.png`
- `docs/phase-4/after-live/local-drivers-390-viewport.png`
- `docs/phase-4/after-live/local-drivers-390.png`
- `docs/phase-4/after-live/local-drivers-768-viewport.png`
- `docs/phase-4/after-live/local-drivers-768.png`
- `docs/phase-4/after-live/local-index-1024-viewport.png`
- `docs/phase-4/after-live/local-index-1024.png`
- `docs/phase-4/after-live/local-index-1440-viewport.png`
- `docs/phase-4/after-live/local-index-1440.png`
- `docs/phase-4/after-live/local-index-320-viewport.png`
- `docs/phase-4/after-live/local-index-320.png`
- `docs/phase-4/after-live/local-index-390-viewport.png`
- `docs/phase-4/after-live/local-index-390.png`
- `docs/phase-4/after-live/local-index-768-viewport.png`
- `docs/phase-4/after-live/local-index-768.png`
- `docs/phase-4/after-live/local-teams-1024-viewport.png`
- `docs/phase-4/after-live/local-teams-1024.png`
- `docs/phase-4/after-live/local-teams-1440-viewport.png`
- `docs/phase-4/after-live/local-teams-1440.png`
- `docs/phase-4/after-live/local-teams-320-viewport.png`
- `docs/phase-4/after-live/local-teams-320.png`
- `docs/phase-4/after-live/local-teams-390-viewport.png`
- `docs/phase-4/after-live/local-teams-390.png`
- `docs/phase-4/after-live/local-teams-768-viewport.png`
- `docs/phase-4/after-live/local-teams-768.png`
- `docs/phase-4/after-live/results.json`
- `docs/phase-4/after/local-404-1024-viewport.png`
- `docs/phase-4/after/local-404-1024.png`
- `docs/phase-4/after/local-404-1440-viewport.png`
- `docs/phase-4/after/local-404-1440.png`
- `docs/phase-4/after/local-404-320-viewport.png`
- `docs/phase-4/after/local-404-320.png`
- `docs/phase-4/after/local-404-390-viewport.png`
- `docs/phase-4/after/local-404-390.png`
- `docs/phase-4/after/local-404-768-viewport.png`
- `docs/phase-4/after/local-404-768.png`
- `docs/phase-4/after/local-calendar-1024-viewport.png`
- `docs/phase-4/after/local-calendar-1024.png`
- `docs/phase-4/after/local-calendar-1440-viewport.png`
- `docs/phase-4/after/local-calendar-1440.png`
- `docs/phase-4/after/local-calendar-320-viewport.png`
- `docs/phase-4/after/local-calendar-320.png`
- `docs/phase-4/after/local-calendar-390-viewport.png`
- `docs/phase-4/after/local-calendar-390.png`
- `docs/phase-4/after/local-calendar-768-viewport.png`
- `docs/phase-4/after/local-calendar-768.png`
- `docs/phase-4/after/local-champions-1024-last.png`
- `docs/phase-4/after/local-champions-1024-middle.png`
- `docs/phase-4/after/local-champions-1024-viewport.png`
- `docs/phase-4/after/local-champions-1024.png`
- `docs/phase-4/after/local-champions-1440-last.png`
- `docs/phase-4/after/local-champions-1440-middle.png`
- `docs/phase-4/after/local-champions-1440-viewport.png`
- `docs/phase-4/after/local-champions-1440.png`
- `docs/phase-4/after/local-champions-320-last.png`
- `docs/phase-4/after/local-champions-320-middle.png`
- `docs/phase-4/after/local-champions-320-viewport.png`
- `docs/phase-4/after/local-champions-320.png`
- `docs/phase-4/after/local-champions-390-last.png`
- `docs/phase-4/after/local-champions-390-middle.png`
- `docs/phase-4/after/local-champions-390-viewport.png`
- `docs/phase-4/after/local-champions-390.png`
- `docs/phase-4/after/local-champions-768-last.png`
- `docs/phase-4/after/local-champions-768-middle.png`
- `docs/phase-4/after/local-champions-768-viewport.png`
- `docs/phase-4/after/local-champions-768.png`
- `docs/phase-4/after/local-drivers-1024-viewport.png`
- `docs/phase-4/after/local-drivers-1024.png`
- `docs/phase-4/after/local-drivers-1440-viewport.png`
- `docs/phase-4/after/local-drivers-1440.png`
- `docs/phase-4/after/local-drivers-320-viewport.png`
- `docs/phase-4/after/local-drivers-320.png`
- `docs/phase-4/after/local-drivers-390-viewport.png`
- `docs/phase-4/after/local-drivers-390.png`
- `docs/phase-4/after/local-drivers-768-viewport.png`
- `docs/phase-4/after/local-drivers-768.png`
- `docs/phase-4/after/local-index-1024-viewport.png`
- `docs/phase-4/after/local-index-1024.png`
- `docs/phase-4/after/local-index-1440-viewport.png`
- `docs/phase-4/after/local-index-1440.png`
- `docs/phase-4/after/local-index-320-viewport.png`
- `docs/phase-4/after/local-index-320.png`
- `docs/phase-4/after/local-index-390-viewport.png`
- `docs/phase-4/after/local-index-390.png`
- `docs/phase-4/after/local-index-768-viewport.png`
- `docs/phase-4/after/local-index-768.png`
- `docs/phase-4/after/local-teams-1024-viewport.png`
- `docs/phase-4/after/local-teams-1024.png`
- `docs/phase-4/after/local-teams-1440-viewport.png`
- `docs/phase-4/after/local-teams-1440.png`
- `docs/phase-4/after/local-teams-320-viewport.png`
- `docs/phase-4/after/local-teams-320.png`
- `docs/phase-4/after/local-teams-390-viewport.png`
- `docs/phase-4/after/local-teams-390.png`
- `docs/phase-4/after/local-teams-768-viewport.png`
- `docs/phase-4/after/local-teams-768.png`
- `docs/phase-4/after/results.json`
- `docs/phase-4/before/local-404-1024.png`
- `docs/phase-4/before/local-404-1440.png`
- `docs/phase-4/before/local-404-320.png`
- `docs/phase-4/before/local-404-390.png`
- `docs/phase-4/before/local-404-768.png`
- `docs/phase-4/before/local-calendar-1024.png`
- `docs/phase-4/before/local-calendar-1440.png`
- `docs/phase-4/before/local-calendar-320.png`
- `docs/phase-4/before/local-calendar-390.png`
- `docs/phase-4/before/local-calendar-768.png`
- `docs/phase-4/before/local-champions-1024.png`
- `docs/phase-4/before/local-champions-1440.png`
- `docs/phase-4/before/local-champions-320.png`
- `docs/phase-4/before/local-champions-390.png`
- `docs/phase-4/before/local-champions-768.png`
- `docs/phase-4/before/local-drivers-1024.png`
- `docs/phase-4/before/local-drivers-1440.png`
- `docs/phase-4/before/local-drivers-320.png`
- `docs/phase-4/before/local-drivers-390.png`
- `docs/phase-4/before/local-drivers-768.png`
- `docs/phase-4/before/local-index-1024.png`
- `docs/phase-4/before/local-index-1440.png`
- `docs/phase-4/before/local-index-320.png`
- `docs/phase-4/before/local-index-390.png`
- `docs/phase-4/before/local-index-768.png`
- `docs/phase-4/before/local-teams-1024.png`
- `docs/phase-4/before/local-teams-1440.png`
- `docs/phase-4/before/local-teams-320.png`
- `docs/phase-4/before/local-teams-390.png`
- `docs/phase-4/before/local-teams-768.png`
- `docs/phase-4/before/production-404-1024.png`
- `docs/phase-4/before/production-404-1440.png`
- `docs/phase-4/before/production-404-320.png`
- `docs/phase-4/before/production-404-390.png`
- `docs/phase-4/before/production-404-768.png`
- `docs/phase-4/before/production-calendar-1024.png`
- `docs/phase-4/before/production-calendar-1440.png`
- `docs/phase-4/before/production-calendar-320.png`
- `docs/phase-4/before/production-calendar-390.png`
- `docs/phase-4/before/production-calendar-768.png`
- `docs/phase-4/before/production-champions-1024.png`
- `docs/phase-4/before/production-champions-1440.png`
- `docs/phase-4/before/production-champions-320.png`
- `docs/phase-4/before/production-champions-390.png`
- `docs/phase-4/before/production-champions-768.png`
- `docs/phase-4/before/production-drivers-1024.png`
- `docs/phase-4/before/production-drivers-1440.png`
- `docs/phase-4/before/production-drivers-320.png`
- `docs/phase-4/before/production-drivers-390.png`
- `docs/phase-4/before/production-drivers-768.png`
- `docs/phase-4/before/production-index-1024.png`
- `docs/phase-4/before/production-index-1440.png`
- `docs/phase-4/before/production-index-320.png`
- `docs/phase-4/before/production-index-390.png`
- `docs/phase-4/before/production-index-768.png`
- `docs/phase-4/before/production-teams-1024.png`
- `docs/phase-4/before/production-teams-1440.png`
- `docs/phase-4/before/production-teams-320.png`
- `docs/phase-4/before/production-teams-390.png`
- `docs/phase-4/before/production-teams-768.png`
- `docs/phase-4/before/results.json`
- `docs/phase-4/brand-source.svg`
- `docs/phase-4/files-changed.json`
- `docs/phase-4/live-images/desktop-first.png`
- `docs/phase-4/live-images/desktop-last.png`
- `docs/phase-4/live-images/desktop-middle.png`
- `docs/phase-4/live-images/identity-contact-sheet.png`
- `docs/phase-4/live-images/mobile-first.png`
- `docs/phase-4/live-images/mobile-last.png`
- `docs/phase-4/live-images/mobile-middle.png`
- `docs/phase-4/live-images/results.json`
- `docs/phase-4/preview/local-404-1024.png`
- `docs/phase-4/preview/local-404-1440.png`
- `docs/phase-4/preview/local-404-320.png`
- `docs/phase-4/preview/local-404-390.png`
- `docs/phase-4/preview/local-404-768.png`
- `docs/phase-4/preview/local-calendar-1024.png`
- `docs/phase-4/preview/local-calendar-1440.png`
- `docs/phase-4/preview/local-calendar-320.png`
- `docs/phase-4/preview/local-calendar-390.png`
- `docs/phase-4/preview/local-calendar-768.png`
- `docs/phase-4/preview/local-champions-1024.png`
- `docs/phase-4/preview/local-champions-1440.png`
- `docs/phase-4/preview/local-champions-320.png`
- `docs/phase-4/preview/local-champions-390.png`
- `docs/phase-4/preview/local-champions-768.png`
- `docs/phase-4/preview/local-drivers-1024.png`
- `docs/phase-4/preview/local-drivers-1440.png`
- `docs/phase-4/preview/local-drivers-320.png`
- `docs/phase-4/preview/local-drivers-390.png`
- `docs/phase-4/preview/local-drivers-768.png`
- `docs/phase-4/preview/local-index-1024.png`
- `docs/phase-4/preview/local-index-1440.png`
- `docs/phase-4/preview/local-index-320.png`
- `docs/phase-4/preview/local-index-390.png`
- `docs/phase-4/preview/local-index-768.png`
- `docs/phase-4/preview/local-teams-1024.png`
- `docs/phase-4/preview/local-teams-1440.png`
- `docs/phase-4/preview/local-teams-320.png`
- `docs/phase-4/preview/local-teams-390.png`
- `docs/phase-4/preview/local-teams-768.png`
- `docs/phase-4/preview/results.json`
- `docs/phase-4/validation/baseline-node-tests.txt`
- `docs/phase-4/validation/browser-results.json`
- `docs/phase-4/validation/budget.txt`
- `docs/phase-4/validation/build.txt`
- `docs/phase-4/validation/commands.json`
- `docs/phase-4/validation/controlled-browser.txt`
- `docs/phase-4/validation/csp.txt`
- `docs/phase-4/validation/dist.txt`
- `docs/phase-4/validation/git-status.txt`
- `docs/phase-4/validation/git-whitespace.txt`
- `docs/phase-4/validation/live-api.json`
- `docs/phase-4/validation/live-api.txt`
- `docs/phase-4/validation/live-browser.txt`
- `docs/phase-4/validation/live-images.txt`
- `docs/phase-4/validation/manifest-browser.json`
- `docs/phase-4/validation/node-tests.txt`
- `docs/phase-4/validation/npm-ci.txt`
- `docs/phase-4/validation/phase2-browser-results.json`
- `docs/phase-4/validation/preserved-contracts.json`
- `docs/phase-4/validation/production-performance.json`
- `docs/phase-4/validation/public-availability.json`
- `docs/phase-4/validation/service-worker.txt`
- `docs/phase-4/validation/summary.json`
- `docs/phase-4/validation/syntax.txt`
- `docs/phase-4/validation/visual-audit.txt`
- `docs/phase-4/validation/visual-live.txt`
- `docs/phase-4/validation/whitespace.txt`
- `robots.txt`
- `scripts/audit-phase4.mjs`
- `scripts/create-brand-assets.mjs`
- `scripts/measure-phase4-production.mjs`
- `sitemap.xml`
- `tests/browser/phase4.browser.mjs`
- `tests/helpers/contrast.js`
- `tests/helpers/phase4-fixtures.js`
- `tests/phase4.test.js`

</details>

## 10. Remaining Technical Debt

| Prioridade | Pendência | Impacto e próximo passo |
| --- | --- | --- |
| P0 | Nenhuma identificada nas verificações realizadas | Não é garantia de ausência de problemas fora do escopo testado. |
| P1 | Disponibilidade pública da nova arte, ícones, sitemap, metadados e shell v6 | Os arquivos locais/dist estão corretos, mas a versão pública permanece no HEAD anterior. Validar respostas 200, previews sociais e upgrade em produção quando houver publicação autorizada; nenhuma foi feita nesta fase. |
| P2 | INP e Core Web Vitals de usuários reais | Não há dados de campo representativos. Coletar RUM/CrUX conforme disponibilidade antes de afirmar sucesso de INP. |
| P2 | Avaliação assistiva e instalação real | Testar NVDA/VoiceOver/TalkBack, zoom do navegador e safe areas em aparelhos físicos; manifesto foi validado pelo Chrome, mas o app não foi instalado no SO. |
| P2 | robots na raiz do host GitHub Pages | `/F1/robots.txt` não substitui `/robots.txt`. Configuração do host/sitemap em ferramentas de busca fica fora deste repositório e não foi alterada. |
| P2 | Busca/crawl sem executar JavaScript | HTML tem contexto e fallback úteis; classificações dinâmicas não foram pré-renderizadas. Avaliar necessidade com dados de indexação, mantendo resultados honestos. |
| P3 | Imports amplos de dados compartilhados | A home ainda carrega o arquivo de campeões transitivamente, conforme trace de módulos. Separar futuramente sem quebrar os contratos do API/archive. Não foi reescrita a camada de cache nesta fase. |
| P3 | Evidência de laboratório e fontes externas | Scores Lighthouse e uma matriz Safari/Firefox não foram produzidos. CDP/Chrome é a evidência desta fase; fonte externa mantém fallback e display=swap. |
| P3 | Espaço reservado e pequenos metadados ausentes | Estados muito curtos deixam área vazia na home; poles continuam indisponíveis. Não preencher valores sem fonte. |

## 11. Final Git Status

- Branch inicial/final: `main`.
- HEAD inicial: `f2b3bb18ff50d648091f1a92b17df198172c2823`.
- HEAD final: `f2b3bb18ff50d648091f1a92b17df198172c2823`.
- Estado inicial: limpo, 0 staged, 0 unstaged, 0 untracked.
- Estado final: 31 arquivos rastreados modificados, 285 novos; **0 staged**. Relação integral na seção 9 e no status anexado.
- Commit: **não**. Push: **não**. Merge: **não**. Deploy: **não**.
- GitHub Actions disparado: **não**. Settings, secrets, environments e branch protection alterados: **não**.
- Nenhuma branch criada, nenhum reset/clean executado e nenhum trabalho pré-existente descartado.
