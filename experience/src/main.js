import { createApp } from "vue";
import "./styles/bootstrap.scss";
import "./styles/tokens.css";
import "./styles/app.css";
import App from "./App.vue";
import { router } from "./router/index.js";

createApp(App).use(router).mount("#app");
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}experience-sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .catch(() => {
        // Existing transport cache still works when worker registration is unavailable.
      });
  });
}
