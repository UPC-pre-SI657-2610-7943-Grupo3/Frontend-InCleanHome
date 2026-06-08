<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="page-title">{{ t('nav.profile') }}</h1>
    </div>

    <div v-if="loading" class="loader-wrapper">
      <div class="spinner spinner-lg"></div>
    </div>

    <div v-else class="card profile-card">
      <!-- Banner de cuenta suspendida (visible para la propia trabajadora) -->
      <div v-if="auth.isSuspended" class="suspension-banner-self">
        🚫 Tu cuenta está temporalmente suspendida hasta el {{ formatSuspendedUntil(auth.suspendedUntil) }}.
        <div class="suspension-reason-self">Durante la suspensión no recibirás nuevas solicitudes.</div>
        <div v-if="auth.suspensionReason" class="suspension-reason-self">{{ auth.suspensionReason }}</div>
      </div>
      <div class="profile-header">
        <div class="avatar-wrap">
          <div class="profile-avatar avatar-purple">
            <img v-if="photoUrl" :src="photoUrl" class="avatar-img" alt="profile" />
            <span v-else class="avatar-initial">{{ initials }}</span>
          </div>
          <button type="button" class="photo-btn" @click="triggerPhoto" :disabled="photoUploading" :title="t('common.edit')">
            <div v-if="photoUploading" class="spinner spinner-xs"></div>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <input ref="photoInput" type="file" accept="image/*" class="hidden-input" @change="onPhotoSelected" />
        </div>
        <h2 class="profile-name">{{ auth.user?.name }}</h2>
        <span class="badge badge-purple">{{ t('auth.worker') }}</span>
        <div v-if="photoError" class="photo-error">{{ photoError }}</div>
      </div>

      <div class="form-group-list">
        <div class="grid-2-cols">
          <div class="form-group">
            <label class="label-bold">{{ t('auth.name') }}</label>
            <input v-model="form.name" class="input-field" />
          </div>
          <div class="form-group">
            <label class="label-bold">{{ t('auth.phone') }}</label>
            <input v-model="form.phone" class="input-field" />
          </div>
        </div>
        <div class="grid-2-cols">
          <div class="form-group">
            <label class="label-bold">{{ t('worker.age') }}</label>
            <input v-model.number="form.age" type="number" class="input-field" min="18" max="70" />
          </div>
          <div class="form-group">
            <label class="label-bold">{{ t('worker.experienceYears') }}</label>
            <input v-model.number="form.experienceYears" type="number" class="input-field" min="0" />
          </div>
        </div>
        <div class="form-group">
          <label class="label-bold">{{ t('worker.hourlyRate') }}</label>
          <input v-model.number="form.hourlyRate" type="number" class="input-field input-small" min="10" step="5" />
        </div>
        <div class="grid-2-cols">
          <div class="form-group">
            <label class="label-bold">{{ t('worker.serviceTypes') }}</label>
            <div class="checkbox-list">
              <label v-for="svc in serviceOptions" :key="svc.value" class="checkbox-item">
                <input type="checkbox" :value="svc.value" v-model="form.serviceTypes" class="checkbox-input" />
                <span class="svc-label">{{ svc.label }}</span>
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="label-bold">{{ t('worker.zonesLabel') }}</label>
             <div class="checkbox-list zones-scroll border-box">
              <label v-for="z in zoneOptions" :key="z.value" class="checkbox-item">
                <input type="checkbox" :value="z.value" v-model="form.zones" class="checkbox-input" />
                 <span class="svc-label">{{ z.label }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="form-group">
          <label class="label-bold">{{ t('worker.bio') }}</label>
           <textarea v-model="form.bio" class="input-field no-resize" rows="4"></textarea>
        </div>

        <!-- Acceso permanente para editar/reemplazar los PDFs de verificación.
             Visible siempre (no solo cuando el admin rechaza) para que la trabajadora
             pueda corregir un archivo equivocado al instante. Reusa la vista
             /upload-documents que ya maneja la lógica de subida. -->
        <div class="form-group docs-edit-row">
          <label class="label-bold">{{ t('worker.documents') }}</label>
          <router-link to="/upload-documents" class="btn btn-outline btn-docs-edit">
            📄 {{ t('worker.editDocuments') }}
          </router-link>
          <p class="docs-edit-hint">{{ t('worker.editDocumentsHint') }}</p>
        </div>

        <div v-if="success" class="alert success-box">✓ Perfil actualizado</div>
        <div v-if="error" class="alert error-box">⚠ {{ error }}</div>

        <button @click="save" class="btn btn-primary btn-full submit-btn" :disabled="saving">
          <div v-if="saving" class="spinner spinner-sm"></div>
          {{ saving ? t('common.loading') : t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";
import { formatSuspendedUntil } from "../../Shared/utils/suspension.js";

const { t } = useI18n();
const auth = useAuthStore();
const loading = ref(true);
const saving = ref(false);
const success = ref(false);
const error = ref("");

const form = ref({ name: "", phone: "", age: 25, experienceYears: 1, hourlyRate: 25, serviceTypes: [], zones: [], bio: "" });
const initials = computed(() => (auth.user?.name || "W").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase());

// Foto de perfil — se carga y guarda exclusivamente en el backend.
const photoInput = ref(null);
const photoUrl = ref("");
const photoUploading = ref(false);
const photoError = ref("");

function triggerPhoto() { photoInput.value?.click(); }

function onPhotoSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { photoError.value = "Solo se aceptan imágenes"; return; }
  if (file.size > 3 * 1024 * 1024) { photoError.value = "La imagen no puede superar 3 MB"; return; }
  photoError.value = "";
  const reader = new FileReader();
  reader.onload = async () => {
    // Previsualización inmediata
    photoUrl.value = reader.result;
    photoUploading.value = true;
    try {
      await api.post("/workers/me/photo", { photoUrl: reader.result });
    } catch {
      photoError.value = "No se pudo guardar la foto";
    } finally {
      photoUploading.value = false;
    }
  };
  reader.readAsDataURL(file);
}

const serviceOptions = computed(() => [
  { value: "limpieza_general", label: t("worker.services.limpieza_general") },
  { value: "cocina", label: t("worker.services.cocina") },
  { value: "lavanderia", label: t("worker.services.lavanderia") },
  { value: "planchado", label: t("worker.services.planchado") },
  { value: "cuidado_ninos", label: t("worker.services.cuidado_ninos") },
  { value: "cuidado_adultos", label: t("worker.services.cuidado_adultos") },
  { value: "jardineria", label: t("worker.services.jardineria") },
  { value: "limpieza_profunda", label: t("worker.services.limpieza_profunda") },
]);

const zoneOptions = computed(() => [
  "miraflores","san_isidro","surco","la_molina","barranco","san_borja",
  "lince","jesus_maria","pueblo_libre","magdalena","san_miguel","callao","los_olivos","san_martin","ate","comas"
].map(v => ({ value: v, label: t(`worker.zones.${v}`) })));

async function save() {
  saving.value = true;
  error.value = "";
  try {
    await api.put("/workers/me/profile", form.value);
    success.value = true;
    setTimeout(() => success.value = false, 3000);
  } catch (e) {
    error.value = e.response?.data?.error || t("common.error");
  } finally { saving.value = false; }
}

onMounted(async () => {
  try {
    const { data } = await api.get("/workers/me/profile");
    form.value = { name: data.name || "", phone: data.phone || "", age: data.age || 25, experienceYears: data.experienceYears || 1, hourlyRate: data.hourlyRate || 25, serviceTypes: data.serviceTypes || [], zones: data.zones || [], bio: data.bio || "" };
    if (data.photoUrl) photoUrl.value = data.photoUrl;
  } catch {} finally { loading.value = false; }
});
</script>

<style scoped>
.view-container {
  max-width: 1024px;
  margin: 1rem auto 0;
}
@media (min-width: 640px) {
  .view-container { margin-top: 2rem; }
}

.view-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 800;
}

.loader-wrapper {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.profile-card {
  max-width: 896px;
  margin: 0 auto;
  padding: 2rem;
}
@media (min-width: 640px) {
  .profile-card { padding: 3rem; }
}

.profile-header {
  text-align: center;
  margin-bottom: 2rem;
}

.profile-avatar { 
  width: 80px; 
  height: 80px; 
  border-radius: 50%; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  margin: 0 auto 1rem;
  overflow: hidden;
}
.avatar-purple { background: #8b5cf6; }
.avatar-initial { color: white; font-size: 1.75rem; font-weight: 700; }
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-wrap { position: relative; width: 80px; margin: 0 auto; }
.photo-btn {
  position: absolute;
  bottom: 0.75rem;
  right: -4px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: white;
  border: 1px solid #e2e8f0;
  color: #8b5cf6;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.photo-btn:hover { background: #f8fafc; }
.hidden-input { display: none; }

.profile-name { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 0.25rem; }

.form-group-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.grid-2-cols {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}
@media (min-width: 768px) {
  .grid-2-cols { grid-template-columns: repeat(2, 1fr); }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.label-bold {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.25rem;
}

.input-small {
  max-width: 320px;
}

.checkbox-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.border-box {
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
}
.checkbox-item:hover { background-color: #f8fafc; }

.checkbox-input {
  width: 1rem;
  height: 1rem;
  accent-color: #8b5cf6;
}

.svc-label { font-size: 0.9375rem; }
.zones-scroll { max-height: 120px; overflow-y: auto; }
.no-resize { resize: none; }

.alert {
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
.success-box { background: #d1fae5; color: #065f46; }
.error-box { background: #fee2e2; color: #991b1b; }

.submit-btn {
  padding: 0.75rem 0;
  font-size: 1.125rem;
  margin-top: 1rem;
}

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }
.spinner-sm { width:18px; height:18px; border-width:2px; }
.spinner-xs { width:12px; height:12px; border-width:2px; }

.photo-error { font-size: 0.75rem; color: #dc2626; margin-top: 0.25rem; }

@keyframes spin { to { transform: rotate(360deg); } }

.suspension-banner-self {
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
  font-weight: 600;
  border-left: 4px solid #dc2626;
  font-size: 0.9375rem;
  line-height: 1.4;
}
.suspension-reason-self {
  font-weight: 400;
  font-size: 0.8125rem;
  color: #7f1d1d;
  margin-top: 0.25rem;
  font-style: italic;
}

.docs-edit-row { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; }
.btn-docs-edit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1rem;
  font-weight: 600;
  text-decoration: none;
}
.docs-edit-hint { font-size: 0.8125rem; color: #64748b; margin: 0.25rem 0 0 0; line-height: 1.4; }
</style>
