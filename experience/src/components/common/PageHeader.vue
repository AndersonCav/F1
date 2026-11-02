<script setup>
defineProps({
  eyebrow: { type: String, default: "F1 PORTAL / RACE INTELLIGENCE" },
  title: String,
  text: String,
});
</script>
<template>
  <header class="page-heading">
    <div>
      <p class="eyebrow">{{ eyebrow }}</p>
      <h1 tabindex="-1">{{ title }}</h1>
      <p v-if="text" class="muted page-intro">{{ text }}</p>
    </div>
    <div class="heading-action"><slot /></div>
  </header>
</template>
