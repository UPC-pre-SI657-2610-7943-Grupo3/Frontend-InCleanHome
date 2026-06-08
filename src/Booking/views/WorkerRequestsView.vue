<template>
  <div class="view-container">
    <h1 class="page-title mb-6">{{ t('nav.requests') }}</h1>

    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>

    <div v-else-if="!bookings.length" class="card empty-state">
      <div class="empty-illustration">📋</div>
      <p class="empty-text">Sin solicitudes de servicio</p>
    </div>

    <div v-else class="booking-list">
      <!-- Tabs -->
      <div class="tabs-container">
        <button v-for="tab in tabs" :key="tab.value" @click="activeTab = tab.value"
          :class="['btn btn-sm', activeTab === tab.value ? 'btn-primary' : 'btn-secondary']">
          {{ t(tab.label) }} <span v-if="tabCount(tab.value)" class="tab-badge" :class="activeTab === tab.value ? 'badge-active' : 'badge-inactive'">{{ tabCount(tab.value) }}</span>
        </button>
      </div>

      <div v-for="b in filteredBookings" :key="b.id" class="card">
        <div class="booking-header">
          <div class="client-info">
            <div class="avatar-sm avatar-aqua" :style="b.clientPhotoUrl ? 'padding:0;overflow:hidden;' : ''">
              <img v-if="b.clientPhotoUrl" :src="b.clientPhotoUrl" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
              <span v-else class="avatar-initial">{{ (b.clientName || 'C')[0] }}</span>
            </div>
            <div>
              <div class="client-name">{{ b.clientName }}</div>
              <div class="client-service">{{ t(`worker.services.${b.serviceType}`) }}</div>
            </div>
          </div>
          <span :class="statusBadge(b.status)">{{ t(`booking.status.${b.status}`) }}</span>
        </div>

        <div class="meta-row">
          <span class="meta-item">📅 {{ b.date }}</span>
          <span class="meta-item">⏰ {{ b.startTime }} – {{ b.endTime }} ({{ b.hours }}h)</span>
          <span class="meta-item">📍 {{ b.address }}</span>
        </div>

        <div v-if="b.notes" class="notes-box">
          💬 {{ b.notes }}
        </div>

        <div class="card-footer">
          <div>
            <span class="earning-label">{{ t('common.profit') }}: </span>
            <span class="earning-amount">S/. {{ b.workerEarning }}</span>
            <span class="total-amount">(total S/. {{ b.totalAmount }})</span>
          </div>
          <div v-if="b.status === 'completed'" class="payment-status-wrap">
            <span :class="['payment-badge', b.isPaid ? 'paid' : 'unpaid']">
              {{ b.isPaid ? '✅ Servicio Pagado' : '⏳ Servicio No Pagado' }}
            </span>
          </div>
          <div class="action-buttons" v-if="b.status === 'pending'">
            <button @click="updateStatus(b.id, 'rejected')" class="btn btn-danger btn-sm">{{ t('common.reject') }}</button>
            <button @click="updateStatus(b.id, 'accepted')" class="btn btn-success btn-sm">{{ t('common.accept') }}</button>
          </div>
          <div class="action-buttons" v-else-if="b.status === 'accepted'">
            <button @click="rescheduleB = b" class="btn btn-outline btn-sm">🗓 {{ t('common.reschedule') }} </button>
            <button @click="openCancel(b)" class="btn btn-danger btn-sm">{{ t('common.cancel') }}</button>
            <button @click="updateStatus(b.id, 'completed')" class="btn btn-success btn-sm">✅ {{ t('common.complete') }}</button>
            <router-link :to="{ path: `/worker/messages/${b.clientId}`, query: { name: b.clientName } }" class="btn btn-secondary btn-sm">💬 {{ t('common.message') }}</router-link>
          </div>
          <!-- Completadas: sin botones de acción. El cobro se solicita desde /worker/payments,
               el comprobante se ve desde /worker/history. -->
        </div>
      </div>
    </div>

    <!-- Cancellation policy modal (worker: 7 business days) -->
    <div v-if="cancelB" class="modal-overlay" @click.self="cancelB = null">
      <div class="modal-box">
        <h3 class="modal-title">{{ t('booking.cancelTitle') }}</h3>
        <p class="policy-text">{{ t('booking.cancelPolicyWorker') }}</p>
        <div v-if="isLateCancel(cancelB)" class="late-warning">{{ t('booking.cancelLateWarning') }}</div>
        <div class="modal-actions mt-3">
          <button @click="cancelB = null" class="btn btn-secondary flex-1">{{ t('booking.keepBooking') }}</button>
          <button @click="confirmCancel" class="btn btn-danger flex-1">{{ t('booking.confirmCancel') }}</button>
        </div>
      </div>
    </div>

    <!-- Reschedule modal -->
    <RescheduleModal v-if="rescheduleB" :booking="rescheduleB" @close="rescheduleB = null" @rescheduled="onRescheduled" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";
import RescheduleModal from "../../Shared/components/RescheduleModal.vue";

const { t } = useI18n();
const toast = useToastStore();
const auth = useAuthStore();
const bookings = ref([]);
const loading = ref(true);
const activeTab = ref("pending");
const rescheduleB = ref(null);
const cancelB = ref(null);

async function onRescheduled() {
  toast.success("Reserva reprogramada. Pendiente de confirmación del cliente.");
  await load();
}

const tabs = [
  { value: "pending", label: "common.pending" },
  { value: "accepted", label: "common.accepted" },
  { value: "completed", label: "common.completed" },
  { value: "all", label: "common.all" },
];

const filteredBookings = computed(() =>
  activeTab.value === "all" ? bookings.value : bookings.value.filter(b => b.status === activeTab.value)
);
const tabCount = (tab) => tab === "all" ? bookings.value.length : bookings.value.filter(b => b.status === tab).length;

function statusBadge(s) {
  return { pending:"badge badge-yellow", accepted:"badge badge-blue", completed:"badge badge-green", rejected:"badge badge-red", cancelled:"badge badge-gray" }[s] || "badge badge-gray";
}

// Cuenta días hábiles (lun-vie) hasta la fecha del servicio.
function businessDaysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (target <= today) return 0;
  let count = 0;
  const cur = new Date(today);
  while (cur < target) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
// Política trabajadora: cancelación tardía si quedan menos de 7 días hábiles.
function isLateCancel(b) { return businessDaysUntil(b.date) < 7; }
function openCancel(b) { cancelB.value = b; }

async function confirmCancel() {
  const id = cancelB.value.id;
  try {
    await api.patch(`/bookings/${id}/status`, { status: "cancelled" });
    toast.success("Reserva cancelada");
    if (isLateCancel(cancelB.value)) {
      toast.error("⚠️ Tu cuenta ha sido suspendida temporalmente por cancelación tardía (7 días hábiles).");
      await auth.refreshUser(); // Refresh suspension status
    }
  } catch (e) {
    toast.success("Reserva cancelada");
  } finally {
    cancelB.value = null;
    await load();
  }
}

async function updateStatus(id, status) {
  await api.patch(`/bookings/${id}/status`, { status });
  toast.success(status === "accepted" ? "Reserva aceptada" : status === "completed" ? "Servicio completado" : "Reserva rechazada");
  await load();
}

async function load(showSpinner = true) {
  if (showSpinner) loading.value = true;
  try {
    const { data } = await api.get("/bookings");
    bookings.value = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } finally {
    if (showSpinner) loading.value = false;
  }
}

// Refresh silencioso cada 10s. Evita "no veo la reserva nueva hasta que recargo".
// El spinner solo se muestra en la carga inicial; los refrescos no parpadean la UI.
// Se pausa cuando la pestaña no está visible para no gastar requests inútiles.
let pollHandle = null;
function startPolling() {
  if (pollHandle) return;
  pollHandle = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    load(false).catch(() => { /* silencioso */ });
  }, 10000);
}
function stopPolling() {
  if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
}
function onVisibilityChange() {
  if (typeof document === "undefined") return;
  if (!document.hidden) load(false).catch(() => {});
}

onMounted(() => {
  load(true);
  startPolling();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  stopPolling();
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped>
.view-container {
  max-width: 1024px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #0f172a;
}
.mb-6 { margin-bottom: 1.5rem; }

.loader-wrapper {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.empty-state {
  text-align: center;
  padding: 4rem 0;
}
.empty-illustration { font-size: 3rem; margin-bottom: 1rem; }
.empty-text { color: #64748b; }

.booking-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tabs-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1rem 0.4rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.25rem;
}
.badge-active { background:white; color:#2563eb; }
.badge-inactive { background:#e2e8f0; color:#475569; }

.booking-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.client-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.avatar-sm { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.avatar-aqua { background:#06b6d4; }
.avatar-initial { color:white; font-size:0.875rem; font-weight:700; }
.client-name { font-weight:700; color:#1e293b; }
.client-service { font-size:0.8125rem; color:#64748b; }

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #64748b;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.notes-box { 
  margin-top:0.75rem; 
  font-size:0.875rem; 
  color:#475569; 
  background:#f8fafc; 
  padding:0.75rem; 
  border-radius:0.5rem; 
  border: 1px solid #e2e8f0;
}

.card-footer { 
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top:1px solid #f1f5f9; 
  margin-top:0.875rem; 
  padding-top:0.875rem; 
}
.earning-label { font-size:0.8125rem; color:#64748b; }
.earning-amount { font-weight:700; color:#10b981; margin-left:0.25rem; }
.total-amount { font-size:0.75rem; color:#94a3b8; margin-left:0.25rem; }

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-box { background: white; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 420px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
.modal-title { font-weight: 700; color: #1e293b; font-size: 1.25rem; }
.policy-text { font-size: 0.875rem; color: #64748b; line-height: 1.4; margin-top: 0.5rem; }
.late-warning { margin-top: 0.75rem; padding: 0.625rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 0.5rem; font-size: 0.8125rem; }
.modal-actions { display: flex; gap: 0.75rem; }
.flex-1 { flex: 1; }
.mt-3 { margin-top: 0.75rem; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }

@keyframes spin { to { transform: rotate(360deg); } }

.payment-status-wrap { display: flex; align-items: center; }
.payment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 600;
  font-size: 0.8125rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  cursor: not-allowed;
  pointer-events: none;
  user-select: none;
}
.payment-badge.paid {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}
.payment-badge.unpaid {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
}
</style>
