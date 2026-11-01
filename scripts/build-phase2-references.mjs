// Rebuild only from the reviewed, versioned audit inputs. No network or inferred live statistics.
import fs from 'node:fs';
const read = path => JSON.parse(fs.readFileSync(`docs/phase-2/${path}`, 'utf8'));
const initial = read('initial-state.json');
const write = (name, text) => fs.writeFileSync(`assets/js/${name}`, text);
const js = value => JSON.stringify(value, null, 2);
const driverRefs = Object.fromEntries(Object.entries(initial.drivers).map(([id, d]) => [id,
  { season: 2026, photo: d.photo, website: d.website }]));
write('driver-metadata.js', '// Visual references scoped to the uniform season; no sporting statistics.\nexport const DRIVER_STATIC = ' + js(driverRefs) + ';\n');
const winners = read('sources/gp-winners-through-2025.json');
const official = read('sources/official-hall-of-fame.json');
const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const identities = new Map(winners.races.flatMap(r => r.Results.map(v => [normalize(v.Driver.givenName + v.Driver.familyName), v.Driver])));
const champions = [{ name: 'Giuseppe Farina', nationality: 'Italia', teams: ['Alfa Romeo'], titleYears: [1950] }, ...initial.champions,
  { name: 'Lando Norris', nationality: 'Reino Unido', teams: ['McLaren'], titleYears: [2025] }];
const aliases = { 'Giuseppe Farina': 'Nino Farina', 'Juan Manuel Fangio': 'Juan Fangio' };
const photoAudit = { auditDate: '2026-11-01', baselineHead: initial.head, records: [] };
for (const [index, c] of champions.entries()) {
  const driver = identities.get(normalize(aliases[c.name] || c.name));
  if (!driver) throw new Error(`Missing verified identity: ${c.name}`);
  c.id = driver.driverId; c.wins = winners.wins[c.id]; c.nationalityCode = driver.nationality;
  c.throughSeason = 2025; c.source = official[index].url;
  if (index === 0 || index === 34) {
    const key = index === 0 ? 'farina' : 'norris';
    const page = Object.values(read(`sources/${key}-commons.json`).query.pages)[0];
    const info = page.imageinfo[0]; const probe = read(`sources/${key}-probe.json`);
    c.photo = probe.url;
    c.photoCredit = { attribution: key === 'farina' ? 'Autor desconhecido / Světozor (1934), via Digitální knihovna' : 'Jen Ross', sourceUrl: info.descriptionurl,
      license: info.extmetadata.LicenseShortName.value, licenseUrl: info.extmetadata.LicenseUrl.value };
    photoAudit.records.push({ name: c.name, replacement: { ...probe, sourceFile: page.title, sourceOriginal: info.url, sourceOriginalSha1: info.sha1,
      credit: c.photoCredit, licenseBasis: key === 'farina' ? 'Creative Commons Attribution 4.0 as declared on the Commons file page; Světozor 1934-10-04, p. 12; Digitální knihovna source; author unknown' : 'Creative Commons Attribution 2.0; existing Commons crop by Valentin JJ.',
      identityEvidence: { url: info.descriptionurl, method: 'Commons subject description, file date and Chrome visual review' } } });
  }
}
if (!process.argv.includes('--approve-reviewed-images')) {
  const approved = read('image-audit.json');
  for (const record of photoAudit.records) {
    const before = approved.records.find(r => r.name === record.name)?.replacement;
    if (!before || before.sha256 !== record.replacement.sha256 || before.url !== record.replacement.url || js(before.credit) !== js(record.replacement.credit)) {
      throw new Error('Photograph changes require visual identity and licence review before --approve-reviewed-images is used.');
    }
  }
}
write('champion-history.js', '// Completed World Drivers Championships only. Reviewed 2026-11-01.\nexport const CHAMPIONS_THROUGH_SEASON = 2025;\nexport const CHAMPIONS_VERIFIED_AT = ' + js(official.at(-1).verifiedAt) + ';\nexport const CHAMPIONS_HISTORY = ' + js(champions) + ';\n');
fs.writeFileSync('docs/phase-2/image-audit.json', js(photoAudit) + '\n');
write('circuit-metadata.js', '// Season-specific illustrations; unverified distances and records are not published.\nexport const CIRCUIT_STATIC = ' + js(Object.fromEntries(Object.entries(initial.circuits).map(([id, c]) => [id, { season: 2026, image: c.image }]))) + ';\n');
if (fs.existsSync('docs/phase-2/sources/constructor-titles-through-2025.json')) {
  const metadata = read('sources/constructor-metadata-2026.json');
  const colors = { mercedes: '#00d2be', ferrari: '#e10600', mclaren: '#ff8000', haas: '#b6babd', red_bull: '#1e5bc6',
    rb: '#2b5cff', alpine: '#0090ff', audi: '#c70000', williams: '#005aff', cadillac: '#9ca3af', aston_martin: '#006f62' };
  for (const [id, ref] of Object.entries(metadata)) Object.assign(ref, { logo: initial.teams[id].logo, carImage: initial.teams[id].carImage, color: colors[id] });
  write('constructor-metadata.js', '// Verified F1 team profile snapshots, explicitly scoped to 2026 and 2026-11-01.\nexport const TEAM_STATIC = ' + js(metadata) + `;
export function getOfficialTeamName(name, season = null) {
  return Object.values(TEAM_STATIC).find(ref => ref.season === Number(season) && ref.name === name)?.name || name;
}
`);
  const titles = read('sources/constructor-titles-through-2025.json').champions;
  const snapshots = {};
  for (const id of Object.keys(metadata)) {
    if (['audi', 'cadillac'].includes(id)) continue; // Not entered by this snapshot's cutoff.
    // Engine suffix is the same McLaren constructor, not a predecessor organisation.
    const ids = id === 'mclaren' ? ['mclaren', 'mclaren-ford'] : [id];
    snapshots[id] = { throughSeason: 2025, wins: winners.races.filter(r => r.Results.some(v => ids.includes(v.Constructor.constructorId))).length,
      titles: titles.filter(c => ids.includes(c.constructorId)).length, identityRule: ids.join(' + ') };
  }
  write('historical-snapshots.js', '// Grand Prix wins and Constructors Championships through the completed 2025 season. No predecessor-brand inheritance.\nexport const CONSTRUCTOR_SNAPSHOTS = ' + js(snapshots) + ';\n');
}
let source = fs.readFileSync('assets/js/static-data.js', 'utf8');
source = source.slice(source.indexOf('const COUNTRY_TO_ISO'));
source = "import { formatEventDate } from './season.js';\nexport { DRIVER_STATIC } from './driver-metadata.js';\nexport { TEAM_STATIC, getOfficialTeamName } from './constructor-metadata.js';\nexport { CHAMPIONS_HISTORY } from './champion-history.js';\nexport { CIRCUIT_STATIC } from './circuit-metadata.js';\nexport const PLACEHOLDER_DRIVER_IMAGE = new URL('../images/placeholder-driver.svg', import.meta.url).href;\n\n" + source;
source = source.replace(/export function formatRaceDate\([\s\S]*?(?=export function setupNavActiveState)/, `export const formatRaceDate = (date, time = '') => formatEventDate(date, time, true);
export const formatRaceDateTime = formatRaceDate;
// Preserve the API's verified sporting event name; no unverified commercial substitutions.
export function getOfficialRaceName(raceName, season) { return raceName; }
export const getOfficialRaceName2026 = raceName => getOfficialRaceName(raceName, 2026);

`);
fs.writeFileSync('assets/js/static-data.js', source);
