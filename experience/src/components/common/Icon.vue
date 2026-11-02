<script setup>
defineProps({ name: String });
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  helmet: "M3 15a9 9 0 0 1 18 0v4H7l-4-4zm1-3h12v4H5",
  car: "m3 16 2-6h14l2 6v4h-3v-2H6v2H3v-4zm3-6 2-5h8l2 5M4 14h16",
  trophy:
    "M7 3h10v7a5 5 0 0 1-10 0V3zm0 2H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4M12 15v6m-5 0h10",
  calendar: "M3 5h18v16H3z M7 2v6m10-6v6M3 11h18m-14 4h3m4 0h3",
  flag: "M4 22V3h15l-3 5 3 5H4m5-10v10m5-10v10M4 8h14",
  compare: "M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "m5 5 14 14M19 5 5 19",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  clock: "M12 7v5l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
};
</script>
<template>
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.grid" />
  </svg>
</template>
