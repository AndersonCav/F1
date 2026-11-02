<script setup>
defineProps({ status: String });
const labels = {
  completed: "Resultado confirmado",
  upcoming: "Próxima corrida",
  scheduled: "Programada",
  result_pending: "Aguardando resultado",
  status_unknown: "Status não confirmado",
};
</script>
<template>
  <span class="status-badge" :class="status"
    ><i aria-hidden="true" />{{ labels[status] || labels.status_unknown }}</span
  >
</template>
