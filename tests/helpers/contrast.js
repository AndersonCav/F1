// Runs in Chrome. Use computed colors, including conservative combinations of
// gradient stops/grid overlays, rather than assuming a design-token background.
export function computedContrast() {
  const parse = css => {
    const parts = css.match(/[\d.]+/g)?.map(Number);
    return parts?.length >= 3 ? [...parts.slice(0, 3), parts[3] ?? 1] : [0, 0, 0, 0];
  };
  const over = (fg, bg) => [...fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])), 1];
  const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  const backgrounds = element => {
    const ancestors = [];
    for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
    let candidates = [[255, 255, 255, 1]];
    for (const node of ancestors) {
      const style = getComputedStyle(node);
      candidates = candidates.map(bg => over(parse(style.backgroundColor), bg));
      const stops = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(m => parse(m[0]));
      const opaque = stops.filter(c => c[3] === 1);
      if (opaque.length) candidates = candidates.flatMap(bg => opaque.map(c => over(c, bg)));
      // Layered technical-grid lines can overlap: include that brightest case.
      for (const stop of stops.filter(c => c[3] > 0 && c[3] < 1)) candidates = [...candidates, ...candidates.map(bg => over(stop, bg))];
      const unique = new Map(candidates.map(c => [c.join(','), c]));
      candidates = [...unique.values()];
    }
    return candidates;
  };
  const samples = [];
  const unique = new Set();
  for (const element of document.querySelectorAll('body *')) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 || rect.right < 0 || element.closest('.sr-only') || ![...element.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const style = getComputedStyle(element);
    const color = parse(style.color);
    const backgroundsList = backgrounds(element);
    const worst = backgroundsList.reduce((a, b) => ratio(over(color, a), a) < ratio(over(color, b), b) ? a : b);
    const large = parseFloat(style.fontSize) >= 24 || (parseInt(style.fontWeight) >= 700 && parseFloat(style.fontSize) >= 18.66);
    const key = `${color}|${worst}|${large}`;
    if (unique.has(key)) continue;
    unique.add(key);
    samples.push({ selector: `${element.tagName.toLowerCase()}.${String(element.className).replaceAll(' ', '.')}`, foreground: style.color, background: worst, ratio: ratio(over(color, worst), worst), minimum: large ? 3 : 4.5 });
  }
  for (const element of document.querySelectorAll('.field input, .field select, .button, .cache-feedback button, .bottom-nav .is-active, .sidebar .is-active')) {
    if (!element.getBoundingClientRect().width) continue;
    const style = getComputedStyle(element);
    const indicator = parse(element.matches('.is-active') ? style.boxShadow.match(/rgba?\([^)]+\)/)?.[0] || style.borderTopColor : style.borderTopColor);
    const worst = backgrounds(element).reduce((a, b) => ratio(indicator, a) < ratio(indicator, b) ? a : b);
    samples.push({ selector: element.className, foreground: indicator, background: worst, ratio: ratio(indicator, worst), minimum: 3, kind: 'required control indicator' });
  }
  return samples;
}
