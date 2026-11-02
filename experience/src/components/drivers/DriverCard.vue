<script setup>
import Portrait from "../common/Portrait.vue";
import { ref, watch } from "vue";
import { unavailable, safeLink } from "../../adapters/portal.js";
const props = defineProps({ driver: Object, selected: Boolean });
const noPhoto = ref(!props.driver.photo);
watch(
  () => props.driver.photo,
  (value) => {
    noPhoto.value = !value;
  },
);
defineEmits(["compare"]);
</script>
<template>
  <article class="driver-card" :style="{ '--team': driver.teamColor }">
    <div class="driver-image">
      <span class="driver-rank">P{{ unavailable(driver.position) }}</span
      ><span class="driver-number" aria-hidden="true">{{
        driver.number || "—"
      }}</span
      ><Portrait
        :src="driver.photo"
        :name="driver.fullName"
        @unavailable="noPhoto = true"
      /><span class="photo-source">{{
        noPhoto
          ? "RETRATO INDISPONÍVEL"
          : `FOTO: FORMULA1.COM · ${driver.season}`
      }}</span>
    </div>
    <div class="driver-body">
      <p class="eyebrow team-label">{{ driver.shortTeam }}</p>
      <h2>{{ driver.fullName }}</h2>
      <p class="muted small">
        {{ driver.nationality || "Nacionalidade não informada" }}
        <span aria-hidden="true">/</span> #{{ driver.number || "—" }}
      </p>
      <div class="card-stats">
        <div>
          <strong>{{ unavailable(driver.points) }}</strong
          ><span>PONTOS</span>
        </div>
        <div>
          <strong>{{ unavailable(driver.wins) }}</strong
          ><span>VITÓRIAS · {{ driver.season }}</span>
        </div>
      </div>
      <details>
        <summary>
          Perfil e referência<span class="sr-only">
            de {{ driver.fullName }}</span
          >
        </summary>
        <p>{{ driver.association }} · {{ driver.season }}.</p>
        <p v-if="driver.dateOfBirth">Nascimento: {{ driver.dateOfBirth }}.</p>
        <p>Pole positions: não disponíveis nesta fonte.</p>
        <a
          v-if="safeLink(driver.website)"
          :href="safeLink(driver.website)"
          target="_blank"
          rel="noopener noreferrer"
          >Perfil e fonte da fotografia ↗</a
        >
      </details>
      <button
        class="button card-compare"
        :aria-pressed="selected"
        @click="$emit('compare', driver.id)"
      >
        {{ selected ? "✓ Selecionado" : "+ Comparar piloto"
        }}<span class="sr-only">: {{ driver.fullName }}</span>
      </button>
    </div>
  </article>
</template>
