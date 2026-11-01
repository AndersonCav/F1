import { fetchCurrentSchedule, fetchSeasonWinners, fetchScheduleBySeason } from "./api.js";
import { formatRaceDate, setupNavActiveState, toFlag, getOfficialRaceName } from "./static-data.js";
import { raceStart, raceStatus, nextScheduledRace, confirmedRaceKeys, seasonPhase } from './season.js';
import { renderSkeleton, renderError, showCacheFeedback } from "./ui-utils.js";

const stateContainer = document.getElementById("calendar-state");
let statusTimer = null;

function createRaceItem(race, status) {
  const card = document.createElement("article");
  card.className = `card calendar-item ${status} ${status === 'completed' ? 'past' : status === 'upcoming' ? 'next' : 'future'} reveal-up`.trim();
  card.dataset.status = status;

  const round = document.createElement("div");
  round.className = "round";
  round.textContent = `R${race.round}`;

  const info = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = `${toFlag(race.Circuit.Location.country)} ${getOfficialRaceName(race.raceName, race.season)}`;

  const subtitle = document.createElement("p");
  subtitle.className = "card-subtitle";
  subtitle.textContent = `${race.Circuit.circuitName} — ${formatRaceDate(race.date, race.time)}`;

  info.append(title, subtitle);

  const side = document.createElement("div");
  if (status === "upcoming") {
    const badge = document.createElement("span");
    badge.className = "badge badge-accent";
    badge.textContent = "PRÓXIMA";
    side.appendChild(badge);
  } else if (status === "completed") {
    const resultText = document.createElement("span");
    resultText.className = "badge";
    resultText.textContent = "CONCLUÍDA";
    side.appendChild(resultText);
  } else {
    const dateText = document.createElement("span");
    dateText.className = "badge";
    dateText.textContent = status === 'result_pending' ? 'AGUARDANDO RESULTADO' : status === 'status_unknown' ? 'STATUS NÃO CONFIRMADO' : 'AGENDADA';
    side.appendChild(dateText);
  }

  card.append(round, info, side);
  return card;
}

function renderCalendar(races, results = []) {
  window.clearTimeout(statusTimer);
  if (!races.length) {
    const empty = document.createElement("article");
    empty.className = "state-card";
    empty.textContent = "Calendário indisponível para esta temporada.";
    stateContainer.replaceChildren(empty);
    return;
  }

  const now = Date.now();
  const sorted = [...races].sort((a, b) => Number(a.round) - Number(b.round));
  const confirmed = confirmedRaceKeys(races, results, now);
  const nextRace = nextScheduledRace(sorted, confirmed, now);

  const list = document.createElement("div");
  list.className = "list";

  sorted.forEach((race) => {
    const status = raceStatus(race, confirmed, now, race === nextRace);
    list.appendChild(createRaceItem(race, status));
  });

  const existing = stateContainer.querySelector(':scope > .list');
  if (existing) existing.replaceWith(list);
  else stateContainer.replaceChildren(list);
  // Reclassify at the next known start/day boundary; this does not claim a live feed.
  const tomorrow = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`) + 86400000;
  const boundary = Math.min(tomorrow, ...races.map(raceStart).filter(time => time !== null && time > now));
  if (confirmed.size < races.length) statusTimer = window.setTimeout(() => renderCalendar(races, results), boundary - now + 1);
}

async function loadCalendar() {
  renderSkeleton(stateContainer, 8, "list");

  try {
    const result = await fetchCurrentSchedule();
    const winners = result.season ? await fetchSeasonWinners(result.season).catch(() => null) : null;
    showCacheFeedback(result, ...[winners].filter(Boolean));
    renderCalendar(result.items, winners?.items || []);
    const heading = document.createElement('p');
    heading.className = 'muted';
    heading.textContent = `Temporada ${result.season || 'não informada'} · conclusão exige resultado publicado. Horários exibidos no seu fuso.`;
    stateContainer.prepend(heading);
    const confirmed = confirmedRaceKeys(result.items, winners?.items || []);
    if (seasonPhase(result.items, confirmed) === 'completed') {
      const next = await fetchScheduleBySeason(result.season + 1).catch(() => null);
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = next?.items.length ? `Próxima temporada: ${result.season + 1}` : `Calendário de ${result.season + 1} ainda não disponível.`;
      stateContainer.append(note);
      next?.items.forEach(race => stateContainer.append(createRaceItem(race, raceStatus(race))));
      if (next) showCacheFeedback(result, winners, next);
    }
  } catch {
    renderError(stateContainer, "Não foi possível carregar o calendário agora.", loadCalendar);
  }
}

function init() {
  setupNavActiveState();
  loadCalendar();
}

init();
