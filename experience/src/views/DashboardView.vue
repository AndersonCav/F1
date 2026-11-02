<script setup>
import { computed } from "vue";
import { portal } from "../composables/usePortal.js";
import PageHeader from "../components/common/PageHeader.vue";
import SectionHeader from "../components/common/SectionHeader.vue";
import DataState from "../components/common/DataState.vue";
import Portrait from "../components/common/Portrait.vue";
import NextRaceHero from "../components/dashboard/NextRaceHero.vue";
import Leaderboard from "../components/dashboard/Leaderboard.vue";
import {
  resultRows,
  unavailable,
  formatEventDate,
} from "../adapters/portal.js";
const { state, drivers, constructors, races, freshness } = portal;
const next = computed(() => races.value.find((r) => r.isNext));
const last = computed(() => state.last.items.at(-1));
const confirmedCount = computed(() =>
  ["ready", "empty"].includes(state.winners.status) ||
  ["ready", "empty"].includes(state.last.status)
    ? races.value.filter((r) => r.status === "completed").length
    : null,
);
const podium = computed(() =>
  resultRows(last.value).filter((r) => r.position <= 3),
);
</script>
<template>
  <PageHeader
    title="Dentro do campeonato."
    text="Do próximo sinal verde a cada ponto na classificação."
    ><RouterLink to="/calendar" class="button secondary"
      >Calendário {{ state.season }}
      <span aria-hidden="true">↗</span></RouterLink
    ></PageHeader
  >
  <p v-if="freshness.partial" class="notice" role="status">
    Algumas fontes estão indisponíveis. Os painéis indicam quais dados foram
    recebidos.
  </p>
  <div class="dashboard-hero-layout">
    <DataState
      :resource="state.schedule"
      label="calendário"
      @retry="portal.load(state.season)"
      ><NextRaceHero :race="next" :season="state.season"
    /></DataState>
    <article class="last-race panel">
      <div class="eyebrow"><span class="red">■</span> ÚLTIMA BANDEIRADA</div>
      <DataState
        :resource="state.last"
        label="última corrida"
        @retry="portal.load(state.season)"
        ><h2>{{ last?.raceName }}</h2>
        <p class="muted small">{{ formatEventDate(last?.date, last?.time) }}</p>
        <div class="podium-list">
          <div v-for="r in podium" :key="r.id" class="podium-row">
            <span class="podium-position">P{{ r.position }}</span
            ><Portrait
              :src="drivers.find((d) => d.id === r.id)?.photo"
              :name="r.name"
              compact
            />
            <div>
              <strong>{{ r.name }}</strong
              ><small>{{ r.team }}</small>
            </div>
            <span class="podium-time">{{ r.time }}</span>
          </div>
        </div>
        <RouterLink
          v-if="last"
          :to="{ path: '/race-center', query: { round: last.round } }"
          class="text-link"
          >Resultado completo <span aria-hidden="true">↗</span></RouterLink
        ></DataState
      >
    </article>
  </div>
  <div class="season-stats">
    <div>
      <span class="stat-label">TEMPORADA</span
      ><strong>{{ state.season || "—" }}</strong
      ><span>Dados publicados</span>
    </div>
    <div>
      <span class="stat-label">RESULTADOS CONFIRMADOS</span
      ><strong
        >{{ confirmedCount ?? "—"
        }}<small> / {{ races.length || "—" }}</small></strong
      ><span>Grandes Prêmios</span>
    </div>
    <div>
      <span class="stat-label">LÍDER DO CAMPEONATO</span
      ><strong class="stat-name">{{
        drivers[0]?.fullName || "Não disponível"
      }}</strong
      ><span>{{ unavailable(drivers[0]?.points) }} pontos na temporada</span>
    </div>
    <div>
      <span class="stat-label">DISPUTA ENTRE EQUIPES</span
      ><strong class="stat-name">{{
        constructors[0]?.shortName || "Não disponível"
      }}</strong
      ><span
        >{{ unavailable(constructors[0]?.points) }} pontos na temporada</span
      >
    </div>
  </div>
  <div class="row g-4">
    <section class="col-12 xl:col-7">
      <div class="panel">
        <SectionHeader
          title="Mundial de pilotos"
          caption="A DISPUTA PELO TÍTULO"
          to="/drivers"
        /><DataState
          :resource="state.driverStandings"
          label="classificação de pilotos"
          @retry="portal.load(state.season)"
          ><Leaderboard :items="drivers.slice(0, 7)" :season="state.season"
        /></DataState>
      </div>
    </section>
    <section class="col-12 xl:col-5">
      <div class="panel">
        <SectionHeader
          title="Mundial de construtores"
          caption="FORÇA COLETIVA"
          to="/constructors"
        /><DataState
          :resource="state.constructorStandings"
          label="classificação de construtores"
          @retry="portal.load(state.season)"
          ><Leaderboard
            :items="constructors.slice(0, 5)"
            :season="state.season"
            constructors /></DataState
        ><RouterLink to="/compare" class="compare-promo"
          ><span class="eyebrow">LADO A LADO</span
          ><strong>Dois pilotos. Outra perspectiva.</strong
          ><span
            >Monte sua comparação <span aria-hidden="true">↗</span></span
          ></RouterLink
        >
      </div>
    </section>
  </div>
</template>
