<script setup>
import { computed } from "vue";
import {
  CHAMPIONS_HISTORY,
  CHAMPIONS_THROUGH_SEASON,
} from "../../../assets/js/champion-history.js";
import { normalizeSearch } from "../adapters/portal.js";
import { useQuery } from "../composables/useQuery.js";
import ChampionCard from "../components/champions/ChampionCard.vue";
import PageHeader from "../components/common/PageHeader.vue";
const query = useQuery("q");
const era = useQuery("era", "", ["", "1950", "1970", "1990", "2010"]);
const sort = useQuery("sort", "titles", ["titles", "name", "first"]);
const eras = [
  { value: "1950", label: "1950–1969", end: 1969 },
  { value: "1970", label: "1970–1989", end: 1989 },
  { value: "1990", label: "1990–2009", end: 2009 },
  { value: "2010", label: "2010–2025", end: 2025 },
];
const filtered = computed(() =>
  CHAMPIONS_HISTORY.filter(
    (c) =>
      normalizeSearch(c.name).includes(normalizeSearch(query.value)) &&
      (!era.value ||
        c.titleYears.some(
          (y) =>
            y >= Number(era.value) &&
            y <= eras.find((e) => e.value === era.value).end,
        )),
  ).sort((a, b) =>
    sort.value === "name"
      ? a.name.localeCompare(b.name)
      : sort.value === "first"
        ? a.titleYears[0] - b.titleYears[0]
        : b.titleYears.length - a.titleYears.length ||
          b.titleYears.at(-1) - a.titleYears.at(-1),
  ),
);
</script>
<template>
  <PageHeader
    eyebrow="HALL DOS CAMPEÕES / 1950—2025"
    title="O tempo passa. A lenda fica."
    :text="`${CHAMPIONS_HISTORY.length} campeões. Uma história escrita no limite. Títulos verificados até ${CHAMPIONS_THROUGH_SEASON}.`"
  />
  <div class="archive-banner">
    <span class="archive-number">{{ CHAMPIONS_HISTORY.length }}</span>
    <div>
      <p class="eyebrow">NOMES NA HISTÓRIA</p>
      <p>Da primeira bandeirada<br />ao topo do mundo.</p>
    </div>
    <span class="archive-period">1950 <span class="red">/</span> 2025</span>
  </div>
  <form class="filter-bar" @submit.prevent>
    <label class="search-control"
      >Buscar campeão<input
        v-model="query"
        type="search"
        placeholder="Encontre uma lenda…" /></label
    ><label
      >Época dos títulos<select v-model="era">
        <option value="">Todas as eras</option>
        <option v-for="e in eras" :key="e.value" :value="e.value">
          {{ e.label }}
        </option>
      </select></label
    ><label
      >Ordenar por<select v-model="sort">
        <option value="titles">Mais títulos</option>
        <option value="name">Nome A–Z</option>
        <option value="first">Primeiro título</option>
      </select></label
    ><span class="filter-count" role="status"
      >{{ filtered.length }} campeões</span
    >
  </form>
  <p v-if="!filtered.length" class="data-state" role="status">
    Nenhum campeão encontrado para esta seleção.
  </p>
  <div class="champion-grid">
    <ChampionCard v-for="c in filtered" :key="c.id" :champion="c" />
  </div>
</template>
