<script setup>
import { computed } from "vue";
import { portal } from "../composables/usePortal.js";
import { useQuery } from "../composables/useQuery.js";
import { normalizeSearch, compareNumber } from "../adapters/portal.js";
import ConstructorCard from "../components/teams/ConstructorCard.vue";
import PageHeader from "../components/common/PageHeader.vue";
import DataState from "../components/common/DataState.vue";
const { state, constructors } = portal;
const query = useQuery("q");
const sort = useQuery("sort", "position", [
  "position",
  "points",
  "wins",
  "name",
]);
const filtered = computed(() =>
  constructors.value
    .filter((c) =>
      normalizeSearch(`${c.name} ${c.shortName}`).includes(
        normalizeSearch(query.value),
      ),
    )
    .sort((a, b) =>
      sort.value === "name"
        ? a.name.localeCompare(b.name)
        : compareNumber(
            a[sort.value],
            b[sort.value],
            sort.value !== "position",
          ),
    ),
);
</script>
<template>
  <PageHeader
    eyebrow="AS EQUIPES / TEMPORADA EM FOCO"
    title="A força por trás do grid."
    :text="`Engenharia, estratégia e os pontos que definem o Mundial de ${state.season || 'temporada não informada'}.`"
  />
  <form class="filter-bar" @submit.prevent>
    <label class="search-control"
      >Buscar construtor<input
        v-model="query"
        type="search"
        placeholder="Nome da equipe…" /></label
    ><label
      >Ordenar por<select v-model="sort">
        <option value="position">Classificação</option>
        <option value="points">Mais pontos</option>
        <option value="wins">Vitórias na temporada</option>
        <option value="name">Nome A–Z</option>
      </select></label
    ><span class="filter-count" role="status"
      >{{ filtered.length }} construtores</span
    >
  </form>
  <DataState
    :resource="state.constructorStandings"
    label="construtores"
    @retry="portal.load(state.season)"
    ><p v-if="!filtered.length" class="data-state" role="status">
      Nenhum construtor encontrado.
    </p>
    <div class="constructor-grid">
      <ConstructorCard v-for="c in filtered" :key="c.id" :team="c" /></div
  ></DataState>
</template>
