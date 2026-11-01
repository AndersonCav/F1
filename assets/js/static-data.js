import { formatEventDate } from './season.js';
export { DRIVER_STATIC } from './driver-metadata.js';
export { TEAM_STATIC, getOfficialTeamName } from './constructor-metadata.js';
export { CHAMPIONS_HISTORY } from './champion-history.js';
export { CIRCUIT_STATIC } from './circuit-metadata.js';
export const PLACEHOLDER_DRIVER_IMAGE = new URL('../images/placeholder-driver.svg', import.meta.url).href;

const COUNTRY_TO_ISO = {
  argentina: "AR",
  argentine: "AR",
  australia: "AU",
  australian: "AU",
  austria: "AT",
  austrian: "AT",
  brazil: "BR",
  brazilian: "BR",
  brasil: "BR",
  belgium: "BE",
  belgian: "BE",
  canada: "CA",
  canadian: "CA",
  china: "CN",
  chinese: "CN",
  czech: "CZ",
  denmark: "DK",
  danish: "DK",
  finland: "FI",
  finnish: "FI",
  finlandia: "FI",
  france: "FR",
  french: "FR",
  franca: "FR",
  germany: "DE",
  german: "DE",
  alemanha: "DE",
  italy: "IT",
  italian: "IT",
  italia: "IT",
  japan: "JP",
  japanese: "JP",
  mexico: "MX",
  mexican: "MX",
  monaco: "MC",
  monegasque: "MC",
  netherlands: "NL",
  dutch: "NL",
  "paises baixos": "NL",
  "new zealand": "NZ",
  "new zealander": "NZ",
  "nova zelandia": "NZ",
  spain: "ES",
  spanish: "ES",
  espanha: "ES",
  thailand: "TH",
  thai: "TH",
  "united kingdom": "GB",
  british: "GB",
  england: "GB",
  "reino unido": "GB",
  "united states": "US",
  american: "US",
  "usa": "US",
  "estados unidos": "US",
  "uk": "GB",
  "south africa": "ZA",
  "south african": "ZA",
  "africa do sul": "ZA",
  switzerland: "CH",
  suica: "CH",
  hungary: "HU",
  bahrain: "BH",
  "saudi arabia": "SA",
  "arabia saudita": "SA",
  uae: "AE",
  "abu dhabi": "AE",
  qatar: "QA",
  singapore: "SG",
  singapura: "SG",
  azerbaijan: "AZ",
  azerbaidjao: "AZ",
  "las vegas": "US"
};

const COUNTRY_TO_PT = {
  argentina: "Argentina",
  australia: "Austrália",
  austria: "Áustria",
  brazil: "Brasil",
  brasil: "Brasil",
  belgium: "Bélgica",
  canada: "Canadá",
  china: "China",
  denmark: "Dinamarca",
  finland: "Finlândia",
  france: "França",
  germany: "Alemanha",
  italy: "Itália",
  japan: "Japão",
  mexico: "México",
  monaco: "Mônaco",
  netherlands: "Holanda",
  "paises baixos": "Holanda",
  spain: "Espanha",
  "united kingdom": "Reino Unido",
  "united states": "EUA",
  "usa": "EUA",
  "south africa": "África do Sul",
  switzerland: "Suíça",
  hungary: "Hungria",
  bahrain: "Bahrein",
  "saudi arabia": "Arábia Saudita",
  uae: "Emirados Árabes",
  qatar: "Catar",
  singapore: "Singapura",
  azerbaijan: "Azerbaijão"
};

export function translateCountry(label) {
  if (!label) return "";
  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return COUNTRY_TO_PT[normalized] || label;
}

function normalizeCountryLabel(label) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isoToFlagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) {
    return "🏁";
  }

  const first = isoCode.charCodeAt(0) - 65 + 0x1f1e6;
  const second = isoCode.charCodeAt(1) - 65 + 0x1f1e6;
  return String.fromCodePoint(first, second);
}

export function toFlag(label) {
  if (!label) {
    return "🏁";
  }
  const normalized = normalizeCountryLabel(label);

  const iso = COUNTRY_TO_ISO[normalized];
  if (!iso) {
    return "🏁";
  }

  return isoToFlagEmoji(iso);
}

export function toFlagUrl(label) {
  if (!label) {
    return PLACEHOLDER_DRIVER_IMAGE;
  }

  const normalized = normalizeCountryLabel(label);
  const iso = COUNTRY_TO_ISO[normalized];
  return iso ? `https://flagsapi.com/${iso}/flat/64.png` : PLACEHOLDER_DRIVER_IMAGE;
}

export const formatRaceDate = (date, time = '') => formatEventDate(date, time, true);
export const formatRaceDateTime = formatRaceDate;
// Preserve the API's verified sporting event name; no unverified commercial substitutions.
export function getOfficialRaceName(raceName, season) { return raceName; }
export const getOfficialRaceName2026 = raceName => getOfficialRaceName(raceName, 2026);

export function setupNavActiveState() {
  const current = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    const page = item.getAttribute("data-page");
    item.classList.toggle("is-active", page === current);
  });
}

const fallbackImages = new WeakSet();

export function setImageFallback(imageElement) {
  if (fallbackImages.has(imageElement)) return;
  fallbackImages.add(imageElement);
  imageElement.addEventListener("error", () => {
    if (imageElement.src !== PLACEHOLDER_DRIVER_IMAGE) imageElement.src = PLACEHOLDER_DRIVER_IMAGE;
  }, { once: true });
}
