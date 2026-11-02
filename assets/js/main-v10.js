import { raceStart, countdownText, confirmedRaceKeys, resolveNextEvent } from './season.js';
import { displayValue } from './data-model.js';
import {
  fetchCurrentConstructorStandings,
  fetchCurrentDriverStandings,
  fetchCurrentResults,
  fetchCurrentSchedule,
  fetchScheduleBySeason,
  fetchSeasonWinners
} from "./api.js";
import {
  CIRCUIT_STATIC,
  DRIVER_STATIC,
  PLACEHOLDER_DRIVER_IMAGE,
  formatRaceDate,
  getOfficialRaceName,
  setupNavActiveState,
  TEAM_STATIC,
  toFlagUrl,
  translateCountry,
  getOfficialTeamName,
  setImageFallback
} from "./static-data.js";
import { renderError, showCacheFeedback } from "./ui-utils.js";

const nextRaceState = document.getElementById("next-race-state");
const lastRaceState = document.getElementById("last-race-state");
const quickStandingsState = document.getElementById("quick-standings-state");
const currentYearElement = document.getElementById("current-year");

let countdownInterval = null;

function createSkeletonBlock(lines = 4) {
  const card = document.createElement("div");
  card.className = "skeleton-card";
  card.setAttribute("role", "status");
  card.setAttribute("aria-label", "Carregando dados…");

  for (let i = 0; i < lines; i += 1) {
    const line = document.createElement("div");
    line.className = `skeleton skeleton-line ${i === 0 ? "short" : "medium"}`;
    card.appendChild(line);
  }

  return card;
}

function buildDetailItem(label, value) {
  const item = document.createElement("div");
  item.className = "detail-item";
  
  const lbl = document.createElement("span");
  lbl.className = "detail-label";
  lbl.textContent = label;
  
  const val = document.createElement("span");
  val.className = "detail-value";
  val.textContent = value;
  
  item.append(lbl, val);
  return item;
}

function normalizeDriverKey(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveDriverStaticInfo(driver, season) {
  const byId = normalizeDriverKey(driver?.driverId);
  if (byId && DRIVER_STATIC[byId]) {
    return DRIVER_STATIC[byId].season === Number(season) ? DRIVER_STATIC[byId] : {};
  }

  const fullNameKey = normalizeDriverKey(`${driver?.givenName || ""}_${driver?.familyName || ""}`);
  if (fullNameKey && DRIVER_STATIC[fullNameKey]) {
    return DRIVER_STATIC[fullNameKey].season === Number(season) ? DRIVER_STATIC[fullNameKey] : {};
  }

  return {};
}

function resolveConstructorLogo(constructorId, season) {
  const key = (constructorId || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (TEAM_STATIC[key]?.season === Number(season)) {
    return TEAM_STATIC[key].logo;
  }
  return null;
}

function buildPodiumComponent(results, season) {
  const container = document.createElement("div");
  container.className = "podium-grid";

  results.forEach((result) => {
    const card = document.createElement("div");
    card.className = "podium-card";

    const rankEl = document.createElement("div");
    rankEl.className = "podium-rank";
    const position = Number(result.position);
    rankEl.textContent = `${position}º`;
    
    const staticInfo = resolveDriverStaticInfo(result.Driver, season);
    
    const avatar = document.createElement("img");
    avatar.className = "podium-avatar";
    avatar.src = staticInfo.photo || PLACEHOLDER_DRIVER_IMAGE;
    setImageFallback(avatar);
    avatar.alt = result.Driver.familyName;
    avatar.width = 44;
    avatar.height = 44;
    avatar.loading = 'lazy';
    if (staticInfo.teamColor) {
      avatar.style.borderColor = staticInfo.teamColor;
      card.style.borderLeftColor = staticInfo.teamColor;
    }

    const info = document.createElement("div");
    info.className = "podium-info";

    const code = document.createElement("div");
    code.className = "podium-code";
    code.textContent = `${result.Driver.givenName} ${result.Driver.familyName}`;

    const time = document.createElement("div");
    time.className = "podium-time";
    if (position === 1) {
      time.classList.add("winner");
      time.textContent = result.Time ? result.Time.time : "Vencedor";
    } else {
      time.classList.add("gap");
      time.textContent = result.Time ? result.Time.time.startsWith("+") ? result.Time.time : `+${result.Time.time}` : "Intervalo não publicado";
    }

    info.append(code, time);
    card.append(rankEl, avatar, info);
    container.appendChild(card);
  });

  return container;
}

function buildRaceDetailsGrid(race) {
  const grid = document.createElement("div");
  grid.className = "race-details-grid";

  const circuitKey = race.Circuit.circuitId.replace(/-/g, "_");
  const reference = CIRCUIT_STATIC[circuitKey];
  const staticInfo = reference?.season === Number(race.season) ? reference : {};

  grid.append(
    buildDetailItem("Largada programada · seu fuso", formatRaceDate(race.date, race.time)),
    buildDetailItem("CIRCUITO", race.Circuit.circuitName),
    buildDetailItem("Local", `${race.Circuit.Location.locality}, ${translateCountry(race.Circuit.Location.country)}`)
  );

  return grid;
}

function buildCountdownHud(eventTime) {
  const hud = document.createElement("div");
  hud.className = "countdown-hud";
  
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "Até a largada programada · sem acompanhamento ao vivo";
  
  const timer = document.createElement("span");
  timer.className = "timer";
  
  const updateTimer = () => {
    timer.textContent = countdownText(eventTime);
    if (eventTime === null || eventTime <= Date.now()) {
      window.clearInterval(countdownInterval);
      countdownInterval = null;
    }
  };

  if (countdownInterval) {
    window.clearInterval(countdownInterval);
  }
  countdownInterval = eventTime !== null && eventTime > Date.now() ? window.setInterval(updateTimer, 1000) : null;
  updateTimer();
  
  const wrapper = document.createElement("div");
  wrapper.className = "timer-wrapper";
  wrapper.append(label, timer);
  
  hud.append(wrapper);
  return hud;
}

function buildNextRaceCard(nextRace, isSeasonClosed = false) {
  const card = document.createElement("article");
  card.className = "card highlight reveal-up";

  const headerTop = document.createElement("div");
  headerTop.className = "card-header-top";

  const title = document.createElement("h3");
  title.className = "card-title official";
  title.textContent = getOfficialRaceName(nextRace.raceName, nextRace.season);

  const flag = document.createElement("img");
  flag.className = "flag-icon";
  flag.src = toFlagUrl(nextRace.Circuit.Location.country);
  setImageFallback(flag);
  flag.alt = nextRace.Circuit.Location.country;
  flag.loading = "lazy";
  flag.width = 40;
  flag.height = 28;
  flag.alt = '';

  headerTop.append(title, flag);

  const subtitle = document.createElement("p");
    subtitle.className = "card-subtitle";
  subtitle.textContent = nextRace.Circuit.Location.locality + ", " + translateCountry(nextRace.Circuit.Location.country);

  const eventTime = raceStart(nextRace);
  const hud = buildCountdownHud(eventTime);
  const grid = buildRaceDetailsGrid(nextRace);

  const footer = document.createElement("p");
  footer.className = "muted";
  footer.textContent = isSeasonClosed
    ? `PROXIMA TEMPORADA ${formatRaceDate(nextRace.date, nextRace.time)}`
    : ``;
  const season = document.createElement('p');
  season.className = 'data-note';
  season.textContent = `Temporada ${nextRace.season} · etapa ${nextRace.round}`;

  const wrapper = document.createElement("div");
  wrapper.className = "card-content-wrapper";

  const mainInfo = document.createElement("div");
  mainInfo.style.flex = "1.5";

  mainInfo.append(season, headerTop, subtitle, grid, hud, footer);

  const circuitKey = nextRace.Circuit.circuitId.replace(/-/g, "_");
  const reference = CIRCUIT_STATIC[circuitKey];
  const staticInfo = reference?.season === Number(nextRace.season) ? reference : {};

  if (staticInfo.image) {
    const circuitContainer = document.createElement("div");
    circuitContainer.className = "circuit-container";
    
    const trackMap = document.createElement("img");
    trackMap.className = "circuit-map";
    trackMap.src = staticInfo.image;
    setImageFallback(trackMap);
    trackMap.alt = `Mapa do circuito ${nextRace.Circuit.circuitName}`;
    trackMap.loading = "lazy";
    trackMap.width = 280;
    trackMap.height = 200;
    
    circuitContainer.appendChild(trackMap);
    wrapper.append(mainInfo, circuitContainer);
  } else {
    wrapper.appendChild(mainInfo);
  }

  card.append(wrapper, detailLink('Ver calendário da temporada', 'calendar.html'));
  return card;
}

function buildLastRaceCard(lastRace) {
  const card = document.createElement("article");
  card.className = "card reveal-up";

  const headerTop = document.createElement("div");
  headerTop.className = "card-header-top";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = getOfficialRaceName(lastRace.raceName, lastRace.season);

  const flag = document.createElement("img");
  flag.className = "flag-icon";
  flag.src = toFlagUrl(lastRace.Circuit.Location.country);
  setImageFallback(flag);
  flag.alt = lastRace.Circuit.Location.country;
  flag.loading = "lazy";
  flag.width = 40;
  flag.height = 28;
  flag.alt = '';

  headerTop.append(title, flag);

  const subtitle = document.createElement("p");
  subtitle.className = "card-subtitle";
  subtitle.textContent = `Resultado publicado · temporada ${lastRace.season} · etapa ${lastRace.round}`;

  const results = (lastRace.Results || []).filter(result => Number(result.position) <= 3).slice(0, 3);
  const podiumWrapper = buildPodiumComponent(results, lastRace.season);

  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Resultado ainda não disponível para esta etapa.";
    card.append(headerTop, subtitle, empty);
    return card;
  }

  const grid = buildRaceDetailsGrid(lastRace);

  const wrapper = document.createElement("div");
  wrapper.className = "card-content-wrapper";

  const mainInfo = document.createElement("div");
  mainInfo.style.flex = "1.5";

  mainInfo.append(headerTop, subtitle, podiumWrapper, grid);

  const circuitKey = lastRace.Circuit.circuitId.replace(/-/g, "_");
  const reference = CIRCUIT_STATIC[circuitKey];
  const staticInfo = reference?.season === Number(lastRace.season) ? reference : {};

  if (staticInfo.image) {
    const circuitContainer = document.createElement("div");
    circuitContainer.className = "circuit-container";
    
    const trackMap = document.createElement("img");
    trackMap.className = "circuit-map";
    trackMap.src = staticInfo.image;
    setImageFallback(trackMap);
    trackMap.alt = `Mapa do circuito ${lastRace.Circuit.circuitName}`;
    trackMap.loading = "lazy";
    trackMap.width = 280;
    trackMap.height = 200;
    
    circuitContainer.appendChild(trackMap);
    wrapper.append(mainInfo, circuitContainer);
  } else {
    wrapper.appendChild(mainInfo);
  }

  card.append(wrapper, detailLink('Consultar etapas e resultados disponíveis', 'calendar.html'));
  return card;
}

function detailLink(text, href) {
  const link = document.createElement('a');
  link.href = href;
  link.className = 'text-link';
  link.textContent = text;
  return link;
}

function createTable(titleText, rows, isConstructorTable = false, season = null) {
  const card = document.createElement("article");
  card.className = "card reveal-up";

  const title = document.createElement("caption");
  title.className = "card-title";
  title.textContent = titleText;

  const table = document.createElement("table");
  table.className = "standings-table";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Pos.", isConstructorTable ? "Equipe" : "Piloto", "Equipe", "Pts"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    th.scope = 'col';
    headRow.appendChild(th);
  });
  head.appendChild(headRow);

  const body = document.createElement("tbody");
  rows.forEach((entry) => {
    const row = document.createElement("tr");
    const pos = document.createElement("td");
    const main = document.createElement("td");
    const secondary = document.createElement("td");
    const points = document.createElement("td");

    pos.textContent = displayValue(entry.position);
    points.textContent = displayValue(entry.points);
    secondary.className = 'standing-team';

    if (isConstructorTable) {
      main.textContent = getOfficialTeamName(entry.Constructor.name);
      const logoUrl = resolveConstructorLogo(entry.Constructor.constructorId, season);
      if (logoUrl) {
        const img = document.createElement("img");
        img.className = "team-logo-mini";
        img.src = logoUrl;
        setImageFallback(img);
        img.alt = getOfficialTeamName(entry.Constructor.name);
        img.title = getOfficialTeamName(entry.Constructor.name);
        secondary.replaceChildren(img);
      } else {
        secondary.textContent = "-";
      }
    } else {
      main.textContent = `${entry.Driver.givenName} ${entry.Driver.familyName}`;
      
      const constructors = entry.Constructors || [];
      const constructor = constructors.length === 1 ? constructors[0] : null;
      const logoUrl = resolveConstructorLogo(constructor?.constructorId, season);
      if (logoUrl) {
        const img = document.createElement("img");
        img.className = "team-logo-mini";
        img.src = logoUrl;
        setImageFallback(img);
        img.alt = getOfficialTeamName(constructor?.name || "-");
        img.title = getOfficialTeamName(constructor?.name || "-");
        // Protection against stale CSS backgrounds
        img.style.background = "rgba(255, 255, 255, 0.1)";
        img.style.padding = "2px";
        img.style.borderRadius = "2px";
        secondary.replaceChildren(img);
      } else {
        secondary.textContent = constructors.map(c => c.name).join(" / ") || "Não disponível";
      }
    }

    if (isConstructorTable) {
      main.colSpan = 2;
      row.append(pos, main, points);
    } else row.append(pos, main, secondary, points);
    body.appendChild(row);
  });

  table.append(title, head, body);
  if (isConstructorTable) {
    headRow.children[1].colSpan = 2;
    headRow.children[2].remove();
  }
  card.append(table, detailLink(isConstructorTable ? 'Ver todas as equipes' : 'Ver todos os pilotos', isConstructorTable ? 'teams.html' : 'drivers.html'));
  return card;
}

async function loadHomeData() {
  nextRaceState.replaceChildren(createSkeletonBlock(4));
  lastRaceState.replaceChildren(createSkeletonBlock(4));
  quickStandingsState.replaceChildren(createSkeletonBlock(6));

  if (countdownInterval) window.clearInterval(countdownInterval);
  countdownInterval = null;
  let schedule;
  try { schedule = await fetchCurrentSchedule(); }
  catch {
    renderError(nextRaceState, "Falha ao carregar a próxima corrida.", loadHomeData);
    renderError(lastRaceState, "Falha ao identificar a temporada.", loadHomeData);
    renderError(quickStandingsState, "Falha ao identificar a temporada.", loadHomeData);
    return;
  }
  if (currentYearElement && schedule.season) currentYearElement.textContent = schedule.season;
  const scheduleState = { status: 'fulfilled', value: schedule };
  const [resultsState, driversState, constructorsState, winnersState] = await Promise.allSettled([
    fetchCurrentResults(schedule.season), fetchCurrentDriverStandings(schedule.season),
    fetchCurrentConstructorStandings(schedule.season), fetchSeasonWinners(schedule.season)
  ]);

  const freshness = [scheduleState, resultsState, driversState, constructorsState, winnersState]
    .filter(result => result.status === "fulfilled").map(result => result.value);
  showCacheFeedback(...freshness);

  if (scheduleState.status === "fulfilled" && Array.isArray(scheduleState.value.items)) {
    try {
      const confirmed = confirmedRaceKeys(schedule.items, winnersState.status === 'fulfilled' ? winnersState.value.items : []);
      const nextRaceInfo = await resolveNextEvent(schedule, confirmed, fetchScheduleBySeason);
      if (nextRaceInfo.freshness) showCacheFeedback(...freshness, nextRaceInfo.freshness);
      if (nextRaceInfo.race) nextRaceState.replaceChildren(buildNextRaceCard(nextRaceInfo.race, nextRaceInfo.isSeasonClosed));
      else {
        const note = document.createElement('article'); note.className = 'state-card'; note.textContent = nextRaceInfo.message;
        nextRaceState.replaceChildren(note);
      }
    } catch {
      renderError(nextRaceState, "Falha ao carregar a próxima corrida.", loadHomeData);
    }
  } else {
    renderError(nextRaceState, "Falha ao carregar a próxima corrida.", loadHomeData);
  }

  if (resultsState.status === "fulfilled" && Array.isArray(resultsState.value.items)) {
    const published = confirmedRaceKeys(schedule.items, resultsState.value.items);
    const lastRace = [...resultsState.value.items].filter(r => published.has(r.season + ':' + r.round)).sort((a, b) => Number(b.round) - Number(a.round))[0];
    if (lastRace) {
      try {
        lastRaceState.replaceChildren(buildLastRaceCard(lastRace));
      } catch {
        renderError(lastRaceState, "Falha ao carregar o resultado da última corrida.", loadHomeData);
      }
    } else {
      const emptyCard = document.createElement("article");
      emptyCard.className = "state-card";
      emptyCard.textContent = "Ainda não há resultado oficial registrado para esta temporada.";
      lastRaceState.replaceChildren(emptyCard);
    }
  } else {
    renderError(lastRaceState, "Falha ao carregar o resultado da última corrida.", loadHomeData);
  }

  const driverStandings = driversState.status === "fulfilled" && Array.isArray(driversState.value.items)
    ? driversState.value.items
    : [];
  const constructorStandings = constructorsState.status === "fulfilled" && Array.isArray(constructorsState.value.items)
    ? constructorsState.value.items
    : [];

  if (driverStandings.length === 0 && constructorStandings.length === 0) {
    if (driversState.status === 'fulfilled' && constructorsState.status === 'fulfilled') {
      const empty = document.createElement('article');
      empty.className = 'state-card';
      empty.textContent = `Classificação ainda não publicada para a temporada ${schedule.season || 'não informada'}.`;
      quickStandingsState.replaceChildren(empty);
      return;
    }
    renderError(quickStandingsState, "Falha ao carregar a classificação rápida.", loadHomeData);
    return;
  }

  const tablesWrap = document.createElement("div");
  tablesWrap.className = "table-wrap";

  if (driverStandings.length > 0) {
    tablesWrap.append(createTable(`Top 5 pilotos · ${schedule.season}`, driverStandings.slice(0, 5), false, schedule.season));
  }

  if (constructorStandings.length > 0) {
    tablesWrap.append(createTable(`Top 5 construtores · ${schedule.season}`, constructorStandings.slice(0, 5), true, schedule.season));
  }
  if (driversState.status !== 'fulfilled' || constructorsState.status !== 'fulfilled') {
    const note = document.createElement('p');
    note.className = 'data-note';
    note.textContent = 'Uma das classificações não pôde ser consultada. Use Atualizar para tentar novamente.';
    tablesWrap.append(note);
  }

  quickStandingsState.replaceChildren(tablesWrap);
}

function init() {
  setupNavActiveState();
  if (currentYearElement) currentYearElement.textContent = "—";
  loadHomeData();
}

init();
