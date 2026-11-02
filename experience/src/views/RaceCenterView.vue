<script setup>
import { computed, ref, watch, defineAsyncComponent } from "vue";
import { fetchRaceResults } from "../../../assets/js/api.js";
import { portal } from "../composables/usePortal.js";
import { useQuery } from "../composables/useQuery.js";
import {
  normalizeRaceResource,
  resultRows,
  formatEventDate,
} from "../adapters/portal.js";
import PageHeader from "../components/common/PageHeader.vue";
import DataState from "../components/common/DataState.vue";
import RaceStatus from "../components/common/RaceStatus.vue";
import ResultsTable from "../components/common/ResultsTable.vue";
import FeatureUnavailable from "../components/common/FeatureUnavailable.vue";
const ComparisonPanel = defineAsyncComponent({
  loader: () => import("../components/drivers/ComparisonPanel.vue"),
  errorComponent: FeatureUnavailable,
});
const { state, races, drivers } = portal;
const round = useQuery("round");
const requestedSeason = useQuery("season");
const session = useQuery("session", "race", [
  "race",
  "qualifying",
  "sprint",
  "practice",
]);
const panel = useQuery("panel", "results", ["results", "compare", "timing"]);
const a = ref("");
const b = ref("");
const result = ref({ status: "idle", items: [] });
let generation = 0;
const selected = computed(
  () =>
    races.value.find((r) => String(r.round) === round.value) ||
    races.value.find((r) => r.isNext) ||
    races.value.at(-1),
);
const seasons = computed(() =>
  state.currentSeason
    ? Array.from(
        { length: state.currentSeason - 1949 },
        (_, i) => state.currentSeason - i,
      )
    : [],
);
watch(
  [() => state.currentSeason, requestedSeason],
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
async function chooseSeason(event) {
  round.value = "";
  requestedSeason.value = event.target.value;
}
async function getResults() {
  const token = ++generation;
  if (!selected.value || session.value !== "race") {
    result.value = { status: "empty", items: [] };
    return;
  }
  const expectedRace = selected.value;
  const season = state.season,
    eventRound = selected.value.round;
  result.value = { status: "loading", items: [] };
  const [response] = await Promise.allSettled([
    fetchRaceResults(season, eventRound),
  ]);
  if (token !== generation) return;
  result.value = normalizeRaceResource(response, expectedRace);
}
watch(
  [() => selected.value?.season, () => selected.value?.round, session],
  getResults,
  { immediate: true },
);
const rows = computed(() => resultRows({ Results: result.value.items }));
const unavailableSession = computed(() => session.value !== "race");
</script>
<template>
  <PageHeader
    eyebrow="ANÁLISE DE CORRIDA / RACE CENTER"
    title="Cada corrida tem uma história."
    text="Resultados publicados, contexto da sessão e comparações. Tudo no mesmo lugar."
  />
  <form class="filter-bar race-selectors" @submit.prevent>
    <label
      >Temporada<select
        aria-label="Temporada"
        :value="state.season"
        :disabled="!state.currentSeason"
        @change="chooseSeason"
      >
        <option v-if="!seasons.length" value="">Buscando temporada</option>
        <option v-for="year in seasons" :key="year" :value="year">
          {{ year }}
        </option>
      </select></label
    ><label
      >Grande Prêmio<select
        aria-label="Grande Prêmio"
        :value="selected?.round"
        :disabled="!races.length"
        @change="round = $event.target.value"
      >
        <option v-if="!races.length" value="">Calendário indisponível</option>
        <option v-for="r in races" :key="r.round" :value="r.round">
          {{ String(r.round).padStart(2, "0") }} · {{ r.raceName }}
        </option>
      </select></label
    ><label
      >Sessão<select aria-label="Sessão" v-model="session">
        <option value="race">Corrida</option>
        <option value="qualifying">Classificação</option>
        <option value="sprint">Sprint</option>
        <option value="practice">Treinos livres</option>
      </select></label
    >
  </form>
  <DataState
    :resource="state.schedule"
    label="calendário da temporada"
    @retry="portal.load(state.season)"
    ><section v-if="selected" class="race-center-heading panel">
      <div>
        <RaceStatus :status="selected.status" />
        <h2>{{ selected.raceName }}</h2>
        <p>
          {{ selected.Circuit.circuitName }}
          <span class="muted">/ {{ selected.Circuit.Location.country }}</span>
        </p>
        <time class="muted" :datetime="selected.date">{{
          formatEventDate(selected.date, selected.time, true)
        }}</time>
      </div>
      <span class="race-center-round" aria-hidden="true"
        >R{{ String(selected.round).padStart(2, "0") }}</span
      >
    </section></DataState
  >
  <p v-if="result.timestamp" class="muted small result-freshness">
    Resultados:
    {{
      result.stale
        ? "cache desatualizado"
        : result.source === "cache"
          ? "cache"
          : "Jolpica"
    }}
    · {{ new Date(result.timestamp).toLocaleString("pt-BR") }}
  </p>
  <div class="view-switch" role="group" aria-label="Painel do Race Center">
    <button
      v-for="p in [
        { id: 'results', label: 'Resultados' },
        { id: 'compare', label: 'Comparar pilotos' },
        { id: 'timing', label: 'Tempos e telemetria' },
      ]"
      :key="p.id"
      :aria-pressed="panel === p.id"
      @click="panel = p.id"
    >
      {{ p.label }}
    </button>
  </div>
  <section v-if="panel === 'results'" class="panel result-panel">
    <p v-if="unavailableSession" class="data-state" role="status">
      Esta sessão não está integrada. Apenas resultados de corrida estão
      disponíveis nesta fase. A existência ou realização desta sessão não foi
      confirmada.
    </p>
    <DataState
      v-else
      :resource="result"
      label="resultados de corrida"
      @retry="getResults"
      ><ResultsTable
        :rows="rows"
        :season="state.season"
        :name="selected?.raceName"
    /></DataState>
  </section>
  <section v-else-if="panel === 'compare'">
    <p class="notice">
      Comparação do campeonato {{ state.season }}; não representa desempenho
      nesta sessão.
    </p>
    <form class="filter-bar" @submit.prevent>
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
    <ComparisonPanel
      :a="drivers.find((d) => d.id === a)"
      :b="drivers.find((d) => d.id === b)"
    />
  </section>
  <section v-else class="panel">
    <div class="telemetry-heading">
      <p class="eyebrow">TEMPOS PUBLICADOS / CORRIDA</p>
      <h2>O que a fonte confirma.</h2>
    </div>
    <DataState
      v-if="!unavailableSession"
      :resource="result"
      label="tempos da corrida"
      @retry="getResults"
      ><ResultsTable
        :rows="rows"
        :season="state.season"
        :name="selected?.raceName"
    /></DataState>
    <p v-else class="notice">Tempos desta sessão não disponíveis.</p>
    <div class="telemetry-unavailable">
      <span class="eyebrow">TELEMETRIA INDISPONÍVEL</span>
      <h3>Os próximos dados entram na pista em outra fase.</h3>
      <p>
        Velocidade, acelerador, freio e voltas individuais exigem uma fonte
        validada. OpenF1 e F1DB ainda não estão integrados.
      </p>
      <div class="unavailable-metrics">
        <span>Velocidade <strong>—</strong></span
        ><span>Acelerador <strong>—</strong></span
        ><span>Freio <strong>—</strong></span>
      </div>
    </div>
  </section>
</template>
