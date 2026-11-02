<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { destinations, navigationFailure } from "./router/index.js";
import { portal } from "./composables/usePortal.js";
import Icon from "./components/common/Icon.vue";
const route = useRoute();
const drawer = ref(false);
const menuButton = ref(null);
const navigation = ref(null);
const { state, freshness } = portal;
function closeDrawer(restore = false) {
  drawer.value = false;
  if (restore) nextTick(() => menuButton.value?.focus());
}
function trap(event) {
  if (event.key === "Escape") {
    closeDrawer(true);
    return;
  }
  if (event.key !== "Tab") return;
  const controls = navigation.value?.querySelectorAll("a, button");
  if (!controls?.length) return;
  const first = controls[0],
    last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
watch(drawer, async (open) => {
  document.body.classList.toggle("drawer-open", open);
  if (open) {
    await nextTick();
    navigation.value?.querySelector("button")?.focus();
  }
});
watch(
  () => route.path,
  async () => {
    closeDrawer();
    document.title = `${route.meta.title || "Race Center"} · F1 Portal`;
    await nextTick();
    // Lazy routes may finish on the following frame; the route view hook completes focus.
  },
);
function focusPage() {
  nextTick(() => document.querySelector("h1")?.focus({ preventScroll: true }));
}
let clockTimer;
onMounted(() => {
  portal.load();
  clockTimer = setInterval(portal.updateClock, 30000);
  document.addEventListener("visibilitychange", portal.updateClock);
});
onUnmounted(() => {
  clearInterval(clockTimer);
  document.removeEventListener("visibilitychange", portal.updateClock);
});
</script>
<template>
  <a class="skip-link" href="#main">Pular para o conteúdo</a>
  <div class="app-layout">
    <div
      v-if="drawer"
      class="drawer-backdrop"
      aria-hidden="true"
      @click="closeDrawer(true)"
    />
    <aside
      ref="navigation"
      class="sidebar"
      :class="{ open: drawer }"
      :role="drawer ? 'dialog' : undefined"
      :aria-modal="drawer ? 'true' : undefined"
      :aria-label="drawer ? 'Navegação principal' : undefined"
      @keydown="drawer && trap($event)"
    >
      <div class="sidebar-brand">
        <RouterLink to="/" class="brand" aria-label="F1 Portal — visão geral"
          ><span class="brand-mark" aria-hidden="true">//</span
          ><span
            >F1<span class="brand-light">PORTAL</span
            ><small>RACE INTELLIGENCE</small></span
          ></RouterLink
        ><button
          class="icon-button close-drawer"
          aria-label="Fechar navegação"
          @click="closeDrawer(true)"
        >
          <Icon name="close" />
        </button>
      </div>
      <p class="nav-label">NO PADDOCK</p>
      <nav aria-label="Principal">
        <RouterLink
          v-for="item in destinations"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          @click="closeDrawer()"
          :class="{ selected: route.path === item.path }"
          :aria-current="route.path === item.path ? 'page' : undefined"
          ><Icon :name="item.icon" /><span>{{ item.label }}</span
          ><span v-if="item.path === '/race-center'" class="nav-tag"
            >NOVO</span
          ></RouterLink
        >
      </nav>
      <div class="sidebar-bottom">
        <div class="season-stamp">
          <span class="eyebrow">TEMPORADA EM FOCO</span
          ><strong>{{ state.season || "—" }}<span class="red">/</span></strong
          ><span class="muted">Cada ponto conta.</span>
        </div>
        <a href="https://andersoncav.github.io/F1/" class="legacy-link"
          >Portal original <span aria-hidden="true">↗</span></a
        >
        <p>Projeto independente.<br />Sem vínculo oficial com a Fórmula 1.</p>
      </div>
    </aside>
    <div class="workspace" :inert="drawer || undefined">
      <header class="topbar">
        <div class="topbar-start">
          <button
            ref="menuButton"
            class="icon-button mobile-menu"
            aria-label="Abrir navegação"
            :aria-expanded="drawer"
            @click="drawer = true"
          >
            <Icon name="menu" /></button
          ><span class="topbar-title"
            >RACE CENTER<span class="red"> /</span></span
          ><span class="desktop-label">O esporte. Em detalhes.</span>
        </div>
        <div class="topbar-end">
          <span
            class="data-dot"
            :class="{ warning: freshness.stale || freshness.partial }"
            aria-hidden="true"
          /><span>{{
            state.loading
              ? "Buscando dados"
              : state.error
                ? "Fonte indisponível"
                : freshness.partial
                  ? "Dados parciais"
                  : freshness.stale
                    ? "Cache desatualizado"
                    : freshness.cached
                      ? "Dados em cache"
                      : "Dados publicados"
          }}</span
          ><span class="topbar-season">{{ state.season || "—" }}</span>
        </div>
      </header>
      <main id="main" class="main-content" tabindex="-1">
        <div v-if="navigationFailure" class="notice" role="alert">
          <strong>Não foi possível abrir esta página.</strong>
          <p>
            Uma página ainda não visitada pode precisar de conexão. Reconecte-se
            e tente novamente, ou retorne à visão geral.
          </p>
          <RouterLink to="/" class="text-link"
            >Voltar à visão geral ↗</RouterLink
          >
        </div>
        <RouterView v-slot="{ Component }"
          ><component :is="Component" @vue:mounted="focusPage"
        /></RouterView>
      </main>
      <footer class="app-footer">
        <span
          >F1 PORTAL <span class="red">//</span> EXPERIÊNCIA EXPERIMENTAL</span
        ><span v-if="freshness.timestamp"
          >Fonte: Jolpica ·
          {{ new Date(freshness.timestamp).toLocaleString("pt-BR") }}</span
        ><span v-else
          >História verificada até 2025 · dados sujeitos à disponibilidade</span
        >
      </footer>
    </div>
  </div>
</template>
