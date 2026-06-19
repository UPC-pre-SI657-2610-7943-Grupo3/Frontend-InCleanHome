<template>
  <div class="view-container max-w-2xl">
    <button @click="$router.back()" class="btn btn-secondary btn-sm mb-4">← {{ t('common.back') }}</button>
    <h1 class="page-title mb-6">{{ t('booking.title') }}</h1>

    <!-- Banner: cuenta del cliente suspendida -->
    <div v-if="auth.isSuspended" class="suspension-banner">
      🚫 Tu cuenta está temporalmente suspendida y no puedes reservar.
      <div class="suspension-until">Termina el {{ formatSuspendedUntil(auth.suspendedUntil) }}.</div>
      <div v-if="auth.suspensionReason" class="suspension-reason">{{ auth.suspensionReason }}</div>
    </div>

    <!-- Show loading spinner while fetching worker data -->
    <div v-if="workerLoading" class="loader-wrapper"><div class="spinner"></div></div>

    <div v-else class="flex-col gap-5">
      <!-- Display worker information -->
      <div class="card flex-row gap-4 worker-summary">
        <div class="worker-avatar-md avatar-blue" :style="worker?.photoUrl ? 'padding:0;overflow:hidden;' : ''">
          <img v-if="worker?.photoUrl" :src="worker.photoUrl" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
          <span v-else class="avatar-initial">{{ initials }}</span>
        </div>
        <div>
          <div class="worker-name">{{ worker?.name }}</div>
          <div class="worker-rate">
            S/. {{ worker?.hourlyRate }}/h
            <!-- Tarifa de domingo: visible si la worker tiene una distinta a la
                 normal. El tooltip aclara que solo aplica si trabaja ese día. -->
            <template v-if="worker?.hourlyRateSunday && Number(worker.hourlyRateSunday) > 0 && Number(worker.hourlyRateSunday) !== Number(worker.hourlyRate)">
              · Dom. S/. {{ worker.hourlyRateSunday }}/h
              <span class="rate-info"
                    :title="t('booking.sundayRateTooltip') || 'Tarifa aplicable solo si la trabajadora tiene disponibilidad ese día.'">ⓘ</span>
            </template>
          </div>
        </div>
      </div>

      <!-- Select service type — multi-select para que el cliente pueda contratar
           varios servicios en una misma reserva (limpieza + cocina, por ej.).
           Las opciones se limitan a los servicios que la trabajadora declara
           ofrecer; así no se permite reservar algo que ella no hace. -->
      <div class="card">
        <label class="label-bold">{{ t('booking.serviceType') }}</label>
        <MultiSelectDropdown
          v-model="form.serviceTypes"
          :options="serviceOptionsForWorker"
          :placeholder="t('booking.selectAtLeastOneService')"
          :all-label="t('search.allServices')"
          :allow-all="false"
          class="mt-1"
        />
        <p class="hint-text">
          {{ t('booking.servicesAvailable') }}: {{ (worker?.serviceTypes || []).length }}
        </p>
      </div>

      <!-- Date and time selection -->
      <div class="card">
        <h3 class="card-subtitle">📅 {{ t('booking.selectDate') }}</h3>

        <!-- Aviso: trabajadora sin disponibilidad configurada -->
        <div v-if="availability.length === 0 && !loading" class="no-avail-notice">
          🚫 Trabajador(a) aún no ha configurado su disponibilidad horaria. No es posible realizar una reserva en este momento.
        </div>

        <!-- Calendar picker -->
        <div class="calendar">
          <div class="cal-header">
            <button @click="prevMonth" class="cal-nav">‹</button>
            <span class="month-label">{{ monthLabel }}</span>
            <button @click="nextMonth" class="cal-nav">›</button>
          </div>
          <div class="cal-days">
            <span v-for="d in weekdaysShort" :key="d" class="cal-day-label">{{ d }}</span>
          </div>
          <div class="cal-grid">
            <div v-for="blank in startBlank" :key="'b'+blank"></div>
            <!-- Day buttons: disabled when past OR worker not available that weekday -->
            <button v-for="day in daysInMonth" :key="day"
              @click="selectDay(day)"
              :disabled="isPast(day) || isUnavailableDay(day)"
              :title="isUnavailableDay(day) && !isPast(day) ? 'La trabajadora no atiende este día' : ''"
              :class="['cal-day',
                        selectedDay === day ? 'cal-day-selected' : '',
                        (isPast(day) || isUnavailableDay(day)) ? 'cal-day-disabled' : 'cal-day-active']">
              {{ day }}
            </button>
          </div>
        </div>

        <!-- Time selection -->
        <div v-if="selectedDay && timeSlots.length" class="grid-2-cols gap-3 mt-4">
          <div class="form-group">
            <label class="label-bold">{{ t('booking.startTime') }}</label>
            <select v-model="form.startTime" class="input-field" @change="calcHours">
              <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label-bold">{{ t('booking.endTime') }}</label>
            <select v-model="form.endTime" class="input-field" @change="calcHours">
              <option v-for="h in endTimeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>
        <div v-else-if="selectedDay" class="coverage-warning mt-4">
          ⚠️ Trabajador(a) no tiene horarios disponibles ese día.
        </div>

        <!-- Display hours calculated -->
        <div v-if="form.hours > 0" class="hours-info">{{ form.hours }} {{ t('booking.hours') }}</div>
      </div>

      <!-- District, reference, address and notes -->
      <div class="card">
        <label class="label-bold">{{ t('booking.district') }}</label>
        <select v-model="form.district" class="input-field mt-1">
          <option value="" disabled>{{ t('booking.selectDistrict') }}</option>
          <option v-for="z in districtOptions" :key="z" :value="z">{{ t(`worker.zones.${z}`) }}</option>
        </select>
        <!-- Coverage validation message -->
        <div v-if="form.district && !districtHasCoverage" class="coverage-warning">
          ⚠️ {{ t('booking.noCoverage') }}
        </div>

        <label class="label-bold mt-label">{{ t('booking.address') }}</label>
        <input v-model="form.address" type="text" class="input-field mt-1" :placeholder="t('booking.address')" />

        <label class="label-bold mt-label">{{ t('booking.reference') }}</label>
        <input v-model="form.reference" type="text" class="input-field mt-1" :placeholder="t('booking.referencePlaceholder')" />

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

      <!-- Booking summary — only visible once the client has selected time slots -->
      <div v-if="form.hours > 0" class="card summary-card">
        <h3 class="card-title mb-4"> {{ t('booking.summary')}}</h3>
        <div class="summary-row">
          <span>{{ form.hours }}h × S/. {{ effectiveRate.toFixed(2) }}</span>
          <span>S/. {{ subtotal.toFixed(2) }}</span>
        </div>
        <!-- Aviso visible solo cuando se está aplicando tarifa de domingo. -->
        <div v-if="showSundayNotice" class="sunday-notice">
          {{ t('booking.sundayRateApplied') || 'Tarifa de domingo aplicada' }}
        </div>
        <div class="summary-total">
          <span class="total-label">{{ t('booking.total') }}</span>
          <span class="total-amount">S/. {{ subtotal.toFixed(2) }}</span>
        </div>
      </div>

      <!-- Error message display -->
      <div v-if="error" class="alert error-box">{{ error }}</div>

      <!-- Confirm booking button -->
      <button @click="handleBook" class="btn btn-primary btn-full btn-lg mt-4" :disabled="!canBook || submitting"
        :title="availability.length === 0 ? 'Trabajador(a) no tiene disponibilidad configurada' : ''">
        <div v-if="submitting" class="spinner spinner-sm"></div>
        {{ submitting ? t('common.loading') : t('booking.confirm') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";
import { hasCoverage } from "../../Shared/constants/zones.js";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { formatSuspendedUntil } from "../../Shared/utils/suspension.js";
import MultiSelectDropdown from "../../Shared/components/MultiSelectDropdown.vue";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const toast = useToastStore();
const auth = useAuthStore();

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
// Disponibilidad de la trabajadora cargada del backend.
const availability = ref([]);

// Booking form data — `serviceTypes` es una lista (multi-select): cliente puede
// contratar varios servicios en una misma reserva, todos ofrecidos por la
// trabajadora. El precio sigue siendo tarifa × horas (no se multiplica por
// cantidad de servicios — son tareas, no items facturables).
const form = ref({ serviceTypes: [], startTime: "08:00", endTime: "10:00", district: "", address: "", reference: "", notes: "", paymentMethodId: null, hours: 0 });
// New payment method form
const newPm = ref({ type: "yape", label: "", details: "" });

// Lista de opciones para el dropdown multi-select, limitadas a los servicios
// que la trabajadora declara ofrecer. Si no hay datos aún, lista vacía.
const serviceOptionsForWorker = computed(() =>
  (worker.value?.serviceTypes || []).map(v => ({ value: v, label: t(`worker.services.${v}`) }))
);

// Payment types mapping. Solo se ofrecen los canales soportados por la plataforma:
// MercadoPago (pasarela, cubre tarjetas) y los manuales Yape/Plin/Bank.
// "cash", "card" (legacy), "izipay_card" y "paypal_card" fueron removidos.
const paymentTypes = computed(() => ({
  mercadopago:   t("booking.paymentTypes.mercadopago") || "Mercado Pago",
  yape:          t("booking.paymentTypes.yape"),
  plin:          t("booking.paymentTypes.plin"),
  bank_transfer: t("booking.paymentTypes.bank_transfer"),
}));

// Computed properties for worker display
const initials = computed(() => worker.value?.name?.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() || "?");
// Calculate pricing
// Tarifa efectiva según el día seleccionado. Si la fecha cae domingo Y la
// trabajadora tiene tarifa de domingo configurada, usamos esa; sino, la normal.
// El cálculo final lo hace el backend (server-side), pero replicamos la regla
// aquí para que el cliente vea el monto correcto antes de confirmar.
const effectiveRate = computed(() => {
  const w = worker.value;
  if (!w) return 0;
  if (!form.value.date) return Number(w.hourlyRate) || 0;
  const d = new Date(form.value.date + 'T00:00:00');
  const isSunday = d.getDay() === 0;
  if (isSunday && Number(w.hourlyRateSunday) > 0) return Number(w.hourlyRateSunday);
  return Number(w.hourlyRate) || 0;
});

// True si la fecha seleccionada es domingo Y se le está aplicando la tarifa especial.
// Lo usamos para mostrar un aviso al cliente debajo del resumen.
const showSundayNotice = computed(() => {
  const w = worker.value;
  if (!w || !form.value.date) return false;
  const d = new Date(form.value.date + 'T00:00:00');
  return d.getDay() === 0 && Number(w.hourlyRateSunday) > 0;
});

const subtotal = computed(() => effectiveRate.value * form.value.hours);
// Nota: no calculamos platformFee/workerEarning aquí. El cliente paga el total
// y el backend, con la tasa de comisión vigente en PlatformSettings, decide el
// desglose final en el momento del pago. Mostrar un cálculo del frontend con
// una tasa hardcoded sería mentir al cliente si el admin la cambió.

// Los distritos ofrecidos son las zonas donde la trabajadora atiende; así la
// cobertura se valida contra la zona de servicio real de la trabajadora.
const districtOptions = computed(() => worker.value?.zones || []);
// Hay cobertura si el distrito está dentro tanto del catálogo global como de
// las zonas de la trabajadora.
const districtHasCoverage = computed(
  () => !!form.value.district && hasCoverage(form.value.district) && districtOptions.value.includes(form.value.district)
);

// Check if booking can be confirmed (incluye cobertura válida del distrito y
// que la cuenta del cliente no esté suspendida).
const canBook = computed(() =>
  !auth.isSuspended &&
  availability.value.length > 0 &&
  selectedDay.value && form.value.serviceTypes.length > 0 && form.value.district && districtHasCoverage.value &&
  form.value.address && form.value.paymentMethodId && form.value.hours > 0
);

const WEEKDAY_SHORT_KEYS = [
  "booking.availability.sundayShort",
  "booking.availability.mondayShort",
  "booking.availability.tuesdayShort",
  "booking.availability.wednesdayShort",
  "booking.availability.thursdayShort",
  "booking.availability.fridayShort",
  "booking.availability.saturdayShort",
];

const weekdaysShort = computed(() => WEEKDAY_SHORT_KEYS.map(k => t(k)));

const MONTHS = ["booking.availability.january",
  "booking.availability.february",
  "booking.availability.march",
  "booking.availability.april",
  "booking.availability.may",
  "booking.availability.june",
  "booking.availability.july",
  "booking.availability.august",
  "booking.availability.september",
  "booking.availability.october",
  "booking.availability.november",
  "booking.availability.december"
];

// Calendar utilities
const monthLabel = computed(() => `${t(MONTHS[viewMonth.value])} ${viewYear.value}`);
const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate());
const startBlank = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay());
// Día de semana del día seleccionado (0=Dom...6=Sáb), o null si no hay selección.
const selectedDow = computed(() =>
  selectedDay.value ? new Date(viewYear.value, viewMonth.value, selectedDay.value).getDay() : null
);
// Franjas disponibles para el día seleccionado (uniendo slots solapados/adyacentes
// para tener un rango efectivo de horas disponibles).
const daySlots = computed(() => {
  if (selectedDow.value === null) return [];
  return availability.value.filter(s => s.dayOfWeek === selectedDow.value);
});
// Genera las horas (HH:00) disponibles según los slots del día. Si la trabajadora
// no atiende ese día (no hay slots), devuelve una lista vacía y se bloquea reservar.
// Si el día seleccionado es hoy, filtra las horas que ya pasaron.
const timeSlots = computed(() => {
  if (!daySlots.value.length) return [];
  // Construye un set de horas cubiertas por al menos un slot.
  const covered = new Set();
  for (const s of daySlots.value) {
    const [sh] = s.startTime.split(":").map(Number);
    const [eh] = s.endTime.split(":").map(Number);
    for (let h = sh; h < eh; h++) covered.add(h);
  }
  // Si el día seleccionado es hoy, filtrar horas pasadas.
  const isToday = selectedDay.value &&
    viewYear.value === today.getFullYear() &&
    viewMonth.value === today.getMonth() &&
    selectedDay.value === today.getDate();
  const nowHour = today.getHours();
  // Devuelve horas como "HH:00" en orden ascendente.
  return Array.from(covered)
    .filter(h => !isToday || h > nowHour)
    .sort((a, b) => a - b)
    .map(h => `${String(h).padStart(2,"0")}:00`);
});
// Horas válidas para "fin": una hora más que la última cubierta.
const endTimeSlots = computed(() => {
  if (!daySlots.value.length) return [];
  const all = new Set();
  for (const s of daySlots.value) {
    const [sh] = s.startTime.split(":").map(Number);
    const [eh] = s.endTime.split(":").map(Number);
    for (let h = sh + 1; h <= eh; h++) all.add(h);
  }
  return Array.from(all).sort((a, b) => a - b).map(h => `${String(h).padStart(2,"0")}:00`);
});

// Navigation functions
function prevMonth() { if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; } else viewMonth.value--; }
function nextMonth() { if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; } else viewMonth.value++; }
function selectDay(d) {
  if (isPast(d) || isUnavailableDay(d)) return;
  selectedDay.value = d;
}
// Check if date is in the past
function isPast(d) {
  const date = new Date(viewYear.value, viewMonth.value, d);
  return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}
// True cuando la trabajadora no tiene ningún slot disponible ese día de semana.
function isUnavailableDay(d) {
  const dow = new Date(viewYear.value, viewMonth.value, d).getDay();
  return !availability.value.some(s => s.dayOfWeek === dow);
}

// Cuando cambia el día seleccionado, asegura que startTime/endTime estén dentro
// de las franjas disponibles. Si no, las ajusta a la primera opción válida.
// También sincroniza form.date con (year, month, selectedDay) → "YYYY-MM-DD".
// Sin esta sincronización, los computed que dependen de form.date (effectiveRate,
// showSundayNotice) nunca se enteraban del cambio y siempre asumían tarifa normal.
watch(selectedDay, () => {
  if (!selectedDay.value) {
    form.value.date = "";
    return;
  }
  // Formato ISO "YYYY-MM-DD" para que `new Date(form.date + 'T00:00:00')`
  // interprete bien la fecha en zona local sin saltos de día por timezone.
  const m = String(viewMonth.value + 1).padStart(2, "0");
  const d = String(selectedDay.value).padStart(2, "0");
  form.value.date = `${viewYear.value}-${m}-${d}`;

  if (!timeSlots.value.length) return;
  if (!timeSlots.value.includes(form.value.startTime)) {
    form.value.startTime = timeSlots.value[0];
  }
  // El fin debe ser > inicio y dentro de endTimeSlots.
  const valid = endTimeSlots.value.filter(h => h > form.value.startTime);
  if (!valid.includes(form.value.endTime)) {
    form.value.endTime = valid[0] || endTimeSlots.value[endTimeSlots.value.length - 1];
  }
  calcHours();
});
// Calculate hours between start and end time
function calcHours() {
  const [sh, sm] = form.value.startTime.split(":").map(Number);
  const [eh, em] = form.value.endTime.split(":").map(Number);
  form.value.hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}
// Get payment method icon
function paymentIcon(type) {
  return { mercadopago:"💳", yape:"📱", plin:"📲", bank_transfer:"🏦" }[type] || "💰";
}

// Add new payment method
async function addPaymentMethod() {
  const { data } = await api.post("/payments/methods", newPm.value);
  paymentMethods.value.push(data);
  form.value.paymentMethodId = data.id;
  showAddPayment.value = false;
  newPm.value = { type:"yape", label:"", details:"" };
}

// Submit booking
async function handleBook() {
  error.value = "";

  // Validación: al menos un servicio elegido.
  if (form.value.serviceTypes.length === 0) {
    error.value = t("booking.selectAtLeastOneService");
    return;
  }

  // Validación: Dirección y Referencia no pueden contener SOLO números.
  // Deben tener al menos una letra (acepta combinación letras+números, o solo
  // letras). Aplico la regla únicamente cuando hay valor — la referencia es
  // opcional, así que solo se valida si el usuario la llenó.
  const addr = (form.value.address || "").trim();
  // Para considerar "solo números" cuenta también espacios/símbolos numéricos.
  const onlyNumbers = (s) => s.length > 0 && /^[\d\s.,\-]+$/.test(s);
  if (!addr) {
    error.value = t("booking.addressOnlyNumbers");
    return;
  }
  if (onlyNumbers(addr)) {
    error.value = t("booking.addressOnlyNumbers");
    return;
  }
  const ref_ = (form.value.reference || "").trim();
  if (ref_ && onlyNumbers(ref_)) {
    error.value = t("booking.referenceOnlyNumbers");
    return;
  }

  submitting.value = true;
  try {
    const dateStr = `${viewYear.value}-${String(viewMonth.value+1).padStart(2,"0")}-${String(selectedDay.value).padStart(2,"0")}`;
    // El backend espera un único campo Address. Componemos distrito + dirección
    // + referencia para preservar el contrato actual sin perder la información
    // estructurada. Cuando el backend agregue campos District/Reference, se
    // pueden enviar por separado.
    const districtLabel = t(`worker.zones.${form.value.district}`);
    const fullAddress = [
      `${districtLabel}`,
      form.value.address,
      form.value.reference ? `(Ref: ${form.value.reference})` : "",
    ].filter(Boolean).join(", ");
    await api.post("/bookings", {
      workerId: parseInt(route.params.id),
      // Enviamos la lista nueva. El backend prioriza `serviceTypes` y si está
      // vacío cae al singular `serviceType` (legacy). Mandamos también el
      // primero como `serviceType` por compatibilidad con cualquier middleware.
      serviceTypes: form.value.serviceTypes,
      serviceType: form.value.serviceTypes[0],
      date: dateStr,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      hours: form.value.hours,
      paymentMethodId: form.value.paymentMethodId,
      address: fullAddress,
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
  // Carga la disponibilidad para filtrar días y franjas horarias.
  try {
    const av = await api.get(`/workers/${id}/availability`);
    availability.value = (av.data || []).filter(s => s.isAvailable);
  } catch { availability.value = []; }
  // El multi-select arranca vacío para que el cliente elija explícitamente
  // qué servicios quiere contratar (no hay preselección por defecto).
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

.no-avail-notice { background: #fee2e2; color: #991b1b; padding: 0.875rem 1rem; border-radius: 0.625rem; margin-bottom: 1rem; font-size: 0.875rem; font-weight: 500; border-left: 4px solid #dc2626; }

.grid-2-cols {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
}

.form-group { display: flex; flex-direction: column; gap: 0.25rem; }

.hours-info { margin-top: 0.75rem; padding: 0.75rem; background: #eff6ff; border-radius: 0.5rem; font-size: 0.875rem; color: #2563eb; font-weight: 600; }
.hint-text { margin-top: 0.5rem; font-size: 0.75rem; color: #64748b; }
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
.sunday-notice { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.8125rem; margin-top: 0.5rem; }
.rate-info { display: inline-block; margin-left: 0.25rem; color: #2563eb; cursor: help; font-size: 0.85em; }
.total-label { font-weight: 700; font-size: 1.0625rem; color: #065f46; }
.total-amount { font-weight: 800; font-size: 1.25rem; color: #2563eb; }

.alert { padding: 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; margin-top: 1rem; }
.error-box { background: #fee2e2; color: #991b1b; }
.coverage-warning { margin-top: 0.5rem; padding: 0.625rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 0.5rem; font-size: 0.8125rem; line-height: 1.3; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-sm { width: 18px; height: 18px; border-width: 2px; display: inline-block; margin-right: 0.5rem; }

@keyframes spin { to { transform: rotate(360deg); } }

.suspension-banner {
  background: #fee2e2;
  color: #991b1b;
  padding: 1rem 1.25rem;
  border-radius: 0.75rem;
  margin-bottom: 1.25rem;
  font-weight: 600;
  border-left: 4px solid #dc2626;
}
.suspension-until {
  font-weight: 500;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}
.suspension-reason {
  font-weight: 400;
  font-size: 0.8125rem;
  color: #7f1d1d;
  margin-top: 0.25rem;
  font-style: italic;
}
</style>
