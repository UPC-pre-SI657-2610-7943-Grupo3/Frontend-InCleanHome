<template>
  <!-- Pantalla mostrada SOLO la primera vez que un usuario entra por Auth0
       (cuando el backend devuelve needsRoleSelection=true). Es la única vez
       que pedimos los datos del perfil — luego se editan desde /profile. -->
  <div class="auth-wrapper auth-bg">
    <div class="auth-container">
      <!-- Logo -->
      <div class="auth-header">
        <div class="logo-wrapper">
          <div class="logo-small">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span class="brand">InClean<span class="brand-accent">Home</span></span>
        </div>
      </div>

      <Transition name="fade" mode="out-in">
        <!-- ── Paso 1: elegir rol ─────────────────────────────────────────── -->
        <div v-if="step === 1" key="step1" class="card card-elevated">
          <h2 class="card-title small">{{ t('auth.welcomeTitle') }}</h2>
          <p class="card-subtitle">
            <span v-if="userEmail">{{ t('auth.welcomeGreeting', { email: userEmail }) }}<br /></span>
            {{ t('auth.welcomeSubtitle') }}
          </p>

          <div class="role-grid">
            <button @click="selectRole('client')"
                    :class="['role-card', selectedRole === 'client' ? 'role-selected' : '']">
              <div class="role-emoji">🏠</div>
              <div class="role-title">{{ t('auth.client') }}</div>
              <div class="role-desc">{{ t('auth.clientDesc') }}</div>
            </button>
            <button @click="selectRole('worker')"
                    :class="['role-card', selectedRole === 'worker' ? 'role-selected-w' : '']">
              <div class="role-emoji">✨</div>
              <div class="role-title">{{ t('auth.worker') }}</div>
              <div class="role-desc">{{ t('auth.workerDesc') }}</div>
            </button>
          </div>

          <button @click="step = 2"
                  class="btn btn-primary btn-full btn-lg btn-continue"
                  :disabled="!selectedRole">
            {{ t('auth.continue') }} →
          </button>
        </div>

        <!-- ── Paso 2: completar datos ────────────────────────────────────── -->
        <div v-else key="step2" class="card card-elevated">
          <button @click="step = 1" class="back-btn">← {{ t('common.back') }}</button>
          <h2 class="card-title">
            {{ selectedRole === 'client' ? t('auth.client') : t('auth.worker') }} —
            {{ t('auth.completeProfile') }}
          </h2>
          <p class="card-subtitle email-pill">
            <span class="email-icon">✉️</span>
            {{ userEmail }}
            <span class="email-tag">{{ t('auth.fromAuth0') }}</span>
          </p>

          <form @submit.prevent="handleContinue" class="auth-form">
            <!-- Campos comunes -->
            <div class="form-grid">
              <div class="form-group">
                <label class="label">{{ t('auth.name') }} *</label>
                <input v-model="form.name" type="text" class="input-field" required />
              </div>
              <div class="form-group">
                <label class="label">{{ t('auth.phone') }} *</label>
                <input v-model="form.phone" type="tel" class="input-field" placeholder="+51 999 999 999" required />
              </div>
            </div>

            <!-- Campos sólo de Worker -->
            <template v-if="selectedRole === 'worker'">
              <div class="form-grid">
                <div class="form-group">
                  <label class="label">{{ t('worker.age') }} *</label>
                  <input v-model.number="form.age" type="number" class="input-field" required min="18" max="70" />
                </div>
                <div class="form-group">
                  <label class="label">{{ t('worker.gender') }} *</label>
                  <select v-model="form.gender" class="input-field" required>
                    <option value="female">{{ t('worker.female') }}</option>
                    <option value="male">{{ t('worker.male') }}</option>
                    <option value="other">{{ t('worker.other') }}</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="label">{{ t('worker.serviceTypes') }} *</label>
                <div class="checkbox-group mt-1">
                  <label v-for="svc in serviceOptions" :key="svc.value" class="checkbox-label">
                    <input type="checkbox" :value="svc.value" v-model="form.serviceTypes" class="rounded" />
                    <span class="svc-label">{{ svc.label }}</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="label">{{ t('worker.zonesLabel') }}</label>
                <div class="checkbox-group mt-1 zones-scroll">
                  <label v-for="z in zoneOptions" :key="z.value" class="checkbox-label">
                    <input type="checkbox" :value="z.value" v-model="form.zones" class="rounded" />
                    <span class="svc-label">{{ z.label }}</span>
                  </label>
                </div>
              </div>

              <div class="form-grid">
                <div class="form-group">
                  <label class="label">{{ t('worker.hourlyRate') }} *</label>
                  <input v-model.number="form.hourlyRate" type="number" class="input-field" required min="10" step="5" />
                </div>
                <div class="form-group">
                  <label class="label">{{ t('worker.experienceYears') }}</label>
                  <input v-model.number="form.experienceYears" type="number" class="input-field" min="0" max="50" />
                </div>
              </div>

              <div class="form-group">
                <label class="label">{{ t('worker.bio') }}</label>
                <textarea v-model="form.bio" class="input-field no-resize" rows="2"></textarea>
              </div>
            </template>

            <div v-if="error" class="error-box">{{ error }}</div>

            <button type="submit"
                    class="btn btn-primary btn-full btn-lg submit-btn"
                    :disabled="loading">
              <div v-if="loading" class="spinner spinner-sm"></div>
              {{ loading ? t('common.loading') : t('auth.continue') + ' →' }}
            </button>

            <p v-if="selectedRole === 'worker'" class="worker-info">
              ℹ️ {{ t('auth.workerDocsHint') }}
            </p>
          </form>
        </div>
      </Transition>

      <div class="lang-toggle-container mt-4">
        <button @click="toggleLang" class="lang-btn">
          {{ locale === 'es' ? '🇺🇸 English' : '🇵🇪 Español' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
// WelcomeView — primera pantalla después del Auth0 callback para usuarios nuevos.
//
// Es un wizard de 2 pasos:
//   1) Elegir rol (cliente o trabajadora).
//   2) Completar datos del perfil (nombre, teléfono, y para worker: edad,
//      género, servicios, zonas, tarifa, experiencia, bio).
//
// Al enviar, llamamos a /api/auth/auth0/complete-registration con un access_token
// fresco y todos los datos. El backend crea User + perfil completo y devuelve JWT.
//
// Después:
//   - Cliente   → /client/search
//   - Trabajadora → /upload-documents (igual que el flujo viejo).

import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuth0 } from "@auth0/auth0-vue";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { isAuth0Enabled } from "../../Shared/auth0.js";
import api from "../../Shared/api.js";

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();

const auth0Enabled = isAuth0Enabled;
let auth0;
if (auth0Enabled) {
  auth0 = useAuth0();
}

const step = ref(1);
const selectedRole = ref("");
const loading = ref(false);
const error = ref("");
const userEmail = ref("");

// Formulario: mismos campos que el RegisterView viejo, pero sin email/password
// (Auth0 los maneja). Defaults razonables para que el submit pase la validación.
const form = ref({
  name: "",
  phone: "",
  age: 25,
  gender: "female",
  serviceTypes: [],
  zones: [],
  hourlyRate: 25,
  experienceYears: 1,
  bio: "",
});

function selectRole(role) { selectedRole.value = role; }
function toggleLang() { locale.value = locale.value === "es" ? "en" : "es"; }

const serviceOptions = computed(() => [
  { value: "limpieza_general",  label: t("worker.services.limpieza_general") },
  { value: "cocina",            label: t("worker.services.cocina") },
  { value: "lavanderia",        label: t("worker.services.lavanderia") },
  { value: "planchado",         label: t("worker.services.planchado") },
  { value: "cuidado_ninos",     label: t("worker.services.cuidado_ninos") },
  { value: "cuidado_adultos",   label: t("worker.services.cuidado_adultos") },
  { value: "jardineria",        label: t("worker.services.jardineria") },
  { value: "limpieza_profunda", label: t("worker.services.limpieza_profunda") },
]);

const zoneOptions = computed(() => [
  "miraflores", "san_isidro", "surco", "la_molina", "barranco", "san_borja",
  "lince", "jesus_maria", "pueblo_libre", "magdalena", "san_miguel", "callao",
  "los_olivos", "san_martin", "ate", "comas"
].map(v => ({ value: v, label: t(`worker.zones.${v}`) })));

onMounted(async () => {
  if (!auth0Enabled) { router.replace("/login"); return; }
  try {
    if (!auth0.isAuthenticated.value) { router.replace("/login"); return; }
    const u = auth0.user.value;
    userEmail.value = u?.email || "";
    // Pre-rellenar nombre con el de Auth0 si lo tenemos (el usuario puede editarlo).
    if (u?.name && form.value.name === "") form.value.name = u.name;
  } catch {
    router.replace("/login");
  }
});

async function handleContinue() {
  if (!selectedRole.value) return;

  // Validaciones de cliente.
  if (!form.value.name.trim()) {
    error.value = t("auth.nameRequired") || "El nombre es obligatorio";
    return;
  }
  if (!form.value.phone.trim()) {
    error.value = t("auth.phoneRequired") || "El teléfono es obligatorio";
    return;
  }
  // Validaciones extra para worker.
  if (selectedRole.value === "worker" && form.value.serviceTypes.length === 0) {
    error.value = t("auth.serviceRequired") || "Selecciona al menos un tipo de servicio";
    return;
  }

  loading.value = true;
  error.value = "";
  try {
    const accessToken = await auth0.getAccessTokenSilently({
      authorizationParams: { audience: import.meta.env.VITE_AUTH0_AUDIENCE },
    });

    // Payload: mandamos todos los campos. El backend ignora los irrelevantes
    // según el rol elegido.
    const payload = {
      accessToken,
      role: selectedRole.value,
      name: form.value.name.trim(),
      phone: form.value.phone.trim(),
    };
    if (selectedRole.value === "worker") {
      Object.assign(payload, {
        age: form.value.age,
        gender: form.value.gender,
        serviceTypes: form.value.serviceTypes,
        zones: form.value.zones,
        hourlyRate: form.value.hourlyRate,
        experienceYears: form.value.experienceYears,
        bio: form.value.bio,
      });
    }

    const { data } = await api.post("/auth/auth0/complete-registration", payload);
    auth.setAuth(data.user, data.token);

    // Redirigir según rol. Worker va a subir documentos primero.
    if (data.user.role === "worker") router.replace("/upload-documents");
    else router.replace("/client/search");
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || t("common.error");
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.auth-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
.auth-bg { background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); }

.auth-container { width: 100%; max-width: 512px; }

.auth-header { text-align: center; margin-bottom: 1.5rem; }
.logo-wrapper { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.logo-small { width: 40px; height: 40px; background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.brand { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
.brand-accent { color: #2563eb; }

.card-elevated { box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08); padding: 2rem; }
.card-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin-bottom: 1.5rem; }
.card-title.small { margin-bottom: 0.5rem; }
.card-subtitle { color: #64748b; font-size: 0.875rem; margin-bottom: 1.5rem; line-height: 1.5; }

.email-pill { display: inline-flex; align-items: center; gap: 0.375rem; background: #f1f5f9; padding: 0.375rem 0.75rem; border-radius: 999px; font-size: 0.8125rem; }
.email-icon { font-size: 0.875rem; }
.email-tag { background: #2563eb; color: white; padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600; margin-left: 0.25rem; }

.role-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.role-card { padding: 1.5rem; border-radius: 1rem; border: 2px solid #e2e8f0; cursor: pointer; text-align: left; transition: all 0.15s; background: white; }
.role-card:hover { border-color: #cbd5e1; }
.role-emoji { font-size: 2rem; margin-bottom: 0.75rem; }
.role-title { font-weight: 700; color: #1e293b; margin-bottom: 0.375rem; }
.role-desc { font-size: 0.8125rem; color: #64748b; }
.role-selected { border-color: #2563eb; background: #eff6ff; }
.role-selected-w { border-color: #8b5cf6; background: #ede9fe; }

.btn-continue { margin-top: 1.5rem; }

.auth-form { display: flex; flex-direction: column; gap: 1rem; }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
.form-group { display: flex; flex-direction: column; gap: 0.25rem; }

.checkbox-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.375rem; cursor: pointer; }

.back-btn { background: none; border: none; cursor: pointer; color: #64748b; font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding: 0; }
.back-btn:hover { color: #1e293b; }

.svc-label { font-size: 0.8125rem; color: #374151; }
.zones-scroll { max-height: 120px; overflow-y: auto; padding-right: 0.5rem; }
.no-resize { resize: none; }

.error-box { background: #fee2e2; color: #991b1b; padding: 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; }

.submit-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

.worker-info { margin-top: 0.75rem; padding: 0.75rem; background: #f0f9ff; border-left: 3px solid #2563eb; border-radius: 0.5rem; font-size: 0.8125rem; color: #475569; line-height: 1.5; }

.spinner { border: 3px solid rgba(0, 0, 0, 0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-sm { width: 18px; height: 18px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.lang-toggle-container { text-align: center; }
.lang-btn { font-size: 0.8125rem; color: #64748b; background: none; border: none; cursor: pointer; }
.lang-btn:hover { color: #1e293b; }
.mt-4 { margin-top: 1rem; }
.mt-1 { margin-top: 0.25rem; }

@media (max-width: 640px) {
  .role-grid { grid-template-columns: 1fr; }
  .form-grid { grid-template-columns: 1fr; }
}
</style>
