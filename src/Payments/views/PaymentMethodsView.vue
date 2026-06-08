<template>
<!-- Payment methods view template -->
  <div class="view-container">
    <div class="view-header">
<!-- View header -->
      <h1 class="page-title">{{ t('nav.payments') }}</h1>
      <p class="page-subtitle">{{ t('payments.subtitle') }}</p>
    </div>

    <div v-if="loading" class="loader-wrapper">
<!-- Loading spinner -->
      <div class="spinner spinner-lg"></div>
    </div>

    <div v-else class="grid-layout">
<!-- Main grid layout -->
      <!-- Left side: Existing payment methods -->
<!-- Existing payment methods section -->
      <div class="column-layout">
        <div v-if="methods.length" class="card shadow-sm border-box">
          <h3 class="card-title">{{ t('payments.saved') }}</h3>
          <div class="method-list">
            <div v-for="m in methods" :key="m.id" class="method-row">
              <span class="payment-icon">{{ paymentIcon(m.type) }}</span>
              <div class="method-info">
                <div class="method-label">{{ m.label }}</div>
                <div v-if="m.details" class="method-details">{{ m.details }}</div>
                <span v-if="m.isDefault" class="badge badge-blue badge-small">Principal</span>
              </div>
              <div class="method-actions">
                <button v-if="!m.isDefault" @click="setDefault(m.id)" class="btn btn-secondary btn-sm">{{ t('payments.setDefault') }}</button>
                <button @click="deleteMethod(m.id)" class="btn btn-danger btn-sm">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right side: Add new method & Info box -->
<!-- Add new method and info section -->
      <div class="column-layout">
        <!-- Add new method -->
<!-- Add new payment method form -->
        <div class="card shadow-sm border-box">
          <h3 class="card-title">{{ t('payments.addNew') }}</h3>
          <div class="form-list">
            <div class="form-group">
              <label class="label-bold">{{ t('booking.paymentMethod') }}</label>
              <div class="payment-types-grid">
                  <button v-for="(lbl, val) in paymentTypes" :key="val" @click="form.type = val" :class="['btn payment-type-btn', form.type === val ? 'btn-primary' : 'btn-secondary']">
                    <span class="payment-type-icon">{{ paymentIcon(val) }}</span>
                    <span class="payment-type-label">{{ lbl }}</span>
                  </button>
              </div>
            </div>
            <div class="form-group">
              <label class="label-bold">{{ t('payments.label') }}</label>
              <input v-model="form.label" class="input-field mt-1" :placeholder="t('payments.labelPlaceholder')" />
            </div>
            <div class="form-group">
              <label class="label-bold">{{ t('payments.details') }}</label>
              <input v-model="form.details" class="input-field mt-1" :placeholder="t('payments.detailsPlaceholder')" />
            </div>
            
            <label class="checkbox-item">
              <input type="checkbox" v-model="form.isDefault" class="checkbox-input" />
              <span class="mark-default-text">{{ t('payments.markDefault') }}</span>
            </label>

            <div v-if="error" class="alert error-box">{{ error }}</div>

            <button @click="addMethod" class="btn btn-primary submit-btn" :disabled="!form.label || saving">
              <div v-if="saving" class="spinner spinner-sm"></div>
              {{ saving ? t('common.loading') : t('payments.add') }}
            </button>
          </div>
        </div>

        <!-- Info box -->
<!-- Security info box -->
        <div class="card secure-card">
          <div class="secure-content">
            <span class="secure-icon">🔒</span>
            <div>
              <div class="secure-title">{{ t('payments.secureTitle') }}</div>
              <p class="secure-desc">{{ t('payments.secureDesc') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Payment methods view script setup
import { ref, computed, onMounted } from "vue";
// Imports for Vue and utilities
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";

const { t } = useI18n();
// Initialize i18n
const toast = useToastStore();
const methods = ref([]);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
// Reactive state variables

const form = ref({ type: "yape", label: "", details: "", isDefault: false });
// Form data object

const paymentTypes = computed(() => ({
  cash: t("booking.paymentTypes.cash"),
  card: t("booking.paymentTypes.card"),
  paypal_card: t("booking.paymentTypes.paypal_card"),
  yape: t("booking.paymentTypes.yape"),
  plin: t("booking.paymentTypes.plin"),
  bank_transfer: t("booking.paymentTypes.bank_transfer"),
}));
// Computed payment types

function paymentIcon(type) {
// Function to get payment icon
  return { cash: "💵", card: "💳", paypal_card: "🅿️", yape: "📱", plin: "📲", bank_transfer: "🏦" }[type] || "💰";
}

async function addMethod() {
// Async function to add payment method
  if (!form.value.label) return;
  saving.value = true;
  error.value = "";
  try {
    const { data } = await api.post("/payments/methods", form.value);
    methods.value.push(data);
    form.value = { type: "yape", label: "", details: "", isDefault: false };
    toast.success(t("common.success"));
  } catch (e) {
    error.value = e.response?.data?.error || t("common.error");
  } finally { saving.value = false; }
}

async function setDefault(id) {
// Async function to set default method
  await api.patch(`/payments/methods/${id}/default`);
  methods.value.forEach(m => { m.isDefault = m.id === id; });
  toast.success(t("common.success"));
}

async function deleteMethod(id) {
// Async function to delete method
  await api.delete(`/payments/methods/${id}`);
  methods.value = methods.value.filter(m => m.id !== id);
  toast.success(t("common.success"));
}

onMounted(async () => {
// On mounted lifecycle hook
  try {
    const { data } = await api.get("/payments/methods");
    methods.value = data;
  } catch {} finally { loading.value = false; }
});
</script>

<style scoped>
/* Payment methods view styles */
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
  margin-bottom: 0.5rem;
}

.page-subtitle {
  font-size: 1.125rem;
  color: #64748b;
}

.loader-wrapper {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: start;
}
@media (min-width: 1024px) {
  .grid-layout { grid-template-columns: repeat(2, 1fr); }
}

.column-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.border-box { border: 1px solid #e2e8f0; }

.card-title { font-weight: 700; color: #1e293b; margin-bottom: 1rem; font-size: 1.25rem; }

.method-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.method-row { 
  display: flex; 
  align-items: center; 
  gap: 1rem; 
  padding: 0.75rem; 
  border: 1.5px solid #e2e8f0; 
  border-radius: 0.75rem; 
}
@media (max-width: 640px) {
  .method-row { flex-direction: column; align-items: flex-start; }
}

.payment-icon { font-size: 1.75rem; }
.method-info { flex: 1; }
.method-label { font-weight: 600; color: #1e293b; }
.method-details { font-size: 0.8125rem; color: #64748b; }
.badge-small { margin-top: 0.25rem; font-size: 0.7rem; }
.method-actions { display: flex; gap: 0.5rem; }

.form-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.mt-1 { margin-top: 0.25rem; }

.payment-types-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-top: 0.25rem;
}
@media (min-width: 640px) {
  .payment-types-grid { grid-template-columns: repeat(3, 1fr); }
}

.payment-type-btn { flex-direction: column; gap: 0.25rem; padding: 0.75rem; }
.payment-type-icon { font-size: 1.5rem; }
.payment-type-label { font-size: 0.8125rem; }

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-top: 0.25rem;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  accent-color: #2563eb;
}

.mark-default-text { font-size: 0.875rem; font-weight: 500; color: #1e293b; }

.alert {
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}
.error-box { background: #fee2e2; color: #991b1b; }

.submit-btn { margin-top: 0.5rem; }

.secure-card { background: #f0fdf4; border-color: #a7f3d0; }
.secure-content { display: flex; gap: 1rem; align-items: center; }
.secure-icon { font-size: 1.875rem; }
.secure-title { font-weight: 600; color: #065f46; margin-bottom: 0.25rem; font-size: 1.125rem; }
.secure-desc { font-size: 0.875rem; color: #047857; margin: 0; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }
.spinner-sm { width:18px; height:18px; border-width:2px; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
