<template>
  <section>
    <div class="page-head">
      <div>
        <h1>{{ t('suspension.adminTitle') || 'Reclamos de suspensión' }}</h1>
        <p>{{ t('suspension.adminSubtitle') || 'Reclamos pendientes de revisión enviados por usuarios suspendidos.' }}</p>
      </div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>

    <div v-if="loading" class="loading-row">
      <span class="spinner"></span>
      <span>{{ t('common.loading') || 'Cargando...' }}</span>
    </div>

    <div v-else-if="pending.length === 0" class="card empty">
      <p>{{ t('suspension.adminEmpty') || 'No hay reclamos pendientes de revisión.' }}</p>
    </div>

    <div v-else class="appeal-list">
      <div v-for="a in pending" :key="a.id" class="card appeal-card">
        <div class="appeal-header">
          <div>
            <strong>Usuario #{{ a.userId }}</strong>
            <span class="meta-date">📅 {{ formatDate(a.createdAt) }}</span>
          </div>
          <span class="pill pill-pending">⏳ {{ t('suspension.statusPending') || 'En revisión' }}</span>
        </div>

        <p class="reason-text">{{ a.reason }}</p>

        <div class="appeal-actions">
          <button class="small success" @click="openReview(a, 'accept')">
            ✅ {{ t('suspension.adminAccept') || 'Aceptar (levanta suspensión)' }}
          </button>
          <button class="small danger" @click="openReview(a, 'reject')">
            ❌ {{ t('suspension.adminReject') || 'Rechazar (mantiene suspensión)' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de revisión con respuesta opcional -->
    <div v-if="reviewing" class="modal-overlay" @click.self="reviewing = null">
      <div class="modal-box">
        <h3 class="modal-title">
          {{ reviewing.action === 'accept'
              ? (t('suspension.adminAcceptConfirm') || 'Aceptar reclamo')
              : (t('suspension.adminRejectConfirm') || 'Rechazar reclamo') }}
        </h3>

        <p class="muted">
          <strong>{{ t('suspension.userIdLabel') || 'Usuario' }}:</strong> #{{ reviewing.appeal.userId }}
        </p>
        <p class="reason-preview">"{{ reviewing.appeal.reason }}"</p>

        <label class="label">{{ t('suspension.adminResponseLabel') || 'Respuesta al usuario (opcional)' }}</label>
        <textarea v-model="responseText" rows="3" class="input-field no-resize"
                  :placeholder="t('suspension.adminResponsePlaceholder') || 'Mensaje breve explicando tu decisión...'"
                  maxlength="1000"></textarea>

        <div v-if="reviewing.action === 'accept'" class="warn-info">
          ⚠️ {{ t('suspension.adminAcceptWarn') ||
            'Al aceptar, la suspensión del usuario se levantará inmediatamente.' }}
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary flex-1" :disabled="processing" @click="reviewing = null">
            {{ t('common.cancel') || 'Cancelar' }}
          </button>
          <button :class="['btn', 'flex-1', reviewing.action === 'accept' ? 'btn-primary' : 'btn-danger']"
                  :disabled="processing" @click="confirmReview">
            <span v-if="processing" class="spinner-sm"></span>
            {{ reviewing.action === 'accept'
                ? (t('suspension.confirmAccept') || 'Confirmar aceptación')
                : (t('suspension.confirmReject') || 'Confirmar rechazo') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";

const { t } = useI18n();
const toast = useToastStore();

const pending = ref([]);
const loading = ref(true);
const error = ref("");

// Estado del modal de revisión.
const reviewing = ref(null); // { appeal, action: 'accept' | 'reject' }
const responseText = ref("");
const processing = ref(false);

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.get("/suspension-appeals/pending");
    pending.value = data || [];
  } catch (e) {
    error.value = e?.response?.data?.error || (t('common.error') || 'Error');
  } finally {
    loading.value = false;
  }
}

function openReview(appeal, action) {
  reviewing.value = { appeal, action };
  responseText.value = "";
}

async function confirmReview() {
  if (!reviewing.value) return;
  const { appeal, action } = reviewing.value;
  processing.value = true;
  try {
    await api.patch(`/suspension-appeals/${appeal.id}/${action}`,
      { response: responseText.value || "" });
    toast.success(
      action === 'accept'
        ? (t('suspension.adminAcceptedToast') || 'Reclamo aceptado: la suspensión fue levantada.')
        : (t('suspension.adminRejectedToast') || 'Reclamo rechazado: la suspensión continúa.')
    );
    // Lo quitamos localmente en lugar de recargar — feedback inmediato.
    pending.value = pending.value.filter(x => x.id !== appeal.id);
    reviewing.value = null;
    responseText.value = "";
  } catch (e) {
    toast.error?.(e?.response?.data?.error || (t('common.error') || 'Error'));
  } finally {
    processing.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
@import "./admin.css";

.loading-row { display: flex; align-items: center; gap: 0.5rem; padding: 2rem; color: #64748b; }
.empty { padding: 2rem; text-align: center; color: #64748b; }
.appeal-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
.appeal-card { padding: 1rem; }
.appeal-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
.meta-date { margin-left: 0.75rem; font-size: 0.8125rem; color: #64748b; font-weight: 400; }
.pill { padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; white-space: nowrap; }
.pill-pending { background: #fef3c7; color: #92400e; }
.reason-text { background: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; border-left: 3px solid #cbd5e1; font-size: 0.875rem; color: #475569; line-height: 1.5; margin: 0.5rem 0 0.75rem; white-space: pre-wrap; }
.appeal-actions { display: flex; gap: 0.75rem; }
.appeal-actions button.small.success { background: #16a34a; color: white; padding: 0.5rem 0.875rem; border: none; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.appeal-actions button.small.success:hover { background: #15803d; }
.appeal-actions button.small.danger { background: #dc2626; color: white; padding: 0.5rem 0.875rem; border: none; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; cursor: pointer; }
.appeal-actions button.small.danger:hover { background: #b91c1c; }

.modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; }
.modal-box { background: white; border-radius: 1rem; padding: 1.5rem; max-width: 480px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.modal-title { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0 0 0.5rem; }
.muted { font-size: 0.875rem; color: #475569; margin: 0 0 0.5rem; }
.reason-preview { background: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; border-left: 3px solid #cbd5e1; font-size: 0.875rem; color: #475569; font-style: italic; margin: 0 0 0.75rem; line-height: 1.5; }
.label { display: block; font-size: 0.8125rem; font-weight: 600; color: #475569; margin-bottom: 0.25rem; }
.input-field { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; font-size: 0.875rem; font-family: inherit; line-height: 1.5; }
.input-field:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.no-resize { resize: vertical; min-height: 80px; }
.warn-info { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.8125rem; margin: 0.75rem 0; }
.modal-actions { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
.flex-1 { flex: 1; }
.btn-danger { background: #dc2626; color: white; }
.btn-danger:hover { background: #b91c1c; }

.spinner { width: 1rem; height: 1rem; border: 2px solid #cbd5e1; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
.spinner-sm { width: 0.875rem; height: 0.875rem; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; margin-right: 0.4rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
