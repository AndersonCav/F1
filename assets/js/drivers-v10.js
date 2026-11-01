import { sortDrivers as applySort, filterDrivers, mapDriver, displayValue } from './data-model.js';
import { fetchCurrentDriverStandings, fetchDrivers } from "./api.js";
import { DRIVER_STATIC, PLACEHOLDER_DRIVER_IMAGE, TEAM_STATIC, setImageFallback, setupNavActiveState, toFlagUrl } from "./static-data.js";
import { renderSkeleton, renderError, renderEmptyState, showCacheFeedback, announceToScreenReader } from "./ui-utils.js";

const stateContainer = document.getElementById("drivers-state");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");

let driversData = [];
let loadedSeason = null;
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

function createBadge(label, value) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${label} ${displayValue(value)}`;
  return badge;
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
    dd.textContent = displayValue(value);
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
    createBadge("VITÓRIAS GP", driver.wins),
    createBadge("POLES GP", driver.poles)
  );

  textWrap.append(name, meta, badges);

  const number = document.createElement("span");
  number.className = "driver-number";
  number.style.color = driver.teamColor;
  number.textContent = driver.number || "—";
  number.title = "Número permanente informado pela API";

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

    appendDetailRow(detailsGrid, "Posicao", displayValue(driver.position));
    appendDetailRow(detailsGrid, "Equipe", driver.fullTeam);
    appendDetailRow(detailsGrid, "Vínculo", driver.association);
    appendDetailRow(detailsGrid, "Estatísticas", `Jolpica · temporada ${driver.season}, etapa ${driver.round}. Pontos incluem sprints; vitórias contam apenas GP. Poles de GP não agregadas.`);
    appendDetailRow(detailsGrid, "Pontos", displayValue(driver.points));
    appendDetailRow(detailsGrid, "Vitorias", displayValue(driver.wins));
    appendDetailRow(detailsGrid, "Poles", displayValue(driver.poles));
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
    renderEmptyState(stateContainer, driversData.length ? "Nenhum piloto encontrado com os filtros atuais." : `Classificação de pilotos ainda não publicada para a temporada ${loadedSeason || 'não informada'}.`);
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
    const driverStandingsResult = await fetchCurrentDriverStandings();
    const season = driverStandingsResult.season;
    loadedSeason = season;
    const allDriversResult = season ? await fetchDrivers(season).catch(() => null) : null;
    showCacheFeedback(driverStandingsResult, ...[allDriversResult].filter(Boolean));
    const profiles = new Map((allDriversResult?.items || []).map(d => [d.driverId, d]));
    driversData = driverStandingsResult.items.map(standing => {
      const profile = profiles.get(standing.Driver.driverId) || standing.Driver;
      const driver = mapDriver(standing, profile, resolveDriverStaticData(standing.Driver, profile), season, TEAM_STATIC);
      return { ...driver, photo: driver.photo || PLACEHOLDER_DRIVER_IMAGE, round: driverStandingsResult.round };
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
  searchInput.value = new URL(window.location.href).searchParams.get('q') || '';

  sortSelect.addEventListener("change", () => {
    updateSortInUrl(sortSelect.value);
    renderDrivers();
  });

  searchInput.addEventListener("input", () => {
    const url = new URL(window.location.href);
    if (searchInput.value) url.searchParams.set('q', searchInput.value);
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
    renderDrivers();
  });

  loadDrivers();
}

init();
