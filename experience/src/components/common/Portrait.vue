<script setup>
import { ref, watch, computed } from "vue";
import fallback from "../../assets/placeholder-driver.svg?url";
import { safeImage } from "../../adapters/portal.js";
const props = defineProps({
  src: String,
  name: String,
  eager: Boolean,
  compact: Boolean,
});
const displaySource = computed(() => {
  const source = safeImage(props.src);
  return props.compact && source?.startsWith("https://media.formula1.com/")
    ? source.replace(/\bw_\d+\b/, "w_96")
    : source;
});
const emit = defineEmits(["unavailable"]);
const broken = ref(false);
watch(
  () => props.src,
  () => {
    broken.value = false;
  },
);
</script>
<template>
  <img
    class="portrait"
    :class="{ 'is-fallback': broken || !safeImage(src) }"
    :src="(!broken && displaySource) || fallback"
    :alt="
      broken || !safeImage(src)
        ? `Retrato indisponível de ${name}`
        : `Foto de ${name}`
    "
    width="360"
    height="360"
    :loading="eager ? 'eager' : 'lazy'"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="
      broken = true;
      emit('unavailable');
    "
  />
</template>
