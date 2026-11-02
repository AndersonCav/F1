import { createRouter, createWebHashHistory } from "vue-router";
import { shallowRef } from "vue";
export const navigationFailure = shallowRef(false);

export const destinations = [
  {
    path: "/",
    label: "Visão geral",
    icon: "grid",
    component: () => import("../views/DashboardView.vue"),
  },
  {
    path: "/drivers",
    label: "Pilotos",
    icon: "helmet",
    component: () => import("../views/DriversView.vue"),
  },
  {
    path: "/constructors",
    label: "Construtores",
    icon: "car",
    component: () => import("../views/ConstructorsView.vue"),
  },
  {
    path: "/champions",
    label: "Campeões",
    icon: "trophy",
    component: () => import("../views/ChampionsView.vue"),
  },
  {
    path: "/calendar",
    label: "Calendário",
    icon: "calendar",
    component: () => import("../views/CalendarView.vue"),
  },
  {
    path: "/race-center",
    label: "Race Center",
    icon: "flag",
    component: () => import("../views/RaceCenterView.vue"),
  },
  {
    path: "/compare",
    label: "Comparar pilotos",
    icon: "compare",
    component: () => import("../views/CompareView.vue"),
  },
];
export const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    ...destinations.map((d) => ({ ...d, meta: { title: d.label } })),
    {
      path: "/:pathMatch(.*)*",
      component: () => import("../views/NotFoundView.vue"),
      meta: { title: "Página não encontrada" },
    },
  ],
  scrollBehavior(to, from, saved) {
    return to.path === from.path ? undefined : saved || { top: 0 };
  },
});
router.onError(() => {
  navigationFailure.value = true;
});
router.afterEach((to, from, failure) => {
  if (!failure) navigationFailure.value = false;
});
