<template>
  <router-view />
  <Transition name="fade">
    <div v-if="toast.visible" :class="['toast', `toast-${toast.type}`]">
      {{ toast.message }}
    </div>
  </Transition>
</template>

<script setup>
import { onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useToastStore } from "./Shared/stores/toast.js";
import { useAuthStore } from "./Shared/stores/auth.js";
import { useNotificationsStore } from "./Shared/stores/notifications.js";
import { setupPushNotifications } from "./Shared/services/pushNotifications.js";

const toast = useToastStore();
const auth = useAuthStore();
const notifStore = useNotificationsStore();
const route = useRoute();

// Estado para evitar llamar a setupPushNotifications dos veces (HMR, refresh, etc.).
let pushInitialized = false;

async function tryInitPush() {
  if (pushInitialized) return;
  if (!auth.isLoggedIn) return;
  pushInitialized = true;
  // Se pide permiso, se obtiene token FCM y se envía a POST /auth/device-token.
  // Si algo falla, el flujo de la app no se interrumpe (la función captura todo).
  await setupPushNotifications();
}

/**
 * Refreshes the notifications store using the current user's role.
 */
function refreshNotifications() {
  if (!auth.isLoggedIn) return;
  const role = auth.user?.role || "client";
  notifStore.fetch(role);
}

/**
 * Refreshes the auth user from the backend so things like suspension status,
 * rating, verified flag and unread counts stay in sync across tabs/profiles.
 * Fire-and-forget — if the JWT expired, refreshUser handles redirect internally.
 */
function refreshAuthUser() {
  if (!auth.isLoggedIn) return;
  auth.refreshUser?.().catch(() => { /* no-op */ });
}

onMounted(() => {
  // Caso 1: el usuario abre la app ya estando logueado (sesión persistida en localStorage).
  tryInitPush();

  // Refresh when the tab becomes visible again (covers the case where a push
  // arrived while the tab was inactive and the SW message was missed, AND the
  // case where another browser profile changed something — e.g. admin suspended
  // this worker, or another client raised the worker's rating).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshNotifications();
      refreshAuthUser();
    }
  });
});

// Caso 2: el usuario inicia sesión durante esta visita (email/password o Auth0).
// En ambos flujos, `setAuth(user, token)` actualiza el store y `isLoggedIn` pasa a true.
watch(
  () => auth.isLoggedIn,
  (logged) => {
    if (logged) {
      tryInitPush();
    } else {
      // Al desloguearse, permitir que un próximo login re-dispare el setup.
      pushInitialized = false;
    }
  },
);

// Caso 3: el usuario navega a otra sección del navbar (sin recargar).
// El layout (ClientLayout/WorkerLayout) NO se desmonta, por lo que su onMounted
// no se vuelve a ejecutar. Aquí refrescamos manualmente cuando cambia la ruta
// para que datos como rating, suspensión o documentos aparezcan al día. Lo
// hacemos fire-and-forget — si falla, la app sigue funcionando con datos viejos.
watch(
  () => route.fullPath,
  (newPath, oldPath) => {
    // Ignoramos la primera asignación (onMounted ya disparó el refresh inicial).
    if (oldPath === undefined) return;
    refreshAuthUser();
    refreshNotifications();
  },
);
</script>

<style>
/* Toast */
.toast { position: fixed; right: 1rem; bottom: 1rem; background: rgba(17,24,39,0.95); color: white; padding: 0.75rem 1rem; border-radius: 0.5rem; box-shadow: 0 6px 20px rgba(2,6,23,0.2); z-index: 60; max-width: 90vw; }
.toast-success { background:#10b981; }
.toast-error { background:#ef4444; }
/* Transition */
.fade-enter-active, .fade-leave-active { transition: opacity .2s ease, transform .2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(6px); }

@media (max-width: 640px) {
  .toast { right: 0.5rem; left: 0.5rem; bottom: 0.75rem; }
}
</style>
