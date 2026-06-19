<template>
  <section>
    <div class="page-head">
      <div>
        <h1>{{ t('adminSettings.title') || 'Configuración de la plataforma' }}</h1>
        <p>{{ t('adminSettings.subtitle') ||
          'Ajusta los parámetros globales que afectan a todos los usuarios.' }}</p>
      </div>
    </div>

    <div v-if="loading" class="loading-row">
      <span class="spinner"></span>
      <span>{{ t('common.loading') || 'Cargando…' }}</span>
    </div>

    <div v-else-if="loadError" class="error-box">{{ loadError }}</div>

    <div v-else class="card form-card">
      <h2 class="card-title">{{ t('adminSettings.commissionTitle') || 'Tasa de comisión' }}</h2>
      <p class="muted">
        {{ t('adminSettings.commissionExplain') ||
          'Porcentaje que la plataforma cobra a la trabajadora sobre cada servicio pagado. Los pagos ya registrados NO se recalculan: solo se aplica a pagos futuros.' }}
      </p>

      <div class="form-row">
        <label class="label-bold">
          {{ t('adminSettings.commissionLabel') || 'Comisión (%)' }}
        </label>
        <div class="rate-row">
          <input v-model.number="percent" type="number" :min="settings.minPercent" :max="settings.maxPercent"
                 step="1" class="input-field rate-input" />
          <span class="rate-suffix">%</span>
        </div>
        <p class="hint-small">
          {{ t('adminSettings.allowedRange') || 'Permitido' }}:
          {{ settings.minPercent }}% – {{ settings.maxPercent }}%
        </p>
      </div>

      <div v-if="settings.updatedAt" class="audit-line">
        🕒 {{ t('adminSettings.lastChange') || 'Último cambio' }}: {{ formatDate(settings.updatedAt) }}
        <span v-if="settings.lastUpdatedByAdminUserId">— admin #{{ settings.lastUpdatedByAdminUserId }}</span>
      </div>

      <div v-if="message" class="success-box">{{ message }}</div>
      <div v-if="error" class="error-box">{{ error }}</div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="saving || !isDirty || !isValid" @click="save">
          <span v-if="saving" class="spinner-sm"></span>
          {{ saving ? (t('common.saving') || 'Guardando…') : (t('adminSettings.saveButton') || 'Guardar comisión') }}
        </button>
        <button v-if="isDirty" class="btn btn-secondary" :disabled="saving" @click="reset">
          {{ t('common.cancel') || 'Cancelar' }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "../../Shared/api.js";

const { t } = useI18n();

const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const message = ref("");
const error = ref("");

// El backend devuelve % como decimal. En la UI manejamos enteros (10, 12, etc.)
// para que sea más natural editar. El backend convierte de vuelta.
const settings = ref({
  commissionPercent: 10,
  minPercent: 0,
  maxPercent: 60,
  updatedAt: null,
  lastUpdatedByAdminUserId: null,
});
const percent = ref(10);

const isDirty = computed(() => Number(percent.value) !== Number(settings.value.commissionPercent));
const isValid = computed(() =>
  Number.isFinite(percent.value) &&
  percent.value >= settings.value.minPercent &&
  percent.value <= settings.value.maxPercent
);

function formatDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const { data } = await api.get("/admin/settings");
    settings.value = {
      // Backend devuelve { commissionRate, commissionPercent, minPercent, maxPercent, ... }
      commissionPercent: Math.round(Number(data.commissionPercent || (data.commissionRate || 0) * 100)),
      minPercent: Number(data.minPercent ?? 0),
      maxPercent: Number(data.maxPercent ?? 60),
      updatedAt: data.updatedAt,
      lastUpdatedByAdminUserId: data.lastUpdatedByAdminUserId,
    };
    percent.value = settings.value.commissionPercent;
  } catch (e) {
    loadError.value = e?.response?.data?.error || (t('common.error') || 'Error');
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!isDirty.value || !isValid.value || saving.value) return;
  saving.value = true;
  error.value = "";
  message.value = "";
  try {
    const { data } = await api.put("/admin/settings", { commissionPercent: percent.value });
    settings.value = {
      commissionPercent: Math.round(Number(data.commissionPercent)),
      minPercent: Number(data.minPercent),
      maxPercent: Number(data.maxPercent),
      updatedAt: data.updatedAt,
      lastUpdatedByAdminUserId: data.lastUpdatedByAdminUserId,
    };
    percent.value = settings.value.commissionPercent;
    message.value = t('adminSettings.savedToast') || `Comisión actualizada a ${percent.value}%.`;
  } catch (e) {
    error.value = e?.response?.data?.error || (t('common.error') || 'Error');
  } finally {
    saving.value = false;
  }
}

function reset() {
  percent.value = settings.value.commissionPercent;
  error.value = "";
  message.value = "";
}

onMounted(load);
</script>

<style scoped>
@import "./admin.css";
.loading-row { display: flex; align-items: center; gap: 0.5rem; padding: 1.5rem; color: #64748b; }
.form-card { max-width: 600px; padding: 1.5rem; }
.card-title { font-size: 1.0625rem; font-weight: 700; color: #1e293b; margin: 0 0 0.5rem; }
.muted { font-size: 0.875rem; color: #64748b; line-height: 1.5; margin: 0 0 1.25rem; }

.form-row { margin-bottom: 1rem; }
.label-bold { display: block; font-size: 0.8125rem; font-weight: 600; color: #475569; margin-bottom: 0.5rem; }
.rate-row { display: flex; align-items: center; gap: 0.5rem; max-width: 200px; }
.rate-input { flex: 1; padding: 0.625rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 1.125rem; font-weight: 700; text-align: right; }
.rate-suffix { font-size: 1.125rem; font-weight: 700; color: #475569; }
.hint-small { font-size: 0.75rem; color: #94a3b8; margin: 0.375rem 0 0; }

.audit-line { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px dashed #e2e8f0; }

.success-box { background: #ecfdf5; color: #065f46; border: 1px solid #d1fae5; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; margin: 0.75rem 0; }
.error-box { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; margin: 0.75rem 0; }

.actions { display: flex; gap: 0.75rem; margin-top: 1.25rem; }
.btn { padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 600; border: none; cursor: pointer; }
.btn-primary { background: #2563eb; color: white; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
.btn-secondary { background: #f1f5f9; color: #475569; }
.btn-secondary:hover:not(:disabled) { background: #e2e8f0; }

.spinner { width: 1rem; height: 1rem; border: 2px solid #cbd5e1; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
.spinner-sm { width: 0.875rem; height: 0.875rem; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; margin-right: 0.4rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
