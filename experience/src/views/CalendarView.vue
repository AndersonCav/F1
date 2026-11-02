<script setup>
import { computed, nextTick } from "vue";
import { portal } from "../composables/usePortal.js";
import { useQuery } from "../composables/useQuery.js";
import PageHeader from "../components/common/PageHeader.vue";
import DataState from "../components/common/DataState.vue";
import RaceCard from "../components/calendar/RaceCard.vue";
const { state, races } = portal;
const status = useQuery("status", "all", [
  "all",
  "upcoming",
  "completed",
  "pending",
]);
const filtered = computed(() =>
  races.value.filter(
    (r) =>
      status.value === "all" ||
      (status.value === "upcoming"
        ? ["upcoming", "scheduled"].includes(r.status)
        : status.value === "pending"
          ? ["result_pending", "status_unknown"].includes(r.status)
          : r.status === "completed"),
  ),
);
const next = computed(() => races.value.find((r) => r.isNext));
async function goNext() {
  status.value = "all";
  await nextTick();
  setTimeout(() => {
    const target = document.getElementById(`round-${next.value?.round}`);
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    target?.focus({ preventScroll: true });
  }, 80);
}
</script>
<template>
  <PageHeader
    eyebrow="AO REDOR DO MUNDO / CALENDÁRIO"
    title="Um mundo de disputas."
    :text="`Cada circuito, um desafio. Calendário publicado de ${state.season || 'temporada não informada'} no seu horário local.`"
    ><button v-if="next" class="button primary" @click="goNext">
      Ir à próxima corrida ↓
    </button></PageHeader
  >
  <div class="filter-bar">
    <label
      >Exibir corridas<select v-model="status">
        <option value="all">Todas as etapas</option>
        <option value="upcoming">Próximas e programadas</option>
        <option value="completed">Resultados confirmados</option>
        <option value="pending">Resultado ou status pendente</option>
      </select></label
    >
    <p class="muted small">Uma largada no passado não confirma o resultado.</p>
    <span class="filter-count" role="status">{{ filtered.length }} etapas</span>
  </div>
  <DataState
    :resource="state.schedule"
    label="calendário"
    @retry="portal.load(state.season)"
    ><p v-if="!filtered.length" class="data-state" role="status">
      Nenhuma corrida corresponde a este filtro.
    </p>
    <div class="race-timeline">
      <RaceCard
        v-for="r in filtered"
        :key="`${r.season}:${r.round}`"
        :race="r"
      /></div
  ></DataState>
</template>
