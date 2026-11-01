import { fetchCurrentDriverStandings, fetchDrivers } from "./api.js";
import { DRIVER_STATIC, PLACEHOLDER_DRIVER_IMAGE, TEAM_STATIC, getOfficialTeamName, setImageFallback, setupNavActiveState, toFlagUrl } from "./static-data.js";
import { renderSkeleton, renderError, renderEmptyState, showCacheFeedback, announceToScreenReader } from "./ui-utils.js";

const stateContainer = document.getElementById("drivers-state");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");

const TEAM_COLOR_MAP = {
  ferrari: "#e10600",
  mercedes: "#00d2be",
  mclaren: "#ff8000",
  "red bull": "#1e5bc6",
  "red bull racing": "#1e5bc6",
  "racing bulls": "#2b5cff",
  rb: "#2b5cff",
  "rb f1 team": "#2b5cff",
  alpine: "#0090ff",
  williams: "#005aff",
  "aston martin": "#006f62",
  "haas": "#b6babd",
  "haas f1 team": "#b6babd",
  audi: "#c70000",
  sauber: "#00c087",
  "stake f1 team kick sauber": "#00c087",
  cadillac: "#9ca3af"
};

let driversData = [];
let expandedCardId = null;

function updateSortInUrl(value) {
  const url = new URL(window.location.href);
  url.searchParams.set("sort", value);
  window.history.replaceState({}, "", url);
}

function getSortFromUrl() {
  const value = new URL(window.location.href).searchParams.get("sort");
  const allowed = ["standing", "name", "team", "points", "wins", "poles"];
  return allowed.includes(value) ? value : "standing";
}

function applySort(items, sortBy) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    if (sortBy === "name") {
      return a.fullName.localeCompare(b.fullName, "pt-BR");
    }

    if (sortBy === "team") {
      return (a.team || "").localeCompare(b.team || "", "pt-BR");
    }

    if (sortBy === "points") {
      return b.points - a.points;
    }

    if (sortBy === "wins") {
      return b.wins - a.wins;
    }

    if (sortBy === "poles") {
      return b.poles - a.poles;
    }

    return a.position - b.position;
  });

  return sorted;
}

function filterDrivers(items, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return items;
  }

  return items.filter((driver) => driver.fullName.toLowerCase().includes(normalized));
}

function createBadge(label, value) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${label} ${value}`;
  return badge;
}

function normalizeTeamName(teamName) {
  return String(teamName || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveTeamColor(teamName, staticColor) {
  const normalized = normalizeTeamName(teamName);
  return TEAM_COLOR_MAP[normalized] || staticColor || "#e10600";
}

function normalizeDriverKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveDriverStaticData(driver, profile) {
  const byId = normalizeDriverKey(driver?.driverId);
  if (byId && DRIVER_STATIC[byId]) {
    return DRIVER_STATIC[byId];
  }

  const fullNameKey = normalizeDriverKey(`${profile?.givenName || driver?.givenName || ""}_${profile?.familyName || driver?.familyName || ""}`);
  if (fullNameKey && DRIVER_STATIC[fullNameKey]) {
    return DRIVER_STATIC[fullNameKey];
  }

  return {};
}

function appendDetailRow(container, label, value, linkHref = "") {
  const item = document.createElement("div");
  item.className = "detail-item";

  const dt = document.createElement("span");
  dt.className = "detail-label";
  dt.textContent = label;

  const dd = document.createElement("div");
  dd.className = "detail-value";
  
  if (linkHref) {
    const link = document.createElement("a");
    link.href = linkHref;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `Acessar ${label.toLowerCase()}`;
    dd.appendChild(link);
  } else {
    dd.textContent = value;
  }

  item.append(dt, dd);
  container.append(item);
}

function buildDriverCard(driver) {
  const article = document.createElement("article");
  article.className = "driver-card reveal-up";

  const header = document.createElement("div");
  header.className = "driver-header";

  const image = document.createElement("img");
  image.className = "portrait";
  image.src = driver.photo;
  image.alt = `Foto do piloto ${driver.fullName}`;
  image.loading = "lazy";
  setImageFallback(image);

  const textWrap = document.createElement("div");
  const name = document.createElement("h3");
  name.className = "name";
  name.textContent = driver.fullName;

  const meta = document.createElement("div");
  meta.className = "meta";

  const nationalityFlag = document.createElement("img");
  nationalityFlag.className = "driver-flag-inline";
  nationalityFlag.src = toFlagUrl(driver.nationality);
  nationalityFlag.alt = `Bandeira ${driver.nationality || ""}`.trim();
  nationalityFlag.loading = "lazy";
  setImageFallback(nationalityFlag);

  const teamLogo = document.createElement("img");
  teamLogo.className = "team-logo-inline";
  teamLogo.src = driver.teamLogo || "";
  teamLogo.alt = `Logo ${driver.shortTeam}`;
  teamLogo.loading = "lazy";
  if (!driver.teamLogo) {
    teamLogo.style.display = "none";
  }
  setImageFallback(teamLogo);

  const teamName = document.createElement("span");
  teamName.textContent = driver.shortTeam;

  meta.append(nationalityFlag, teamLogo, teamName);

  const badges = document.createElement("div");
  badges.className = "kpis";
  badges.append(
    createBadge("PTS", driver.points),
    createBadge("VITORIAS", driver.wins),
    createBadge("POLES", driver.poles)
  );

  textWrap.append(name, meta, badges);

  const number = document.createElement("span");
  number.className = "driver-number";
  number.style.color = driver.teamColor;
  number.textContent = String(driver.number || "-");

  header.append(image, textWrap, number);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "expand-btn";
  button.setAttribute("aria-expanded", String(expandedCardId === driver.id));
  button.textContent = expandedCardId === driver.id ? "Ocultar detalhes" : "Ver detalhes";
  button.addEventListener("click", () => {
    expandedCardId = expandedCardId === driver.id ? null : driver.id;
    renderDrivers();
  });

  article.append(header, button);

  if (expandedCardId === driver.id) {
    const details = document.createElement("div");
    details.className = "details";

    const detailsGrid = document.createElement("div");
    detailsGrid.className = "race-details-grid"; // Reusing the same grid style for expanded details

    appendDetailRow(detailsGrid, "Posicao", String(driver.position));
    appendDetailRow(detailsGrid, "Equipe", driver.fullTeam);
    appendDetailRow(detailsGrid, "Pontos", String(driver.points));
    appendDetailRow(detailsGrid, "Vitorias", String(driver.wins));
    appendDetailRow(detailsGrid, "Poles", String(driver.poles));
    appendDetailRow(detailsGrid, "Nascimento", driver.dateOfBirth || "-");
    appendDetailRow(detailsGrid, "Local de nascimento", driver.placeOfBirth || "-");
    appendDetailRow(detailsGrid, "Nacionalidade", driver.nationality || "-");

    if (driver.website) {
      appendDetailRow(detailsGrid, "Site oficial do piloto", "", driver.website);
    } else {
      appendDetailRow(detailsGrid, "Site oficial do piloto", "Nao informado");
    }

    details.appendChild(detailsGrid);
    article.appendChild(details);
  }

  return article;
}

function renderDrivers() {
  const query = searchInput.value;
  const sortBy = sortSelect.value;

  const filtered = filterDrivers(driversData, query);
  const sorted = applySort(filtered, sortBy);

  if (sorted.length === 0) {
    renderEmptyState(stateContainer, "Nenhum piloto encontrado com os filtros atuais.");
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid grid-drivers";

  sorted.forEach((driver) => {
    grid.appendChild(buildDriverCard(driver));
  });

  stateContainer.replaceChildren(grid);
  
  if (query) {
    announceToScreenReader(`${sorted.length} pilotos encontrados para "${query}"`);
  }
}

async function loadDrivers() {
  renderSkeleton(stateContainer);

  try {
    const currentYear = new Date().getFullYear();
    const [driverStandingsResult, allDriversResult] = await Promise.all([
      fetchCurrentDriverStandings(),
      fetchDrivers(currentYear)
    ]);

    const driverStandings = driverStandingsResult.items;
    const allDrivers = allDriversResult.items;
    
    showCacheFeedback(driverStandingsResult, allDriversResult);

    const driversById = new Map(allDrivers.map((entry) => [entry.driverId, entry]));

    driversData = driverStandings.map((standing) => {
      const driver = standing.Driver || {};
      const id = driver.driverId;
      const profile = driversById.get(id) || driver;
      const staticData = resolveDriverStaticData(driver, profile);
      const constructorId = standing.Constructors?.[0]?.constructorId || "";
      const rawTeamName = standing.Constructors?.[0]?.name || "Equipe nao informada";

      return {
        id,
        position: Number(standing.position || 0),
        fullName: `${driver.givenName || ""} ${driver.familyName || ""}`.trim(),
        shortTeam: rawTeamName,
        fullTeam: getOfficialTeamName(rawTeamName),
        points: Number(standing.points || 0),
        wins: Number(standing.wins || 0),
        poles: Number(staticData.poles || 0),
        number: staticData.number || profile.permanentNumber || "-",
        nationality: profile.nationality || driver.nationality || "",
        dateOfBirth: staticData.dateOfBirth || profile.dateOfBirth || "",
        placeOfBirth: staticData.placeOfBirth || "",
        photo: staticData.photo || PLACEHOLDER_DRIVER_IMAGE,
        website: staticData.website || "",
        teamLogo: TEAM_STATIC[constructorId]?.logo || "",
        teamColor: resolveTeamColor(rawTeamName, staticData.teamColor)
      };
    });

    renderDrivers();
  } catch {
    renderError(stateContainer, "Não foi possível carregar os pilotos agora.", loadDrivers);
  }
}

function init() {
  setupNavActiveState();

  const sortFromUrl = getSortFromUrl();
  sortSelect.value = sortFromUrl;

  sortSelect.addEventListener("change", () => {
    updateSortInUrl(sortSelect.value);
    renderDrivers();
  });

  searchInput.addEventListener("input", renderDrivers);

  loadDrivers();
}

init();
