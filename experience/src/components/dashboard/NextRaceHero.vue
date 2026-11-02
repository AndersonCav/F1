<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { countdownText } from "../../../../assets/js/season.js";
import { raceStart, formatEventDate } from "../../adapters/portal.js";
import RaceStatus from "../common/RaceStatus.vue";
import Icon from "../common/Icon.vue";
const props = defineProps({ race: Object, season: Number });
const now = ref(Date.now());
let timer;
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});
onUnmounted(() => clearInterval(timer));
const countdown = computed(() =>
  countdownText(raceStart(props.race), now.value),
);
</script>
<template>
  <article class="next-race-hero">
    <div class="hero-grid" aria-hidden="true" />
    <span class="hero-round" aria-hidden="true">{{
      race ? String(race.round).padStart(2, "0") : "//"
    }}</span>
    <div class="hero-content">
      <div class="hero-top">
        <RaceStatus :status="race?.status || 'status_unknown'" /><span
          class="eyebrow"
          >{{ season || "—" }} · ETAPA {{ race?.round || "—" }}</span
        >
      </div>
      <template v-if="race"
        ><p class="eyebrow hero-kicker">PRÓXIMO GRANDE PRÊMIO</p>
        <h2>
          {{ race.raceName.replace(" Grand Prix", "") }}<br /><span
            >Grand Prix<span class="red">.</span></span
          >
        </h2>
        <p class="circuit-name">{{ race.Circuit.circuitName }}</p>
        <p class="muted">
          {{ race.Circuit.Location.locality }},
          {{ race.Circuit.Location.country }}
        </p>
        <div class="hero-bottom">
          <div>
            <p class="eyebrow">LARGADA · SEU HORÁRIO LOCAL</p>
            <time
              :datetime="
                raceStart(race) ? `${race.date}T${race.time}` : race.date
              "
              >{{ formatEventDate(race.date, race.time, true) }}</time
            >
            <p class="countdown"><Icon name="clock" />{{ countdown }}</p>
          </div>
          <RouterLink
            :to="{ path: '/race-center', query: { round: race.round } }"
            class="button primary"
            >Explorar corrida <Icon name="arrow"
          /></RouterLink></div></template
      ><template v-else
        ><p class="eyebrow hero-kicker">CALENDÁRIO DA TEMPORADA</p>
        <h2>
          O próximo<br /><span>capítulo<span class="red">.</span></span>
        </h2>
        <p class="muted">
          Nenhuma próxima largada publicada nesta temporada.<br />Explore os
          eventos e os resultados disponíveis.
        </p>
        <RouterLink to="/calendar" class="button primary"
          >Abrir calendário <Icon name="arrow" /></RouterLink
      ></template>
    </div>
  </article>
</template>
