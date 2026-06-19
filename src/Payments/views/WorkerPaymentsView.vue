<template>
  <div class="view-container">
    <div class="view-header">
      <h1 class="page-title">{{ t('workerPayments.title') }}</h1>
      <p class="page-subtitle">{{ t('workerPayments.subtitle') }}</p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loader-wrapper">
      <div class="spinner spinner-lg"></div>
    </div>

    <div v-else class="dashboard-content">
      <!-- Pendiente de cobro (solo si hay algo pendiente) -->
      <div v-if="pendingPayoutCount > 0" class="card pending-payout-card mb-6">
        <div class="pending-info">
          <div class="pending-icon">📥</div>
          <div>
            <div class="pending-label">{{ t('workerPayments.pendingPayout') }}</div>
            <div class="pending-amount">S/. {{ pendingPayout.toFixed(2) }}</div>
            <div class="pending-detail">
              {{ pendingPayoutCount === 1
                  ? t('workerPayments.pendingPayoutDetail1')
                  : t('workerPayments.pendingPayoutDetailN', { n: pendingPayoutCount }) }}
            </div>
          </div>
        </div>
        <button @click="handleRequestPayout"
                class="btn btn-primary btn-lg"
                :disabled="requestingPayout">
          <span v-if="requestingPayout" class="spinner spinner-sm"></span>
          {{ requestingPayout ? t('common.loading') : t('workerPayments.requestPayout') }}
        </button>
      </div>

      <!-- Top Section: Earnings Cards -->
      <div class="stats-grid mb-6">
        <!-- Total Earnings Card -->
        <div class="card stat-card total-card">
          <div class="stat-icon-wrapper">
            <span class="stat-icon">💰</span>
          </div>
          <div class="stat-details">
            <div class="stat-value">S/. {{ totalEarnings.toFixed(2) }}</div>
            <div class="stat-label">{{ t('workerPayments.totalEarnings') }}</div>
          </div>
        </div>

        <!-- Platform Fee Card -->
        <div class="card stat-card fee-card">
          <div class="stat-icon-wrapper">
            <span class="stat-icon">📊</span>
          </div>
          <div class="stat-details">
            <div class="stat-value text-danger">- S/. {{ platformFee.toFixed(2) }}</div>
            <div class="stat-label">{{ t('workerPayments.platformFee') }}</div>
          </div>
        </div>

        <!-- Net Earnings Card -->
        <div class="card stat-card net-card">
          <div class="stat-icon-wrapper">
            <span class="stat-icon">✅</span>
          </div>
          <div class="stat-details">
            <div class="stat-value text-success">S/. {{ netEarnings.toFixed(2) }}</div>
            <div class="stat-label">{{ t('workerPayments.netEarnings') }}</div>
          </div>
        </div>
      </div>

      <!-- Main Layout Grid -->
      <div class="grid-layout">
        <!-- Left Side: Saved Payout Methods -->
        <div class="column-layout">
          <div class="card shadow-sm border-box">
            <h3 class="card-subtitle-custom mb-4">{{ t('workerPayments.payoutMethods') }}</h3>
            <p class="muted-text mb-4">{{ t('workerPayments.payoutMethodsSubtitle') }}</p>

            <div v-if="methods.length === 0" class="empty-state">
              <span class="empty-icon">💳</span>
              <p class="muted-text">No tienes métodos de cobro configurados.</p>
            </div>

            <div v-else class="method-list">
              <div v-for="m in methods" :key="m.id" class="method-row" :class="{ 'default-row': m.isDefault }">
                <span class="payment-icon">{{ paymentIcon(m.type) }}</span>
                <div class="method-info">
                  <div class="method-label">{{ m.label }}</div>
                  <div v-if="m.details" class="method-details">{{ m.details }}</div>
                  <span v-if="m.isDefault" class="badge badge-blue badge-small">Predeterminado</span>
                </div>
                <div class="method-actions">
                  <button v-if="!m.isDefault" @click="setDefault(m.id)" class="btn btn-secondary btn-sm">{{ t('payments.setDefault') }}</button>
                  <button @click="deleteMethod(m.id)" class="btn btn-danger btn-sm" title="Eliminar">✕</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Side: Add New Payout Method & Info Box -->
        <div class="column-layout">
          <!-- Add New Payout Method Form -->
          <div class="card shadow-sm border-box">
            <h3 class="card-subtitle-custom mb-4">{{ t('workerPayments.addNewPayout') }}</h3>
            
            <div class="form-list">
              <!-- Type Selector -->
              <div class="form-group">
                <label class="label-bold">{{ t('booking.paymentMethod') }}</label>
                <div class="payment-types-grid">
                  <button v-for="(lbl, val) in payoutTypes" :key="val" @click="form.type = val" 
                    :class="['btn payment-type-btn', form.type === val ? 'btn-primary' : 'btn-secondary']">
                    <span class="payment-type-icon">{{ paymentIcon(val) }}</span>
                    <span class="payment-type-label">{{ lbl }}</span>
                  </button>
                </div>
              </div>

              <!-- Label -->
              <div class="form-group">
                <label class="label-bold">{{ t('payments.label') }}</label>
                <input v-model="form.label" class="input-field mt-1" :placeholder="t('workerPayments.labelPlaceholder')" />
              </div>

              <!-- Details -->
              <div class="form-group">
                <label class="label-bold">{{ t('payments.details') }}</label>
                <input v-model="form.details" class="input-field mt-1" :placeholder="t('workerPayments.detailsPlaceholder')" />
              </div>
              
              <!-- Mark Default -->
              <label class="checkbox-item">
                <input type="checkbox" v-model="form.isDefault" class="checkbox-input" />
                <span class="mark-default-text">{{ t('payments.markDefault') }}</span>
              </label>

              <!-- Error Alert -->
              <div v-if="error" class="alert error-box">{{ error }}</div>

              <!-- Submit Button -->
              <button @click="addMethod" class="btn btn-primary submit-btn btn-full" :disabled="!form.label || saving">
                <div v-if="saving" class="spinner spinner-sm"></div>
                {{ saving ? t('common.loading') : t('workerPayments.add') }}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";
import {
  getMyWorkerBalance,
  requestWorkerPayout,
} from "../../Shared/services/paymentApi.js";

const { t } = useI18n();
const toast = useToastStore();

const loading = ref(true);
const saving = ref(false);
const error = ref("");

const methods = ref([]);

const form = ref({ type: "yape", label: "", details: "", isDefault: false });

// ── Balance del worker (viene de /api/service-payments/worker/balance) ────
// Los 3 valores que se muestran arriba ahora vienen REALES del backend, no
// del cálculo localStorage anterior.
const balance = ref({
  totalEarnings: 0,
  platformFeeTotal: 0,
  netEarnings: 0,
  pendingPayout: 0,
  pendingPayoutCount: 0,
  completedServices: 0,
});

const totalEarnings = computed(() => (balance.value.totalEarnings || 0) + (balance.value.platformFeeTotal || 0));
const platformFee   = computed(() => balance.value.platformFeeTotal || 0);
const netEarnings   = computed(() => balance.value.netEarnings || 0);

// "Pendiente de cobro" — payments aún no liquidados al worker.
const pendingPayout      = computed(() => balance.value.pendingPayout || 0);
const pendingPayoutCount = computed(() => balance.value.pendingPayoutCount || 0);

// Estado del botón "Solicitar Cobro".
const requestingPayout = ref(false);

// Métodos de cobro que la trabajadora puede registrar. Solo flujos donde
// realmente puede recibir dinero por fuera: Yape, Plin, transferencia bancaria.
// "cash" fue removido (no permite trazar comisión) y "mercadopago" no aplica:
// es un canal de cobro al CLIENTE, no de payout a la trabajadora.
const payoutTypes = computed(() => ({
  yape:          t("booking.paymentTypes.yape"),
  plin:          t("booking.paymentTypes.plin"),
  bank_transfer: t("booking.paymentTypes.bank_transfer"),
}));

function paymentIcon(type) {
  return { yape: "📱", plin: "📲", bank_transfer: "🏦" }[type] || "💰";
}

async function fetchData() {
  try {
    const [balanceData, methodsData] = await Promise.all([
      getMyWorkerBalance().catch(() => null),
      api.get("/payments/methods"),
    ]);
    if (balanceData) balance.value = balanceData;
    methods.value = methodsData.data;
  } catch (e) {
    console.error("Failed to load worker payments data:", e);
  } finally {
    loading.value = false;
  }
}

/**
 * Solicita el cobro de TODOS los payments pendientes del worker.
 * El backend los marca como PayoutStatus=Completed (no se mueve dinero real
 * en esta simulación — el cobro real va por fuera).
 */
async function handleRequestPayout() {
  if (pendingPayoutCount.value === 0 || requestingPayout.value) return;
  requestingPayout.value = true;
  try {
    const { payoutsProcessed } = await requestWorkerPayout();
    toast.success(
      payoutsProcessed === 1
        ? "Cobro solicitado correctamente. Se acreditó a tu cuenta predeterminada."
        : `${payoutsProcessed} cobros procesados correctamente.`
    );
    // Recargar el balance.
    const newBalance = await getMyWorkerBalance();
    balance.value = newBalance;
  } catch (e) {
    toast.error(e?.response?.data?.error || "No se pudo procesar el cobro");
  } finally {
    requestingPayout.value = false;
  }
}

async function addMethod() {
  if (!form.value.label) return;
  saving.value = true;
  error.value = "";
  try {
    const { data } = await api.post("/payments/methods", form.value);
    methods.value.push(data);

    if (form.value.isDefault) {
      methods.value.forEach(m => {
        if (m.id !== data.id) m.isDefault = false;
      });
    }

    form.value = { type: "yape", label: "", details: "", isDefault: false };
    toast.success(t("common.success"));
  } catch (e) {
    error.value = e.response?.data?.error || t("common.error");
  } finally {
    saving.value = false;
  }
}

async function setDefault(id) {
  try {
    await api.patch(`/payments/methods/${id}/default`);
    methods.value.forEach(m => {
      m.isDefault = m.id === id;
    });
    toast.success(t("common.success"));
  } catch (e) {
    toast.error(e.response?.data?.error || t("common.error"));
  }
}

async function deleteMethod(id) {
  try {
    await api.delete(`/payments/methods/${id}`);
    methods.value = methods.value.filter(m => m.id !== id);
    toast.success(t("common.success"));
  } catch (e) {
    toast.error(e.response?.data?.error || t("common.error"));
  }
}

onMounted(fetchData);
</script>

<style scoped>
.view-container {
  max-width: 1200px;
  margin: 0 auto;
}

.view-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.page-title {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
}

.page-subtitle {
  font-size: 1.1rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.loader-wrapper {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

@media (min-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
}

.total-card:hover {
  border-color: #3b82f6;
}

.fee-card:hover {
  border-color: #ef4444;
}

.net-card:hover {
  border-color: #10b981;
}

.stat-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  font-size: 1.5rem;
}

.total-card .stat-icon-wrapper {
  background: #eff6ff;
}

.fee-card .stat-icon-wrapper {
  background: #fef2f2;
}

.net-card .stat-icon-wrapper {
  background: #ecfdf5;
}

.stat-details {
  flex: 1;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
}

.text-danger {
  color: var(--color-danger);
}

.text-success {
  color: var(--color-success);
}

.stat-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b;
  margin-top: 0.15rem;
}

.grid-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  align-items: start;
}

@media (min-width: 1024px) {
  .grid-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.column-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.border-box {
  border: 1px solid var(--color-border);
}

.card-subtitle-custom {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.5rem;
}

.muted-text {
  font-size: 0.875rem;
  color: #64748b;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  background: #f8fafc;
  border: 2px dashed #e2e8f0;
  border-radius: 0.75rem;
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  opacity: 0.6;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.method-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
}

.method-row:hover {
  border-color: #cbd5e1;
  background: #fafafa;
}

.default-row {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.default-row:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.payment-icon {
  font-size: 1.75rem;
}

.method-info {
  flex: 1;
}

.method-label {
  font-weight: 600;
  color: #1e293b;
}

.method-details {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.15rem;
}

.badge-small {
  margin-top: 0.35rem;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
}

.method-actions {
  display: flex;
  gap: 0.5rem;
}

.form-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.label-bold {
  font-size: 0.85rem;
  font-weight: 600;
  color: #475569;
}

.payment-types-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  margin-top: 0.25rem;
}

@media (min-width: 480px) {
  .payment-types-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

.payment-type-btn {
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 0.5rem;
  height: 70px;
}

.payment-type-icon {
  font-size: 1.25rem;
}

.payment-type-label {
  font-size: 0.75rem;
  font-weight: 600;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  margin-top: 0.25rem;
  user-select: none;
}

.checkbox-input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.mark-default-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
}

.alert {
  padding: 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
}

.error-box {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.submit-btn {
  font-weight: 700;
}

.spinner {
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 0.8s linear infinite;
}

.spinner-lg {
  width: 36px;
  height: 36px;
  border-width: 3px;
}

.spinner-sm {
  width: 18px;
  height: 18px;
  border-width: 2px;
  border-top-color: white;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mb-6 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 1rem; }
/* Pending payout card */
.pending-payout-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border: 2px solid #93c5fd;
  border-radius: 1rem;
  flex-wrap: wrap;
}
.pending-info { display: flex; align-items: center; gap: 1rem; }
.pending-icon { font-size: 2.5rem; }
.pending-label { font-size: 0.875rem; color: #64748b; font-weight: 600; }
.pending-amount { font-size: 1.875rem; font-weight: 800; color: #2563eb; margin: 0.125rem 0; }
.pending-detail { font-size: 0.8125rem; color: #475569; }

.spinner-sm { width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 0.375rem; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .pending-payout-card { flex-direction: column; align-items: stretch; text-align: center; }
  .pending-info { justify-content: center; }
}
</style>
