# Baseline anterior à implementação

- Data da sessão: 02/11/2026, America/Sao_Paulo.
- Branch `main`; HEAD `f2b3bb18ff50d648091f1a92b17df198172c2823`; árvore inicialmente limpa, nada staged.
- `npm ci`: 2 pacotes, zero vulnerabilidades; `npm test`: 243 testes, 243 aprovados.
- Captura reproduzível: `node scripts/audit-phase4.mjs before --production`. Seis páginas em 320, 390, 768, 1024 e 1440 px. Artefato inicial isolado em `dist/`; produção consultada somente por GET. Dados locais são fixtures, não resultados esportivos reais. Imagens externas locais usam o fallback existente e fontes externas têm CSS vazio, de modo idêntico antes/depois. Produção usa provedores reais.
- Métricas e condições completas serão armazenadas em `before/results.json`; capturas têm prefixos `local-` e `production-`.

| Prioridade | Evidência no código/captura | Impacto e correção pretendida |
| --- | --- | --- |
| P1 | `local-index-390.png`: bandeira sem dimensões, contador com quebras, cards excessivamente longos | Reservar dimensões, destacar data antes dos detalhes técnicos, reduzir espaços e ajustar tipografia fluida |
| P1 | `local-drivers-1440.png`: três colunas comprimem nome/estatísticas | Usar grade que respeite largura mínima de leitura; separar pontos e posição do número permanente |
| P1 | Expansões em drivers/teams chamam renderização completa | Foco do teclado perdido; alternar painel no DOM e relacionar com aria-controls |
| P1 | `aria-live` na galeria inteira e anúncio separado | Evitar leitura repetida de todo o conteúdo; anunciar só quantidade/status |
| P1 | Vermelho #e10600 em labels pequenos, opacidade no pódio e corridas concluídas | Medir cores computadas; manter vermelho da marca e usar tom textual mais claro; remover opacidade de conteúdo |
| P1 | Barra de cache fixa sobre conteúdo e navegação inferior sem safe-area | Integrar feedback ao fluxo, reservar altura e área segura da navegação |
| P1 | Opção de poles disponível mesmo sem dados | Desabilitar com explicação; normalizar links antigos sem inventar valores |
| P1 | Metadados sociais prometem tempo real, sem canonicals nas cinco páginas, placeholder como imagem/ícone | Metadados honestos e únicos; arte original PNG; sitemap e noindex na 404 |
| P1 | Google Fonts em HTML e @import com duas famílias adicionais em CSS | Uma folha de fonte no HTML; monospace do sistema, sem downloads redundantes |
| P2 | Galeria simula espera de 300ms para dados locais | Renderizar imediatamente; busca que se compõe com filtros existentes |
| P2 | Metadados técnicos e históricos competem com temporada corrente | Dar referência explícita e ordenar por vitórias/títulos históricos com rótulo inequívoco |
| P2 | Seletores duplicados, estilos órfãos e !important de logos | Consolidar regras verificadas; preservar redução de movimento e regras responsivas |

Identidade mantida: superfícies escuras, vermelho da marca, tipografia técnica, cinco destinos e módulos ES nativos. Nenhuma mudança na modelagem esportiva é necessária.
