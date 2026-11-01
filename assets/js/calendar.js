import { fetchCurrentSchedule } from "./api.js";
import { formatRaceDate, setupNavActiveState, toFlag, getOfficialRaceName2026 } from "./static-data.js";
import { renderSkeleton, renderError, showCacheFeedback } from "./ui-utils.js";

const stateContainer = document.getElementById("calendar-state");

function raceToTime(race) {
  const iso = race.time ? `${race.date}T${race.time}` : `${race.date}T12:00:00Z`;
  return new Date(iso).getTime();
}

function createRaceItem(race, status) {
  const card = document.createElement("article");
  card.className = `card calendar-item ${status} reveal-up`.trim();

  const round = document.createElement("div");
  round.className = "round";
  round.textContent = `R${race.round}`;

  const info = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = `${toFlag(race.Circuit.Location.country)} ${getOfficialRaceName2026(race.raceName)}`;

  const subtitle = document.createElement("p");
  subtitle.className = "card-subtitle";
  subtitle.textContent = `${race.Circuit.circuitName} — ${formatRaceDate(race.date, race.time)}`;

  info.append(title, subtitle);

  const side = document.createElement("div");
  if (status === "next") {
    const badge = document.createElement("span");
    badge.className = "badge badge-accent";
    badge.textContent = "PRÓXIMA";
    side.appendChild(badge);
  } else if (status === "past") {
    const resultText = document.createElement("span");
    resultText.className = "badge";
    resultText.textContent = "CONCLUÍDA";
    side.appendChild(resultText);
  } else {
    const dateText = document.createElement("span");
    dateText.className = "badge";
    dateText.textContent = "AGENDADA";
    side.appendChild(dateText);
  }

  card.append(round, info, side);
  return card;
}

function renderCalendar(races) {
  if (!races.length) {
    const empty = document.createElement("article");
    empty.className = "state-card";
    empty.textContent = "Calendário indisponível para esta temporada.";
    stateContainer.replaceChildren(empty);
    return;
  }

  const now = Date.now();
  const sorted = [...races].sort((a, b) => Number(a.round) - Number(b.round));
  const nextRace = sorted.find((race) => raceToTime(race) > now);

  const list = document.createElement("div");
  list.className = "list";

  sorted.forEach((race) => {
    const raceTime = raceToTime(race);
    let status = "future";

    if (raceTime <= now) {
      status = "past";
    }

    if (nextRace && race.round === nextRace.round) {
      status = "next";
    }

    list.appendChild(createRaceItem(race, status));
  });

  stateContainer.replaceChildren(list);
}

async function loadCalendar() {
  renderSkeleton(stateContainer, 8, "list");

  try {
    const result = await fetchCurrentSchedule();
    showCacheFeedback(result);
    renderCalendar(result.items);
  } catch {
    renderError(stateContainer, "Não foi possível carregar o calendário agora.", loadCalendar);
  }
}

function init() {
  setupNavActiveState();
  loadCalendar();
}

init();
