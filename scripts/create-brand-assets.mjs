// Original geometric artwork: a portal aperture and timing stripes, no official marks.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, launchOptions } from '../tests/helpers/champion-browser.js';

const dir = new URL('../assets/images/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await chromium.launch(launchOptions);
const mark = `<rect x="0" y="0" width="512" height="512" fill="#15151e"/>
  <path d="M152 352V160h208v192h-64V224h-80v128Z" fill="#fff"/>
  <path d="M112 368h288v32H112zM112 112h288v16H112z" fill="#e10600"/>`;
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${mark}</svg>`;
const social = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0c0c0f"/>
  <path d="M0 0h16v630H0zM64 514h1072v2H64z" fill="#e10600"/>
  <svg x="872" y="120" width="240" height="240" viewBox="0 0 512 512">${mark}</svg>
  <g font-family="Arial, sans-serif" fill="white">
    <text x="64" y="130" font-size="22" letter-spacing="5" fill="#ff7772">DADOS PUBLICADOS · MEMÓRIA DO ESPORTE</text>
    <text x="60" y="280" font-size="96" font-weight="900" font-style="italic">F1 PORTAL</text>
    <text x="64" y="365" font-size="32">Calendário. Classificação. História.</text>
    <text x="64" y="458" font-size="24" fill="#b0b0ba">Seu próximo Grande Prêmio começa aqui.</text>
    <text x="64" y="565" font-size="20" fill="#b0b0ba">Portal independente · sem afiliação oficial à Fórmula 1</text>
  </g>
</svg>`;
try {
  for (const [name, width, height, svg] of [['icon-192.png', 192, 192, icon], ['icon-512.png', 512, 512, icon], ['social-preview.png', 1200, 630, social]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0">${svg.replace(/width="512" height="512"/, `width="${width}" height="${height}"`)}</body>`);
    await page.screenshot({ path: fileURLToPath(new URL(name, dir)) });
    await page.close();
  }
  await mkdir(new URL('../docs/phase-4/', import.meta.url), { recursive: true });
  await writeFile(new URL('../docs/phase-4/brand-source.svg', import.meta.url), social + '\n');
} finally { await browser.close(); }
