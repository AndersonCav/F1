import {
  fetchCurrentConstructorStandings,
  fetchCurrentDriverStandings,
  fetchCurrentResults,
  fetchCurrentSchedule,
  fetchScheduleBySeason
} from "./api.js";
import {
  CIRCUIT_STATIC,
  DRIVER_STATIC,
  PLACEHOLDER_DRIVER_IMAGE,
  formatRaceDate,
  getOfficialRaceName2026,
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

function raceDateToTimestamp(race) {
  const isoDate = race.time ? `${race.date}T${race.time}` : `${race.date}T12:00:00Z`;
  return new Date(isoDate).getTime();
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function cleanRaceName(name) {
  return name.replace(/^[A-Z]{2,3}\s+/, "");
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

function resolveDriverStaticInfo(driver) {
  const byId = normalizeDriverKey(driver?.driverId);
  if (byId && DRIVER_STATIC[byId]) {
    return DRIVER_STATIC[byId];
  }

  const fullNameKey = normalizeDriverKey(`${driver?.givenName || ""}_${driver?.familyName || ""}`);
  if (fullNameKey && DRIVER_STATIC[fullNameKey]) {
    return DRIVER_STATIC[fullNameKey];
  }

  return {};
}

function resolveConstructorLogo(constructorId) {
  const key = (constructorId || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if (TEAM_STATIC[key]) {
    return TEAM_STATIC[key].logo;
  }
  return null;
}

function buildPodiumComponent(results) {
  const container = document.createElement("div");
  container.className = "podium-grid";

  const rankSuffixes = ["ST", "ND", "RD"];

  results.forEach((result, index) => {
    const card = document.createElement("div");
    card.className = "podium-card";

    const rankEl = document.createElement("div");
    rankEl.className = "podium-rank";
    rankEl.innerHTML = `${index + 1}<span>${rankSuffixes[index]}</span>`;
    
    const staticInfo = resolveDriverStaticInfo(result.Driver);
    
    const avatar = document.createElement("img");
    avatar.className = "podium-avatar";
    avatar.src = staticInfo.photo || PLACEHOLDER_DRIVER_IMAGE;
    setImageFallback(avatar);
    avatar.alt = result.Driver.familyName;
    if (staticInfo.teamColor) {
      avatar.style.borderColor = staticInfo.teamColor;
      card.style.borderLeftColor = staticInfo.teamColor;
    }

    const info = document.createElement("div");
    info.className = "podium-info";

    const code = document.createElement("div");
    code.className = "podium-code";
    code.textContent = result.Driver.code || result.Driver.familyName.substring(0, 3).toUpperCase();

    const time = document.createElement("div");
    time.className = "podium-time";
    if (index === 0) {
      time.classList.add("winner");
      time.textContent = result.Time ? result.Time.time : "Vencedor";
    } else {
      time.classList.add("gap");
      time.textContent = result.Time ? `+${result.Time.time}` : "Interv.";
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
  const staticInfo = CIRCUIT_STATIC[circuitKey] || { laps: "-", length: "-", distance: "-", firstGP: "-" };

  grid.append(
    buildDetailItem("CIRCUITO", race.Circuit.circuitName),
    buildDetailItem("EXTENSÃO", staticInfo.length),
    buildDetailItem("DISTÂNCIA", staticInfo.distance),
    buildDetailItem("VOLTAS", staticInfo.laps),
    buildDetailItem("ESTREIA", staticInfo.firstGP),
    buildDetailItem("DATA LOCAL", formatRaceDate(race.date, race.time))
  );

  if (staticInfo.fastestLap) {
    const fl = staticInfo.fastestLap;
    grid.append(buildDetailItem("RECORDE", `${fl.time} (${fl.driver}, ${fl.year})`));
  }

  return grid;
}

function buildCountdownHud(eventTime) {
  const hud = document.createElement("div");
  hud.className = "countdown-hud";
  
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "LARGADA DA CORRIDA EM";
  
  const timer = document.createElement("span");
  timer.className = "timer";
  
  const updateTimer = () => {
    const diff = eventTime - Date.now();
    timer.textContent = diff > 0 ? formatCountdown(diff) : "AO VIVO";
  };
  
  updateTimer();

  if (countdownInterval) {
    window.clearInterval(countdownInterval);
  }
  countdownInterval = window.setInterval(updateTimer, 1000);
  
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
  title.textContent = isSeasonClosed ? "Temporada encerrada" : getOfficialRaceName2026(cleanRaceName(nextRace.raceName));

  const flag = document.createElement("img");
  flag.className = "flag-icon";
  flag.src = toFlagUrl(nextRace.Circuit.Location.country);
  setImageFallback(flag);
  flag.alt = nextRace.Circuit.Location.country;
  flag.loading = "lazy";

  headerTop.append(title, flag);

  const subtitle = document.createElement("p");
    subtitle.className = "card-subtitle";
  subtitle.textContent = nextRace.Circuit.Location.locality + ", " + translateCountry(nextRace.Circuit.Location.country);

  const eventTime = raceDateToTimestamp(nextRace);
  const hud = buildCountdownHud(eventTime);
  const grid = buildRaceDetailsGrid(nextRace);

  const footer = document.createElement("p");
  footer.className = "muted";
  footer.textContent = isSeasonClosed
    ? `PROXIMA TEMPORADA ${formatRaceDate(nextRace.date, nextRace.time)}`
    : ``;

  const wrapper = document.createElement("div");
  wrapper.className = "card-content-wrapper";

  const mainInfo = document.createElement("div");
  mainInfo.style.flex = "1.5";

  mainInfo.append(headerTop, subtitle, hud, grid, footer);

  const circuitKey = nextRace.Circuit.circuitId.replace(/-/g, "_");
  const staticInfo = CIRCUIT_STATIC[circuitKey] || {};

  if (staticInfo.image) {
    const circuitContainer = document.createElement("div");
    circuitContainer.className = "circuit-container";
    
    const trackMap = document.createElement("img");
    trackMap.className = "circuit-map";
    trackMap.src = staticInfo.image;
    setImageFallback(trackMap);
    trackMap.alt = `Mapa do circuito ${nextRace.Circuit.circuitName}`;
    trackMap.loading = "lazy";
    
    circuitContainer.appendChild(trackMap);
    wrapper.append(mainInfo, circuitContainer);
  } else {
    wrapper.appendChild(mainInfo);
  }

  card.append(wrapper);
  return card;
}

function buildLastRaceCard(lastRace) {
  const card = document.createElement("article");
  card.className = "card reveal-up";

  const headerTop = document.createElement("div");
  headerTop.className = "card-header-top";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = getOfficialRaceName2026(cleanRaceName(lastRace.raceName));

  const flag = document.createElement("img");
  flag.className = "flag-icon";
  flag.src = toFlagUrl(lastRace.Circuit.Location.country);
  setImageFallback(flag);
  flag.alt = lastRace.Circuit.Location.country;
  flag.loading = "lazy";

  headerTop.append(title, flag);

  const subtitle = document.createElement("p");
  subtitle.className = "card-subtitle";
  subtitle.textContent = `Etapa ${lastRace.round} - ${translateCountry(lastRace.Circuit.Location.country)}`;

  const results = (lastRace.Results || []).slice(0, 3);
  const podiumWrapper = buildPodiumComponent(results);

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
  const staticInfo = CIRCUIT_STATIC[circuitKey] || {};

  if (staticInfo.image) {
    const circuitContainer = document.createElement("div");
    circuitContainer.className = "circuit-container";
    
    const trackMap = document.createElement("img");
    trackMap.className = "circuit-map";
    trackMap.src = staticInfo.image;
    setImageFallback(trackMap);
    trackMap.alt = `Mapa do circuito ${lastRace.Circuit.circuitName}`;
    trackMap.loading = "lazy";
    
    circuitContainer.appendChild(trackMap);
    wrapper.append(mainInfo, circuitContainer);
  } else {
    wrapper.appendChild(mainInfo);
  }

  card.append(wrapper);
  return card;
}

function createTable(titleText, rows, isConstructorTable = false) {
  const card = document.createElement("article");
  card.className = "card reveal-up";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = titleText;

  const table = document.createElement("table");
  table.className = "standings-table";

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Pos", isConstructorTable ? "Equipe" : "Piloto", isConstructorTable ? "-" : "Equipe", "Pts"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
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

    pos.textContent = entry.position;
    points.textContent = entry.points;

    if (isConstructorTable) {
      main.textContent = getOfficialTeamName(entry.Constructor.name);
      const logoUrl = resolveConstructorLogo(entry.Constructor.constructorId);
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
      
      const constructor = entry.Constructors?.[0];
      const logoUrl = resolveConstructorLogo(constructor?.constructorId);
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
        secondary.textContent = getOfficialTeamName(constructor?.name || "-");
      }
    }

    row.append(pos, main, secondary, points);
    body.appendChild(row);
  });

  table.append(head, body);
  card.append(title, table);
  return card;
}

async function resolveNextRace(schedule) {
  const now = Date.now();
  const ordered = [...schedule].sort((a, b) => raceDateToTimestamp(a) - raceDateToTimestamp(b));
  const futureRace = ordered.find((race) => raceDateToTimestamp(race) > now);

  if (futureRace) {
    return { race: futureRace, isSeasonClosed: false };
  }

  const nextSeason = new Date().getFullYear() + 1;
  const nextSeasonScheduleResult = await fetchScheduleBySeason(nextSeason);
  const firstRound = [...nextSeasonScheduleResult.items].sort((a, b) => raceDateToTimestamp(a) - raceDateToTimestamp(b))[0];

  if (!firstRound) {
    throw new Error("Não foi possível identificar a próxima corrida.");
  }

  return { race: firstRound, isSeasonClosed: true, freshness: nextSeasonScheduleResult };
}

async function loadHomeData() {
  nextRaceState.replaceChildren(createSkeletonBlock(4));
  lastRaceState.replaceChildren(createSkeletonBlock(4));
  quickStandingsState.replaceChildren(createSkeletonBlock(6));

  const [scheduleState, resultsState, driversState, constructorsState] = await Promise.allSettled([
    fetchCurrentSchedule(),
    fetchCurrentResults(),
    fetchCurrentDriverStandings(),
    fetchCurrentConstructorStandings()
  ]);

  const freshness = [scheduleState, resultsState, driversState, constructorsState]
    .filter(result => result.status === "fulfilled").map(result => result.value);
  showCacheFeedback(...freshness);

  if (scheduleState.status === "fulfilled" && Array.isArray(scheduleState.value.items) && scheduleState.value.items.length > 0) {
    try {
      const nextRaceInfo = await resolveNextRace(scheduleState.value.items);
      if (nextRaceInfo.freshness) showCacheFeedback(...freshness, nextRaceInfo.freshness);
      nextRaceState.replaceChildren(buildNextRaceCard(nextRaceInfo.race, nextRaceInfo.isSeasonClosed));
    } catch {
      renderError(nextRaceState, "Falha ao carregar a próxima corrida.", loadHomeData);
    }
  } else {
    renderError(nextRaceState, "Falha ao carregar a próxima corrida.", loadHomeData);
  }

  if (resultsState.status === "fulfilled" && Array.isArray(resultsState.value.items)) {
    const lastRace = [...resultsState.value.items].sort((a, b) => Number(b.round) - Number(a.round))[0];
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
    renderError(quickStandingsState, "Falha ao carregar a classificação rápida.", loadHomeData);
    return;
  }

  const tablesWrap = document.createElement("div");
  tablesWrap.className = "table-wrap";

  if (driverStandings.length > 0) {
    tablesWrap.append(createTable("Top 5 pilotos", driverStandings.slice(0, 5), false));
  }

  if (constructorStandings.length > 0) {
    tablesWrap.append(createTable("Top 5 construtores", constructorStandings.slice(0, 5), true));
  }

  quickStandingsState.replaceChildren(tablesWrap);
}

function init() {
  setupNavActiveState();
  if (currentYearElement) currentYearElement.textContent = String(new Date().getFullYear());
  loadHomeData();
}

init();
