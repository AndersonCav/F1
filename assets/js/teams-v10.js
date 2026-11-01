import { mapConstructor, compareNumber, displayValue } from './data-model.js';
import { CONSTRUCTOR_SNAPSHOTS } from './historical-snapshots.js';
import { fetchCurrentConstructorStandings, fetchCurrentDriverStandings } from "./api.js";
import { PLACEHOLDER_DRIVER_IMAGE, TEAM_STATIC, setImageFallback, setupNavActiveState } from "./static-data.js";
import { renderSkeleton, renderError, showCacheFeedback } from "./ui-utils.js";

const stateContainer = document.getElementById("teams-state");
const sortSelect = document.getElementById("sort-select");

let teamsData = [];
let expandedTeamId = null;

function getSortFromUrl() {
  const sort = new URL(window.location.href).searchParams.get("sort");
  const allowed = ["standing", "name", "wins", "championships"];
  return allowed.includes(sort) ? sort : "standing";
}

function updateSortInUrl(value) {
  const url = new URL(window.location.href);
  url.searchParams.set("sort", value);
  window.history.replaceState({}, "", url);
}

function applySort(items, sortBy) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sortBy === "name") {
      return a.shortName.localeCompare(b.shortName, "pt-BR");
    }

    if (sortBy === "wins") {
      return compareNumber(a.historicWins, b.historicWins, true) || a.shortName.localeCompare(b.shortName, "pt-BR");
    }

    if (sortBy === "championships") {
      return compareNumber(a.championships, b.championships, true) || a.shortName.localeCompare(b.shortName, "pt-BR");
    }

    return compareNumber(a.position, b.position) || a.shortName.localeCompare(b.shortName, "pt-BR");
  });

  return sorted;
}

function createTeamCard(team) {
  const article = document.createElement("article");
  article.className = "team-card reveal-up";

  const header = document.createElement("div");
  header.className = "team-header";

  const logo = document.createElement("img");
  logo.className = "logo";
  logo.src = team.logo || PLACEHOLDER_DRIVER_IMAGE;
  logo.alt = `Logo da equipe ${team.name}`;
  logo.loading = "lazy";
  // Force styles inline to bypass zombie CSS caches
  logo.style.background = "rgba(255, 255, 255, 0.05)";
  logo.style.padding = "8px";
  logo.style.objectFit = "contain";
  setImageFallback(logo);

  const textWrap = document.createElement("div");
  textWrap.className = "team-text-wrap";

  const nameBrand = document.createElement("h3");
  nameBrand.className = "name-brand";
  nameBrand.textContent = team.shortName;

  const nameOfficial = document.createElement("p");
  nameOfficial.className = "name-official";
  nameOfficial.textContent = team.name;

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = `PILOTOS NA TEMPORADA ${team.drivers.join(" / ") || "Não disponíveis"}`;

  const badges = document.createElement("div");
  badges.className = "kpis";

  const positionBadge = document.createElement("span");
  positionBadge.className = "badge badge-accent";
  positionBadge.textContent = `POS ${displayValue(team.position)}`;

  const pointsBadge = document.createElement("span");
  pointsBadge.className = "badge";
  pointsBadge.textContent = `${displayValue(team.points)} PTS`;

  badges.append(positionBadge, pointsBadge);
  textWrap.append(nameBrand, nameOfficial, meta, badges);

  const metrics = document.createElement("span");
  metrics.className = "driver-number";
  metrics.textContent = displayValue(team.historicWins);
  metrics.title = "Vitórias de GP até 2025; mesma identidade de construtor";
  metrics.style.fontSize = "1.55rem";

  header.append(logo, textWrap, metrics);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "expand-btn";
  button.textContent = expandedTeamId === team.id ? "Ocultar detalhes" : "Ver detalhes";
  button.setAttribute("aria-expanded", String(expandedTeamId === team.id));
  button.addEventListener("click", () => {
    expandedTeamId = expandedTeamId === team.id ? null : team.id;
    renderTeams();
  });

  article.append(header, button);

  if (expandedTeamId === team.id) {
    const details = document.createElement("div");
    details.className = "details";

    if (team.carImage) {
      const carImage = document.createElement("img");
      carImage.src = team.carImage;
      carImage.alt = `Carro da equipe ${team.name}`;
      carImage.loading = "lazy";
      carImage.className = "portrait";
      carImage.style.height = "120px";
      carImage.style.objectFit = "contain";
      carImage.style.backgroundColor = "transparent";
      setImageFallback(carImage);
      details.appendChild(carImage);
    }

    const detailsGrid = document.createElement("div");
    detailsGrid.className = "race-details-grid";

    const pairs = [
      ["Chefe de equipe", team.principal],
      ["Chefe técnico", team.technicalChief],
      ["Chassi", team.chassis],
      ["Motor", team.powerUnit],
      ["Base", team.base],
      ["Vitórias de GP até 2025", displayValue(team.historicWins)],
      ["Títulos de construtores até 2025", displayValue(team.championships)],
      ["Vitórias de GP na temporada", displayValue(team.wins)],
      ["Temporada da classificação", displayValue(team.season)],
      ["Referência dos metadados", team.referenceDate ? `F1 · temporada ${team.season} · verificado ${team.referenceDate}` : null]
    ];

    pairs.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "detail-item";
      
      const dt = document.createElement("span");
      dt.className = "detail-label";
      dt.textContent = label;

      const dd = document.createElement("div");
      dd.className = "detail-value";
      dd.textContent = displayValue(value);

      item.append(dt, dd);
      detailsGrid.append(item);
    });

    details.appendChild(detailsGrid);
    article.appendChild(details);
  }

  return article;
}

function renderTeams() {
  const sorted = applySort(teamsData, sortSelect.value);

  if (sorted.length === 0) {
    const empty = document.createElement("article");
    empty.className = "state-card";
    empty.textContent = "Nenhuma equipe disponível nesta temporada.";
    stateContainer.replaceChildren(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-teams";

  sorted.forEach((team) => grid.appendChild(createTeamCard(team)));
  stateContainer.replaceChildren(grid);
}

async function loadTeams() {
  renderSkeleton(stateContainer, 6, "grid");

  try {
    const constructorStandingsResult = await fetchCurrentConstructorStandings();
    const season = constructorStandingsResult.season;
    const driverStandingsResult = season ? await fetchCurrentDriverStandings(season).catch(() => null) : null;
    showCacheFeedback(constructorStandingsResult, ...[driverStandingsResult].filter(Boolean));
    teamsData = constructorStandingsResult.items.map(entry => mapConstructor(entry,
      driverStandingsResult?.items || [], TEAM_STATIC[entry.Constructor.constructorId],
      CONSTRUCTOR_SNAPSHOTS[entry.Constructor.constructorId], season));
    renderTeams();
  } catch {
    renderError(stateContainer, "Não foi possível carregar as equipes agora.", loadTeams);
  }
}

function init() {
  setupNavActiveState();

  sortSelect.value = getSortFromUrl();
  sortSelect.addEventListener("change", () => {
    updateSortInUrl(sortSelect.value);
    renderTeams();
  });

  loadTeams();
}

init();
