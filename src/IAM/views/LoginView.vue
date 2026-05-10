<template>
  <div class="auth-wrapper auth-bg">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-header">
        <div class="logo-wrapper">
          <div class="logo-box">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <h1 class="brand">InClean<span class="brand-accent">Home</span></h1>
        </div>
        <p class="login-subtitle">{{ t('auth.loginSubtitle') }}</p>
      </div>

      <div class="card card-elevated">
        <h2 class="card-title">{{ t('auth.loginTitle') }}</h2>

        <form @submit.prevent="handleLogin" class="auth-form">
          <div class="form-group">
            <label class="label">{{ t('auth.email') }}</label>
            <input v-model="form.email" type="email" class="input-field" required :placeholder="t('auth.email')" />
          </div>
          <div class="form-group">
            <label class="label">{{ t('auth.password') }}</label>
            <input v-model="form.password" type="password" class="input-field" required :placeholder="t('auth.password')" />
          </div>

          <div v-if="error" class="error-box">{{ error }}</div>

          <button type="submit" class="btn btn-primary btn-full btn-lg submit-btn" :disabled="loading">
            <div v-if="loading" class="spinner spinner-sm"></div>
            {{ loading ? t('common.loading') : t('auth.login') }}
          </button>
        </form>

        <div class="card-footer">
          {{ t('auth.noAccount') }}
          <router-link to="/register" class="link-primary"> {{ t('auth.register') }}</router-link>
        </div>
      </div>

      <!-- Language toggle -->
      <div class="lang-toggle-container">
         <button @click="toggleLang" class="lang-btn">{{ locale === 'es' ? '🇺🇸 English' : '🇵🇪 Español' }}</button>
       </div>
    </div>
  </div>
</template>

<script setup>
// Importación de utilidades de Vue y librerías externas
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
// Importación del store de autenticación (Pinia) y configuración de Axios (api)
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";

const { t, locale } = useI18n();

  // Inicialización de composables
import { useAuthStore } from "../../Shared/stores/auth.js";
const router = useRouter();
const auth = useAuthStore();

  // Variables reactivas para el estado del formulario
const form = ref({ email: "", password: "" });
const loading = ref(false);
const error = ref("");

function toggleLang() { locale.value = locale.value === "es" ? "en" : "es"; }

async function handleLogin() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.post("/auth/login", form.value);
    auth.setAuth(data.user, data.token);
    router.push(data.user.role === "worker" ? "/worker/dashboard" : "/client/search");
  } catch (e) {
    const msg = e.response?.data?.error || t('common.error');
    if (msg.includes("Documents not verified") || msg.includes("documentos")) {
      router.push("/upload-documents");
    } else {
      error.value = msg;
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.auth-bg { background: linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%); }

.auth-container { width: 100%; max-width: 400px; }

.auth-header { text-align: center; margin-bottom: 2rem; }
.logo-wrapper { display: inline-flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }

.logo-box { width:48px; height:48px; background: linear-gradient(135deg,#2563eb,#06b6d4); border-radius:14px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(37,99,235,0.3); }
.brand { font-size:1.75rem; font-weight:800; color:#1e293b; display:inline-block; margin: 0; }
.brand-accent { color:#2563eb; }
.login-subtitle { color:#64748b; font-size:0.9375rem; margin: 0; }

.card-elevated { box-shadow:0 20px 40px rgba(0,0,0,0.08); padding: 2rem; }
.card-title { font-size:1.25rem; font-weight:700; color:#1e293b; margin-bottom:1.5rem; }

.auth-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.5rem; }

.error-box { background:#fee2e2; color:#991b1b; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; }
.submit-btn { margin-top:0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-sm { width:18px; height:18px; border-width:2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.card-footer { text-align:center; margin-top:1.5rem; font-size:0.875rem; color:#64748b; }
.link-primary { color:#2563eb; font-weight:500; text-decoration: none; }
.link-primary:hover { text-decoration: underline; }

.lang-toggle-container { text-align: center; margin-top: 1rem; }
.lang-btn { font-size:0.8125rem; color:#64748b; background:none; border:none; cursor:pointer; }
.lang-btn:hover { color: #1e293b; }

@media (max-width: 640px) {
  .card-elevated { padding: 1.5rem; }
}
</style>
