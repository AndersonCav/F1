<script setup>
import Portrait from "../common/Portrait.vue";
import { unavailable } from "../../adapters/portal.js";
defineProps({ items: Array, constructors: Boolean, season: Number });
</script>
<template>
  <div class="table-scroll">
    <table class="leaderboard">
      <caption class="sr-only">
        Classificação de
        {{
          constructors ? "construtores" : "pilotos"
        }}
        · temporada
        {{
          season
        }}. Pontos e vitórias na temporada.
      </caption>
      <thead>
        <tr>
          <th scope="col">POS</th>
          <th scope="col">{{ constructors ? "CONSTRUTOR" : "PILOTO" }}</th>
          <th scope="col" class="numeric">VIT</th>
          <th scope="col" class="numeric">PTS</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          :style="{ '--team': item.teamColor || item.color }"
        >
          <td class="rank">
            {{ unavailable(item.position)?.padStart(2, "0") }}
          </td>
          <th scope="row">
            <RouterLink
              :to="{
                path: constructors ? '/constructors' : '/drivers',
                query: { q: constructors ? item.shortName : item.fullName },
              }"
              class="competitor"
              ><span class="team-line" aria-hidden="true" /><Portrait
                v-if="!constructors"
                compact
                :src="item.photo"
                :name="item.fullName"
              /><span
                ><strong>{{
                  constructors ? item.shortName : item.fullName
                }}</strong
                ><small v-if="!constructors">{{ item.shortTeam }}</small></span
              ></RouterLink
            >
          </th>
          <td class="numeric muted">{{ unavailable(item.wins) }}</td>
          <td class="numeric points">{{ unavailable(item.points) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
