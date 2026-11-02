<script setup>
import { formatEventDate } from "../../adapters/portal.js";
import RaceStatus from "../common/RaceStatus.vue";
defineProps({ race: Object });
</script>
<template>
  <article
    class="race-card"
    :class="{ 'next-event': race.isNext }"
    :id="`round-${race.round}`"
    tabindex="-1"
  >
    <div class="race-round">
      <span>ROUND</span
      ><strong>{{ String(race.round).padStart(2, "0") }}</strong>
    </div>
    <div class="race-identity">
      <RaceStatus :status="race.status" />
      <h2>{{ race.raceName }}</h2>
      <p class="muted">{{ race.Circuit.circuitName }}</p>
      <p class="small muted">
        {{ race.Circuit.Location.locality }} ·
        {{ race.Circuit.Location.country }}
      </p>
    </div>
    <div class="race-date">
      <time :datetime="race.date">{{
        formatEventDate(race.date, race.time, true)
      }}</time
      ><RouterLink
        :to="{ path: '/race-center', query: { round: race.round } }"
        class="button secondary"
        >{{ race.status === "completed" ? "Ver resultado" : "Explorar evento" }}
        <span aria-hidden="true">↗</span></RouterLink
      >
    </div>
  </article>
</template>
