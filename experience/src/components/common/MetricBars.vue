<script setup>
import { unavailable } from "../../adapters/portal.js";
defineProps({
  label: String,
  names: Array,
  values: Array,
  colors: Array,
  unit: String,
});
const width = (value, values) =>
  value === null
    ? "0%"
    : `${(Math.max(0, value) / Math.max(1, ...values.filter((v) => v !== null))) * 100}%`;
</script>
<template>
  <figure class="metric-chart">
    <figcaption>{{ label }}</figcaption>
    <div v-for="(value, i) in values" :key="i" class="bar-row">
      <span>{{ names[i] }}</span
      ><span class="bar-track" aria-hidden="true"
        ><span
          :style="{
            width: width(value, values),
            backgroundColor: colors?.[i] || '#e10600',
          }" /></span
      ><strong
        >{{ unavailable(value)
        }}<small> {{ value !== null ? unit : "" }}</small></strong
      >
    </div>
  </figure>
</template>
