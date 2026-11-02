<script setup>
defineProps({ title: String, caption: String, to: String });
</script>
<template>
  <div class="section-heading">
    <div>
      <p v-if="caption" class="eyebrow">{{ caption }}</p>
      <h2>{{ title }}</h2>
    </div>
    <RouterLink v-if="to" :to="to" class="text-link"
      >Ver todos <span aria-hidden="true">↗</span
      ><span class="sr-only">: {{ title }}</span></RouterLink
    ><slot />
  </div>
</template>
