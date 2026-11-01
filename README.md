# F1 Portal

Um portal estático desenvolvido com Vanilla JavaScript para consulta de dados em tempo real da Fórmula 1. O projeto foca em performance, acessibilidade e resiliência, utilizando técnicas modernas de desenvolvimento web sem a dependência de frameworks pesados.

Acesse a demonstração: [https://andersoncav.github.io/F1/](https://andersoncav.github.io/F1/)

## 🏎️ O Projeto

O objetivo deste portal é fornecer uma interface rápida e intuitiva para entusiastas da categoria. Ele consome dados da Jolpica F1 API (sucessora da Ergast) e implementa uma camada robusta de cache local para contornar limites de taxa e garantir funcionamento offline parcial via PWA.

### Diferenciais Técnicos

- **Arquitetura Vanilla:** Zero frameworks. Todo o gerenciamento de estado e DOM é feito via JavaScript puro, demonstrando domínio dos fundamentos da web.
- **Persistência Seletiva:** Sistema de cache customizado em `localStorage` com controle de expiração (TTL) e limpeza granular por projeto.
- **Performance e PWA:** Implementação de Service Worker para cache de assets estáticos e manifesto para instalação como aplicativo.
- **Acessibilidade Real:** Marcação semântica, suporte a leitores de tela via `aria-live` e gestão de foco para navegação por teclado.

## ✨ Funcionalidades

- **Dashboard:** Próximo Grande Prêmio com countdown em tempo real e resultados da última corrida.
- **Classificação Dinâmica:** Tabelas de pilotos e construtores com filtros e ordenação personalizada.
- **Grid Completo:** Detalhes técnicos de equipes e pilotos, incluindo fotos e estatísticas históricas.
- **Histórico de Campeões:** Galeria completa de todos os campeões mundiais desde 1950.
- **Calendário:** Cronograma da temporada com status atualizado de cada etapa.

## 🛠️ Stack Técnica

- **Linguagens:** HTML5, CSS3, JavaScript (ES6+ Modules)
- **API:** [Jolpica F1 API](https://github.com/jolpica/jolpica-f1)
- **Infra:** GitHub Actions (Deploy automatizado), Node.js (apenas para o Test Runner nativo)
- **Testes:** Node Test Runner (sem dependências externas)

## 📂 Estrutura

```text
/assets
  ├── css/          # Design System e animações
  ├── js/
  │   ├── api.js    # Camada de rede e cache
  │   ├── ui-utils.js # Utilitários de interface e PWA
  │   └── *.js      # Scripts específicos por página
/tests              # Testes unitários de lógica pura
sw.js               # Service Worker para suporte offline
manifest.json       # Configurações do PWA
```

## 💻 Desenvolvimento Local

O projeto utiliza módulos ES6, o que requer um servidor web para rodar localmente devido às restrições de CORS e segurança do navegador.

1. Clone o repositório:
   ```bash
   git clone https://github.com/AndersonCav/F1.git
   cd F1
   ```

2. Inicie um servidor local (exemplos):
   - **Node.js:** `npx serve .`
   - **Python:** `python -m http.server 8080`
   - **VS Code:** Extensão "Live Server"

3. Para rodar os testes unitários (requer Node.js 20+):
   ```bash
   npm run test
   ```

## 📝 Observações e Limitações

- As fotos dos pilotos e logos das equipes são fornecidos por assets externos integrados no `static-data.js`.
- O cache da API é renovado automaticamente a cada 60 minutos para garantir dados frescos sem sobrecarregar o serviço gratuito.

## Cache, recuperação e CSP

- `api.js` controla a validade dos dados da Jolpica. Uma resposta HTTP válida, JSON e com a coleção esperada recebe um único timestamp; leituras do cache nunca renovam esse horário. As requisições reais usam `cache: "no-store"` e timeout de 10 segundos.
- Dados com menos de 60 minutos são reutilizados. Se a rede falhar após esse prazo ou durante RELOAD, o último dado válido pode ser mostrado por até 7 dias, com o aviso **DADOS SALVOS · SEM ATUALIZAÇÃO** e sua data original. Sem dados utilizáveis, a página oferece tentar novamente.
- RELOAD força uma consulta na próxima navegação usando o parâmetro temporário `f1-refresh=1`, removido da URL ao iniciar. Ele preserva filtros e dados anteriores até a atualização terminar. Não apaga preferências, outros projetos ou todo o `localStorage`. Quando o armazenamento é bloqueado, o cache em memória atende a página atual; ele não persiste após navegar.
- O cache da API é limitado a 64 entradas reconhecidas do portal. Na gravação de dados válidos, entradas fora da retenção ou excedentes são removidas. Outros nomes de armazenamento são preservados.
- O Service Worker guarda somente os 18 recursos locais do shell em `f1-portal:<diretório>:static-v3`. Não guarda API, fontes ou imagens de terceiros. O diretório inicial e parâmetros das páginas/CSS são normalizados para as entradas do shell. O shell e o placeholder funcionam offline após uma instalação bem-sucedida; dados nunca consultados online podem ficar indisponíveis offline.
- **Ao alterar qualquer recurso do shell, incremente `CACHE_VERSION` em `sw.js`.** O precache usa `addAll`, verifica status/MIME/redirecionamentos e rejeita a instalação incompleta. O worker anterior continua atendendo suas abas; feche as abas do portal para ativar uma versão em espera. A ativação remove apenas o namespace desse diretório e os nomes legados exatos `f1-portal-v<número>`, incluindo o antigo `v13`.
- A fonte única da política é `scripts/sync-csp.mjs`: execute `npm run sync:csp` após editar a política ou o pequeno script de base da 404. `npm run check:csp` detecta divergências em todas as páginas. Não há `unsafe-inline`, `unsafe-eval` ou hosts curinga. O único script inline, necessário para caminhos 404 aninhados, é autorizado pelo hash exato.
- A CSP em `<meta>` precisa aparecer antes dos recursos; ela não oferece `frame-ancestors`, `sandbox`, modo Report-Only nem relatórios de violação equivalentes aos cabeçalhos HTTP. Esses recursos exigiriam configuração de hospedagem, fora desta fase. A 404 usa a raiz local ou o diretório `F1` informado pela URL canônica; ao renomear o projeto, atualize essa URL e sincronize a CSP.
- Imagens externas mantêm suas fontes originais e usam o placeholder local uma única vez em caso de erro. A disponibilidade dos arquivos remotos continua dependendo dos provedores.

## Validação da fase 1

```bash
npm test
npm run check:csp
```

Os testes nativos não exigem dependências. Os testes opcionais de navegador usam uma instalação existente do Playwright e Chrome, sem adicionar bibliotecas à aplicação:

```bash
npm run test:browser
npm run test:browser:live
```

Se Playwright não estiver resolvível como pacote local, defina `F1_PLAYWRIGHT_MODULE` com o caminho absoluto para seu `index.mjs`. `F1_BROWSER_EXECUTABLE` permite indicar o executável do Chrome. O teste controlado usa respostas externas simuladas para validar falhas, CSP e lifecycle; o teste `live` usa os serviços reais. Ambos iniciam e encerram um servidor HTTP local, sem deploy. O teste de upgrade lê o snapshot Git `eaa7335` (worker `v13`); o de regressão também reproduz o worker defeituoso em `e302381` (`v2`). Esses snapshots precisam existir no clone para reproduzir os dois cenários históricos.

---
Desenvolvido por [Anderson Cavalcante](https://github.com/AndersonCav)
