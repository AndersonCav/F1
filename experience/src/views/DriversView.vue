<script setup>
import { computed, ref } from "vue";
import { portal } from "../composables/usePortal.js";
import { useQuery } from "../composables/useQuery.js";
import { normalizeSearch, compareNumber } from "../adapters/portal.js";
import PageHeader from "../components/common/PageHeader.vue";
import DataState from "../components/common/DataState.vue";
import DriverCard from "../components/drivers/DriverCard.vue";
const { state, drivers, constructors } = portal;
const query = useQuery("q");
const team = useQuery("team");
const sort = useQuery("sort", "position", [
  "position",
  "points",
  "wins",
  "name",
]);
const chosen = ref([]);
const message = ref("");
const filtered = computed(() =>
  drivers.value
    .filter(
      (d) =>
        normalizeSearch(d.fullName).includes(normalizeSearch(query.value)) &&
        (!team.value || d.constructorIds.includes(team.value)),
    )
    .sort((a, b) =>
      sort.value === "name"
        ? a.fullName.localeCompare(b.fullName, "pt-BR")
        : compareNumber(
            a[sort.value],
            b[sort.value],
            sort.value !== "position",
          ),
    ),
);
function select(id) {
  if (chosen.value.includes(id))
    chosen.value = chosen.value.filter((d) => d !== id);
  else if (chosen.value.length < 2) chosen.value.push(id);
  else {
    message.value = "Remova um piloto antes de selecionar outro.";
    return;
  }
  message.value = `${chosen.value.length} de 2 pilotos selecionados.`;
}
</script>
<template>
  <PageHeader
    eyebrow="O GRID / TEMPORADA EM FOCO"
    title="Talento. Coragem. Precisão."
    :text="`Conheça os pilotos e explore a classificação de ${state.season || 'temporada não informada'}.`"
    ><RouterLink to="/compare" class="button secondary"
      >Comparar pilotos ↗</RouterLink
    ></PageHeader
  >
  <form class="filter-bar" @submit.prevent>
    <label class="search-control"
      >Buscar piloto<input
        v-model="query"
        type="search"
        placeholder="Nome do piloto…" /></label
    ><label
      >Construtor<select v-model="team" aria-label="Construtor">
        <option value="">Todos os construtores</option>
        <option v-for="c in constructors" :key="c.id" :value="c.id">
          {{ c.shortName }}
        </option>
      </select></label
    ><label
      >Ordenar por<select v-model="sort">
        <option value="position">Classificação</option>
        <option value="points">Mais pontos</option>
        <option value="wins">Mais vitórias</option>
        <option value="name">Nome A–Z</option>
      </select></label
    ><span class="filter-count" role="status"
      >{{ filtered.length }} pilotos</span
    >
  </form>
  <DataState
    :resource="state.driverStandings"
    label="pilotos"
    @retry="portal.load(state.season)"
    ><p v-if="!filtered.length" class="data-state" role="status">
      Nenhum piloto encontrado. Ajuste a busca ou os filtros.
    </p>
    <div class="driver-grid">
      <DriverCard
        v-for="d in filtered"
        :key="d.id"
        :driver="d"
        :selected="chosen.includes(d.id)"
        @compare="select"
      /></div
  ></DataState>
  <div v-if="chosen.length" class="comparison-tray">
    <span>{{ chosen.length }}/2 pilotos selecionados</span
    ><button
      class="button secondary"
      @click="
        chosen = [];
        message = 'Seleção removida.';
      "
    >
      Limpar</button
    ><RouterLink
      v-if="chosen.length === 2"
      :to="{
        path: '/compare',
        query: { a: chosen[0], b: chosen[1], season: state.season },
      }"
      class="button primary"
      >Comparar agora ↗</RouterLink
    >
  </div>
  <p class="sr-only" role="status">{{ message }}</p>
</template>
