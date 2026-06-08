<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="card modal-card">
      <h3 class="modal-title">Reprogramar reserva</h3>
      <p class="muted-text">Al reprogramar, la reserva queda pendiente hasta que la contraparte confirme.</p>

      <div class="form-group mt-3">
        <label class="label-bold">Nueva fecha</label>
        <input type="date" v-model="form.date" :min="todayStr" class="input-field" />
        <div v-if="form.date && !dayAvailable" class="warn-box">⚠️ Trabajador(a) no atiende ese día.</div>
      </div>

      <div v-if="dayAvailable" class="grid-2-cols">
        <div class="form-group">
          <label class="label-bold">Hora inicio</label>
          <select v-model="form.startTime" class="input-field" @change="recalcHours">
            <option v-for="h in startOptions" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
        <div class="form-group">
          <label class="label-bold">Hora fin</label>
          <select v-model="form.endTime" class="input-field" @change="recalcHours">
            <option v-for="h in endOptions" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
      </div>

      <div v-if="form.hours > 0" class="hours-info">{{ form.hours }} horas</div>

      <div v-if="error" class="error-box">{{ error }}</div>

      <div class="modal-actions mt-3">
        <button @click="$emit('close')" class="btn btn-secondary flex-1">Cancelar</button>
        <button @click="submit" class="btn btn-primary flex-1" :disabled="!canSubmit || saving">
          {{ saving ? 'Guardando...' : 'Reprogramar' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../api.js";

const props = defineProps({
  booking: { type: Object, required: true },
});
const emit = defineEmits(["close", "rescheduled"]);

const todayStr = new Date().toISOString().slice(0, 10);
const form = ref({
  date: props.booking.date || todayStr,
  startTime: props.booking.startTime || "08:00",
  endTime: props.booking.endTime || "10:00",
  hours: Number(props.booking.hours) || 2,
});
const availability = ref([]);
const saving = ref(false);
const error = ref("");

onMounted(async () => {
  try {
    const { data } = await api.get(`/workers/${props.booking.workerId}/availability`);
    availability.value = (data || []).filter(s => s.isAvailable);
  } catch { availability.value = []; }
});

// Day of week of the chosen date (0=Sun...6=Sat).
const selectedDow = computed(() => {
  if (!form.value.date) return null;
  const [y, m, d] = form.value.date.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
});
const daySlots = computed(() =>
  selectedDow.value === null ? [] : availability.value.filter(s => s.dayOfWeek === selectedDow.value)
);
const dayAvailable = computed(() => daySlots.value.length > 0);

const startOptions = computed(() => {
  const set = new Set();
  for (const s of daySlots.value) {
    const [sh] = s.startTime.split(":").map(Number);
    const [eh] = s.endTime.split(":").map(Number);
    for (let h = sh; h < eh; h++) set.add(h);
  }
  return [...set].sort((a, b) => a - b).map(h => `${String(h).padStart(2, "0")}:00`);
});
const endOptions = computed(() => {
  const set = new Set();
  for (const s of daySlots.value) {
    const [sh] = s.startTime.split(":").map(Number);
    const [eh] = s.endTime.split(":").map(Number);
    for (let h = sh + 1; h <= eh; h++) set.add(h);
  }
  return [...set].sort((a, b) => a - b).map(h => `${String(h).padStart(2, "0")}:00`);
});

function recalcHours() {
  const [sh, sm] = form.value.startTime.split(":").map(Number);
  const [eh, em] = form.value.endTime.split(":").map(Number);
  form.value.hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

const canSubmit = computed(() =>
  form.value.date && dayAvailable.value && form.value.hours > 0
);

async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  error.value = "";
  try {
    await api.patch(`/bookings/${props.booking.id}/reschedule`, {
      date: form.value.date,
      startTime: form.value.startTime,
      endTime: form.value.endTime,
      hours: form.value.hours,
    });
    emit("rescheduled");
    emit("close");
  } catch (e) {
    error.value = e.response?.data?.error || "No se pudo reprogramar";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 1000; }
.modal-card { width: 100%; max-width: 460px; padding: 1.5rem; }
.modal-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; }
.muted-text { color: #64748b; font-size: 0.875rem; margin-top: 0.25rem; }
.form-group { display: flex; flex-direction: column; gap: 0.375rem; margin-top: 0.75rem; }
.label-bold { font-weight: 600; color: #475569; font-size: 0.875rem; }
.grid-2-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.hours-info { margin-top: 0.5rem; color: #2563eb; font-weight: 600; font-size: 0.875rem; }
.warn-box { margin-top: 0.5rem; padding: 0.5rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 0.5rem; font-size: 0.8125rem; }
.error-box { margin-top: 0.75rem; background: #fee2e2; color: #991b1b; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.875rem; }
.modal-actions { display: flex; gap: 0.75rem; }
.flex-1 { flex: 1; }
.mt-3 { margin-top: 0.75rem; }
</style>
