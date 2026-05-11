<template>
  <div class="view-container max-w-2xl">
    <button @click="$router.back()" class="btn btn-secondary btn-sm mb-4">← {{ t('common.back') }}</button>
    <h1 class="page-title mb-6">{{ t('booking.title') }}</h1>

    <!-- Show loading spinner while fetching worker data -->
    <div v-if="workerLoading" class="loader-wrapper"><div class="spinner"></div></div>

    <div v-else class="flex-col gap-5">
      <!-- Display worker information -->
      <div class="card flex-row gap-4 worker-summary">
        <div class="worker-avatar-md avatar-blue">
          <span class="avatar-initial">{{ initials }}</span>
        </div>
        <div>
          <div class="worker-name">{{ worker?.name }}</div>
          <div class="worker-rate">S/. {{ worker?.hourlyRate }}/hora</div>
        </div>
      </div>

      <!-- Select service type -->
      <div class="card">
        <label class="label-bold">{{ t('booking.serviceType') }}</label>
        <select v-model="form.serviceType" class="input-field mt-1">
          <option v-for="svc in worker?.serviceTypes || []" :key="svc" :value="svc">{{ t(`worker.services.${svc}`) }}</option>
        </select>
      </div>

      <!-- Date and time selection -->
      <div class="card">
        <h3 class="card-subtitle">📅 {{ t('booking.selectDate') }}</h3>
        <!-- Calendar picker -->
        <div class="calendar">
          <div class="cal-header">
            <button @click="prevMonth" class="cal-nav">‹</button>
            <span class="month-label">{{ monthLabel }}</span>
            <button @click="nextMonth" class="cal-nav">›</button>
          </div>
          <div class="cal-days">
            <span v-for="d in ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']" :key="d" class="cal-day-label">{{ d }}</span>
          </div>
          <div class="cal-grid">
            <div v-for="blank in startBlank" :key="'b'+blank"></div>
            <!-- Day buttons -->
            <button v-for="day in daysInMonth" :key="day"
              @click="selectDay(day)"
              :disabled="isPast(day)"
              :class="['cal-day', selectedDay === day ? 'cal-day-selected' : '', isPast(day) ? 'cal-day-disabled' : 'cal-day-active']">
              {{ day }}
            </button>
          </div>
        </div>

        <!-- Time selection -->
        <div class="grid-2-cols gap-3 mt-4">
          <div class="form-group">
            <label class="label-bold">{{ t('booking.startTime') }}</label>
            <select v-model="form.startTime" class="input-field" @change="calcHours">
              <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label-bold">{{ t('booking.endTime') }}</label>
            <select v-model="form.endTime" class="input-field" @change="calcHours">
              <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- Display hours calculated -->
        <div v-if="form.hours > 0" class="hours-info">{{ form.hours }} {{ t('booking.hours') }}</div>
      </div>

      <!-- Address and notes -->
      <div class="card">
        <label class="label-bold">{{ t('booking.address') }}</label>
        <input v-model="form.address" type="text" class="input-field mt-1" :placeholder="t('booking.address')" />
        <label class="label-bold mt-label">{{ t('booking.notes') }}</label>
        <textarea v-model="form.notes" class="input-field mt-1 no-resize" rows="2"></textarea>
      </div>

      <!-- Payment method section -->
      <div class="card">
        <h3 class="card-subtitle">💳 {{ t('booking.paymentMethod') }}</h3>
          <!-- Show add payment button if no methods available -->
          <div v-if="paymentMethods.length === 0" class="empty-state-small">
            <p class="muted-text mb-3">No tienes métodos de pago guardados</p>
            <button @click="showAddPayment = true" class="btn btn-outline btn-sm">+ {{ t('booking.addPaymentMethod') }}</button>
          </div>
        <!-- Display available payment methods -->
        <div v-else class="flex-col gap-2">
          <label v-for="pm in paymentMethods" :key="pm.id" class="payment-option" :class="{ selected: form.paymentMethodId === pm.id }" @click="form.paymentMethodId = pm.id">
            <span class="payment-icon">{{ paymentIcon(pm.type) }}</span>
            <div class="pm-info-text">
              <div class="pm-label">{{ pm.label }}</div>
              <div v-if="pm.details" class="pm-details">{{ pm.details }}</div>
            </div>
            <div class="pm-radio-container">
              <div :class="['radio-circle', form.paymentMethodId === pm.id ? 'radio-selected' : '']"></div>
            </div>
          </label>
          <button @click="showAddPayment = true" class="btn btn-outline btn-sm mt-2">+ {{ t('booking.addPaymentMethod') }}</button>
        </div>

        <!-- Add payment modal -->
        <div v-if="showAddPayment" class="modal-overlay" @click.self="showAddPayment = false">
          <div class="modal-box">
            <h3 class="card-title mb-4">{{ t('booking.addPaymentMethod') }}</h3>
            <select v-model="newPm.type" class="input-field mb-3">
              <option v-for="(lbl, val) in paymentTypes" :key="val" :value="val">{{ paymentIcon(val) }} {{ lbl }}</option>
            </select>
            <input v-model="newPm.label" class="input-field mb-3" :placeholder="t('booking.paymentMethod')" />
            <input v-model="newPm.details" class="input-field mb-4" placeholder="Detalles opcionales" />
            <div class="flex-row gap-3">
              <button @click="showAddPayment = false" class="btn btn-secondary flex-1">{{ t('common.cancel') }}</button>
              <button @click="addPaymentMethod" class="btn btn-primary flex-1">{{ t('common.save') }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Booking summary -->
      <div class="card summary-card">
        <h3 class="card-title mb-4">Resumen</h3>
        <div class="summary-row"><span>{{ form.hours }}h × S/. {{ worker?.hourlyRate }}</span><span>S/. {{ subtotal.toFixed(2) }}</span></div>
        <div class="summary-row summary-warning"><span>{{ t('booking.platformFee') }}</span><span>- S/. {{ platformFee.toFixed(2) }}</span></div>
        <div class="summary-row summary-success"><span>{{ t('booking.workerEarning') }}</span><span>S/. {{ workerEarning.toFixed(2) }}</span></div>
        <div class="summary-total">
          <span class="total-label">{{ t('booking.total') }}</span>
          <span class="total-amount">S/. {{ subtotal.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Error message display -->
      <div v-if="error" class="alert error-box">{{ error }}</div>

      <!-- Confirm booking button -->
      <button @click="handleBook" class="btn btn-primary btn-full btn-lg mt-4" :disabled="!canBook || submitting">
        <div v-if="submitting" class="spinner spinner-sm"></div>
        {{ submitting ? t('common.loading') : t('booking.confirm') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const worker = ref(null);
const workerLoading = ref(true);
const paymentMethods = ref([]);
const submitting = ref(false);
const error = ref("");
const showAddPayment = ref(false);

// Calendar state
const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());
const selectedDay = ref(null);

// Booking form data
const form = ref({ serviceType: "", startTime: "08:00", endTime: "10:00", address: "", notes: "", paymentMethodId: null, hours: 2 });
// New payment method form
const newPm = ref({ type: "cash", label: "", details: "" });

// Payment types mapping
const paymentTypes = computed(() => ({
  cash: t("booking.paymentTypes.cash"), card: t("booking.paymentTypes.card"),
  yape: t("booking.paymentTypes.yape"), plin: t("booking.paymentTypes.plin"),
  bank_transfer: t("booking.paymentTypes.bank_transfer"),
}));

// Computed properties for worker display
const initials = computed(() => worker.value?.name?.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() || "?");
// Calculate pricing
const subtotal = computed(() => (worker.value?.hourlyRate || 0) * form.value.hours);
const platformFee = computed(() => subtotal.value * 0.10);
const workerEarning = computed(() => subtotal.value - platformFee.value);
// Check if booking can be confirmed
const canBook = computed(() => selectedDay.value && form.value.serviceType && form.value.address && form.value.paymentMethodId && form.value.hours > 0);

// Calendar utilities
const monthLabel = computed(() => new Date(viewYear.value, viewMonth.value).toLocaleDateString("es-PE", { month:"long", year:"numeric" }));
const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate());
const startBlank = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay());
// Generate time slots from 6:00 to 23:00
const timeSlots = Array.from({ length: 18 }, (_, i) => `${String(Math.floor(i + 6)).padStart(2,"0")}:00`);

// Navigation functions
function prevMonth() { if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; } else viewMonth.value--; }
function nextMonth() { if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; } else viewMonth.value++; }
function selectDay(d) { selectedDay.value = d; }
// Check if date is in the past
function isPast(d) {
  const date = new Date(viewYear.value, viewMonth.value, d);
  return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
// Calculate hours between start and end time
function calcHours() {
  const [sh, sm] = form.value.startTime.split(":").map(Number);
  const [eh, em] = form.value.endTime.split(":").map(Number);
  form.value.hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}
// Get payment method icon
function paymentIcon(type) {
  return { cash:"💵", card:"💳", yape:"📱", plin:"📲", bank_transfer:"🏦" }[type] || "💰";
}

// Add new payment method
async function addPaymentMethod() {
  const { data } = await api.post("/payments/methods", newPm.value);
  paymentMethods.value.push(data);
  form.value.paymentMethodId = data.id;
  showAddPayment.value = false;
  newPm.value = { type:"cash", label:"", details:"" };
}

// Submit booking
async function handleBook() {
  submitting.value = true;
  error.value = "";
  try {
    const dateStr = `${viewYear.value}-${String(viewMonth.value+1).padStart(2,"0")}-${String(selectedDay.value).padStart(2,"0")}`;
    await api.post("/bookings", {
      workerId: parseInt(route.params.id),
      serviceType: form.value.serviceType,
      date: dateStr,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      hours: form.value.hours,
      paymentMethodId: form.value.paymentMethodId,
      address: form.value.address,
      notes: form.value.notes,
    });
    toast.success(t("booking.bookingSuccess"));
    router.push("/client/bookings");
  } catch (e) {
    error.value = e.response?.data?.error || t("common.error");
  } finally { submitting.value = false; }
}

// Load worker and payment methods on mount
onMounted(async () => {
  const id = route.params.id;
  const [w, pm] = await Promise.all([api.get(`/workers/${id}`), api.get("/payments/methods")]);
  worker.value = w.data;
  paymentMethods.value = pm.data;
  if (w.data.serviceTypes?.length) form.value.serviceType = w.data.serviceTypes[0];
  workerLoading.value = false;
});
</script>

<style scoped>
.view-container {
  padding: 1rem;
  margin: 0 auto;
}
.max-w-2xl { max-width: 672px; }

@media (min-width: 640px) {
  .view-container { padding: 2rem 0; }
}

.page-title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #0f172a;
}
.mb-6 { margin-bottom: 1.5rem; }
.mb-4 { margin-bottom: 1rem; }
.mb-3 { margin-bottom: 0.75rem; }

.loader-wrapper {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.flex-col { display: flex; flex-direction: column; }
.flex-row { display: flex; align-items: center; }
.gap-5 { gap: 1.25rem; }
.gap-4 { gap: 1rem; }
.gap-3 { gap: 0.75rem; }
.gap-2 { gap: 0.5rem; }
.flex-1 { flex: 1; }

.worker-avatar-md { 
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-blue { background: #2563eb; }
.avatar-initial { color: white; font-weight: 700; font-size: 1.25rem; }

.worker-summary { padding: 1rem; }
.worker-name { font-weight: 700; color: #1e293b; font-size: 1.125rem; }
.worker-rate { font-size: 0.875rem; color: #64748b; }

.card-subtitle { font-weight: 600; color: #1e293b; margin-bottom: 1rem; font-size: 1.125rem; }
.card-title { font-weight: 700; color: #1e293b; font-size: 1.25rem; }

.label-bold { font-size: 0.875rem; font-weight: 600; color: #475569; display: block; }
.mt-1 { margin-top: 0.25rem; }
.mt-4 { margin-top: 1rem; }

.calendar { border: 1px solid #e2e8f0; border-radius: 0.75rem; overflow: hidden; }
.cal-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.cal-nav { background: none; border: none; cursor: pointer; font-size: 1.25rem; color: #64748b; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.cal-nav:hover { background: #e2e8f0; }
.month-label { font-weight: 600; color: #1e293b; }
.cal-days { display: grid; grid-template-columns: repeat(7, 1fr); padding: 0.5rem 0.5rem 0; }
.cal-day-label { text-align: center; font-size: 0.75rem; font-weight: 600; color: #94a3b8; padding: 0.25rem; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 0.5rem; }
.cal-day { height: 34px; border-radius: 6px; border: none; background: none; cursor: pointer; font-size: 0.875rem; font-weight: 500; transition: all 0.1s; }
.cal-day-active:hover { background: #eff6ff; color: #2563eb; }
.cal-day-selected { background: #2563eb !important; color: white !important; }
.cal-day-disabled { color: #cbd5e1; cursor: not-allowed; }

.grid-2-cols {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.form-group { display: flex; flex-direction: column; gap: 0.25rem; }

.hours-info { margin-top: 0.75rem; padding: 0.75rem; background: #eff6ff; border-radius: 0.5rem; font-size: 0.875rem; color: #2563eb; font-weight: 600; }
.mt-label { margin-top: 1rem; }
.no-resize { resize: none; }

.empty-state-small { text-align: center; padding: 1rem 0; }
.muted-text { font-size: 0.875rem; color: #64748b; }

.payment-option { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem; border-radius: 0.75rem; border: 2px solid #e2e8f0; cursor: pointer; transition: border-color 0.15s; }
.payment-option.selected { border-color: #2563eb; background: #eff6ff; }
.payment-icon { font-size: 1.5rem; }
.pm-info-text { flex: 1; }
.pm-label { font-weight: 600; font-size: 0.9375rem; color: #1e293b; }
.pm-details { font-size: 0.8125rem; color: #64748b; }
.pm-radio-container { margin-left: auto; }

.radio-circle { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd5e1; transition: all 0.15s; }
.radio-selected { border-color: #2563eb; background: #2563eb; box-shadow: inset 0 0 0 4px white; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
.modal-box { background: white; border-radius: 1rem; padding: 1.5rem; width: 100%; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }

.summary-card { background: #f0fdf4; border-color: #a7f3d0; }
.summary-row { display: flex; justify-content: space-between; align-items: center; font-size: 0.9375rem; margin-bottom: 0.375rem; color: #334155; }
.summary-warning { color: #ef4444; font-size: 0.875rem; }
.summary-success { color: #10b981; font-size: 0.875rem; }
.summary-total { border-top: 1px solid #a7f3d0; margin-top: 0.75rem; padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center; }
.total-label { font-weight: 700; font-size: 1.0625rem; color: #065f46; }
.total-amount { font-weight: 800; font-size: 1.25rem; color: #2563eb; }

.alert { padding: 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; margin-top: 1rem; }
.error-box { background: #fee2e2; color: #991b1b; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-sm { width: 18px; height: 18px; border-width: 2px; display: inline-block; margin-right: 0.5rem; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
