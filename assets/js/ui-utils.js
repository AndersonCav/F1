/**
 * UI Utilities - Funções compartilhadas para manipulação de DOM e feedback visual
 */

export function renderSkeleton(container, count = 6, type = "grid") {
  const wrapper = document.createElement("div");
  wrapper.className = type === "grid" ? "grid" : "list";
  wrapper.setAttribute("role", "status");
  wrapper.setAttribute("aria-label", "Carregando dados…");
  
  // Adiciona classes específicas se for grid
  if (type === "grid") {
    if (container.id === "drivers-state") wrapper.classList.add("grid-drivers");
    if (container.id === "teams-state") wrapper.classList.add("grid-teams");
    if (container.id === "champions-state") wrapper.classList.add("grid-champions");
  }

  for (let i = 0; i < count; i += 1) {
    const skeletonCard = document.createElement("article");
    skeletonCard.className = "skeleton-card";

    for (let line = 0; line < 4; line += 1) {
      const skeletonLine = document.createElement("div");
      skeletonLine.className = `skeleton skeleton-line ${line === 0 ? "short" : "medium"}`;
      skeletonCard.appendChild(skeletonLine);
    }

    wrapper.appendChild(skeletonCard);
  }

  container.replaceChildren(wrapper);
}

export function renderError(container, message, onRetry) {
  const card = document.createElement("article");
  card.className = "state-card error reveal-up";
  card.setAttribute("role", "alert");

  const text = document.createElement("p");
  text.textContent = message || "Não foi possível carregar os dados no momento.";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button";
  button.innerHTML = `
    <svg class="retry-icon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
    Tentar novamente
  `;
  button.addEventListener("click", onRetry);

  card.append(text, button);
  container.replaceChildren(card);
}

export function renderEmptyState(container, message) {
  const card = document.createElement("article");
  card.className = "state-card state-card-empty reveal-up";
  
  const icon = document.createElement("div");
  icon.className = "empty-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "🔍";
  const text = document.createElement("p");
  text.className = "empty-message";
  text.textContent = message || "Nenhum resultado encontrado.";
  card.setAttribute("role", "status");
  card.append(icon, text);
  
  container.replaceChildren(card);
}

/**
 * Cria uma notificação visual discreta sobre o estado do cache
 */
export function showCacheFeedback(...results) {
  const existing = document.getElementById("cache-info");
  if (existing) existing.remove();

  const records = results.filter(result => Number.isFinite(result?.timestamp));
  if (!records.length) return;
  const timestamp = Math.min(...records.map(result => result.timestamp));
  const stale = records.some(result => result.stale) || Date.now() - timestamp >= 60 * 60 * 1000;

  const date = new Date(timestamp);
  const timeStr = date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  
  const info = document.createElement("div");
  info.id = "cache-info";
  info.className = "cache-feedback reveal-up";
  info.setAttribute("role", "status");
  info.innerHTML = `
    <span>${stale ? "DADOS SALVOS · SEM ATUALIZAÇÃO" : "DADOS DA API"} (${timeStr})</span>
    <button id="clear-cache-btn" type="button" title="Forçar atualização" aria-label="Buscar dados atualizados da API">RELOAD</button>
  `;

  document.body.appendChild(info);

  document.getElementById("clear-cache-btn")?.addEventListener("click", () => {
    // Bypass freshness on the next navigation, keeping offline data until success.
    const url = new URL(window.location.href);
    url.searchParams.set("f1-refresh", "1");
    window.location.assign(url.href);
  });
}

/**
 * Anúncio para leitores de tela
 */
export function announceToScreenReader(message) {
  let announcer = document.getElementById("sr-announcer");
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.id = "sr-announcer";
    announcer.setAttribute("aria-live", "polite");
    announcer.className = "sr-only";
    document.body.appendChild(announcer);
  }
  announcer.textContent = message;
}

export function registerServiceWorker() {
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    const register = () => {
      const swUrl = new URL("../../sw.js", import.meta.url);
      navigator.serviceWorker.register(swUrl.href, { scope: new URL("./", swUrl).href }).catch(error => {
        console.error("[F1 Portal] Service Worker registration failed.", error);
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}

registerServiceWorker();
