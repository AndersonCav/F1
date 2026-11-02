<script setup>
import { ref } from "vue";
import { unavailable, safeLink } from "../../adapters/portal.js";
defineProps({ team: Object });
const broken = ref(false);
</script>
<template>
  <article class="constructor-card panel" :style="{ '--team': team.color }">
    <div class="constructor-top">
      <span class="rank">{{
        String(team.position || "—").padStart(2, "0")
      }}</span>
      <div>
        <p class="eyebrow">{{ team.season }} · CONSTRUTORES</p>
        <h2>{{ team.shortName }}</h2>
      </div>
      <span class="constructor-points"
        >{{ unavailable(team.points) }}<small>PTS</small></span
      >
    </div>
    <div class="car-stage">
      <img
        v-if="team.carImage && !broken"
        :src="team.carImage"
        :alt="`Carro de ${team.shortName} · ${team.season}`"
        width="960"
        height="240"
        loading="lazy"
        decoding="async"
        @error="broken = true"
      /><span v-else class="muted">Imagem do carro não disponível</span>
    </div>
    <p class="constructor-name muted">{{ team.name }}</p>
    <div class="participant-list">
      <RouterLink
        v-for="d in team.participants"
        :key="d.id"
        :to="{ path: '/drivers', query: { q: d.name } }"
        >{{ d.name }} <span aria-hidden="true">↗</span></RouterLink
      >
      <p v-if="!team.participants.length" class="muted">
        Participantes não disponíveis.
      </p>
    </div>
    <p class="small muted">
      Participantes na temporada; não confirma a escalação atual.
    </p>
    <details>
      <summary>
        Dados da equipe<span class="sr-only"> {{ team.shortName }}</span>
      </summary>
      <dl class="detail-grid">
        <div>
          <dt>Vitórias · {{ team.season }}</dt>
          <dd>{{ unavailable(team.wins) }}</dd>
        </div>
        <div>
          <dt>Títulos · até {{ team.snapshotSeason || "—" }}</dt>
          <dd>{{ unavailable(team.championships) }}</dd>
        </div>
        <div>
          <dt>Base · {{ team.referenceDate || "sem referência" }}</dt>
          <dd>{{ team.base || "Não disponível" }}</dd>
        </div>
        <div>
          <dt>Chassi · {{ team.season }}</dt>
          <dd>{{ team.chassis || "Não disponível" }}</dd>
        </div>
        <div>
          <dt>Chefe · {{ team.referenceDate || "—" }}</dt>
          <dd>{{ team.principal || "Não disponível" }}</dd>
        </div>
      </dl>
      <a
        v-if="safeLink(team.source)"
        :href="safeLink(team.source)"
        target="_blank"
        rel="noopener noreferrer"
        >Perfil, metadados e foto: Formula1.com ↗</a
      >
    </details>
  </article>
</template>
