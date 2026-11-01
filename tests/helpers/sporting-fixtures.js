export const driver = (id = 'norris', givenName = 'Lando', familyName = 'Norris') => ({ driverId: id, givenName, familyName, nationality: 'British', dateOfBirth: '1999-11-13', permanentNumber: '4' });
export const constructor = (id = 'mclaren', name = 'McLaren') => ({ constructorId: id, name });
export const standing = (id = 'norris', position = '1', points = '100', wins = '2', constructors = [constructor()]) => ({ position, points, wins, Driver: driver(id), Constructors: constructors });
export const race = (round = '1', overrides = {}) => ({ season: '2026', round, raceName: 'Test Grand Prix', date: '2026-03-08', time: '04:00:00Z',
  Circuit: { circuitId: 'albert_park', circuitName: 'Albert Park', Location: { country: 'Australia', locality: 'Melbourne' } }, ...overrides });
export const result = (round = '1', overrides = {}) => race(round, { Results: [{ position: '1', Driver: driver(), Constructor: constructor() }], ...overrides });
export function standingsResponse(items = [standing()], season = '2026', kind = 'DriverStandings') {
  return { MRData: { total: String(items.length), offset: '0', StandingsTable: { season,
    StandingsLists: [{ season, round: '20', [kind]: items }] } } };
}
export function racesResponse(items = [race()], season = '2026', results = false) {
  return { MRData: { total: String(results ? items.reduce((n, r) => n + r.Results.length, 0) : items.length), offset: '0', RaceTable: { season, Races: items } } };
}
