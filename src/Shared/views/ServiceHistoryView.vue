<template>
  <div class="view-container">
    <div class="history-header">
      <h1 class="page-title">{{ t('history.title') }}</h1>
      <p class="page-subtitle">{{ t('history.subtitle') }}</p>
    </div>

    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.value"
        @click="activeTab = tab.value"
        :class="['tab-btn', activeTab === tab.value ? 'tab-active' : '']">
        {{ t(`history.${tab.value}`) }} ({{ tabCount(tab.value) }})
      </button>
    </div>

    <div v-if="loading" class="center-pad"><div class="spinner"></div></div>

    <div v-else-if="!filtered.length" class="card empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-text">{{ t('history.empty') }}</p>
    </div>

    <div v-else class="history-list">
      <div v-for="b in filtered" :key="b.id" class="card history-card">
        <div class="hc-main">
          <div class="hc-avatar" :style="otherPhoto(b) ? 'padding:0;overflow:hidden;' : ''">
            <img v-if="otherPhoto(b)" :src="otherPhoto(b)" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
            <template v-else>{{ initials(otherName(b)) }}</template>
          </div>
          <div class="hc-info">
            <div class="hc-name">{{ otherName(b) }}</div>
            <div class="hc-service">{{ serviceLabel(b.serviceType) }}</div>
            <div class="hc-date">📅 {{ b.date }} · {{ b.startTime }}–{{ b.endTime }}</div>
          </div>
        </div>
        <div class="hc-right">
          <span :class="statusBadge(b.status)">{{ t(`booking.status.${b.status}`) }}</span>
          <div class="hc-amount">S/. {{ num(b.totalAmount) }}</div>
          <button v-if="b.status === 'completed' && isPaid(b.id)" @click="openReceipt(b)" class="link-btn">{{ t('booking.viewReceipt') }}</button>
        </div>
      </div>
    </div>

    <ReceiptModal v-if="receiptBooking" :booking="receiptBooking" :payment="receiptPayment" :show-worker-net="isWorker" @close="closeReceipt" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "../api.js";
import { useAuthStore } from "../stores/auth.js";
import { fetchPaymentsForBookings } from "../services/paymentApi.js";
import ReceiptModal from "../components/ReceiptModal.vue";

const { t } = useI18n();
const auth = useAuthStore();
const bookings = ref([]);
const loading = ref(true);
const activeTab = ref("all");
const receiptBooking = ref(null);
const receiptPayment = ref(null);

// Map { bookingId -> ServicePayment | null }
const paymentsMap = ref(new Map());
function isPaid(id) { return paymentsMap.value.get(id) != null; }

const isWorker = computed(() => auth.user?.role === "worker");
const tabs = [{ value: "all" }, { value: "completed" }, { value: "cancelled" }];

const closed = computed(() => bookings.value.filter((b) => ["completed", "cancelled"].includes(b.status)));
const filtered = computed(() =>
  activeTab.value === "all" ? closed.value : closed.value.filter((b) => b.status === activeTab.value)
);
const tabCount = (tab) => (tab === "all" ? closed.value.length : closed.value.filter((b) => b.status === tab).length);

function otherName(b) { return isWorker.value ? b.clientName : b.workerName; }
function otherPhoto(b) { return isWorker.value ? b.clientPhotoUrl : b.workerPhotoUrl; }
function initials(name) { return (name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(); }
function num(v) { return (Number(v) || 0).toFixed(2); }
function serviceLabel(s) { const k = `worker.services.${s}`; const tr = t(k); return tr === k ? s : tr; }
function statusBadge(s) {
  return { completed: "badge badge-green", cancelled: "badge badge-gray" }[s] || "badge badge-gray";
}

function openReceipt(b) {
  receiptBooking.value = b;
  receiptPayment.value = paymentsMap.value.get(b.id);
}
function closeReceipt() {
  receiptBooking.value = null;
  receiptPayment.value = null;
}

async function load() {
  loading.value = true;
  const { data } = await api.get("/bookings");
  bookings.value = (data || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // Cargar pagos de los completed para saber cuáles tienen comprobante.
  const completedIds = bookings.value
    .filter((b) => b.status === "completed")
    .map((b) => b.id);
  if (completedIds.length > 0) {
    paymentsMap.value = await fetchPaymentsForBookings(completedIds);
  }
  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.view-container { max-width: 900px; margin: 0 auto; padding: 1.5rem 1rem; }
.history-header { margin-bottom: 1.25rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
.page-subtitle { color: #64748b; font-size: 0.9375rem; margin-top: 0.25rem; }
.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
.tab-btn { padding: 0.5rem 1rem; border-radius: 9999px; border: 1px solid #e2e8f0; background: white; color: #64748b; font-size: 0.875rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.tab-btn:hover { border-color: #cbd5e1; }
.tab-active { background: #2563eb; border-color: #2563eb; color: white; }
.center-pad { display: flex; justify-content: center; padding: 3rem; }
.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:32px; height:32px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 3rem 1.5rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty-text { color: #64748b; }
.history-list { display: flex; flex-direction: column; gap: 0.75rem; }
.history-card { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; gap: 1rem; }
.hc-main { display: flex; align-items: center; gap: 0.875rem; min-width: 0; }
.hc-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#2563eb,#06b6d4); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; }
.hc-info { min-width: 0; }
.hc-name { font-weight: 600; color: #1e293b; }
.hc-service { font-size: 0.8125rem; color: #64748b; }
.hc-date { font-size: 0.8125rem; color: #94a3b8; margin-top: 0.2rem; }
.hc-right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.3rem; flex-shrink: 0; }
.badge { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background:#d1fae5; color:#065f46; } .badge-gray { background:#f1f5f9; color:#475569; }
.hc-amount { font-weight: 700; color: #1e293b; }
.link-btn { background: none; border: none; color: #2563eb; font-size: 0.8125rem; font-weight: 500; cursor: pointer; padding: 0; }
.link-btn:hover { text-decoration: underline; }
@media (max-width: 560px) {
  .history-card { flex-direction: column; align-items: flex-start; }
  .hc-right { align-items: flex-start; width: 100%; flex-direction: row; justify-content: space-between; }
}
</style>
