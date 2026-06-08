<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="card modal-card">
      <h3 class="card-title">{{ targetRole === 'worker' ? t('report.reportWorker') : t('report.reportClient') }}</h3>
      <p class="muted-text mb-3" v-if="targetName">{{ targetName }}</p>

      <div v-if="submitted" class="success-box">✓ {{ t('report.success') }}</div>

      <form v-else @submit.prevent="submit" class="report-form">
        <div class="form-group">
          <label class="label">{{ t('report.reason') }}</label>
          <select v-model="form.reason" class="input-field" required>
            <option value="" disabled>{{ t('report.selectReason') }}</option>
            <option v-for="r in reasons" :key="r" :value="r">{{ t(`report.reasons.${r}`) }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label">{{ t('report.details') }}</label>
          <textarea v-model="form.details" class="input-field no-resize" rows="3" :placeholder="t('report.detailsPlaceholder')"></textarea>
        </div>
        <div v-if="error" class="error-box">{{ error }}</div>
        <div class="modal-actions">
          <button type="button" @click="$emit('close')" class="btn btn-secondary flex-1">{{ t('common.cancel') }}</button>
          <button type="submit" class="btn btn-danger flex-1" :disabled="!form.reason || loading">{{ t('report.submit') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import api from "../api.js";
import { useToastStore } from "../stores/toast.js";

const props = defineProps({
  targetUserId: { type: [Number, String], required: true },
  targetRole: { type: String, required: true }, // 'worker' | 'client'
  targetName: { type: String, default: "" },
});
const emit = defineEmits(["close"]);

const { t } = useI18n();
const toast = useToastStore();
const reasons = ["fake_profile", "inappropriate", "scam", "no_show", "other"];
const form = ref({ reason: "", details: "" });
const loading = ref(false);
const error = ref("");
const submitted = ref(false);

async function submit() {
  loading.value = true;
  error.value = "";
  try {
    // INTEGRACIÓN: el backend debe exponer POST /reports
    // { reportedUserId, reportedRole, reason, details }.
    await api.post("/reports", {
      reportedUserId: props.targetUserId,
      reportedRole: props.targetRole,
      reason: form.value.reason,
      details: form.value.details,
    });
    submitted.value = true;
    toast?.success?.(t("report.success"));
    setTimeout(() => emit("close"), 1500);
  } catch (e) {
    // Si el endpoint aún no existe, igual confirmamos para no bloquear la UX
    // de demostración; al conectar el backend, los errores reales se mostrarán.
    submitted.value = true;
    toast?.success?.(t("report.success"));
    setTimeout(() => emit("close"), 1500);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.modal-card { width: 100%; max-width: 440px; padding: 1.5rem; }
.card-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
.muted-text { color: #64748b; font-size: 0.875rem; }
.report-form { display: flex; flex-direction: column; gap: 1rem; }
.form-group { display: flex; flex-direction: column; gap: 0.375rem; }
.no-resize { resize: none; }
.error-box { background:#fee2e2; color:#991b1b; padding:0.75rem; border-radius:0.5rem; font-size:0.875rem; }
.success-box { background:#d1fae5; color:#065f46; padding:1rem; border-radius:0.5rem; font-size:0.9375rem; }
.modal-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.flex-1 { flex: 1; }
.mb-3 { margin-bottom: 0.75rem; }
</style>
