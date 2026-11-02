<script setup>
import { computed, watch } from "vue";
import { portal } from "../composables/usePortal.js";
import { useQuery } from "../composables/useQuery.js";
import PageHeader from "../components/common/PageHeader.vue";
import DataState from "../components/common/DataState.vue";
import ComparisonPanel from "../components/drivers/ComparisonPanel.vue";
const { state, drivers } = portal;
const a = useQuery("a");
const b = useQuery("b");
const season = useQuery("season");
watch(
  [() => state.currentSeason, season],
  ([current, requested]) => {
    if (
      current &&
      /^\d{4}$/.test(requested) &&
      Number(requested) >= 1950 &&
      Number(requested) <= current &&
      Number(requested) !== state.season
    )
      portal.load(Number(requested));
  },
  { immediate: true },
);
const driverA = computed(() => drivers.value.find((d) => d.id === a.value));
const driverB = computed(() => drivers.value.find((d) => d.id === b.value));
</script>
<template>
  <PageHeader
    eyebrow="HEAD TO HEAD / COMPARAÇÃO"
    title="Lado a lado. Ponto a ponto."
    :text="`Compare o desempenho publicado de ${state.season || 'temporada não informada'}. Métricas de carreira têm referência própria.`"
  />
  <form class="filter-bar comparison-controls" @submit.prevent>
    <label
      >Piloto A<select v-model="a">
        <option value="">Selecionar piloto A</option>
        <option
          v-for="d in drivers"
          :key="d.id"
          :value="d.id"
          :disabled="d.id === b"
        >
          {{ d.fullName }}
        </option>
      </select></label
    ><span class="versus-inline" aria-hidden="true">VS</span
    ><label
      >Piloto B<select v-model="b">
        <option value="">Selecionar piloto B</option>
        <option
          v-for="d in drivers"
          :key="d.id"
          :value="d.id"
          :disabled="d.id === a"
        >
          {{ d.fullName }}
        </option>
      </select></label
    >
  </form>
  <DataState
    :resource="state.driverStandings"
    label="pilotos para comparar"
    @retry="portal.load(state.season)"
    ><ComparisonPanel :a="driverA" :b="driverB"
  /></DataState>
</template>
