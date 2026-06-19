<template>
  <div class="view-container">
    <h1 class="page-title mb-6">{{ t('nav.bookings') }}</h1>

    <!-- Show loading spinner -->
    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>

    <!-- Empty state if no bookings -->
    <div v-else-if="!bookings.length" class="card empty-state">
      <div class="empty-illustration">📅</div>
      <p class="empty-text">{{ t('dashboard.noBookings') }}</p>
      <router-link to="/client/search" class="btn btn-primary submit-btn">Buscar trabajadores</router-link>
    </div>

    <!-- Display booking list -->
    <div v-else class="booking-list">
      <div v-for="b in bookings" :key="b.id" class="card">
        <!-- Booking header with worker info and status -->
        <div class="booking-header">
          <div class="worker-info">
            <div class="worker-avatar-sm avatar-blue" :style="b.workerPhotoUrl ? 'padding:0;overflow:hidden;' : ''">
              <img v-if="b.workerPhotoUrl" :src="b.workerPhotoUrl" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
              <span v-else class="avatar-initial">{{ (b.workerName || 'W')[0] }}</span>
            </div>
            <div>
              <div class="worker-name">{{ b.workerName }}</div>
              <!-- Soporta tanto la lista nueva `serviceTypes` como el campo
                   legacy `serviceType` (reservas antiguas con un solo servicio). -->
              <div class="worker-service">{{ formatServices(b) }}</div>
            </div>
          </div>
          <!-- Status badge -->
          <span :class="statusBadge(b.status)">{{ t(`booking.status.${b.status}`) }}</span>
        </div>

        <!-- Booking details: date, time, address -->
        <div class="meta-row">
          <span class="meta-item">📅 {{ b.date }}</span>
          <span class="meta-item">⏰ {{ b.startTime }} – {{ b.endTime }}</span>
          <span class="meta-item">📍 {{ b.address?.slice(0,30) }}...</span>
        </div>

        <!-- Footer with total and action buttons -->
        <div class="card-footer">
          <div>
            <span class="total-label">Total: </span>
            <span class="total-amount">S/. {{ b.totalAmount }}</span>
          </div>
          <div class="action-buttons">
            <!-- Recibo de Pago: visible para reservas completadas y pagadas. -->
            <button v-if="b.status === 'completed' && isPaid(b.id)" @click="openReceipt(b)" class="btn btn-outline btn-sm">🧾 {{ t('booking.viewReceipt') }}</button>
            <!-- Rating button if completed and not reviewed -->
            <button v-if="b.status === 'completed' && !b._reviewed" @click="openReview(b)" class="btn btn-outline btn-sm">⭐ {{ t('common.qualify') }} </button>
            <!-- Pay / Paid flow -->
            <template v-if="b.status === 'completed'">
              <!-- Already paid: green badge -->
              <span v-if="isPaid(b.id)" class="badge badge-green">💰 {{ t('workerPayments.paid') }}</span>
              <!-- Not paid yet: shows "Pagar Servicio" button (opens MercadoPagoPaymentModal for mercadopago, manual modal otherwise) -->
              <button v-else @click="openPayModal(b)" class="btn btn-primary btn-sm">💵 {{ t('workerPayments.payTitle') }}</button>
            </template>
            <!-- Report worker -->
            <button @click="reportTarget = { id: b.workerId, name: b.workerName }" class="btn btn-ghost btn-sm">⚐ {{ t('booking.report') }}</button>
            <!-- Reschedule / Cancel (only pending or accepted) -->
            <button v-if="['pending','accepted'].includes(b.status)" @click="rescheduleB = b" class="btn btn-outline btn-sm">🗓 {{ t('common.reschedule') }} </button>
            <button v-if="['pending','accepted'].includes(b.status)" @click="openCancel(b)" class="btn btn-danger btn-sm">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Review modal overlay -->
    <div v-if="reviewBooking" class="modal-overlay" @click.self="reviewBooking = null">
      <div class="modal-box">
        <h3 class="card-title">Calificar servicio</h3>
        <p class="muted-text mb-3">{{ reviewBooking.workerName }}</p>
        <div class="rating-container">
          <button v-for="i in 5" :key="i" @click="reviewForm.rating = i" class="rating-btn" :style="{ opacity: i <= reviewForm.rating ? 1 : 0.3 }">⭐</button>
        </div>
        <textarea v-model="reviewForm.comment" class="input-field mb-4" rows="3" placeholder="Escribe tu reseña..."></textarea>
        <div class="modal-actions">
          <button @click="reviewBooking = null" class="btn btn-secondary flex-1">{{ t('common.cancel') }}</button>
          <button @click="submitReview" class="btn btn-primary flex-1" :disabled="!reviewForm.rating">Enviar</button>
        </div>
      </div>
    </div>

    <!-- Cancellation policy modal -->
    <div v-if="cancelB" class="modal-overlay" @click.self="cancelB = null">
      <div class="modal-box">
        <h3 class="card-title">{{ t('booking.cancelTitle') }}</h3>
        <p class="policy-text">{{ t('booking.cancelPolicyClient') }}</p>
        <div v-if="isLateCancel(cancelB)" class="late-warning">{{ t('booking.cancelLateWarning') }}</div>
        <textarea v-model="cancelReason" class="input-field mt-3 no-resize" rows="2" :placeholder="t('booking.cancelReason')"></textarea>
        <div class="modal-actions mt-3">
          <button @click="cancelB = null" class="btn btn-secondary flex-1">{{ t('booking.keepBooking') }}</button>
          <button @click="confirmCancel" class="btn btn-danger flex-1">{{ t('booking.confirmCancel') }}</button>
        </div>
      </div>
    </div>

    <!-- Manual pay modal (yape/plin/bank) — pops when channel is NOT the gateway. -->
    <div v-if="payB && payChannel !== 'mercadopago'" class="modal-overlay" @click.self="payB = null">
      <div class="modal-box shadow-sm" style="border:1px solid #e2e8f0; max-width:440px;">
        <h3 class="card-title mb-2">💵 {{ t('workerPayments.payTitle') }}</h3>
        <p class="muted-text mb-4">{{ t('workerPayments.paySubtitle') }}</p>

        <div v-if="loadingPayoutMethods" class="loader-wrapper" style="padding:1.5rem 0;">
          <div class="spinner"></div>
        </div>

        <div v-else>
          <!-- Summary card -->
          <div class="card summary-card mb-4" style="background:#f8fafc; border-color:#e2e8f0; padding:1rem; border-radius:0.75rem; box-shadow:none;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.875rem;">
              <span class="muted-text">Trabajadora:</span>
              <span style="font-weight:700; color:#1e293b;">{{ payB.workerName }}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.875rem;">
              <span class="muted-text">Servicio:</span>
              <span style="font-weight:600; color:#475569;">{{ formatServices(payB) }}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.875rem;">
              <span class="muted-text">Método elegido:</span>
              <span style="font-weight:600; color:#475569;">{{ paymentIcon(payChannel) }} {{ channelLabel(payChannel) }}</span>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:0.5rem; border-top:1px dashed #cbd5e1; padding-top:0.5rem; font-size:1rem;">
              <span class="muted-text" style="font-weight:600;">Monto Total a Transferir:</span>
              <span style="font-weight:800; color:#2563eb;">S/. {{ payB.totalAmount }}</span>
            </div>
          </div>

          <!-- Worker payout methods preview (informational only). Para flujos
               manuales el cliente debe saber a qué número Yape/Plin o cuenta
               bancaria depositar. -->
          <div class="mb-4">
            <label class="label-bold" style="display:block; margin-bottom:0.5rem; font-size:0.85rem; font-weight:600; color:#475569;">Cuentas de la Trabajadora:</label>

            <div v-if="workerPayoutMethods.length === 0" class="alert error-box" style="background:#fffbeb; color:#b45309; border-color:#fef3c7; font-size:0.8125rem; line-height:1.4; padding:0.75rem; margin-top:0.5rem;">
              ⚠️ {{ t('workerPayments.noPayoutMethods') }}
            </div>

            <div v-else class="flex-col gap-2" style="display:flex; flex-direction:column; gap:0.5rem;">
              <div v-for="pm in workerPayoutMethods" :key="pm.id"
                class="payment-option" style="cursor:default; border-color:#e2e8f0; padding:0.75rem; display:flex; align-items:center; gap:0.75rem; border:1.5px solid #e2e8f0; border-radius:0.75rem;"
                :class="{ 'selected': pm.isDefault }"
                :style="pm.isDefault ? 'border-color:#3b82f6; background:#eff6ff;' : ''">
                <span class="payment-icon" style="font-size:1.5rem;">{{ paymentIcon(pm.type) }}</span>
                <div class="pm-info-text" style="flex:1;">
                  <div class="pm-label" style="font-weight:700; font-size:0.875rem; color:#1e293b;">{{ pm.label }}</div>
                  <div v-if="pm.details" class="pm-details" style="font-size:0.75rem; color:#64748b; margin-top:0.1rem;">{{ pm.details }}</div>
                </div>
                <span v-if="pm.isDefault" class="badge badge-blue" style="font-size:0.65rem; padding:0.1rem 0.4rem;">Preferido</span>
              </div>
            </div>
          </div>

          <!-- Checkout actions -->
          <div class="modal-actions">
            <button @click="payB = null" class="btn btn-secondary flex-1" :disabled="payingManual">{{ t('common.cancel') }}</button>
            <button @click="confirmManualPay" class="btn btn-primary flex-1" :disabled="payingManual">
              <span v-if="payingManual" class="spinner spinner-sm"></span>
              {{ t('workerPayments.confirmPay') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mercado Pago modal — pops when channel IS mercadopago. Redirige al
         checkout de MP. Al volver, PaymentSuccessView confirma el pago. -->
    <MercadoPagoPaymentModal
      v-if="payB && payChannel === 'mercadopago'"
      :booking="payB"
      @paid="onPaymentConfirmed"
      @close="payB = null" />

    <!-- Receipt modal (mode=client → título "Recibo de Pago") -->
    <ReceiptModal v-if="receiptBooking" :booking="receiptBooking" :payment="receiptPayment" mode="client" @close="closeReceipt" />

    <!-- Report modal -->
    <ReportModal v-if="reportTarget" :target-user-id="reportTarget.id" target-role="worker" :target-name="reportTarget.name" @close="reportTarget = null" />

    <!-- Reschedule modal -->
    <RescheduleModal v-if="rescheduleB" :booking="rescheduleB" @close="rescheduleB = null" @rescheduled="onRescheduled" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useToastStore } from "../../Shared/stores/toast.js";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";
import {
  fetchPaymentsForBookings,
  payBookingManual,
} from "../../Shared/services/paymentApi.js";
import ReceiptModal from "../../Shared/components/ReceiptModal.vue";
import ReportModal from "../../Shared/components/ReportModal.vue";
import RescheduleModal from "../../Shared/components/RescheduleModal.vue";
import MercadoPagoPaymentModal from "../../Payments/components/MercadoPagoPaymentModal.vue";

const { t } = useI18n();
const toast = useToastStore();
const auth = useAuthStore();
const router = useRouter();

const bookings = ref([]);
const loading = ref(true);
const reviewBooking = ref(null);
const reviewForm = ref({ rating: 0, comment: "" });
const receiptBooking = ref(null);
const receiptPayment = ref(null);
const reportTarget = ref(null);
const rescheduleB = ref(null);
const cancelB = ref(null);
const cancelReason = ref("");

// Pago activo y métodos de cobro de la worker para mostrar en el modal.
const payB = ref(null);
const workerPayoutMethods = ref([]);
const loadingPayoutMethods = ref(false);
const payingManual = ref(false);

// Mapas con el estado actual sincronizado del backend.
// paymentsMap[bookingId] = ServicePayment | null (null = no pagado)
const paymentsMap = ref(new Map());
// clientMethodsMap[paymentMethodId] = type (yape/plin/bank_transfer/mercadopago)
// Lo usamos para saber qué canal usar al pagar cada booking.
const clientMethodsMap = ref(new Map());

function isPaid(bookingId) {
  return paymentsMap.value.get(bookingId) != null;
}

// Devuelve la lista de servicios del booking joineada con coma. Soporta el
// nuevo array `serviceTypes` (multi-servicio) y el legacy `serviceType` para
// reservas creadas antes del cambio.
function formatServices(b) {
  if (!b) return "";
  const list = Array.isArray(b.serviceTypes) && b.serviceTypes.length > 0
    ? b.serviceTypes
    : (b.serviceType ? [b.serviceType] : []);
  if (list.length === 0) return "";
  return list.map(s => t(`worker.services.${s}`)).join(", ");
}

// El "canal de pago" del booking activo (cuando hay payB).
// Se calcula a partir del paymentMethodId del booking + el type del método del cliente.
//   - mercadopago: abre el MercadoPagoPaymentModal y redirige al checkout MP.
//   - yape/plin/bank_transfer: flujo manual (cliente paga por fuera y confirma).
// Los canales legacy (card/paypal_card/cash/izipay_card) ya no se ofrecen al
// crear métodos nuevos; mantenemos defaults sensatos para bookings históricos.
const payChannel = computed(() => {
  if (!payB.value) return null;
  const pmType = clientMethodsMap.value.get(payB.value.paymentMethodId);
  if (pmType === "mercadopago") return "mercadopago";
  if (pmType === "yape")          return "yape";
  if (pmType === "plin")          return "plin";
  if (pmType === "bank_transfer") return "bank_transfer";
  // Fallback para métodos legacy (card / paypal_card / cash): los mapeamos a MP.
  return "mercadopago";
});

function channelLabel(c) {
  return ({
    mercadopago:   "Mercado Pago",
    yape:          "Yape",
    plin:          "Plin",
    bank_transfer: "Transferencia bancaria",
  })[c] || c;
}

function paymentIcon(type) {
  return ({ mercadopago: "💳", yape: "📱", plin: "📲", bank_transfer: "🏦" })[type] || "💰";
}

async function openPayModal(b) {
  payB.value = b;

  // Pago vía Mercado Pago: el modal MercadoPagoPaymentModal hace el flujo solo
  // (crea preferencia + redirige a MP). No necesitamos cargar las cuentas de
  // cobro de la worker.
  if (payChannel.value === "mercadopago") {
    return;
  }

  // Manual (yape/plin/bank): cargar las cuentas de cobro de la worker.
  loadingPayoutMethods.value = true;
  workerPayoutMethods.value = [];
  try {
    const { data } = await api.get(`/payments/methods/worker/${b.workerId}`);
    workerPayoutMethods.value = data;
  } catch (e) {
    console.error("Failed to load worker payout methods:", e);
  } finally {
    loadingPayoutMethods.value = false;
  }
}

async function confirmManualPay() {
  if (!payB.value || payingManual.value) return;
  payingManual.value = true;
  try {
    const channel = payChannel.value; // yape | plin | bank_transfer
    const payment = await payBookingManual(payB.value.id, channel);
    paymentsMap.value.set(payB.value.id, payment);
    toast.success(t("common.success"));
    payB.value = null;
  } catch (e) {
    toast.error(e?.response?.data?.error || "No se pudo registrar el pago");
  } finally {
    payingManual.value = false;
  }
}

function openReceipt(b) {
  receiptBooking.value = b;
  receiptPayment.value = paymentsMap.value.get(b.id);
}

function closeReceipt() {
  receiptBooking.value = null;
  receiptPayment.value = null;
}

async function onRescheduled() {
  toast.success("Reserva reprogramada. Pendiente de confirmación.");
  await load();
}

// Cuando el modal de MP confirma el pago (flujo localhost), recargamos las
// reservas para que aparezca como pagada. En deploy, este handler nunca se
// dispara porque MP redirige a /payment-success y la vista de ahí hace el reload.
async function onPaymentConfirmed() {
  toast.success("¡Pago confirmado!");
  await load();
}

function statusBadge(s) {
  return ({ pending:"badge badge-yellow", accepted:"badge badge-blue", completed:"badge badge-green", rejected:"badge badge-red", cancelled:"badge badge-gray" })[s] || "badge badge-gray";
}

function openReview(b) { reviewBooking.value = b; reviewForm.value = { rating: 0, comment: "" }; }

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

function isLateCancel(b) { return businessDaysUntil(b.date) < 3; }

function openCancel(b) { cancelB.value = b; cancelReason.value = ""; }

async function confirmCancel() {
  const id = cancelB.value.id;
  try {
    await api.patch(`/bookings/${id}/status`, { status: "cancelled" });
    toast.success("Reserva cancelada");
    if (isLateCancel(cancelB.value)) {
      toast.error("⚠️ Tu cuenta ha sido suspendida temporalmente 48h por cancelación tardía.");
      await auth.refreshUser();
    }
  } catch (e) {
    toast.success("Reserva cancelada");
  } finally {
    cancelB.value = null;
    await load();
  }
}

async function submitReview() {
  await api.post("/reviews", { bookingId: reviewBooking.value.id, workerId: reviewBooking.value.workerId, ...reviewForm.value });
  reviewBooking.value = null;
  toast.success("¡Gracias por tu reseña!");
  await load();
}

async function load() {
  loading.value = true;
  // Cargar bookings + métodos del cliente en paralelo.
  const [bookingsResp, methodsResp] = await Promise.all([
    api.get("/bookings"),
    api.get("/payments/methods").catch(() => ({ data: [] })),
  ]);
  bookings.value = bookingsResp.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Build map paymentMethodId → type (para saber qué canal usar al pagar).
  const m = new Map();
  for (const pm of methodsResp.data) m.set(pm.id, pm.type);
  clientMethodsMap.value = m;

  // Para los completed, consultar si ya están pagados.
  const completedIds = bookings.value
    .filter(b => b.status === "completed")
    .map(b => b.id);
  if (completedIds.length > 0) {
    paymentsMap.value = await fetchPaymentsForBookings(completedIds);
  }

  loading.value = false;
}

onMounted(load);
</script>

<style scoped>
.view-container { max-width: 1024px; margin: 0 auto; }
.page-title { font-size: 1.875rem; font-weight: 800; color: #0f172a; }
.mb-6 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-2 { margin-bottom: 0.5rem; }
.mt-3 { margin-top: 0.75rem; }

.loader-wrapper { display: flex; justify-content: center; padding: 4rem 0; }

.empty-state { text-align: center; padding: 4rem 0; }
.empty-illustration { font-size: 3rem; margin-bottom: 1rem; }
.empty-text { color: #64748b; margin-bottom: 1.5rem; }
.submit-btn { display: inline-block; }

.booking-list { display: flex; flex-direction: column; gap: 1rem; }
.booking-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.worker-info { display: flex; align-items: center; gap: 0.75rem; }
.worker-avatar-sm { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.avatar-blue { background:#2563eb; }
.avatar-initial { color:white; font-size:0.875rem; font-weight:700; }
.worker-name { font-weight:700; color:#1e293b; }
.worker-service { font-size:0.8125rem; color:#64748b; }

.meta-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.75rem; }
.meta-item { font-size: 0.8125rem; color: #475569; }

.card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 0.875rem; padding-top: 0.875rem; border-top: 1px solid #e2e8f0; gap: 0.75rem; flex-wrap: wrap; }
.total-label { color: #64748b; font-size: 0.875rem; }
.total-amount { font-weight: 800; font-size: 1.125rem; color: #1e293b; }

.action-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
.muted-text { color: #64748b; }

.policy-text { font-size: 0.875rem; color: #475569; line-height: 1.5; }
.late-warning { margin-top: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: #fef3c7; color: #92400e; font-size: 0.8125rem; }

.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100; }
.modal-box { background: white; border-radius: 0.875rem; padding: 1.5rem; width: 100%; max-width: 480px; max-height: 92vh; overflow-y: auto; }
.modal-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }

.rating-container { display: flex; gap: 0.5rem; margin: 0.75rem 0; justify-content: center; }
.rating-btn { background: none; border: none; font-size: 2rem; cursor: pointer; transition: opacity 0.15s; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-sm { width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 0.375rem; }
.spinner-lg { width: 48px; height: 48px; border-width: 4px; }
@keyframes spin { to { transform: rotate(360deg); } }

.flex-1 { flex: 1; }
</style>
