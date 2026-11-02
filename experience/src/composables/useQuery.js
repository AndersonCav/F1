import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
const pendingQueries = new WeakMap();
export function useQuery(key, fallback = "", allowed = null) {
  const route = useRoute();
  const router = useRouter();
  return computed({
    get: () =>
      typeof route.query[key] === "string" &&
      (!allowed || allowed.includes(route.query[key]))
        ? route.query[key]
        : fallback,
    set: (value) => {
      // Two controls may change before the router finishes its first navigation.
      // Merge against the pending query so one control cannot restore another's old value.
      const query = {
        ...(pendingQueries.get(router) || route.query),
        [key]: value === fallback || !value ? undefined : value,
      };
      pendingQueries.set(router, query);
      router.replace({ query }).finally(() => {
        if (pendingQueries.get(router) === query) pendingQueries.delete(router);
      });
    },
  });
}
