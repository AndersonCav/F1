// Sporting seasons come from the API, never from the browser's calendar year.
export function seasonNumber(value) {
  return ['string', 'number'].includes(typeof value) && /^\d{4}$/.test(String(value)) && Number(value) >= 1950 ? Number(value) : null;
}

export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function raceStart(race) {
  if (!validDate(race?.date) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/.test(race?.time || '')) return null;
  return Date.parse(`${race.date}T${race.time}`);
}

export function raceKey(race) { return `${race.season}:${race.round}`; }

export function confirmedRaceKeys(schedule, results, now = Date.now()) {
  return new Set(results.filter(result => {
    const race = schedule.find(r => raceKey(r) === raceKey(result));
    return race && race.Circuit.circuitId === result.Circuit.circuitId && race.date === result.date &&
      validDate(race.date) && race.date <= new Date(now).toISOString().slice(0, 10) &&
      (raceStart(race) === null || raceStart(race) <= now) && result.Results?.some(r => Number(r.position) === 1);
  }).map(raceKey));
}

export function raceStatus(race, confirmed = new Set(), now = Date.now(), isNext = false) {
  if (confirmed.has(raceKey(race))) return 'completed';
  if (!validDate(race?.date)) return 'status_unknown';
  const start = raceStart(race);
  if (start === null) {
    // A date identifies a day, not an instant in the viewer's local timezone.
    return race.date > new Date(now).toISOString().slice(0, 10) ? 'scheduled' : 'status_unknown';
  }
  if (start <= now) return 'result_pending';
  return isNext ? 'upcoming' : 'scheduled';
}

export function nextScheduledRace(races, confirmed = new Set(), now = Date.now()) {
  return [...races].sort((a, b) => Number(a.round) - Number(b.round)).find(race =>
    !confirmed.has(raceKey(race)) && validDate(race.date) &&
    (raceStart(race) === null ? race.date >= new Date(now).toISOString().slice(0, 10) : raceStart(race) > now)) || null;
}

export function seasonPhase(races, confirmed = new Set(), now = Date.now()) {
  if (!races.length) return 'unpublished';
  if (races.every(race => confirmed.has(raceKey(race)))) return 'completed';
  const first = [...races].sort((a, b) => Number(a.round) - Number(b.round))[0];
  if (raceStart(first) !== null && raceStart(first) > now) return 'upcoming';
  return 'active'; // An elapsed final start without results is still unconfirmed.
}

export async function resolveNextEvent(schedule, confirmed, fetchNext, now = Date.now()) {
  if (!schedule.items.length) return { race: null, message: `Calendário de ${schedule.season || 'temporada não informada'} ainda não publicado.` };
  const next = nextScheduledRace(schedule.items, confirmed, now);
  if (next) return { race: next, isSeasonClosed: false };
  if (seasonPhase(schedule.items, confirmed, now) !== 'completed') {
    return { race: null, message: 'Horários previstos atingidos · aguardando resultados oficiais ou atualização do calendário.' };
  }
  try {
    const upcoming = await fetchNext(schedule.season + 1);
    const race = nextScheduledRace(upcoming.items, new Set(), now);
    return { race, isSeasonClosed: true, freshness: upcoming,
      message: race ? null : `Temporada ${schedule.season} encerrada · calendário de ${schedule.season + 1} ainda não publicado.` };
  } catch {
    return { race: null, isSeasonClosed: true, message: `Temporada ${schedule.season} encerrada · calendário de ${schedule.season + 1} indisponível.` };
  }
}

export function countdownText(start, now = Date.now()) {
  if (!Number.isFinite(start)) return 'Horário de largada não informado';
  if (start <= now) return 'Horário previsto atingido · aguardando resultado';
  const total = Math.floor((start - now) / 1000);
  return `${Math.floor(total / 86400)}d ${String(Math.floor(total % 86400 / 3600)).padStart(2, '0')}h ${String(Math.floor(total % 3600 / 60)).padStart(2, '0')}m ${String(total % 60).padStart(2, '0')}s`;
}

export function formatEventDate(date, time = '', withTime = false) {
  if (!validDate(date)) return 'Data não informada';
  const start = raceStart({ date, time });
  const options = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' };
  if (start === null) return `${new Intl.DateTimeFormat('pt-BR', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))} · horário não informado`;
  return new Intl.DateTimeFormat('pt-BR', { ...options, ...(withTime ? { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' } : {}) }).format(new Date(start));
}
