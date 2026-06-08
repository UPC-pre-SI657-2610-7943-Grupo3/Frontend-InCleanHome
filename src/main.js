import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router.js";
import i18n from "./i18n.js";
import { auth0Plugin, isAuth0Enabled } from "./Shared/auth0.js";
import "./style.css";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(i18n);

// Solo se registra el plugin si Auth0 está habilitado por env. Si no, todo el
// código que importa `useAuth0()` queda sin efecto y el botón se esconde.
if (isAuth0Enabled && auth0Plugin) {
  app.use(auth0Plugin);
}

app.mount("#app");
