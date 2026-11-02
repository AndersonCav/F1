<script setup>
import { computed } from "vue";
import { CHAMPIONS_HISTORY } from "../../../../assets/js/champion-history.js";
import { comparisonFrom, unavailable } from "../../adapters/portal.js";
import MetricBars from "../common/MetricBars.vue";
import Portrait from "../common/Portrait.vue";
const props = defineProps({ a: Object, b: Object });
const comparison = computed(() =>
  comparisonFrom(props.a, props.b, CHAMPIONS_HISTORY),
);
</script>
<template>
  <section
    v-if="comparison"
    class="comparison-panel panel"
    aria-label="Comparação de pilotos"
  >
    <div class="comparison-portraits">
      <div
        v-for="d in comparison.drivers"
        :key="d.id"
        :style="{ '--team': d.teamColor }"
      >
        <Portrait :src="d.photo" :name="d.fullName" /><span class="eyebrow">{{
          d.shortTeam
        }}</span>
        <h2>{{ d.fullName }}</h2>
        <p class="muted">{{ d.season }} · P{{ unavailable(d.position) }}</p>
      </div>
      <span class="versus" aria-hidden="true">VS</span>
    </div>
    <div class="comparison-metrics">
      <MetricBars
        v-for="m in comparison.metrics"
        :key="m.label"
        :label="m.label"
        :names="comparison.drivers.map((d) => d.fullName)"
        :values="m.values"
        :colors="comparison.drivers.map((d) => d.teamColor)"
        :unit="m.unit"
      />
    </div>
    <details class="comparison-table">
      <summary>Ver tabela de dados</summary>
      <div class="table-scroll">
        <table>
          <caption>
            Métricas de comparação. Na posição do campeonato, um número menor
            representa melhor colocação.
          </caption>
          <thead>
            <tr>
              <th scope="col">Métrica</th>
              <th v-for="d in comparison.drivers" :key="d.id" scope="col">
                {{ d.fullName }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in comparison.metrics" :key="m.label">
              <th scope="row">{{ m.label }}</th>
              <td v-for="(v, i) in m.values" :key="i">{{ unavailable(v) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
    <p class="muted small">
      Pontos, vitórias e posições: temporada {{ comparison.season }}. Títulos
      mundiais: arquivo completo de 1950 a 2025. Barras representam valores
      absolutos; menor posição é melhor. Poles e pódios não estão disponíveis
      nesta comparação.
    </p>
  </section>
  <p v-else class="data-state" role="status">
    Selecione dois pilotos diferentes da mesma temporada para comparar.
  </p>
</template>
