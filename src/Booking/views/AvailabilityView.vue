<template>
  <div class="view-container max-w-2xl">
    <h1 class="page-title mb-2">{{ t('nav.availability') }}</h1>
    <p class="page-subtitle mb-6">{{ t('booking.availability.subtitle') }}</p>

    <div class="card">
      <div class="day-list">
        <div v-for="(day, index) in days" :key="index" class="day-row">
          <div class="day-toggle-container">
            <!-- Toggle -->
            <button @click="toggleDay(index)"
              :class="['toggle', slots[index]?.isAvailable ? 'toggle-on' : 'toggle-off']">
              <div :class="['toggle-knob', slots[index]?.isAvailable ? 'knob-on' : 'knob-off']"></div>
            </button>
            <span class="day-label">{{t(day) }}</span>
          </div>

          <div v-if="slots[index]?.isAvailable" class="time-select-container">
            <select v-model="slots[index].startTime" class="input-field time-select">
              <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
            <span class="until-text">{{ t('booking.availability.until')}}</span>
            <select v-model="slots[index].endTime" class="input-field time-select">
              <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
          <div v-else class="unavailable-text">{{ t('booking.availability.notavailable')}}</div>
        </div>
      </div>

      <div v-if="error" class="alert error-box">{{ error }}</div>

        <button @click="saveAvailability" class="btn btn-primary btn-full submit-btn" :disabled="saving">
            <div v-if="saving" class="spinner spinner-sm"></div>
        {{ saving ? t('common.loading') : t('common.save') }}
      </button>
    </div>

    <!-- Calendario de reservas próximas -->
    <div class="card mt-4">
      <h2 class="section-title">{{ t('booking.availability.reservations')}}</h2>
      <p class="section-subtitle">{{ t('booking.availability.message')}}</p>

      <div class="cal-header mt-3">
        <button @click="prevMonth" class="cal-nav-btn">‹</button>
        <span class="cal-month">{{ monthLabel }}</span>
        <button @click="nextMonth" class="cal-nav-btn">›</button>
      </div>
      <div class="cal-weekdays">
        <span v-for="d in weekdaysShort" :key="d" class="cal-day-label">{{ d }}</span>
      </div>
      <div class="cal-grid">
        <div v-for="b in startBlank" :key="'b'+b"></div>
        <button v-for="day in daysInMonth" :key="day"
          @click="selectDay(day)"
          :class="['cal-day-bk', dayHasBookings(day) ? 'has-bookings' : '', selectedDay === day ? 'cal-day-selected' : '']">
          <span>{{ t(day) }}</span>
          <span v-if="dayHasBookings(day)" class="dot"></span>
        </button>
      </div>

      <!-- Detalle de reservas del día seleccionado -->
      <div v-if="selectedDay" class="day-bookings mt-3">
        <h3 class="day-bookings-title">{{ selectedDay }} - {{ monthLabel }}</h3>
        <div v-if="bookingsOnSelected.length" class="bookings-list">
          <div v-for="b in bookingsOnSelected" :key="b.id" class="booking-item">
            <div class="bk-time">⏰ {{ b.startTime }} – {{ b.endTime }}</div>
            <div class="bk-info">
              <span class="bk-client">{{ b.clientName }}</span>
              <span :class="['bk-badge', `bk-${b.status}`]">{{ t(statusLabel(b.status)) }}</span>
            </div>
            <div class="bk-service">{{ serviceLabel(b) }} · {{ b.address?.slice(0, 60) }}</div>
          </div>
        </div>
        <p v-else class="empty-day">{{ t('booking.availability.noreservations')}}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";

const { t } = useI18n();
const auth = useAuthStore();
const toast = useToastStore();

const days = [  "booking.availability.sunday",
  "booking.availability.monday",
  "booking.availability.tuesday",
  "booking.availability.wednesday",
  "booking.availability.thursday",
  "booking.availability.friday",
  "booking.availability.saturday"
];

const timeSlots = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2,"0")}:00`);
const saving = ref(false);
const error = ref("");

const slots = ref(days.map((_, i) => ({
  dayOfWeek: i,
  startTime: "08:00",
  endTime: "18:00",
  isAvailable: i >= 1 && i <= 5,
})));

async function toggleDay(index) {
  slots.value[index].isAvailable = !slots.value[index].isAvailable;
}

async function saveAvailability() {
  saving.value = true;
  try {
    const workerId = auth.user?.id;
    await api.put(`/workers/${workerId}/availability`, { slots: slots.value });
    toast.success(t("common.success"));
    // Notify WorkerDashboard to re-check availability banner
    window.dispatchEvent(new Event("inclean-availability-saved"));
  } catch { toast.error(t("common.error")); } finally { saving.value = false; }
}

onMounted(async () => {
  try {
    const { data } = await api.get(`/workers/${auth.user?.id}/availability`);
    if (data.length > 0) {
      data.forEach(s => {
        if (s.dayOfWeek >= 0 && s.dayOfWeek <= 6) {
          slots.value[s.dayOfWeek] = { dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, isAvailable: s.isAvailable };
        }
      });
    }
  } catch { }
  // Carga las reservas para el calendario de la trabajadora.
  // Se incluyen: pendientes, aceptadas Y completadas — así las reservas ya
  // aceptadas o finalizadas siguen visibles en el calendario histórico.
  try {
    const { data } = await api.get("/bookings");
    bookings.value = (data || []).filter(b => ["pending", "accepted", "completed"].includes(b.status));
  } catch { bookings.value = []; }
});

// === Calendario de reservas agendadas ===
const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());
const selectedDay = ref(null);
const bookings = ref([]);

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
const monthLabel = computed(() => `${t(MONTHS[viewMonth.value])} ${viewYear.value}`);
const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate());
const startBlank = computed(() => new Date(viewYear.value, viewMonth.value, 1).getDay());

function pad(n) { return String(n).padStart(2, "0"); }
function dateStrFor(day) {
  return `${viewYear.value}-${pad(viewMonth.value + 1)}-${pad(day)}`;
}
function dayHasBookings(day) {
  const ds = dateStrFor(day);
  return bookings.value.some(b => String(b.date).startsWith(ds));
}
const bookingsOnSelected = computed(() => {
  if (!selectedDay.value) return [];
  const ds = dateStrFor(selectedDay.value);
  return bookings.value
    .filter(b => String(b.date).startsWith(ds))
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
});

function prevMonth() {
  selectedDay.value = null;
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; } else viewMonth.value--;
}
function nextMonth() {
  selectedDay.value = null;
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; } else viewMonth.value++;
}
function selectDay(d) { selectedDay.value = d; }

function statusLabel(s) {
  return ({ pending: "booking.status.pending", accepted: "booking.status.accepted", completed: "booking.status.completed", cancelled: "booking.status.cancelled", rejected: "booking.status.rejected" })[s] || s;
}
// Acepta el booking completo o un string. Si el booking trae la lista nueva
// `serviceTypes`, la joinea con coma; si no, cae al singular `serviceType`.
function serviceLabel(b) {
  const translate = (s) => { const k = `worker.services.${s}`; const tr = t(k); return tr === k ? s : tr; };
  if (typeof b === "string") return translate(b);
  const list = Array.isArray(b?.serviceTypes) && b.serviceTypes.length > 0
    ? b.serviceTypes
    : (b?.serviceType ? [b.serviceType] : []);
  return list.map(translate).join(", ");
}
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
.mb-2 { margin-bottom: 0.5rem; }
.mb-6 { margin-bottom: 1.5rem; }
.page-subtitle { color: #64748b; font-size: 1.125rem; }

.day-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.day-row { display:flex;align-items:center;gap:1rem;padding:0.75rem 0;border-bottom:1px solid #f1f5f9; flex-wrap: wrap; }
@media (min-width: 640px) {
  .day-row { flex-wrap: nowrap; }
}
.day-row:last-child { border-bottom:none; }

.day-toggle-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
}
@media (min-width: 640px) {
  .day-toggle-container { width: auto; min-width: 160px; }
}

.toggle { width:44px;height:24px;border-radius:12px;border:none;cursor:pointer;position:relative;transition:background 0.2s;flex-shrink:0; }
.toggle-on { background:#2563eb; }
.toggle-off { background:#e2e8f0; }
.toggle-knob { width:18px;height:18px;border-radius:50%;background:white;position:absolute;top:3px;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2); }
.knob-on { left:23px; }
.knob-off { left:3px; }
.day-label { font-weight:600; color:#1e293b; }

.time-select-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  width: 100%;
}
@media (min-width: 640px) {
  .time-select-container { width: auto; }
}

.time-select { flex: 1; min-width: 100px; }
.until-text { color:#94a3b8; font-size:0.875rem; }
.unavailable-text { flex:1; font-size:0.875rem; color:#94a3b8; }

.alert { padding: 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; margin-top: 1rem; }
.error-box { background:#fee2e2; color:#991b1b; }

.submit-btn {
  margin-top: 1.5rem;
}

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-sm { width:18px; height:18px; border-width:2px; display: inline-block; margin-right: 0.5rem; }

@keyframes spin { to { transform: rotate(360deg); } }

/* === Calendario de reservas === */
.section-title { font-size: 1.125rem; font-weight: 700; color: #1e293b; }
.section-subtitle { color: #64748b; font-size: 0.875rem; margin-top: 0.25rem; }
.cal-header { display: flex; align-items: center; justify-content: center; gap: 1rem; margin-bottom: 0.5rem; }
.cal-month { font-weight: 700; color: #1e293b; text-transform: capitalize; min-width: 160px; text-align: center; }
.cal-nav-btn { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e2e8f0; background: white; color: #475569; font-size: 1.25rem; cursor: pointer; }
.cal-nav-btn:hover { background: #f1f5f9; }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; color: #94a3b8; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; }
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-day-bk { position: relative; aspect-ratio: 1 / 1; border-radius: 0.5rem; border: 1px solid transparent; background: #f8fafc; color: #475569; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cal-day-bk:hover { background: #eff6ff; }
.cal-day-bk.has-bookings { background: #dbeafe; color: #1e3a8a; font-weight: 600; }
.cal-day-bk.cal-day-selected { background: #2563eb; color: white; border-color: #1d4ed8; }
.cal-day-bk .dot { position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 50%; background: #2563eb; }
.cal-day-bk.cal-day-selected .dot { background: white; }
.day-bookings { padding-top: 0.5rem; border-top: 1px solid #e2e8f0; }
.day-bookings-title { font-weight: 600; color: #1e293b; margin-bottom: 0.5rem; text-transform: capitalize; }
.bookings-list { display: flex; flex-direction: column; gap: 0.5rem; }
.booking-item { padding: 0.625rem 0.75rem; background: #f8fafc; border-left: 3px solid #2563eb; border-radius: 0.5rem; }
.bk-time { font-weight: 600; color: #1e293b; font-size: 0.875rem; }
.bk-info { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
.bk-client { color: #475569; font-size: 0.875rem; }
.bk-service { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
.bk-badge { font-size: 0.6875rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 600; }
.bk-pending { background: #fef3c7; color: #92400e; }
.bk-accepted { background: #dbeafe; color: #1e3a8a; }
.bk-completed { background: #d1fae5; color: #065f46; }
.empty-day { color: #94a3b8; font-size: 0.875rem; padding: 0.5rem 0; }
.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
</style>
