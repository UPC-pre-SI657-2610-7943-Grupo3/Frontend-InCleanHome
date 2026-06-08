<template>
  <div class="view-container">
    <div class="dashboard-header mb-6">
      <div>
        <h1 class="page-title">{{ t('dashboard.title') }}</h1>
        <p class="page-subtitle">{{ t('search.greeting') }} {{ auth.user?.name?.split(' ')[0] }} 👋</p>
      </div>
    </div>

    <!-- Banner: cuenta en revisión (pendiente de aprobación admin) -->
    <div v-if="auth.isPendingApproval" class="pending-banner">
      ⏳ <strong>Cuenta en revisión</strong> — Tu perfil aún no ha sido aprobado por el administrador. No aparecerás en búsquedas ni podrás recibir reservas hasta que seas aprobada.
    </div>

    <!-- Banner: cuenta suspendida -->
    <div v-if="auth.isSuspended" class="suspension-banner">
      🚫 <strong>Cuenta suspendida</strong> — Tu cuenta está temporalmente suspendida.
      <div v-if="auth.suspendedUntil" class="suspension-until">Hasta: {{ formatSuspendedUntil(auth.suspendedUntil) }}</div>
      <div v-if="auth.suspensionReason" class="suspension-reason">Motivo: {{ auth.suspensionReason }}</div>
    </div>

    <!-- Banner: cuenta reportada -->
    <div v-if="hasReport" class="report-banner">
      ⚠️ <strong>Cuenta reportada</strong> — Tu cuenta ha recibido un reporte. El equipo de administración lo revisará.
    </div>

    <!-- Banner: sin disponibilidad configurada -->
    <div v-if="!loading && !hasAvailability" class="availability-banner">
      📅 <strong>Configura tu disponibilidad</strong> — Aún no tienes horarios configurados. Los clientes no podrán reservar tus servicios hasta que configures tu disponibilidad en la sección
      <router-link to="/worker/availability" class="avail-link">Disponibilidad</router-link>.
    </div>

    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>

    <template v-else>
      <!-- Stats cards -->
      <div class="stats-grid mb-6">
        <div class="card stat-card">
          <div class="stat-icon stat-blue">💰</div>
          <div class="stat-value">S/. {{ adjustedNetEarnings.toFixed(2) }}</div>
          <div class="stat-label">{{ t('dashboard.netEarnings') }}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon stat-red">📊</div>
          <div class="stat-value">S/. {{ adjustedPlatformFee.toFixed(2) }}</div>
          <div class="stat-label">{{ t('dashboard.platformFee') }}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon stat-green">✅</div>
          <div class="stat-value">{{ adjustedCompletedServices }}</div>
          <div class="stat-label">{{ t('dashboard.completedServices') }}</div>
        </div>
        <div class="card stat-card">
          <div class="stat-icon stat-yellow">⭐</div>
          <div class="stat-value">{{ (stats.averageRating || 0).toFixed(1) }}</div>
          <div class="stat-label">{{ t('dashboard.averageRating') }}</div>
        </div>
      </div>

      <div class="content-grid">
        <!-- Monthly earnings chart -->
        <div class="card">
          <h3 class="section-title">{{ t('dashboard.monthlyEarnings') }}</h3>
          <div v-if="!adjustedMonthlyEarnings.length" class="empty-msg">Sin datos aún</div>
          <div v-else class="chart">
            <div v-for="m in adjustedMonthlyEarnings.slice(-6)" :key="m.month" class="chart-bar-wrap">
              <div class="chart-bar-outer">
                <div class="chart-bar" :style="{ height: (m.earnings / maxEarning * 100) + '%', background: '#2563eb' }"></div>
              </div>
              <span class="chart-label">{{ m.month.slice(5) }}</span>
              <span class="chart-val">S/. {{ m.earnings.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Recent bookings -->
        <div class="card">
          <h3 class="section-title">{{ t('dashboard.recentBookings') }}</h3>
          <div v-if="!bookings.length" class="empty-msg">{{ t('dashboard.noBookings') }}</div>
          <div v-else class="bookings-list">
            <div v-for="b in bookings.slice(0,5)" :key="b.id" class="booking-row">
              <div class="booking-info">
                <div class="booking-name">{{ b.clientName }}</div>
                <div class="booking-meta">{{ t(`worker.services.${b.serviceType}`) }} · {{ b.date }}</div>
              </div>
              <div class="booking-actions">
                <div class="booking-amount">S/. {{ b.workerEarning?.toFixed(0) }}</div>
                <span :class="statusBadge(b.status)">{{ t(`booking.status.${b.status}`) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { useRoute } from "vue-router";
import api from "../../Shared/api.js";
import { formatSuspendedUntil } from "../../Shared/utils/suspension.js";
import { getMyWorkerBalance } from "../../Shared/services/paymentApi.js";

const { t } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const stats = ref({});
const bookings = ref([]);
const loading = ref(true);
const hasReport = ref(false);
const hasAvailability = ref(true);

// Balance del backend (reemplaza la lógica adjusted* basada en localStorage).
const balance = ref({
  totalEarnings: 0,
  platformFeeTotal: 0,
  netEarnings: 0,
  pendingPayout: 0,
  pendingPayoutCount: 0,
  completedServices: 0,
});

async function checkAvailability() {
  try {
    const userId = auth.user?.id;
    if (!userId) { hasAvailability.value = false; return; }
    const { data } = await api.get(`/workers/${userId}/availability`);
    hasAvailability.value = Array.isArray(data) && data.some(s => s.isAvailable);
  } catch { hasAvailability.value = false; }
}

watch(() => route.path, (path) => {
  if (path === "/worker/dashboard") checkAvailability();
});

if (typeof window !== "undefined") {
  window.addEventListener("inclean-availability-saved", checkAvailability);
}

// ── Computeds que ahora leen del balance del backend ─────────────────────
// netEarnings: ganancias acumuladas del worker (después de comisión, todos los canales).
// platformFee: comisión total cobrada por la plataforma (10% de los no-cash).
// completedServices: cantidad de servicios pagados.
//
// Estas 3 reflejan lo que YA fue cobrado por el cliente. Los servicios completados
// pero aún no pagados NO suman acá — solo aparecen como "Reservas recientes" abajo.
const adjustedNetEarnings = computed(() => balance.value.netEarnings || 0);
const adjustedPlatformFee = computed(() => balance.value.platformFeeTotal || 0);
const adjustedCompletedServices = computed(() => balance.value.completedServices || 0);

// monthlyEarnings sigue viniendo de /workers/me/stats; queda como está.
// (Sería más correcto recalcular del backend, pero es solo el gráfico — no afecta lógica.)
const adjustedMonthlyEarnings = computed(() => stats.value.monthlyEarnings || []);

const maxEarning = computed(() => Math.max(...adjustedMonthlyEarnings.value.map(m => m.earnings), 1));

function statusBadge(s) {
  const map = { pending:'badge badge-yellow', accepted:'badge badge-blue', completed:'badge badge-green', rejected:'badge badge-red', cancelled:'badge badge-gray' };
  return map[s] || 'badge badge-gray';
}

// Carga inicial + refrescos posteriores. showSpinner=true solo en la carga inicial;
// los refrescos silenciosos no parpadean la UI.
async function refreshAll(showSpinner = false) {
  try {
    const [s, b, bal] = await Promise.all([
      api.get("/workers/me/stats"),
      api.get("/bookings"),
      getMyWorkerBalance().catch(() => null),
    ]);
    stats.value = s.data;
    bookings.value = b.data;
    if (bal) balance.value = bal;
    try {
      const { data } = await api.get("/reports/my");
      hasReport.value = data && data.some(r => r.status === "open" || r.status === "confirmed");
    } catch { hasReport.value = false; }
    // Sync user payload (rating del worker, suspensión, documentsRejected, etc.).
    try { await auth.refreshUser(); } catch { /* no-op */ }
    // Verificar si tiene disponibilidad configurada
    await checkAvailability();
  } catch { /* silencioso para no romper polling */ } finally {
    if (showSpinner) loading.value = false;
  }
}

// Polling silencioso cada 15s. Cubre el caso en que un cliente deja una review,
// completa un pago, o el admin cambia algo desde otra cuenta — la trabajadora ve
// los cambios reflejados sin recargar ni cambiar de ruta. Se pausa cuando la
// pestaña no está visible.
let pollHandle = null;
function startPolling() {
  if (pollHandle) return;
  pollHandle = setInterval(() => {
    if (typeof document !== "undefined" && document.hidden) return;
    refreshAll(false);
  }, 15000);
}
function stopPolling() {
  if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
}
function onVisibilityChange() {
  if (typeof document === "undefined") return;
  if (!document.hidden) refreshAll(false);
}

onMounted(() => {
  refreshAll(true);
  startPolling();
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  stopPolling();
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped>
.view-container { max-width: 1280px; margin: 0 auto; }

.dashboard-header { display: flex; align-items: center; justify-content: space-between; }
.mb-6 { margin-bottom: 1.5rem; }

.page-title { font-size: 1.875rem; font-weight: 800; color: #0f172a; margin-bottom: 0.25rem; }
.page-subtitle { color: #64748b; font-size: 1.125rem; }

.loader-wrapper { display: flex; justify-content: center; padding: 4rem 0; }

.stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
@media (min-width: 1024px) { .stats-grid { grid-template-columns: repeat(4, 1fr); } }

.stat-card { text-align: center; padding: 1.5rem; transition: transform 0.2s; }
.stat-card:hover { transform: translateY(-4px); }

.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin: 0 auto 0.75rem; }
.stat-blue { background: #dbeafe; color: #2563eb; }
.stat-red { background: #fee2e2; color: #ef4444; }
.stat-green { background: #d1fae5; color: #10b981; }
.stat-yellow { background: #fef3c7; color: #f59e0b; }

.stat-value { font-size: 1.75rem; font-weight: 800; color: #1e293b; line-height: 1.2; }
.stat-label { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; font-weight: 500; }

.content-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
@media (min-width: 1024px) { .content-grid { grid-template-columns: repeat(2, 1fr); } }

.section-title { font-weight: 700; font-size: 1.125rem; color: #1e293b; margin-bottom: 1.25rem; }

.chart { display: flex; gap: 0.75rem; align-items: flex-end; height: 160px; padding-top: 1rem; }
.chart-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.chart-bar-outer { flex: 1; width: 100%; display: flex; align-items: flex-end; background: #f1f5f9; border-radius: 6px 6px 0 0; }
.chart-bar { width: 100%; min-height: 4px; border-radius: 6px 6px 0 0; transition: height 0.5s ease-out; }
.chart-label { font-size: 0.75rem; font-weight: 600; color: #64748b; }
.chart-val { font-size: 0.6875rem; color: #94a3b8; }

.empty-msg { color: #94a3b8; font-size: 0.875rem; text-align: center; padding: 3rem 0; }

.bookings-list { display: flex; flex-direction: column; gap: 0.75rem; }

.booking-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; transition: border-color 0.2s; }
.booking-row:hover { border-color: #cbd5e1; }

.booking-info { flex: 1; min-width: 0; }
.booking-name { font-weight: 700; font-size: 1rem; color: #1e293b; margin-bottom: 0.125rem; }
.booking-meta { font-size: 0.8125rem; color: #64748b; }

.booking-actions { text-align: right; }
.booking-amount { font-weight: 800; color: #2563eb; margin-bottom: 0.25rem; font-size: 1rem; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-lg { width: 36px; height: 36px; }

.suspension-banner { background: #fee2e2; color: #991b1b; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.25rem; font-weight: 600; border-left: 4px solid #dc2626; }
.suspension-until { font-weight: 500; font-size: 0.875rem; margin-top: 0.25rem; }
.suspension-reason { font-weight: 400; font-size: 0.8125rem; color: #7f1d1d; margin-top: 0.25rem; font-style: italic; }
.report-banner { background: #fef3c7; color: #92400e; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.25rem; font-weight: 600; border-left: 4px solid #f59e0b; }
.pending-banner { background: #ede9fe; color: #5b21b6; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.25rem; font-weight: 600; border-left: 4px solid #7c3aed; line-height: 1.5; }
.availability-banner { background: #e0f2fe; color: #075985; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.25rem; font-weight: 600; border-left: 4px solid #0284c7; line-height: 1.5; }
.avail-link { color: #0284c7; text-decoration: underline; font-weight: 700; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
