<script setup>
import Portrait from "../common/Portrait.vue";
import { safeLink } from "../../adapters/portal.js";
defineProps({ champion: Object });
</script>
<template>
  <article class="champion-card">
    <div class="champion-image">
      <Portrait :src="champion.photo" :name="champion.name" /><span
        class="champion-titles"
        ><strong>{{ champion.titleYears.length }}</strong
        ><small>{{
          champion.titleYears.length === 1
            ? "TÍTULO MUNDIAL"
            : "TÍTULOS MUNDIAIS"
        }}</small></span
      >
    </div>
    <div class="champion-body">
      <p class="eyebrow">
        {{ champion.nationality }} <span aria-hidden="true">/</span>
        {{ champion.titleYears[0] }}—{{ champion.titleYears.at(-1) }}
      </p>
      <h2>{{ champion.name }}</h2>
      <p class="champion-years">{{ champion.titleYears.join(" · ") }}</p>
      <details>
        <summary>
          Carreira e créditos<span class="sr-only">
            de {{ champion.name }}</span
          >
        </summary>
        <p>
          {{ champion.wins }} vitórias de GP até {{ champion.throughSeason }}.
        </p>
        <p>Equipes campeãs: {{ champion.teams.join(" / ") }}.</p>
        <a
          :href="safeLink(champion.source)"
          target="_blank"
          rel="noopener noreferrer"
          >Fonte da carreira ↗</a
        >
        <p class="photo-credit">{{ champion.photoCredit.attribution }}</p>
        <a
          :href="safeLink(champion.photoCredit.sourceUrl)"
          target="_blank"
          rel="noopener noreferrer"
          >Fotografia no Wikimedia Commons ↗</a
        ><br /><a
          :href="safeLink(champion.photoCredit.licenseUrl)"
          target="_blank"
          rel="noopener noreferrer"
          >{{ champion.photoCredit.license }}</a
        >
      </details>
    </div>
  </article>
</template>
