<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal-box">
      <h3 class="modal-title">{{ t('suspension.appealTitle') || 'Reclamar suspensión' }}</h3>

      <!-- Estado: enviado correctamente. -->
      <div v-if="submitted" class="success-block">
        <div class="success-icon">✓</div>
        <p>{{ t('suspension.appealSubmitted') ||
          'Tu reclamo fue enviado. El equipo de InCleanHome lo revisará pronto.' }}</p>
        <button class="btn btn-primary flex-1" @click="close">{{ t('common.close') || 'Cerrar' }}</button>
      </div>

      <!-- Estado: ya existe un reclamo activo (cargado al montar). -->
      <div v-else-if="existing" class="existing-block">
        <p class="muted">{{ t('suspension.existingAppealText') ||
          'Ya enviaste un reclamo. Está siendo revisado por el equipo.' }}</p>
        <div class="existing-meta">
          <span>📅 {{ formatDate(existing.createdAt) }}</span>
          <span class="pill pill-pending">⏳ {{ t('suspension.statusPending') || 'En revisión' }}</span>
        </div>
        <p class="reason-preview">"{{ existing.reason }}"</p>
        <button class="btn btn-secondary flex-1" @click="close">{{ t('common.close') || 'Cerrar' }}</button>
      </div>

      <!-- Estado: formulario para enviar nuevo reclamo. -->
      <template v-else>
        <p class="modal-help">
          {{ t('suspension.appealInstructions') ||
             'Si consideras que tu suspensión es injusta, escribe aquí tu versión de los hechos. El equipo de InCleanHome la revisará y decidirá si levanta la suspensión.' }}
        </p>

        <textarea
          v-model="reason"
          rows="6"
          class="input-field no-resize"
          :placeholder="t('suspension.reasonPlaceholder') || 'Explica detalladamente por qué consideras que tu suspensión es injusta.'"
          maxlength="2000"></textarea>
        <p class="char-count">{{ reason.length }} / 2000</p>

        <div v-if="error" class="alert error-box">{{ error }}</div>

        <div class="modal-actions">
          <button class="btn btn-secondary flex-1" :disabled="submitting" @click="close">
            {{ t('common.cancel') || 'Cancelar' }}
          </button>
          <button class="btn btn-primary flex-1"
                  :disabled="!reason.trim() || submitting"
                  @click="submit">
            <span v-if="submitting" class="spinner-sm"></span>
            {{ submitting ? (t('common.sending') || 'Enviando…') : (t('suspension.submitAppeal') || 'Enviar reclamo') }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "../../Shared/api.js";

const emit = defineEmits(["close", "submitted"]);
const { t } = useI18n();

const reason = ref("");
const submitting = ref(false);
const submitted = ref(false);
const error = ref("");

// Si ya hay un reclamo activo, no permitimos enviar otro; mostramos el existente.
const existing = ref(null);

function close() { if (!submitting.value) emit("close"); }

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

async function submit() {
  if (!reason.value.trim() || submitting.value) return;
  submitting.value = true;
  error.value = "";
  try {
    await api.post("/suspension-appeals", { reason: reason.value.trim() });
    submitted.value = true;
    emit("submitted");
  } catch (e) {
    error.value = e?.response?.data?.error || (t('common.error') || 'Error');
  } finally {
    submitting.value = false;
  }
}

// Al abrir el modal verificamos si ya existe un reclamo activo. Si sí, lo
// mostramos en lugar del formulario para que el usuario sepa el estado.
onMounted(async () => {
  try {
    const r = await api.get("/suspension-appeals/me");
    // El backend devuelve 204 NoContent cuando no hay reclamo activo.
    if (r.status === 200 && r.data) existing.value = r.data;
  } catch { /* sin reclamo activo, o error 204 — caso normal */ }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 23, 42, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
}
.modal-box {
  background: white; border-radius: 1rem; padding: 1.5rem;
  max-width: 520px; width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  max-height: 92vh; overflow-y: auto;
}
.modal-title { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0 0 0.5rem; }
.modal-help { font-size: 0.875rem; color: #64748b; margin: 0 0 1rem; line-height: 1.5; }

.input-field {
  width: 100%; padding: 0.625rem 0.75rem;
  border: 1px solid #cbd5e1; border-radius: 0.5rem;
  font-size: 0.875rem; font-family: inherit; line-height: 1.5;
}
.input-field:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
.no-resize { resize: vertical; min-height: 120px; }
.char-count { font-size: 0.75rem; color: #94a3b8; text-align: right; margin: 0.25rem 0 0.75rem; }

.alert.error-box { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; margin-bottom: 0.75rem; }

.modal-actions { display: flex; gap: 0.75rem; margin-top: 0.75rem; }
.flex-1 { flex: 1; }

.success-block { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 0.5rem 0; }
.success-icon { font-size: 2.5rem; color: #10b981; }

.existing-block { display: flex; flex-direction: column; gap: 0.5rem; }
.muted { font-size: 0.875rem; color: #475569; line-height: 1.5; margin: 0; }
.existing-meta { display: flex; gap: 0.5rem; align-items: center; font-size: 0.8125rem; color: #64748b; }
.pill { padding: 0.2rem 0.5rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
.pill-pending { background: #fef3c7; color: #92400e; }
.reason-preview { background: #f8fafc; padding: 0.75rem; border-radius: 0.5rem; border-left: 3px solid #cbd5e1; font-size: 0.875rem; color: #475569; font-style: italic; margin: 0.25rem 0 0.75rem; line-height: 1.5; }

.spinner-sm { width: 0.875rem; height: 0.875rem; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; margin-right: 0.4rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
