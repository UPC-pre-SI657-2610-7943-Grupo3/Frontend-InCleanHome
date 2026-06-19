<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="page-title">{{ t('nav.profile') }}</h1>
    </div>

    <div v-if="loading" class="loader-wrapper">
      <div class="spinner spinner-lg"></div>
    </div>

    <div v-else class="card profile-card">
      <!-- Banner de cuenta suspendida (visible para el propio cliente) -->
      <div v-if="auth.isSuspended" class="suspension-banner-self">
        🚫 Tu cuenta está temporalmente suspendida hasta el {{ formatSuspendedUntil(auth.suspendedUntil) }}.
        <div v-if="auth.suspensionReason" class="suspension-reason">{{ auth.suspensionReason }}</div>
      </div>
      <div class="profile-header">
        <div class="avatar-wrap">
          <div class="profile-avatar avatar-blue">
            <img v-if="photoUrl" :src="photoUrl" class="avatar-img" alt="profile" />
            <span v-else class="avatar-initial">{{ initials }}</span>
          </div>
          <button type="button" class="photo-btn" @click="triggerPhoto" :disabled="photoUploading" :title="t('common.edit')">
            <div v-if="photoUploading" class="spinner spinner-xs"></div>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <input ref="photoInput" type="file" accept="image/*" class="hidden-input" @change="onPhotoSelected" />
        </div>
        <h2 class="profile-name">{{ form.name }}</h2>
        <span class="badge badge-blue">{{ t('auth.client') }}</span>
        <div v-if="photoError" class="photo-error">{{ photoError }}</div>
      </div>
      
      <div class="form-group-list">
        <div class="form-group">
          <label class="label-bold">{{ t('auth.name') }}</label>
          <input v-model="form.name" class="input-field" />
        </div>
        <div class="form-group">
          <label class="label-bold">{{ t('auth.email') }}</label>
          <input :value="auth.user?.email" class="input-field input-disabled" disabled />
        </div>
        <div class="form-group">
          <label class="label-bold">{{ t('auth.phone') }}</label>
          <input v-model="form.phone" class="input-field" />
        </div>
        
        <div v-if="error" class="alert error-box">⚠ {{ error }}</div>
        <div v-if="success" class="alert success-box">✓ {{ t('common.success') }}</div>
        
        <button @click="save" class="btn btn-primary btn-full submit-btn" :disabled="saving">
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
const saving = ref(false);
const success = ref(false);
const error = ref("");
const loading = ref(true);
const form = ref({ name: "", phone: "" });
const initials = computed(() => (form.value.name || "U").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase());

// Foto de perfil — se carga y guarda exclusivamente en el backend.
const photoInput = ref(null);
const photoUrl = ref("");
const photoUploading = ref(false);
const photoError = ref("");

function triggerPhoto() { photoInput.value?.click(); }
function onPhotoSelected(e) {
  const file = e.target.files?.[0];
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 3 * 1024 * 1024) { photoError.value = "La imagen no puede superar 3 MB"; return; }
  photoError.value = "";
  const reader = new FileReader();
  reader.onload = async () => {
    photoUrl.value = reader.result;
    photoUploading.value = true;
    try {
      await api.post("/my-profile/photo", { photoUrl: reader.result });
    } catch {
      photoError.value = "No se pudo guardar la foto";
    } finally {
      photoUploading.value = false;
    }
  };
  reader.readAsDataURL(file);
}

onMounted(async () => {
  try {
    const { data } = await api.get("/my-profile");
    form.value = { name: data.name || "", phone: data.phone || "" };
    if (data.photoUrl) photoUrl.value = data.photoUrl;
  } catch (err) {
    error.value = t('common.error') || "Error al cargar el perfil";
  } finally {
    loading.value = false;
  }
});

async function save() {
  // Validación: nombre solo letras (con tildes/ñ y espacios), no vacío.
  const name = form.value.name.trim();
  if (!name) {
    error.value = t('auth.nameRequired');
    return;
  }
  const nameRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
  if (!nameRegex.test(name)) {
    error.value = t('auth.nameInvalid');
    return;
  }
  // Validación: teléfono solo dígitos y exactamente 9.
  const phone = (form.value.phone || "").trim();
  const phoneRegex = /^\d{9}$/;
  if (!phoneRegex.test(phone)) {
    error.value = t('auth.phoneInvalid');
    return;
  }

  saving.value = true;
  error.value = "";

  try {
    const { data } = await api.patch("/my-profile", {
      name: name,
      phone: phone
    });

    const updatedUser = { ...auth.user, ...data };
    auth.user = updatedUser;
    localStorage.setItem("inclean_user", JSON.stringify(updatedUser));

    success.value = true;
    setTimeout(() => success.value = false, 3000);
  } catch (err) {
    error.value = err.response?.data?.message || t('common.error') || "Error al guardar los cambios";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.view-container {
  max-width: 896px;
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
  padding: 3rem 0;
}

.profile-card {
  max-width: 672px;
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
.avatar-blue { background: #2563eb; }
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
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.12);
}
.photo-btn:hover { background: #f8fafc; }
.photo-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.hidden-input { display: none; }
.photo-error { font-size: 0.75rem; color: #dc2626; margin-top: 0.25rem; }

.spinner-xs { border: 2px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:12px; height:12px; animation: spin 1s linear infinite; display: inline-block; }
@keyframes spin { to { transform: rotate(360deg); } }

.profile-name { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 0.25rem; }

.form-group-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
}

.input-disabled { background: #f8fafc; cursor: not-allowed; }

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

@media (max-width: 640px) {
  .profile-avatar { width: 70px; height: 70px; }
  .avatar-initial { font-size: 1.5rem; }
  .profile-name { font-size: 1.25rem; }
}
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
.suspension-reason {
  font-weight: 400;
  font-size: 0.8125rem;
  color: #7f1d1d;
  margin-top: 0.25rem;
  font-style: italic;
}
</style>
