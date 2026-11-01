# Phase 2 — Data Integrity, Historical Accuracy & Season Reliability

Auditoria e implementação local em **01/11/2026**, fuso de referência America/Sao_Paulo. Repositório: [AndersonCav/F1](https://github.com/AndersonCav/F1). Este relatório descreve o conteúdo da árvore de trabalho, sem publicação.

## 1. Phase Status

**`PHASE_2_COMPLETE_WITH_DEBT`**

As correções de integridade, os 35 campeões até 2025, a confirmação por resultados, a separação por temporada e as regressões das fases anteriores foram implementadas e verificadas. Permanecem indisponíveis estatísticas para as quais o repositório não tinha uma fonte ou data verificável, particularmente poles, local de nascimento e métricas técnicas de circuitos. Essas lacunas estão explícitas; não foram convertidas em zeros nem apresentadas como atualização automática.

O trabalho começou com a árvore limpa na `main`, HEAD `5269a9e694ba2ac2cd6ddc686c0d6dda7c33ea24`. Nenhuma alteração preexistente precisava ser conciliada. Não houve criação de branch, commit, push, merge, deploy ou alteração de infraestrutura/configuração do repositório remoto.

## 2. Data Integrity Findings

| Problema, causa e impacto anterior | Comportamento implementado | Arquivos principais | Evidência |
| --- | --- | --- | --- |
| Arquivo histórico manual com apenas 33 identidades; faltavam os campeões de 1950 e 2025. Verstappen tinha 63 vitórias sem data de referência. | 35 IDs estáveis, 76 temporadas completas, Farina e Norris incluídos; todas as vitórias de GP recalculadas até 2025, incluindo 71 para Verstappen. | `champion-history.js`, `champions.js` | Hall of Fame oficial, 76 classificações finais e 1.149 provas arquivadas em `sources/`; testes históricos. |
| Estatísticas estáticas misturavam carreira, duas corridas de 2026 e valores sem proveniência. Poles de carreira apareciam ao lado de vitórias da temporada; `Number(value || 0)` fabricava zeros. | Classificação e vitórias de GP usam a temporada/etapa da API. Estatísticas opcionais inválidas ficam `null` e são exibidas como indisponíveis. Dados antigos sem verificação saíram dos módulos de produção e continuam no registro inicial da auditoria. | `driver-metadata.js`, `data-model.js`, `drivers-v10.js`, `initial-state.json` | Testes de precedência, valores ausentes, zero legítimo, sprints e ausência de campos antigos. |
| Ordenação por equipe acessava `team`, campo inexistente. Empates e acentos dependiam da ordem de entrada. | Usa `fullTeam`/`shortTeam`, desempata por nome e ID, coloca ausentes no final; pesquisa ignora acentos e também encontra equipes. URL preserva `sort`, `q` e parâmetros não relacionados. | `data-model.js`, `drivers-v10.js` | Seis modos de ordenação em Node e Chrome; pesquisa, filtros e expansão combinados. |
| A primeira equipe de `Constructors` era tratada como vínculo atual e os participantes da classificação como dois assentos simultâneos. Cores fixadas no piloto também podiam sobreviver à troca de equipe. | Todas as associações da temporada são preservadas; múltiplos construtores têm vínculo atual explicitamente não confirmado. Equipes mostram participantes, incluindo substitutos, e a cor vem do construtor correspondente. | `data-model.js`, `drivers-v10.js`, `teams-v10.js`, `main-v10.js` | Fixtures de substitutos e transferências; teste de cor; observação real de Lawson associado a RB e Red Bull. |
| Vitórias e títulos de organizações anteriores eram atribuídos à marca atual. Metadados técnicos não tinham temporada/data e a Audi ainda apontava Jonathan Wheatley. | Recorte de construtores até 2025 com regra de identidade documentada. Dados técnicos dos 11 perfis oficiais têm temporada 2026 e verificação de 01/11/2026, incluindo Mattia Binotto na Audi. Ausentes não viram zero. | `constructor-metadata.js`, `historical-snapshots.js`, `teams-v10.js` | 68 campeonatos de construtores, resultados de GP e 11 perfis oficiais arquivados. |
| O ano do navegador selecionava pilotos e a próxima temporada, permitindo misturar anos. Patrocinadores de 2026 eram aplicados a qualquer corrida. | Ano concreto vem da resposta de calendário/classificação. Consultas relacionadas usam esse ano; a seguinte é `season + 1`. Nome esportivo da API é preservado, sem substituição comercial não verificada. Imagens e metadados sazonais não atravessam anos. | `season.js`, `api.js`, páginas JS, módulos de referência | Cenários de janeiro, temporada futura publicada, vazia e indisponível; rejeição de cache de outro ano. |
| Corridas eram concluídas só porque a largada prevista passou. Horário ausente virava meio-dia; o contador anunciava “AO VIVO” indefinidamente. Texto decorativo também anunciava telemetria ao vivo. | Conclusão exige resultado publicado compatível. Sem resultado: pendente; sem instante verificável: agendada ou desconhecida. O contador para e explica o limite do horário. Textos decorativos agora identificam dados publicados/horário programado. | `season.js`, `calendar.js`, `main-v10.js`, `styles-v7.css`, `index.html` | Fronteira exata da largada, atualização do calendário sem recarga, três fusos, contador encerrado e inspeção do pseudo-elemento CSS. |
| A interpretação do transporte aceitava duplicatas, temporada errada e páginas truncadas; o antigo endpoint histórico sem ano retorna HTTP 400 atualmente. | Validação de domínio antes de gravar, verificação de total/offset, IDs, etapas, duplicatas e regressões sobre dados válidos. Histórico usa arquivo revisado permanente, sem dependência desse endpoint indisponível. O transporte/cache existente foi preservado. | `api.js`, `data-model.js`, `champion-history.js` | Cache inválido é recusado; refresh ruim preserva bytes e timestamp anteriores; arquivo de campeões funciona sem rede. |
| Bandeira ausente/desconhecida era substituída pela Bélgica. Nacionalidades “American” e “South African” não tinham alias. | Ausência usa o fallback local; os 35 campeões têm mapeamento de nacionalidade válido. | `static-data.js` | Casos de nacionalidade ausente, desconhecida e todos os campeões. |
| O pódio usava índice de array como colocação e podia duplicar o sinal `+` do intervalo. | Resultados são ordenados pela posição publicada; os rótulos usam essa posição e preservam intervalos já sinalizados. | `data-model.js`, `main-v10.js` | Resposta fora de ordem em Node e Chrome. |
| Novos rótulos longos expuseram a largura mínima automática do seletor em 320px. | Colunas e controles podem encolher; textos e metadados quebram dentro dos cartões, mantendo o design existente. | `styles-v7.css`, `drivers.html` | Todas as seis páginas verificadas em 320px e 390px; 404 preserva seu próprio link de início. |
| Distâncias, voltas e recordes de circuitos eram valores manuais sem evidência versionada nem garantia de configuração da pista por ano. | Mapas externos existentes foram preservados e associados a 2026. Métricas não verificadas são indisponíveis até uma nova revisão. | `circuit-metadata.js`, `main-v10.js` | Imports/precache e cenário futuro sem reaproveitar mapa de 2026; limitação registrada na seção 8. |

As garantias da camada de transporte permanecem: 60 minutos de frescor, sete dias de fallback, 64 entradas, timeout de dez segundos, `no-store`, deduplicação de requisições e timestamps originais. A evolução de domínio rejeita desaparecimento do conjunto de classificação na mesma etapa, regressão de etapa, apagamento de resultados publicados e resposta vazia que substituiria dados conhecidos da mesma temporada. Uma resposta nova de outra temporada não é fundida à anterior.

## 3. Historical Champion Audit

**Antes: 33. Depois: 35. Cobertura: 1950–2025, 76 temporadas, exatamente um campeão por ano.** Nenhum líder ou resultado parcial de 2026 foi promovido ao arquivo histórico.

O [Hall of Fame oficial da Formula 1](https://www.formula1.com/en/drivers/hall-of-fame) forneceu os 35 perfis e seus anos de títulos. [Farina](https://www.formula1.com/en/information/drivers-hall-of-fame-nino-farina.42vZMEuSei8avz76yMDHpf) é o campeão de 1950; a [FIA confirma Norris como campeão de 2025 e 35º vencedor distinto](https://www.fia.com/news/f1-norris-crowned-fia-formula-one-world-champion-verstappen-takes-abu-dhabi-win). As páginas oficiais coletadas estão resumidas em [official-hall-of-fame.json](sources/official-hall-of-fame.json).

Uma segunda coleta verificou os 76 vencedores das classificações finais, suas nacionalidades e construtores: [championship-seasons.json](sources/championship-seasons.json). O conjunto `teams` representa apenas construtores usados nas temporadas de títulos, não toda a carreira. Sufixos de motorização de Cooper, Lotus, Brabham e Matra foram normalizados à identidade histórica documentada; Fangio conserva Maserati e Mercedes em 1954.

As vitórias são **Grandes Prêmios do Mundial com classificação em primeiro lugar, até o fim de 2025**, incluindo vitórias compartilhadas e excluindo sprints e provas fora do campeonato. Foram coletadas 12 páginas completas do endpoint de vencedores, retidas as 1.149 provas até 2025 e agregadas as identidades: [gp-winners-through-2025.json](sources/gp-winners-through-2025.json). Corridas de Indianápolis contam somente quando integravam o Mundial. As 33 contagens anteriores foram conferidas; a correção numérica necessária foi Verstappen, de 63 para 71. Norris soma 11 e Farina, cinco nesse recorte.

As 33 URLs anteriores, créditos, nacionalidades em português, anos de títulos, equipes campeãs e ordem relativa continuam protegidos. O teste ainda confere o hash imutável dos campos históricos do baseline da fase 1.1 antes de verificar a alteração justificada de vitórias. O arquivo inicial completo está em [initial-state.json](initial-state.json).

| Novo campeão | Fotografia real e licença declarada pela fonte | Verificação |
| --- | --- | --- |
| Giuseppe Farina, ID `farina`, título 1950, Alfa Romeo | [Farina no circuito Masaryk em 1934](https://commons.wikimedia.org/wiki/File:V%C3%ADt%C4%9Bzn%C3%BD_Giuseppe_Farina_zdrav%C3%AD_div%C3%A1ky_(Masaryk%C5%AFv_okruh_1934).jpg), autor desconhecido, Světozor de 04/10/1934, p. 12, via Digitální knihovna; [CC BY 4.0 declarada no Commons](https://creativecommons.org/licenses/by/4.0). Crédito e link dos termos no cartão. | Miniatura retornada pelo Commons, JPEG 250×333; HTTP 200, MIME, assinatura, SHA-256, decodificação e revisão visual em Chrome desktop/mobile. |
| Lando Norris, ID `norris`, título 2025, McLaren | [Retrato no GP britânico de 2022](https://commons.wikimedia.org/wiki/File:Lando_Norris,_British_GP_2022_(52382574143)_(cropped).jpg), Jen Ross, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0); recorte já publicado no Commons por Valentin JJ. | Miniatura retornada pelo Commons, JPEG 250×336; mesmas verificações. |

O [novo registro de aprovação](image-audit.json), as respostas `*-commons.json` e as sondagens `*-probe.json` conservam identidade, termos, bytes e procedência. Não houve geração de imagem, substituição de pessoa nem edição dos 33 retratos existentes. A interface informa o enquadramento da miniatura e mantém acesso aos créditos.

No teste final, as **35 fotos reais** foram decodificadas em desktop e mobile, sem placeholders nesses dois cenários. O conjunto transferiu 929.565 bytes no teste que força todas as imagens a carregar; a aplicação continua lazy. Falha intencional: 34 fotos reais e um fallback. Offline: 35 registros e 35 fallbacks locais, sem cache de fotografias externas. Os hashes e dimensões foram conferidos, e a folha de contato foi visualmente revisada: [evidência JSON](browser/results.json), [folha de contato](browser/identity-contact-sheet.png), [desktop](browser/desktop-first.png), [mobile](browser/mobile-first.png).

### Inventário histórico verificado

| ID | Campeão / fonte oficial | Anos de títulos | Total de títulos | Vitórias de GP até 2025 | Equipes nas temporadas campeãs |
| --- | --- | --- | ---: | ---: | --- |
| farina | [Giuseppe Farina](https://www.formula1.com/en/information/drivers-hall-of-fame-nino-farina.42vZMEuSei8avz76yMDHpf) | 1950 | 1 | 5 | Alfa Romeo |
| fangio | [Juan Manuel Fangio](https://www.formula1.com/en/information/drivers-hall-of-fame-juan-manuel-fangio.6SSng3B5E6j6pxPNbyqQIv) | 1951, 1954, 1955, 1956, 1957 | 5 | 24 | Alfa Romeo / Maserati / Mercedes / Ferrari |
| ascari | [Alberto Ascari](https://www.formula1.com/en/information/drivers-hall-of-fame-alberto-ascari.6zgWYwDIjoQmYSiz48FAZD) | 1952, 1953 | 2 | 13 | Ferrari |
| hawthorn | [Mike Hawthorn](https://www.formula1.com/en/information/drivers-hall-of-fame-mike-hawthorn.1ZhSmpnVlO7Pb8peo23YVd) | 1958 | 1 | 3 | Ferrari |
| jack_brabham | [Jack Brabham](https://www.formula1.com/en/information/drivers-hall-of-fame-jack-brabham.3XK2XWdL0moCmnSC55m84J) | 1959, 1960, 1966 | 3 | 14 | Cooper / Brabham |
| phil_hill | [Phil Hill](https://www.formula1.com/en/information/drivers-hall-of-fame-phil-hill.6lgmSO6KAK9UgCNziJodGB) | 1961 | 1 | 3 | Ferrari |
| hill | [Graham Hill](https://www.formula1.com/en/information/drivers-hall-of-fame-graham-hill.NUqzbttsJ2gsuGtW9PzNG) | 1962, 1968 | 2 | 14 | BRM / Lotus |
| clark | [Jim Clark](https://www.formula1.com/en/information/drivers-hall-of-fame-jim-clark.2xXQsIYM7LBHJrP4Gw6rRD) | 1963, 1965 | 2 | 25 | Lotus |
| surtees | [John Surtees](https://www.formula1.com/en/information/drivers-hall-of-fame-john-surtees.7a0aXDMmG4DZeRFpzeN4vz) | 1964 | 1 | 6 | Ferrari |
| hulme | [Denny Hulme](https://www.formula1.com/en/information/drivers-hall-of-fame-denny-hulme.4Y4lvrNNAQcB0Cf6PQcIqq) | 1967 | 1 | 8 | Brabham |
| stewart | [Jackie Stewart](https://www.formula1.com/en/information/drivers-hall-of-fame-jackie-stewart.18715uErEG7LS83UDkeqP4) | 1969, 1971, 1973 | 3 | 27 | Matra / Tyrrell |
| rindt | [Jochen Rindt](https://www.formula1.com/en/information/drivers-hall-of-fame-jochen-rindt.297CPloKgJFry8fsI3oVyx) | 1970 | 1 | 6 | Lotus |
| emerson_fittipaldi | [Emerson Fittipaldi](https://www.formula1.com/en/information/drivers-hall-of-fame-emerson-fittipaldi.2H5252hs7KMUh5HBXoYdoW) | 1972, 1974 | 2 | 14 | Lotus / McLaren |
| lauda | [Niki Lauda](https://www.formula1.com/en/information/drivers-hall-of-fame-niki-lauda.2Ye7VYWdXwhb97ZqLyxvX) | 1975, 1977, 1984 | 3 | 25 | Ferrari / McLaren |
| hunt | [James Hunt](https://www.formula1.com/en/information/drivers-hall-of-fame-james-hunt.4vRKjActuXEjrFBR9hzo2A) | 1976 | 1 | 10 | McLaren |
| mario_andretti | [Mario Andretti](https://www.formula1.com/en/information/drivers-hall-of-fame-mario-andretti.6F7CXYpxRzHezXe6At2E7E) | 1978 | 1 | 12 | Lotus |
| scheckter | [Jody Scheckter](https://www.formula1.com/en/information/drivers-hall-of-fame-jody-scheckter.xGrSCopMMf1mkdIUX1119) | 1979 | 1 | 10 | Ferrari |
| jones | [Alan Jones](https://www.formula1.com/en/information/drivers-hall-of-fame-alan-jones.2g6TF5HMcodjT4Jd6Xuub2) | 1980 | 1 | 12 | Williams |
| piquet | [Nelson Piquet](https://www.formula1.com/en/information/drivers-hall-of-fame-nelson-piquet.7EkDuZAxJN03b0kgFksCzf) | 1981, 1983, 1987 | 3 | 23 | Brabham / Williams |
| keke_rosberg | [Keke Rosberg](https://www.formula1.com/en/information/drivers-hall-of-fame-keke-rosberg.5oGvi8v8jkuvLTXHTgm0bt) | 1982 | 1 | 5 | Williams |
| prost | [Alain Prost](https://www.formula1.com/en/information/drivers-hall-of-fame-alain-prost.6xkomcqkRL5K0HgmPX4zAH) | 1985, 1986, 1989, 1993 | 4 | 51 | McLaren / Williams |
| senna | [Ayrton Senna](https://www.formula1.com/en/information/drivers-hall-of-fame-ayrton-senna.FLD7ZtO0nUn7JzLEn5rOJ) | 1988, 1990, 1991 | 3 | 41 | McLaren |
| mansell | [Nigel Mansell](https://www.formula1.com/en/information/drivers-hall-of-fame-nigel-mansell.3mLYxotFMTyLgIRxilGObS) | 1992 | 1 | 31 | Williams |
| michael_schumacher | [Michael Schumacher](https://www.formula1.com/en/information/drivers-hall-of-fame-michael-schumacher.7KdX5nJlTG55vR5JQSbZ21) | 1994, 1995, 2000, 2001, 2002, 2003, 2004 | 7 | 91 | Benetton / Ferrari |
| damon_hill | [Damon Hill](https://www.formula1.com/en/information/drivers-hall-of-fame-damon-hill.5Cwo2Aog5nHCR1eduIkq3y) | 1996 | 1 | 22 | Williams |
| villeneuve | [Jacques Villeneuve](https://www.formula1.com/en/information/drivers-hall-of-fame-jacques-villeneuve.7gsINZWlAMv5jdtvUJKL8e) | 1997 | 1 | 11 | Williams |
| hakkinen | [Mika Hakkinen](https://www.formula1.com/en/information/drivers-hall-of-fame-mika-hakkinen.7ptiWW1foQkbFQSp2boc9d) | 1998, 1999 | 2 | 20 | McLaren |
| alonso | [Fernando Alonso](https://www.formula1.com/en/information/drivers-hall-of-fame-fernando-alonso.2Ig4mBh2FaPMgAMjI0bBF9) | 2005, 2006 | 2 | 32 | Renault |
| raikkonen | [Kimi Raikkonen](https://www.formula1.com/en/information/drivers-hall-of-fame-kimi-raikkonen.4Ykdt9U76gWO40cNbjaMXf) | 2007 | 1 | 21 | Ferrari |
| hamilton | [Lewis Hamilton](https://www.formula1.com/en/information/drivers-hall-of-fame-lewis-hamilton.6TbSwzJA2miTUwtnXUHkjk) | 2008, 2014, 2015, 2017, 2018, 2019, 2020 | 7 | 105 | McLaren / Mercedes |
| button | [Jenson Button](https://www.formula1.com/en/information/drivers-hall-of-fame-jenson-button.3BuV7MDE7ykNAThxxLr8vT) | 2009 | 1 | 15 | Brawn GP |
| vettel | [Sebastian Vettel](https://www.formula1.com/en/information/drivers-hall-of-fame-sebastian-vettel.GBy6vPkxKOKUV89QOhZe5) | 2010, 2011, 2012, 2013 | 4 | 53 | Red Bull |
| rosberg | [Nico Rosberg](https://www.formula1.com/en/information/drivers-hall-of-fame-nico-rosberg.7ryzoUXKrxqhlcNlXEUaTf) | 2016 | 1 | 23 | Mercedes |
| max_verstappen | [Max Verstappen](https://www.formula1.com/en/information/drivers-hall-of-fame-max-verstappen.2DttvntAuFvHYrBY2tV8fN) | 2021, 2022, 2023, 2024 | 4 | 71 | Red Bull |
| norris | [Lando Norris](https://www.formula1.com/en/information/drivers-hall-of-fame-lando-norris.1x6Yu55IhitkH8t4NnFMmK) | 2025 | 1 | 11 | McLaren |

## 4. Driver and Constructor Audit

| Campo ou conjunto | Definição, fonte e precedência | Frescor e fallback |
| --- | --- | --- |
| Posição, pontos e vitórias do piloto | Classificação Jolpica da temporada/etapa retornada. Pontos do campeonato incluem sprints; vitórias contam GP. | Cache de 60 minutos, fallback de até sete dias com data original. Sem campo válido: indisponível. |
| Equipe do piloto | Todos os `Constructors` da classificação. A [documentação do fornecedor](https://raw.githubusercontent.com/jolpica/jolpica-f1/main/docs/endpoints/driverStandings.md) define a lista como todos os construtores representados naquele ano. | Não se deduz vínculo atual ou número de assentos a partir da ordem da lista. |
| Identidade, nascimento, nacionalidade e número permanente | Perfil Jolpica do mesmo ano; se a consulta opcional falhar, usa a identidade contida na classificação. Valores esportivos manuais não têm precedência. | Dados de referência estáveis, transportados com a mesma política de cache. Número ausente permanece ausente; não se inventa número de campeão ou de inscrição da prova. |
| Poles e outros totais de carreira dos pilotos ativos | O repositório não tinha data de corte/proveniência verificável. Não se contam grid 1, vitórias ou sprints como poles. | `null`/indisponível. A opção de ordenação continua determinística, com ausentes no final. Não há agregação de carreira cara por visita. |
| Local de nascimento | A string manual não tinha prova de origem e a resposta usada da Jolpica não fornece esse campo. | Indisponível; sem inferência pelo país ou data de nascimento. |
| Retratos e cores | Retratos existentes preservados, com temporada do uniforme. Logo e cor vêm da referência do construtor da temporada, quando o vínculo é inequívoco. | Em outra temporada ou vínculo desconhecido, fallback local/estilo neutro; sem transportar automaticamente uma identidade visual anterior. |
| Classificação das equipes | Posição, pontos e vitórias vêm do endpoint de construtores do ano correto. | Mesma retenção e política de ausência. Uma falha opcional na lista de pilotos não apaga a classificação da equipe. |
| Nome oficial, chefe, direção técnica, chassi, unidade de potência e base | Snapshot dos 11 [perfis oficiais da F1](https://www.formula1.com/en/teams), com URL, temporada 2026, `verifiedAt` e referência 01/11/2026. | Exibidos apenas no ano correspondente; o painel informa a data. Em outro ano, nome da API e campos indisponíveis. |
| Vitórias e títulos históricos das equipes | GP até 2025 e títulos de construtores 1958–2025, sob a identidade indicada no snapshot. [68 classificações vencedoras](sources/constructor-titles-through-2025.json) e provas vencedoras completas. | Snapshot histórico, sem rótulo de dado ao vivo. Não soma organizações predecessoras. |
| Biografia/estatísticas antigas não exibidas | `seasonStats`, `careerStats` e números manuais foram auditados como snapshots sem data confiável, não como valores correntes. | Permanecem somente no baseline documental; não são publicados pela aplicação. |

Os campos técnicos conferidos estão em [constructor-metadata-2026.json](sources/constructor-metadata-2026.json), separados do estilo e dos resultados dinâmicos. “First Team Entry” não foi usado para transferir a história de uma organização ao construtor moderno. Para McLaren, o ID antigo `mclaren-ford` é uma variante com sufixo de motor da mesma identidade e foi explicitamente incluído; não há soma automática de uma linhagem comercial.

| Construtor | Vitórias anteriores → GP até 2025 | Títulos anteriores → títulos de construtores até 2025 | Regra |
| --- | --- | --- | --- |
| Mercedes | 130 → 131 | 8 → 8 | Identidade Mercedes. |
| Ferrari | 248 → 248 | 16 → 16 | Identidade Ferrari. |
| McLaren | 186 → 203 | 9 → 10 | McLaren + variante histórica McLaren-Ford. |
| Haas | 0 → 0 | 0 → 0 | Zeros verificados na identidade Haas. |
| Red Bull | 122 → 130 | 7 → 6 | Sem Jaguar/Stewart. |
| Racing Bulls / RB | 2 → 0 | 0 → 0 | Sem Toro Rosso/AlphaTauri. |
| Alpine | 21 → 1 | 2 → 0 | Sem títulos/vitórias Renault ou outros predecessores. |
| Audi | 1 → indisponível | 0 → indisponível | Não participava sob essa identidade no recorte até 2025; não herda BMW Sauber. |
| Williams | 114 → 114 | 9 → 9 | Identidade Williams. |
| Cadillac | 0 → indisponível | 0 → indisponível | Ingresso posterior ao recorte histórico; classificação de 2026 continua dinâmica. |
| Aston Martin | 1 → 0 | 0 → 0 | Sem vitória da Racing Point. |

Na validação real, a API apresentou **2026, etapa 19, 24 participantes de pilotos e 11 construtores**, além de 18 resultados vencedores compatíveis. Essas quantidades são observações datadas, não pressupostos fixos de tamanho do grid. A conferência representativa reproduziu Norris em 2025 com **423 pontos e sete vitórias na temporada**, Farina vencedor em 1950 com três vitórias naquele ano, e McLaren com 14 vitórias em 2025. Os resultados de Norris também foram comparados à [classificação oficial da FIA de 2025](https://www.fia.com/events/fia-formula-one-world-championship/season-2025/2025-classifications). [Evidência da API real](validation/live-api.json).

## 5. Season and Calendar Reliability

O alias `current` da API identifica o ano esportivo por meio do campo `season`. Dashboard/calendário começam pelo calendário; pilotos e equipes começam por suas classificações. Requisições relacionadas usam o ano retornado explicitamente e caches com esse ano na chave. Janeiro não encerra nem promove um campeonato. Respostas de temporada diferente são rejeitadas.

`seasonPhase` distingue calendário não publicado, temporada futura, ativa e concluída. Uma temporada somente recebe a condição concluída quando todas as provas presentes no calendário têm confirmação compatível. Após isso, o próximo ano consultado é o ano esportivo mais um; calendário vazio ou serviço indisponível produz mensagem informativa de offseason. Uma temporada futura publicada conserva seu próprio ano e nome esportivo. Uma temporada vazia válida não é exibida como falha de requisição.

| Estado | Evidência necessária |
| --- | --- |
| `scheduled` | Dia futuro válido, ou horário futuro conhecido que ainda não é o próximo evento. |
| `upcoming` | Próximo evento com instante futuro verificável. |
| `result_pending` | Horário UTC previsto atingido, sem resultado compatível publicado. |
| `completed` | Resultado publicado com vencedor válido, mesmo ano/etapa/circuito/data do calendário, e sem evidência temporal de publicação futura. |
| `status_unknown` | Data inválida, ou dia atingido/passado sem instante verificável nem resultado compatível. |

O calendário reclassifica as provas na próxima largada conhecida ou fronteira de dia UTC, mesmo sem recarregar a página. Isso atualiza a interpretação do horário; não consulta telemetria. Não se afirma `in_progress`, cancelamento ou adiamento sem uma fonte apropriada. Ausência de resultado não prova cancelamento.

Datas e horários UTC são validados separadamente. Uma data sem hora continua sendo um dia: a exibição evita mudança de dia pelo fuso e informa que o horário não foi publicado. Não se usa meio-dia fictício. Um horário conhecido é convertido para o fuso do navegador; a ordem das etapas e o instante comparado permanecem os mesmos em São Paulo, Honolulu e Tóquio. Datas inválidas não causam exceção de `Intl.DateTimeFormat`.

O contador usa somente `raceStart` válido, nunca fica negativo e cancela seu intervalo quando o instante previsto é atingido. Passa a informar que aguarda resultado. Sem hora, mostra a ausência de informação e não inicia intervalo. O texto HTML, o aviso do cache e o rótulo CSS do painel foram revisados para não sugerir telemetria ou transmissão ao vivo.

Os resultados do GP são separados dos sprints. A confirmação usa o endpoint de vencedores de GP, com validação de completude; o pódio usa a classificação publicada e seus intervalos, não a ordem arbitrária da resposta. Fontes: [contrato de resultados Jolpica](https://raw.githubusercontent.com/jolpica/jolpica-f1/main/docs/endpoints/results.md) e [documentação de paginação](https://raw.githubusercontent.com/jolpica/jolpica-f1/main/docs/README.md).

## 6. Files Changed

`static-data.js` agora funciona como compatibilidade de imports e mantém traduções, bandeiras, formatação e helpers de UI. Sete módulos pequenos/separados por responsabilidade substituem a mistura de estatísticas e referências. Não foram adicionados framework, bundler, backend, banco de dados ou dependência de produção/teste. O Service Worker v5 precacheia os 18 recursos anteriores e os sete módulos novos: **25 recursos locais**.

O inventário abaixo inclui cada arquivo modificado ou criado, inclusive as evidências. Os documentos da fase 1.1 e seu registro de aprovação continuam intactos.

| Estado | Arquivo | Alteração |
| --- | --- | --- |
| Modificado | [README.md](../../README.md) | Política de dados, temporada, snapshots e comandos de validação. |
| Modificado | [assets/css/styles-v7.css](../../assets/css/styles-v7.css) | Ajustes de quebra em 320px e rótulo verdadeiro do contador. |
| Modificado | [assets/js/api.js](../../assets/js/api.js) | Validação de domínio, chaves por temporada e arquivo histórico permanente; transporte preservado. |
| Modificado | [assets/js/calendar.js](../../assets/js/calendar.js) | Estados por evidência, confirmação, timer de fronteira e próxima temporada. |
| Modificado | [assets/js/champions.js](../../assets/js/champions.js) | 35 campeões, referência até 2025, fonte e créditos preservados. |
| Modificado | [assets/js/drivers-v10.js](../../assets/js/drivers-v10.js) | Mapeamento, ordenação, busca/URL e ausência de estatísticas. |
| Modificado | [assets/js/main-v10.js](../../assets/js/main-v10.js) | Temporada concreta, contador honesto, confirmação, pódio e referências por ano. |
| Modificado | [assets/js/static-data.js](../../assets/js/static-data.js) | Compatibilidade de imports, traduções, bandeiras e datas seguras. |
| Modificado | [assets/js/teams-v10.js](../../assets/js/teams-v10.js) | Participantes da temporada, estatísticas com recorte e metadados datados. |
| Modificado | [assets/js/ui-utils.js](../../assets/js/ui-utils.js) | Aviso de dados da API sem alegação de telemetria. |
| Modificado | [calendar.html](../../calendar.html) | Remove a fixação textual da temporada em 2026. |
| Modificado | [drivers.html](../../drivers.html) | Explicita vitórias de GP e indisponibilidade de poles. |
| Modificado | [index.html](../../index.html) | Textos de dados publicados em lugar de alegação ao vivo. |
| Modificado | [package.json](../../package.json) | Inclui testes da fase 2 e API real, sem dependências. |
| Modificado | [sw.js](../../sw.js) | Shell v5 com os sete módulos novos e 25 entradas. |
| Modificado | [tests/browser/champion-images.browser.mjs](../../tests/browser/champion-images.browser.mjs) | Mesmos cenários de imagens com 35 registros e shell v5. |
| Modificado | [tests/browser/champion-images.live.mjs](../../tests/browser/champion-images.live.mjs) | Confere 35 fotos reais, duas aprovações novas e shell expandido. |
| Modificado | [tests/browser/live.browser.mjs](../../tests/browser/live.browser.mjs) | Mantém seis páginas reais e exige 35 fotos genuínas. |
| Modificado | [tests/browser/phase1.browser.mjs](../../tests/browser/phase1.browser.mjs) | Preserva cenários anteriores com contratos e quantidades atuais. |
| Modificado | [tests/champion-images.test.js](../../tests/champion-images.test.js) | 35 aprovações e proteção integral dos 33 registros anteriores. |
| Modificado | [tests/helpers/champion-browser.js](../../tests/helpers/champion-browser.js) | Espera as 35 imagens antes de verificar decodificação. |
| Modificado | [tests/helpers/http-server.js](../../tests/helpers/http-server.js) | Acrescenta baseline Git real da fase 1.1 para upgrade. |
| Novo | [assets/js/champion-history.js](../../assets/js/champion-history.js) | 35 campeões, IDs, anos, vitórias até 2025, fotos, créditos e fontes. |
| Novo | [assets/js/circuit-metadata.js](../../assets/js/circuit-metadata.js) | Imagens existentes de circuitos, com temporada explícita. |
| Novo | [assets/js/constructor-metadata.js](../../assets/js/constructor-metadata.js) | Snapshots oficiais de 2026, fontes/datas e estilo por construtor. |
| Novo | [assets/js/data-model.js](../../assets/js/data-model.js) | Validação, números opcionais, ordenação, busca e mapeamentos puros. |
| Novo | [assets/js/driver-metadata.js](../../assets/js/driver-metadata.js) | Referências visuais de pilotos sem estatísticas manuais. |
| Novo | [assets/js/historical-snapshots.js](../../assets/js/historical-snapshots.js) | Vitórias/títulos por identidade de construtor até 2025. |
| Novo | [assets/js/season.js](../../assets/js/season.js) | Datas UTC, estados, confirmação, temporada e contagem regressiva. |
| Novo | [docs/phase-2/REPORT.md](REPORT.md) | Relatório técnico completo com inventários e resultados. |
| Novo | [docs/phase-2/browser/404.html.png](browser/404.html.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/champions.html.png](browser/champions.html.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/desktop-first.png](browser/desktop-first.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/desktop-last.png](browser/desktop-last.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/desktop-middle.png](browser/desktop-middle.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/identity-contact-sheet.png](browser/identity-contact-sheet.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/index.html.png](browser/index.html.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/mobile-first.png](browser/mobile-first.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/mobile-last.png](browser/mobile-last.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/mobile-middle.png](browser/mobile-middle.png) | Captura real do Chrome e revisão visual. |
| Novo | [docs/phase-2/browser/phase2-results.json](browser/phase2-results.json) | Observações de navegador, imagens, exceções e CSP. |
| Novo | [docs/phase-2/browser/results.json](browser/results.json) | Observações de navegador, imagens, exceções e CSP. |
| Novo | [docs/phase-2/image-audit.json](image-audit.json) | Aprovação das duas novas fotos, bytes, termos e identidade. |
| Novo | [docs/phase-2/initial-state.json](initial-state.json) | Baseline limpo do HEAD inicial e todos os dados anteriores. |
| Novo | [docs/phase-2/sources/championship-seasons.json](sources/championship-seasons.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/constructor-metadata-2026.json](sources/constructor-metadata-2026.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/constructor-titles-through-2025.json](sources/constructor-titles-through-2025.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/farina-commons.json](sources/farina-commons.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/farina-probe.json](sources/farina-probe.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/gp-winners-through-2025.json](sources/gp-winners-through-2025.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/norris-commons.json](sources/norris-commons.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/norris-probe.json](sources/norris-probe.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/sources/official-hall-of-fame.json](sources/official-hall-of-fame.json) | Evidência de fonte e metadados preservada para revisão offline. |
| Novo | [docs/phase-2/validation/controlled-chrome.txt](validation/controlled-chrome.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/csp.txt](validation/csp.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/git-status.txt](validation/git-status.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/git-whitespace.txt](validation/git-whitespace.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/historical-data.txt](validation/historical-data.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/live-api.json](validation/live-api.json) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/live-api.txt](validation/live-api.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/live-images.txt](validation/live-images.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/live-pages.txt](validation/live-pages.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/node-tests.txt](validation/node-tests.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/service-worker.txt](validation/service-worker.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/summary.json](validation/summary.json) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [docs/phase-2/validation/syntax.txt](validation/syntax.txt) | Resultado bruto ou resumo estruturado de validação executada. |
| Novo | [scripts/audit-phase2.mjs](../../scripts/audit-phase2.mjs) | Coleta opcional de metadados/imagens e páginas completas de vencedores. |
| Novo | [scripts/build-phase2-references.mjs](../../scripts/build-phase2-references.mjs) | Reconstrói referências a partir de evidências revistas; bloqueia mudança de foto não aprovada. |
| Novo | [scripts/verify-champion-seasons.mjs](../../scripts/verify-champion-seasons.mjs) | Verifica os 76 campeões finais, nacionalidades e construtores. |
| Novo | [scripts/verify-constructors.mjs](../../scripts/verify-constructors.mjs) | Coleta perfis de equipes e campeões de construtores 1958–2025. |
| Novo | [scripts/verify-history.mjs](../../scripts/verify-history.mjs) | Coleta perfis/anos de títulos do Hall of Fame oficial. |
| Novo | [tests/api-domain.test.js](../../tests/api-domain.test.js) | Cache por ano, respostas incompletas, evolução e fallback histórico. |
| Novo | [tests/browser/live-api.mjs](../../tests/browser/live-api.mjs) | Seis verificações esportivas com rede real e relatório JSON. |
| Novo | [tests/browser/phase2.browser.mjs](../../tests/browser/phase2.browser.mjs) | 17 cenários controlados novos, incluindo v4 para v5 e mobile. |
| Novo | [tests/data-integrity.test.js](../../tests/data-integrity.test.js) | Campeões, fontes, equipes, números, ordenação, calendário e temporadas. |
| Novo | [tests/helpers/sporting-fixtures.js](../../tests/helpers/sporting-fixtures.js) | Fixtures reutilizáveis, completas e independentes da rede. |

## 7. Testing Results

Chrome real **156.0.8078.80**, headless, via instalação existente de Playwright e Chrome; nenhum pacote foi instalado no projeto. O servidor de teste usa `/F1/`, portas locais efêmeras e snapshots Git imutáveis para upgrades. Os testes nativos não fazem chamadas externas. Fixtures e relógios controlados são separados das verificações com serviços reais.

| Validação | Passaram | Falharam | Ignorados | Evidência |
| --- | ---: | ---: | ---: | --- |
| Native Node | 205 | 0 | 0 | [Saída](validation/node-tests.txt) |
| Chrome controlado | 35 | 0 | 0 | [Saída](validation/controlled-chrome.txt) |
| Páginas em rede real | 7 | 0 | 0 | [Saída](validation/live-pages.txt) |
| Imagens em rede real | 5 | 0 | 0 | [Saída](validation/live-images.txt) |
| API em rede real | 7 | 0 | 0 | [Saída](validation/live-api.txt) |
| Consistência histórica e de dados (subconjunto) | 144 | 0 | 0 | [Saída](validation/historical-data.txt) |
| Service Worker nativo (subconjunto) | 17 | 0 | 0 | [Saída](validation/service-worker.txt) |
| Sintaxe JavaScript | 39 | 0 | 0 | [Saída](validation/syntax.txt) |
| CSP centralizada | 1 | 0 | 0 | [Saída](validation/csp.txt) |
| Git whitespace | 1 | 0 | 0 | [Saída](validation/git-whitespace.txt) |

Total sem somar subconjuntos: **259 resultados do Node test runner aprovados**, zero falhas, cancelamentos ou testes ignorados.

Os totais do runner incluem os testes-pai: são 32 cenários controlados individuais, além de três wrappers; os serviços reais têm seis páginas, quatro cenários de imagem e seis verificações de API, além de três wrappers. Os subconjuntos histórico e Service Worker já pertencem a `npm test` e não devem ser somados novamente. [Resumo estruturado](validation/summary.json).

As seis páginas primárias — dashboard, pilotos, equipes, campeões, calendário e 404 — passaram com rede real. O teste registrou somente HTTP 200 nos serviços externos usados e nenhuma requisição externa malsucedida. Nos cenários normais de fotos: 35 JPEGs genuínos, zero fallback, zero exceções JavaScript e zero violações CSP inesperadas. As falhas de recurso provocadas no teste offline e na fonte bloqueada são esperadas e não foram contadas como fotos válidas. O teste de CSP da fase 1 provoca deliberadamente uma violação de origem não autorizada e verifica esse bloqueio.

A auditoria de imagens registra também mensagens de console de recursos esperados, incluindo a solicitação automática de favicon e as falhas offline, separadas de exceções JS em [browser/results.json](browser/results.json). A verificação de API pelo Node emitiu um aviso experimental de `localStorage` sem arquivo configurado; o fallback em memória funcionou. Isso não foi um erro da aplicação nem teste ignorado.

Durante a implementação, os testes detectaram fixtures antigas sem temporada/completude, um relógio que reiniciava a cada navegação, uma espera de upgrade que ainda observava o worker antigo, valores padrão indevidos em fixtures e overflow do seletor em 320px. Esses problemas foram corrigidos e os testes finais repetidos. Uma asserção nova que exigia navegação móvel na 404 foi corrigida para verificar o link de início que essa página efetivamente oferece. Nenhuma falha anterior foi ignorada ou removida para obter o resultado final. Permanecem todos os cenários legados, com contagens atualizadas para 35 campeões e shell de 25 recursos.

## 8. Remaining Technical Debt

| Prioridade | Item e efeito prático |
| --- | --- |
| P0 — Critical | Nenhum problema crítico identificado nas verificações executadas. |
| P1 — High | Nenhum defeito de alta prioridade conhecido permanece nos fluxos implementados e testados. |
| P2 — Medium | Poles de GP e agregados de carreira não verificados de pilotos ativos continuam indisponíveis. Uma futura implementação deve usar classificações qualificatórias adequadas ou snapshot revisado com data, sem confundir grid ou sprint. A ordenação está pronta para valores conhecidos e hoje desempata os ausentes deterministicamente. |
| P2 — Medium | Local de nascimento e métricas de circuitos — extensão, distância, voltas, estreia e recorde — precisam de revisão oficial por temporada/configuração antes de voltar a ser publicados. Os cartões e mapas continuam funcionando; não se conservaram números sem prova como se fossem atuais. |
| P2 — Medium | A API não fornece neste fluxo confirmação confiável de cancelamento, adiamento ou corrida em andamento. Se mantiver uma etapa cancelada no calendário sem resultado, a conclusão da temporada permanece não confirmada e a promoção automática do próximo ano será conservadora. É necessário calendário corrigido ou fonte oficial adicional para resolver esse caso sem inferência. |
| P2 — Medium | O arquivo de campeões e os totais históricos têm corte em 2025. Avançar o corte exige revisar temporada oficialmente concluída, título, resultados completos, equipes e eventuais novas fotos. Metadados de chefes/chassis também são snapshots datados, não atualização ao vivo. |
| P3 — Low | A validação verifica estrutura, completude, identidade, coerência temporal e evolução; não consegue provar que todo valor esportivo fornecido por terceiros é verdadeiro. Não há espelho completo oficial da FIA nem monitoramento permanente de divergências. Fontes oficiais foram usadas para resolver/conferir os pontos históricos e metadados descritos. |
| P3 — Low | Há limite de 100 itens por requisição. Coleção truncada é recusada; uma expansão futura além desse limite precisará de paginação completa, nunca de aceitar uma página como conjunto inteiro. |
| P3 — Low | Fotografias, uniformes, fontes e API continuam dependendo dos provedores. O teste de hashes detecta troca de bytes e exige nova revisão de identidade/licença. Não foram colocadas fotos externas no cache offline. O favicon de raiz permanece uma limitação herdada e não afeta o shell. |

Não há pendência de licença ou fotografia indisponível nas 35 fontes aprovadas durante esta validação. Disponibilidade de rede é uma observação datada, não garantia de uptime. O status com dívida registra principalmente cobertura de metadados/estatísticas e limites do fornecedor, não sucesso de validações que não foram executadas.

## 9. Regression and Compatibility Assessment

| Garantia anterior | Resultado |
| --- | --- |
| Vanilla JS, HTML, CSS e hospedagem estática | Preservados; sem nova infraestrutura ou dependência. |
| Shell completo e atualização segura | 25 recursos verificados atomicamente. Baselines v13 e v3 continuam testados; novo cenário usa o v4 real do HEAD inicial e confirma v4 → v5 com fechamento dos clientes antigos. |
| Isolamento de cache | Namespace por diretório, limpeza apenas de caches do app e legados exatos; caches alheios preservados. |
| Transporte, frescor e recuperação | Testes legados de 60 minutos, sete dias, armazenamento bloqueado, requisição compartilhada, refresh não destrutivo e timestamp original continuam passando. |
| API e imagens externas fora do Service Worker | Preservado. Nenhuma foto obrigatória no precache; fallback SVG local mantido. |
| CSP | Gerador original e allowlist exata preservados, sem wildcard, `unsafe-inline` ou `unsafe-eval`; zero violações inesperadas. |
| Imagens históricas | Todas as 33 URLs/créditos anteriores preservados; 35 fotos verificadas e créditos acessíveis. |
| Acessibilidade | Estados de erro/retry, anúncios, links de fonte/licença, alt, teclado e reduced motion verificados. |
| Navegação e responsividade | Páginas e seletores mantidos; consultas e expansão preservadas; seis páginas em 320/390px. |
| GitHub Pages `/F1/` e 404 | Escopo, import de módulos, navegação offline, queries e 404 aninhada preservados. |

Limite deliberado de compatibilidade de dados: o antigo endpoint sem temporada para campeões foi substituído por arquivo revisado, e números sem procedência não são mais exibidos. Essas são correções de integridade explícitas, não alterações de cache nem uma promessa de preenchimento de estatísticas indisponíveis.

## 10. Final Git Status

Branch: **main**. HEAD inicial e final: **5269a9e694ba2ac2cd6ddc686c0d6dda7c33ea24**, inalterado. Origem: [AndersonCav/F1](https://github.com/AndersonCav/F1).

**22 arquivos rastreados modificados; 54 novos arquivos não rastreados; 0 alterações staged.** Todos os arquivos rastreados modificados estão unstaged. O inventário da seção 6 distingue cada categoria. [Status completo](validation/git-status.txt).

```text
 M README.md
 M assets/css/styles-v7.css
 M assets/js/api.js
 M assets/js/calendar.js
 M assets/js/champions.js
 M assets/js/drivers-v10.js
 M assets/js/main-v10.js
 M assets/js/static-data.js
 M assets/js/teams-v10.js
 M assets/js/ui-utils.js
 M calendar.html
 M drivers.html
 M index.html
 M package.json
 M sw.js
 M tests/browser/champion-images.browser.mjs
 M tests/browser/champion-images.live.mjs
 M tests/browser/live.browser.mjs
 M tests/browser/phase1.browser.mjs
 M tests/champion-images.test.js
 M tests/helpers/champion-browser.js
 M tests/helpers/http-server.js
?? assets/js/champion-history.js
?? assets/js/circuit-metadata.js
?? assets/js/constructor-metadata.js
?? assets/js/data-model.js
?? assets/js/driver-metadata.js
?? assets/js/historical-snapshots.js
?? assets/js/season.js
?? docs/phase-2/REPORT.md
?? docs/phase-2/browser/404.html.png
?? docs/phase-2/browser/champions.html.png
?? docs/phase-2/browser/desktop-first.png
?? docs/phase-2/browser/desktop-last.png
?? docs/phase-2/browser/desktop-middle.png
?? docs/phase-2/browser/identity-contact-sheet.png
?? docs/phase-2/browser/index.html.png
?? docs/phase-2/browser/mobile-first.png
?? docs/phase-2/browser/mobile-last.png
?? docs/phase-2/browser/mobile-middle.png
?? docs/phase-2/browser/phase2-results.json
?? docs/phase-2/browser/results.json
?? docs/phase-2/image-audit.json
?? docs/phase-2/initial-state.json
?? docs/phase-2/sources/championship-seasons.json
?? docs/phase-2/sources/constructor-metadata-2026.json
?? docs/phase-2/sources/constructor-titles-through-2025.json
?? docs/phase-2/sources/farina-commons.json
?? docs/phase-2/sources/farina-probe.json
?? docs/phase-2/sources/gp-winners-through-2025.json
?? docs/phase-2/sources/norris-commons.json
?? docs/phase-2/sources/norris-probe.json
?? docs/phase-2/sources/official-hall-of-fame.json
?? docs/phase-2/validation/controlled-chrome.txt
?? docs/phase-2/validation/csp.txt
?? docs/phase-2/validation/git-status.txt
?? docs/phase-2/validation/git-whitespace.txt
?? docs/phase-2/validation/historical-data.txt
?? docs/phase-2/validation/live-api.json
?? docs/phase-2/validation/live-api.txt
?? docs/phase-2/validation/live-images.txt
?? docs/phase-2/validation/live-pages.txt
?? docs/phase-2/validation/node-tests.txt
?? docs/phase-2/validation/service-worker.txt
?? docs/phase-2/validation/summary.json
?? docs/phase-2/validation/syntax.txt
?? scripts/audit-phase2.mjs
?? scripts/build-phase2-references.mjs
?? scripts/verify-champion-seasons.mjs
?? scripts/verify-constructors.mjs
?? scripts/verify-history.mjs
?? tests/api-domain.test.js
?? tests/browser/live-api.mjs
?? tests/browser/phase2.browser.mjs
?? tests/data-integrity.test.js
?? tests/helpers/sporting-fixtures.js
```

Não houve commit, push, merge, deploy, branch nova, reset, clean, restore, alteração de configuração remota ou modificação de infraestrutura. Todo o resultado permanece local e revisável na árvore de trabalho.
