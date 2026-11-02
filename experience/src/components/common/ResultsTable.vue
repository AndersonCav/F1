<script setup>
defineProps({ rows: Array, season: Number, name: String });
</script>
<template>
  <div
    class="table-scroll"
    tabindex="0"
    role="region"
    aria-label="Resultados da corrida, role horizontalmente se necessário"
  >
    <table class="results-table">
      <caption>
        {{
          name
        }}
        ·
        {{
          season
        }}
        · classificação final publicada
      </caption>
      <thead>
        <tr>
          <th scope="col">POS</th>
          <th scope="col">PILOTO</th>
          <th scope="col">EQUIPE</th>
          <th scope="col">VOLTAS</th>
          <th scope="col">TEMPO / STATUS</th>
          <th scope="col">PTS</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td class="rank">{{ r.position }}</td>
          <th scope="row">{{ r.name }}</th>
          <td>{{ r.team }}</td>
          <td>{{ r.laps ?? "—" }}</td>
          <td class="timing">{{ r.time }}</td>
          <td class="points">{{ r.points ?? "—" }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
