<script setup>
import { ref, watch, nextTick } from "vue";
const props = defineProps({
  resource: Object,
  label: { type: String, default: "dados" },
});
const emit = defineEmits(["retry"]);
const retryButton = ref(null);
let retryRequested = false;
function retry() {
  retryRequested = true;
  emit("retry");
}
watch(
  () => props.resource?.status,
  async (status) => {
    if (retryRequested && !["idle", "loading"].includes(status)) {
      retryRequested = false;
      await nextTick();
      if (status === "error") retryButton.value?.focus({ preventScroll: true });
      else document.querySelector("#main h1")?.focus({ preventScroll: true });
    }
  },
);
</script>
<template>
  <div
    v-if="!resource || ['idle', 'loading'].includes(resource.status)"
    class="data-state skeleton"
    role="status"
  >
    <span class="state-symbol">···</span>
    <p>Carregando {{ label }}…</p>
  </div>
  <div
    v-else-if="resource.status === 'error'"
    class="data-state error-state"
    role="status"
  >
    <span class="eyebrow">FONTE INDISPONÍVEL</span>
    <p>{{ resource.error || "Não foi possível carregar os dados." }}</p>
    <button ref="retryButton" class="button secondary" @click="retry">
      Tentar novamente
    </button>
  </div>
  <div v-else-if="resource.status === 'empty'" class="data-state" role="status">
    <span class="state-symbol">—</span>
    <p>Nenhum registro de {{ label }} publicado para esta seleção.</p>
  </div>
  <slot v-else />
</template>
