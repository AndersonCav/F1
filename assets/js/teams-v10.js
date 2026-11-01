import { fetchCurrentConstructorStandings, fetchCurrentDriverStandings } from "./api.js";
import { PLACEHOLDER_DRIVER_IMAGE, TEAM_STATIC, getOfficialTeamName, setImageFallback, setupNavActiveState } from "./static-data.js";
import { renderSkeleton, renderError, showCacheFeedback, announceToScreenReader } from "./ui-utils.js";

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
      return b.historicWins - a.historicWins;
    }

    if (sortBy === "championships") {
      return b.championships - a.championships;
    }

    return a.position - b.position;
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
  logo.src = team.logo;
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
  meta.textContent = `PILOTOS ${team.drivers.join(" / ") || "-"}`;

  const badges = document.createElement("div");
  badges.className = "kpis";

  const positionBadge = document.createElement("span");
  positionBadge.className = "badge badge-accent";
  positionBadge.textContent = `POS ${team.position}`;

  const pointsBadge = document.createElement("span");
  pointsBadge.className = "badge";
  pointsBadge.textContent = `${team.points} PTS`;

  badges.append(positionBadge, pointsBadge);
  textWrap.append(nameBrand, nameOfficial, meta, badges);

  const metrics = document.createElement("span");
  metrics.className = "driver-number";
  metrics.textContent = String(team.historicWins);
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
      ["Vitórias históricas", String(team.historicWins)],
      ["Campeonatos", String(team.championships)]
    ];

    pairs.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "detail-item";
      
      const dt = document.createElement("span");
      dt.className = "detail-label";
      dt.textContent = label;

      const dd = document.createElement("div");
      dd.className = "detail-value";
      dd.textContent = value || "-";

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
    const [constructorStandingsResult, driverStandingsResult] = await Promise.all([
      fetchCurrentConstructorStandings(),
      fetchCurrentDriverStandings()
    ]);

    const constructorStandings = constructorStandingsResult.items;
    const driverStandings = driverStandingsResult.items;
    
    showCacheFeedback(constructorStandingsResult, driverStandingsResult);

    const driverGroups = new Map();
    driverStandings.forEach((entry) => {
      const constructor = entry.Constructors?.[0];
      if (!constructor) {
        return;
      }
      const list = driverGroups.get(constructor.constructorId) || [];
      list.push(`${entry.Driver.givenName} ${entry.Driver.familyName}`.trim());
      driverGroups.set(constructor.constructorId, list);
    });

    teamsData = constructorStandings.map((entry) => {
      const id = entry.Constructor.constructorId;
      const staticData = TEAM_STATIC[id] || {};
      const rawName = entry.Constructor.name;
      return {
        id,
        shortName: rawName,
        name: getOfficialTeamName(rawName),
        position: Number(entry.position || 0),
        points: Number(entry.points || 0),
        wins: Number(entry.wins || 0),
        drivers: driverGroups.get(id) || [],
        logo: staticData.logo || PLACEHOLDER_DRIVER_IMAGE,
        carImage: staticData.carImage || null,
        chassis: staticData.chassis || "-",
        powerUnit: staticData.powerUnit || "-",
        base: staticData.base || "-",
        technicalChief: staticData.technicalChief || "-",
        historicWins: Number(staticData.historicWins || 0),
        championships: Number(staticData.championships || 0),
        principal: staticData.principal || "-"
      };
    });

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
