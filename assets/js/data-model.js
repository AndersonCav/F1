import { seasonNumber, validDate } from './season.js';

export function numberOrNull(value, integer = false) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '') return null;
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(String(value))) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && (!integer || Number.isInteger(n)) ? n : null;
}
export const displayValue = value => value === null || value === undefined || value === '' ? 'Não disponível' : String(value);
export const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
const idOK = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
const driverOK = d => idOK(d?.driverId) && !!d.givenName?.trim() && !!d.familyName?.trim();
const constructorOK = c => idOK(c?.constructorId) && !!c.name?.trim();
const positive = n => numberOrNull(n, true) > 0;
function requireData(condition, message) { if (!condition) throw new Error(`Dados esportivos inválidos: ${message}`); }
function distinct(items, key) {
  const values = items.map(key);
  requireData(new Set(values).size === values.length, 'registros duplicados ou contraditórios');
}

// Validate before the existing transport may persist a response. Reject truncated pages.
export function decodeResponse(data, kind, expectedSeason = null, expectedRound = null) {
  const mr = data?.MRData;
  requireData(mr && typeof mr === 'object', 'MRData');
  const table = mr[kind === 'drivers' ? 'DriverTable' : kind.includes('standings') ? 'StandingsTable' : 'RaceTable'];
  requireData(table && typeof table === 'object', 'tabela');
  const season = seasonNumber(table.season);
  requireData(!expectedSeason || season === Number(expectedSeason), 'temporada diferente da solicitada');
  let items;
  let round = null;
  if (kind.includes('standings')) {
    requireData(Array.isArray(table.StandingsLists) && table.StandingsLists.length <= 1, 'classificação');
    const list = table.StandingsLists[0];
    round = numberOrNull(list?.round ?? table.round, true);
    if (list) {
      requireData(season !== null && seasonNumber(list.season) === season && positive(round), 'temporada/etapa da classificação');
      items = list[kind === 'driver-standings' ? 'DriverStandings' : 'ConstructorStandings'];
    } else items = [];
    requireData(Array.isArray(items), 'registros da classificação');
    for (const entry of items) {
      if (kind === 'driver-standings') {
        requireData(driverOK(entry.Driver) && Array.isArray(entry.Constructors) && entry.Constructors.every(constructorOK), 'piloto/construtor');
        distinct(entry.Constructors, c => c.constructorId);
      } else requireData(constructorOK(entry.Constructor), 'construtor');
      requireData(numberOrNull(entry.wins, true) === null || Number(entry.wins) <= round, 'vitórias contradizem etapa');
    }
    distinct(items, e => kind === 'driver-standings' ? e.Driver.driverId : e.Constructor.constructorId);
    const ranked = items.filter(e => positive(e.position));
    distinct(ranked, e => Number(e.position));
    items = items.map(e => ({ ...e, position: positive(e.position) ? Number(e.position) : null,
      points: numberOrNull(e.points), wins: numberOrNull(e.wins, true) }));
    items.sort((a, b) => compareNumber(a.position, b.position));
  } else if (kind === 'drivers') {
    items = table.Drivers;
    requireData(Array.isArray(items) && items.every(driverOK), 'pilotos');
    distinct(items, d => d.driverId);
  } else {
    items = table.Races;
    requireData(Array.isArray(items), 'corridas');
    for (const race of items) {
      requireData(season !== null && seasonNumber(race.season) === season && positive(race.round), 'temporada/etapa da corrida');
      requireData(!expectedRound || Number(race.round) === Number(expectedRound), 'etapa diferente da solicitada');
      requireData(idOK(race.Circuit?.circuitId) && !!race.Circuit.circuitName?.trim() && typeof race.Circuit.Location === 'object' && !!race.raceName?.trim(), 'identidade da corrida');
      // Invalid/missing dates remain visible with an honest unknown status.
      if (kind !== 'schedule') {
        requireData(Array.isArray(race.Results), 'resultados');
        requireData(race.Results.every(r => driverOK(r.Driver) && positive(r.position) && (!r.Constructor || constructorOK(r.Constructor))), 'resultado parcial');
        distinct(race.Results, r => r.Driver.driverId);
        // Historical shared drives may share finishing positions, so do not deduplicate positions here.
        requireData(race.Results.length === 0 || race.Results.some(r => Number(r.position) === 1), 'resultado sem vencedor');
      }
    }
    distinct(items, r => `${r.season}:${Number(r.round)}`);
    items = [...items].sort((a, b) => Number(a.round) - Number(b.round)).map(race =>
      kind === 'schedule' ? race : { ...race, Results: [...race.Results].sort((a, b) => Number(a.position) - Number(b.position)) });
  }
  const count = kind === 'results' || kind === 'winners' ? items.reduce((n, r) => n + r.Results.length, 0) : items.length;
  requireData(mr.total !== undefined || items.length === 0, 'metadados de completude ausentes');
  if (mr.total !== undefined) requireData(numberOrNull(mr.total, true) === count && numberOrNull(mr.offset ?? 0, true) === 0, 'resposta incompleta/paginada');
  requireData(items.length === 0 || season !== null, 'temporada ausente');
  return { items, season, round, complete: true };
}

export function compareNumber(a, b, descending = false) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  return descending ? b - a : a - b;
}
export function sortDrivers(items, sort = 'standing') {
  const tie = (a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR') || a.id.localeCompare(b.id);
  return [...items].sort((a, b) => {
    let diff;
    if (sort === 'name') diff = tie(a, b);
    else if (sort === 'team') diff = (a.fullTeam || a.shortTeam || '\uffff').localeCompare(b.fullTeam || b.shortTeam || '\uffff', 'pt-BR');
    else diff = compareNumber(a[sort === 'standing' ? 'position' : sort], b[sort === 'standing' ? 'position' : sort], sort !== 'standing');
    return diff || tie(a, b);
  });
}
export function filterDrivers(items, query) {
  const q = normalizeSearch(query);
  return items.filter(d => normalizeSearch(`${d.fullName} ${d.shortTeam} ${d.fullTeam}`).includes(q));
}

export function mapDriver(standing, profile, reference, season, teamReference = {}) {
  const driver = standing.Driver;
  const refs = reference || {};
  const constructors = standing.Constructors || [];
  const current = constructors.length === 1 ? constructors[0] : null;
  const team = current ? teamReference[current.constructorId] : null;
  return { id: driver.driverId, season, position: numberOrNull(standing.position, true), fullName: `${driver.givenName} ${driver.familyName}`,
    shortTeam: constructors.map(c => c.name).join(' / ') || 'Equipe não informada', fullTeam: constructors.map(c => teamReference[c.constructorId]?.season === season ? teamReference[c.constructorId].name : c.name).join(' / ') || 'Equipe não informada',
    association: constructors.length > 1 ? 'Equipes representadas na temporada; vínculo atual não confirmado' : 'Equipe representada na classificação',
    points: numberOrNull(standing.points), wins: numberOrNull(standing.wins, true), poles: null,
    number: profile?.permanentNumber || driver.permanentNumber || null, nationality: profile?.nationality || driver.nationality,
    dateOfBirth: validDate(profile?.dateOfBirth || driver.dateOfBirth) ? (profile?.dateOfBirth || driver.dateOfBirth) : null,
    placeOfBirth: null, photo: refs.season === season ? refs.photo : null, website: refs.website,
    teamLogo: team?.season === season ? team.logo : null, teamColor: team?.season === season ? team.color || '#e10600' : '#e10600' };
}

export function mapConstructor(entry, drivers, reference, snapshot, season) {
  const id = entry.Constructor.constructorId;
  const metadata = reference?.season === season ? reference : {};
  // All season participants, never an invented current race-seat roster.
  const participants = drivers.filter(d => d.Constructors?.some(c => c.constructorId === id));
  return { ...metadata, id, season, shortName: entry.Constructor.name, name: metadata.name || entry.Constructor.name,
    position: numberOrNull(entry.position, true), points: numberOrNull(entry.points), wins: numberOrNull(entry.wins, true),
    drivers: participants.map(d => `${d.Driver.givenName} ${d.Driver.familyName}`), historicWins: snapshot?.wins ?? null,
    championships: snapshot?.titles ?? null, snapshotSeason: snapshot?.throughSeason ?? null };
}
