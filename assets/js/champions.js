import { CHAMPIONS_HISTORY, setImageFallback, setupNavActiveState, toFlag } from "./static-data.js";
import { renderSkeleton, renderEmptyState, announceToScreenReader } from "./ui-utils.js";

const stateContainer = document.getElementById("champions-state");
const titlesFilter = document.getElementById("titles-filter");
const sortSelect = document.getElementById("sort-select");
const searchInput = document.getElementById('search-input');
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

function readQueryParams() {
  const params = new URL(window.location.href).searchParams;
  const allowedSort = ["titles", "name", "firstYear"];
  const allowedFilter = ["all", "1", "2", "3plus", "5plus"];

  return {
    sort: allowedSort.includes(params.get("sort")) ? params.get("sort") : "titles",
    filter: allowedFilter.includes(params.get("filter")) ? params.get("filter") : "all"
  };
}

function writeQueryParams(sort, filter) {
  const url = new URL(window.location.href);
  url.searchParams.set("sort", sort);
  url.searchParams.set("filter", filter);
  if (searchInput.value) url.searchParams.set('q', searchInput.value);
  else url.searchParams.delete('q');
  window.history.replaceState({}, "", url);
}

function filterItems(items, filter) {
  if (filter === "1") {
    return items.filter((item) => item.titleYears.length === 1);
  }

  if (filter === "2") {
    return items.filter((item) => item.titleYears.length === 2);
  }

  if (filter === "3plus") {
    return items.filter((item) => item.titleYears.length >= 3);
  }

  if (filter === "5plus") {
    return items.filter((item) => item.titleYears.length >= 5);
  }

  return items;
}

function sortItems(items, sortBy) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name, "pt-BR");
    }

    if (sortBy === "firstYear") {
      return a.titleYears[0] - b.titleYears[0];
    }

    const titleDiff = b.titleYears.length - a.titleYears.length;
    if (titleDiff !== 0) {
      return titleDiff;
    }

    return b.titleYears[b.titleYears.length - 1] - a.titleYears[a.titleYears.length - 1];
  });

  return sorted;
}

function createCard(champion) {
  const article = document.createElement("article");
  article.className = "champion-card reveal-up";

  const header = document.createElement("div");
  header.className = "champion-header";

  const image = document.createElement("img");
  image.className = "portrait";
  image.src = champion.photo;
  image.alt = `Foto de ${champion.name}`;
  image.width = 100;
  image.height = 100;
  image.loading = "lazy";
  image.decoding = "async";
  setImageFallback(image);

  const textWrap = document.createElement("div");
  const name = document.createElement("h2");
  name.className = "name";
  name.textContent = champion.name;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `${toFlag(champion.nationalityCode)} ${champion.nationality}`;

  const years = document.createElement("p");
  years.className = "muted";
  years.textContent = `Títulos: ${champion.titleYears.join(", ")}`;

  const wins = document.createElement("p");
  wins.className = "muted";
  wins.textContent = `Vitórias de GP até ${champion.throughSeason}: ${champion.wins}`;

  textWrap.append(name, meta, years, wins);

  const count = document.createElement("span");
  count.className = "title-count";
  count.textContent = `${champion.titleYears.length} ${champion.titleYears.length === 1 ? 'título mundial' : 'títulos mundiais'}`;

  header.append(image, textWrap, count);

  const details = document.createElement("details");
  details.className = "details";
  const summary = document.createElement('summary');
  summary.textContent = 'História e créditos';
  const summaryName = document.createElement('span');
  summaryName.className = 'sr-only';
  summaryName.textContent = ` de ${champion.name}`;
  summary.append(summaryName);
  details.append(summary);

  const dl = document.createElement("dl");
  const pairs = [
    ["Primeiro título", String(champion.titleYears[0])],
    ["Último título", String(champion.titleYears[champion.titleYears.length - 1])],
    ["Vitórias de GP até 2025", String(champion.wins)],
    ["Equipes campeãs", champion.teams.join(" / ")]
  ];

  pairs.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    dl.append(dt, dd);
  });

  details.appendChild(dl);
  const historySource = document.createElement('a');
  historySource.href = champion.source;
  historySource.textContent = 'Fonte: F1 Hall of Fame · títulos até 2025';
  details.appendChild(historySource);

  const credit = document.createElement("p");
  credit.className = "photo-credit muted";
  const source = document.createElement("a");
  source.href = champion.photoCredit.sourceUrl;
  source.textContent = champion.photoCredit.attribution;
  source.title = decodeURIComponent(new URL(source.href).pathname.replace("/wiki/File:", "")).replaceAll("_", " ");
  source.setAttribute("aria-label", `Fonte da foto de ${champion.name}: ${champion.photoCredit.attribution}`);
  const license = document.createElement("a");
  license.href = champion.photoCredit.licenseUrl;
  license.textContent = champion.photoCredit.license;
  credit.append("Foto: ", source, " · ", license, ". Miniatura enquadrada.");
  details.appendChild(credit);

  article.append(header, details);
  return article;
}

function render() {
  const query = normalize(searchInput.value.trim());
  const filtered = filterItems(CHAMPIONS_HISTORY, titlesFilter.value).filter(item => normalize(item.name).includes(query));
  const sorted = sortItems(filtered, sortSelect.value);
  document.getElementById('result-count').textContent = `${sorted.length} de 35 campeões · títulos de 1950 a 2025`;
  announceToScreenReader(`${sorted.length} campeões exibidos.`);

  if (sorted.length === 0) {
    renderEmptyState(stateContainer, "Nenhum campeão encontrado para este filtro.");
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-champions";
  sorted.forEach((champion) => grid.appendChild(createCard(champion)));
  stateContainer.replaceChildren(grid);
  
}

function init() {
  setupNavActiveState();
  renderSkeleton(stateContainer, 6, "grid");

  const query = readQueryParams();
  sortSelect.value = query.sort;
  titlesFilter.value = query.filter;
  searchInput.value = new URL(window.location.href).searchParams.get('q') || '';

  const onControlsChange = () => {
    writeQueryParams(sortSelect.value, titlesFilter.value);
    render();
  };

  sortSelect.addEventListener("change", onControlsChange);
  titlesFilter.addEventListener("change", onControlsChange);
  searchInput.addEventListener('input', onControlsChange);

  render();
}

init();
