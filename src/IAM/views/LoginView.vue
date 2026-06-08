<template>
  <!-- Pantalla de entrada única: solo botón "Continuar con Auth0".
       Sin formulario propio, sin enlaces a registro/recuperar contraseña — todo
       lo gestiona Auth0 desde su Universal Login (incluyendo sign up, reset, etc). -->
  <div class="auth-wrapper auth-bg">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-header">
        <div class="logo-wrapper">
          <div class="logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span class="brand">InClean<span class="brand-accent">Home</span></span>
        </div>
        <p class="tagline">{{ t('auth.loginSubtitle') }}</p>
      </div>

      <div class="card card-elevated">
        <h2 class="card-title">{{ t('auth.loginTitle') }}</h2>
        <p class="card-subtitle">{{ t('auth.auth0Subtitle') }}</p>

        <div v-if="error" class="error-box">{{ error }}</div>

        <button
          type="button"
          class="btn btn-auth0 btn-full btn-lg"
          :disabled="loading || !auth0Enabled"
          @click="loginWithAuth0">
          <div v-if="loading" class="spinner spinner-sm"></div>
          <svg v-else class="auth0-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21.98 7.448L19.62 0H4.347L1.99 7.448c-1.352 4.312.03 9.206 3.815 12.015L12.005 24l6.157-4.552c3.755-2.81 5.182-7.688 3.818-12zM12.005 21.54l-5.027-3.712a8.473 8.473 0 01-3.118-9.563l1.928-6.096h12.43l1.926 6.096a8.488 8.488 0 01-3.119 9.563l-5.02 3.712z" fill="#EB5424"/>
          </svg>
          {{ loading ? t('common.loading') : t('auth.continueWithAuth0') }}
        </button>

        <p v-if="!auth0Enabled" class="warning-text">
          ⚠️ {{ t('auth.auth0Disabled') }}
        </p>

        <p class="auth0-info">
          {{ t('auth.auth0Info') }}
        </p>
      </div>

      <div class="lang-toggle-container">
        <button @click="toggleLang" class="lang-btn">{{ locale === 'es' ? '🇺🇸 English' : '🇵🇪 Español' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Login simplificado: solo Auth0. Sin formulario interno.
//
// Esta vista es el punto de entrada de la app. Toda autenticación (login,
// registro, recuperar contraseña) pasa por Auth0 Universal Login. La vista
// /welcome se encarga de pedir el rol cuando es la primera vez del usuario.
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { isAuth0Enabled } from "../../Shared/auth0.js";
import { useAuth0 } from "@auth0/auth0-vue";

const { t, locale } = useI18n();
const loading = ref(false);
const error = ref("");

const auth0Enabled = isAuth0Enabled;
let auth0;
if (auth0Enabled) {
  auth0 = useAuth0();
}

function toggleLang() { locale.value = locale.value === "es" ? "en" : "es"; }

async function loginWithAuth0() {
  if (!auth0Enabled) {
    error.value = "Auth0 no está configurado en este entorno.";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    // Disparamos Universal Login. Auth0 redirige a /auth0/callback al volver
    // y Auth0CallbackView.vue completa el intercambio con el backend.
    // screen_hint=login (sin él, Auth0 muestra "Continue with..." o "Sign up").
    await auth0.loginWithRedirect({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email",
      },
    });
  } catch (e) {
    error.value = e?.message || "No se pudo iniciar sesión con Auth0.";
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.auth-bg { background: linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%); }

.auth-container { width: 100%; max-width: 420px; }

.auth-header { text-align: center; margin-bottom: 1.5rem; }
.logo-wrapper { display: inline-flex; align-items: center; gap: 0.625rem; margin-bottom: 0.625rem; }
.logo { width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 16px rgba(37, 99, 235, 0.2); }
.brand { font-size: 1.75rem; font-weight: 800; color: #1e293b; }
.brand-accent { color: #2563eb; }
.tagline { color: #64748b; font-size: 0.9375rem; margin: 0; }

.card-elevated { box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08); padding: 2rem; }
.card-title { font-size: 1.375rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; }
.card-subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 1.5rem; }

.error-box { background: #fee2e2; color: #991b1b; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; margin-bottom: 1rem; }
.warning-text { color: #b45309; font-size: 0.8125rem; margin-top: 1rem; text-align: center; }

.btn-auth0 {
  background: #ffffff;
  color: #1e293b;
  border: 2px solid #e2e8f0;
  font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 0.625rem;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.05s;
}
.btn-auth0:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
}
.btn-auth0:active:not(:disabled) { transform: translateY(1px); }
.btn-auth0:disabled { opacity: 0.6; cursor: not-allowed; }
.auth0-icon { flex-shrink: 0; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-sm { width: 18px; height: 18px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.auth0-info {
  margin-top: 1.25rem;
  padding: 0.75rem;
  background: #f1f5f9;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  color: #64748b;
  text-align: center;
  line-height: 1.5;
}

.lang-toggle-container { text-align: center; margin-top: 1rem; }
.lang-btn { font-size: 0.8125rem; color: #64748b; background: none; border: none; cursor: pointer; }
.lang-btn:hover { color: #1e293b; }

@media (max-width: 640px) {
  .card-elevated { padding: 1.5rem; }
}
</style>
