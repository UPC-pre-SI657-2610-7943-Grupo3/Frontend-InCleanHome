<template>
  <!-- Pantalla mostrada inmediatamente después de que Auth0 redirige de vuelta. -->
  <div class="auth-wrapper auth-bg">
    <div class="callback-card card card-elevated">
      <div v-if="state === 'loading'" class="callback-state">
        <div class="spinner spinner-lg"></div>
        <h2 class="callback-title">{{ t('auth.connecting') }}</h2>
        <p class="callback-text">{{ t('auth.connectingSubtitle') }}</p>
      </div>

      <div v-else-if="state === 'error'" class="callback-state">
        <div class="callback-icon-error">⚠️</div>
        <h2 class="callback-title">{{ t('auth.connectError') }}</h2>
        <p class="callback-text">{{ errorMessage }}</p>
        <button class="btn btn-primary btn-lg" @click="goBack">{{ t('auth.backToLogin') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Vista que procesa /auth0/callback?code=...&state=... después del login Auth0.
//
// Flujo:
//   1) El plugin @auth0/auth0-vue intercepta la URL y completa el intercambio
//      code → tokens automáticamente. Cuando termina, isAuthenticated = true.
//   2) Pedimos un access_token con audience (para que sea JWT firmado RS256).
//   3) Lo mandamos al backend en POST /api/auth/auth0/login.
//   4) Si el backend devuelve needsRoleSelection → vamos a /welcome.
//   5) Si devuelve el JWT + user → setAuth y redirigimos según rol:
//        - admin   → /admin/users
//        - worker  → /worker/dashboard
//        - client  → /client/search

import { ref, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuth0 } from "@auth0/auth0-vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";

const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();
const { isLoading, isAuthenticated, getAccessTokenSilently, error, logout } = useAuth0();

const state = ref("loading");        // "loading" | "error"
const errorMessage = ref("");
let exchangeStarted = false;          // evita doble llamada en HMR/StrictMode-like

async function exchangeAndLogin() {
  if (exchangeStarted) return;
  exchangeStarted = true;
  try {
    // Audience asegura JWT firmado RS256 (no opaco).
    const accessToken = await getAccessTokenSilently({
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });

    const { data } = await api.post("/auth/auth0/login", { accessToken });

    // Usuario nuevo → ir a /welcome para elegir rol.
    if (data.needsRoleSelection) {
      router.replace("/welcome");
      return;
    }

    // Usuario existente: guardar JWT propio y redirigir según rol.
    auth.setAuth(data.user, data.token);
    if (data.user.role === "admin") {
      router.replace("/admin/users");
      return;
    }
    if (data.user.role === "worker") {
      router.replace("/worker/dashboard");
      return;
    }
    router.replace("/client/search");
  } catch (e) {
    const msg = e?.response?.data?.error || e?.message || "Error inesperado";
    errorMessage.value = msg;
    state.value = "error";
    // Cerramos la sesión de Auth0 para que un retry empiece limpio.
    try { await logout({ logoutParams: { returnTo: window.location.origin + "/login" } }); } catch {}
  }
}

watch([isLoading, isAuthenticated, error], () => {
  if (error.value) {
    errorMessage.value = error.value.message || String(error.value);
    state.value = "error";
    return;
  }
  if (!isLoading.value && isAuthenticated.value) {
    exchangeAndLogin();
  } else if (!isLoading.value && !isAuthenticated.value) {
    errorMessage.value = "No se completó la autenticación con Auth0.";
    state.value = "error";
  }
}, { immediate: true });

onMounted(() => {
  // Timeout de seguridad: si seguimos en "loading" después de 15s, mostrar error.
  setTimeout(() => {
    if (state.value === "loading") {
      errorMessage.value = "El proveedor de identidad tardó demasiado en responder.";
      state.value = "error";
    }
  }, 15000);
});

function goBack() { router.replace("/login"); }
</script>

<style scoped>
.auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.auth-bg { background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); }
.callback-card { width: 100%; max-width: 420px; padding: 2.5rem 2rem; text-align: center; }
.callback-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.callback-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
.callback-text { color: #64748b; font-size: 0.9375rem; margin: 0 0 0.5rem 0; }
.callback-icon-error { font-size: 3rem; line-height: 1; }
.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 48px; height: 48px; animation: spin 1s linear infinite; }
.spinner-lg { width: 56px; height: 56px; border-width: 4px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
