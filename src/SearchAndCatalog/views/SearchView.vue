<template>
  <div class="view-container">
    <!-- Header -->
    <div class="search-header">
      <h1 class="page-title">{{ t('search.title') }}</h1>
      <p class="page-subtitle">{{ t('search.subtitle') }}</p>
    </div>

    <!-- Banner: cuenta suspendida -->
    <div v-if="auth.isSuspended" class="suspension-banner">
      🚫 <strong>Cuenta suspendida</strong> — Tu cuenta está temporalmente suspendida y no puedes hacer reservas.
      <div v-if="auth.suspendedUntil" class="suspension-until">Hasta: {{ formatSuspendedUntil(auth.suspendedUntil) }}</div>
      <div v-if="auth.suspensionReason" class="suspension-reason">Motivo: {{ auth.suspensionReason }}</div>
    </div>

    <div class="search-layout">
      <!-- Filters sidebar -->
      <div class="filters-sidebar">
        <div class="card sticky-card">
          <div class="filters-header">
            <h3 class="filters-title">{{ t('search.filters') }}</h3>
            <button @click="clearFilters" class="link-btn">{{ t('search.clearFilters') }}</button>
          </div>
          <div class="filters-list">
            <div class="form-group">
              <label class="label">{{ t('search.serviceType') }}</label>
              <select v-model="filters.serviceType" class="input-field" @change="doSearch">
                <option value="">{{ t('search.allServices') }}</option>
                <option v-for="s in serviceOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">{{ t('search.zone') }}</label>
              <select v-model="filters.zone" class="input-field" @change="doSearch">
                <option value="">{{ t('search.allZones') }}</option>
                <option v-for="z in zoneOptions" :key="z.value" :value="z.value">{{ z.label }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">{{ t('search.gender') }}</label>
              <select v-model="filters.gender" class="input-field" @change="doSearch">
                <option value="">{{ t('search.allGenders') }}</option>
                <option value="female">{{ t('worker.female') }}</option>
                <option value="male">{{ t('worker.male') }}</option>
              </select>
            </div>
            <div class="grid-2-cols gap-small">
              <div class="form-group">
                <label class="label">{{ t('search.minAge') }}</label>
                <input v-model.number="filters.minAge" type="number" class="input-field" min="18" max="70" @input="doSearch" />
              </div>
              <div class="form-group">
                <label class="label">{{ t('search.maxAge') }}</label>
                <input v-model.number="filters.maxAge" type="number" class="input-field" min="18" max="70" @input="doSearch" />
              </div>
            </div>
            <div class="form-group">
              <label class="label">{{ t('search.maxHourlyRate') }}</label>
              <input v-model.number="filters.maxHourlyRate" type="number" class="input-field" min="10" step="5" @input="doSearch" />
            </div>
            <div class="form-group">
              <label class="label">{{ t('search.minRating') }}</label>
              <select v-model.number="filters.minRating" class="input-field" @change="doSearch">
                <option value="">-</option>
                <option value="4.5">4.5+</option>
                <option value="4">4+</option>
                <option value="3">3+</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">{{ t('search.availableOn') }}</label>
              <select v-model.number="filters.availableDay" class="input-field" @change="applyAvailabilityFilter">
                <option value="">{{ t('search.anyDay') }}</option>
                <option v-for="d in dayOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div class="results-area">
        <!-- Mobile filters toggle -->
        <div class="mobile-filters-toggle">
          <button @click="showFilters = !showFilters" class="btn btn-secondary btn-full toggle-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
            {{ t('search.filters') }}
          </button>
          <div v-if="showFilters" class="card mt-3">
            <div class="filters-list-mobile">
              <select v-model="filters.serviceType" class="input-field" @change="doSearch"><option value="">{{ t('search.allServices') }}</option><option v-for="s in serviceOptions" :key="s.value" :value="s.value">{{ s.label }}</option></select>
              <select v-model="filters.zone" class="input-field" @change="doSearch"><option value="">{{ t('search.allZones') }}</option><option v-for="z in zoneOptions" :key="z.value" :value="z.value">{{ z.label }}</option></select>
              <select v-model="filters.gender" class="input-field" @change="doSearch"><option value="">{{ t('search.allGenders') }}</option><option value="female">{{ t('worker.female') }}</option><option value="male">{{ t('worker.male') }}</option></select>
            </div>
          </div>
        </div>

        <div class="results-header">
          <p class="results-meta"><span class="results-count">{{ displayedWorkers.length }}</span> {{ t('search.results') }}</p>
          <div class="sort-control">
            <label class="sort-label">{{ t('search.sortBy') }}:</label>
            <select v-model="sortBy" class="input-field sort-select">
              <option value="relevance">{{ t('search.sortRelevance') }}</option>
              <option value="priceAsc">{{ t('search.sortPriceAsc') }}</option>
              <option value="priceDesc">{{ t('search.sortPriceDesc') }}</option>
              <option value="ratingDesc">{{ t('search.sortRatingDesc') }}</option>
            </select>
          </div>
        </div>

        <div v-if="loading" class="loader-wrapper">
          <div class="spinner spinner-lg"></div>
        </div>

        <div v-else-if="displayedWorkers.length === 0" class="empty-state">
          <div class="empty-illustration">🔍</div>
          <p class="empty-text">{{ t('search.noResults') }}</p>
        </div>

        <div v-else class="results-grid">
          <WorkerCard v-for="worker in displayedWorkers" :key="worker.id" :worker="worker" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "../../Shared/api.js";
import WorkerCard from "../components/WorkerCard.vue";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { formatSuspendedUntil } from "../../Shared/utils/suspension.js";

const { t } = useI18n();
const auth = useAuthStore();
const workers = ref([]);
const loading = ref(true);
const showFilters = ref(false);
const sortBy = ref("relevance");
// availableDay: índice de día (0=Dom ... 6=Sáb) o "" para cualquiera.
const filters = ref({ serviceType: "", zone: "", gender: "", minAge: "", maxAge: "", maxHourlyRate: "", minRating: "", availableDay: "" });
// IDs de trabajadoras disponibles el día filtrado (se llena al aplicar el filtro).
const availableWorkerIds = ref(null);

const dayOptions = computed(() => [
  { value: 1, label: t("search.anyDay") === "Any day" ? "Monday" : "Lunes" },
  { value: 2, label: t("search.anyDay") === "Any day" ? "Tuesday" : "Martes" },
  { value: 3, label: t("search.anyDay") === "Any day" ? "Wednesday" : "Miércoles" },
  { value: 4, label: t("search.anyDay") === "Any day" ? "Thursday" : "Jueves" },
  { value: 5, label: t("search.anyDay") === "Any day" ? "Friday" : "Viernes" },
  { value: 6, label: t("search.anyDay") === "Any day" ? "Saturday" : "Sábado" },
  { value: 0, label: t("search.anyDay") === "Any day" ? "Sunday" : "Domingo" },
]);

const serviceOptions = computed(() => [
  { value: "limpieza_general", label: t("worker.services.limpieza_general") },
  { value: "cocina", label: t("worker.services.cocina") },
  { value: "lavanderia", label: t("worker.services.lavanderia") },
  { value: "planchado", label: t("worker.services.planchado") },
  { value: "cuidado_ninos", label: t("worker.services.cuidado_ninos") },
  { value: "cuidado_adultos", label: t("worker.services.cuidado_adultos") },
  { value: "jardineria", label: t("worker.services.jardineria") },
  { value: "limpieza_profunda", label: t("worker.services.limpieza_profunda") },
]);
const zoneOptions = computed(() => [
  "miraflores","san_isidro","surco","la_molina","barranco","san_borja",
  "lince","jesus_maria","pueblo_libre","magdalena","san_miguel","callao","los_olivos","san_martin","ate","comas"
].map(v => ({ value: v, label: t(`worker.zones.${v}`) })));

async function doSearch() {
  loading.value = true;
  try {
    const params = {};
    Object.entries(filters.value).forEach(([k, v]) => {
      // availableDay no es un parámetro del backend; se aplica en cliente.
      if (k === "availableDay") return;
      if (v !== "" && v !== null) params[k] = v;
    });
    const { data } = await api.get("/workers", { params });
    workers.value = data;
    // Re-aplica el filtro de disponibilidad si estaba activo.
    if (filters.value.availableDay !== "") await applyAvailabilityFilter();
  } catch { workers.value = []; }
  finally { loading.value = false; }
}

// Filtra por disponibilidad consultando GET /workers/{id}/availability y
// quedándose con quienes tienen un slot disponible en el día seleccionado.
async function applyAvailabilityFilter() {
  if (filters.value.availableDay === "") {
    availableWorkerIds.value = null;
    return;
  }
  const day = filters.value.availableDay;
  const checks = await Promise.all(
    workers.value.map(async (w) => {
      try {
        const { data } = await api.get(`/workers/${w.id}/availability`);
        const ok = (data || []).some((s) => s.dayOfWeek === day && s.isAvailable);
        return ok ? w.id : null;
      } catch { return null; }
    })
  );
  availableWorkerIds.value = new Set(checks.filter((x) => x !== null));
}

// Lista final mostrada: aplica filtro de disponibilidad (cliente) y orden.
const displayedWorkers = computed(() => {
  let list = workers.value;
  if (availableWorkerIds.value) {
    list = list.filter((w) => availableWorkerIds.value.has(w.id));
  }
  const arr = [...list];
  switch (sortBy.value) {
    case "priceAsc": arr.sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0)); break;
    case "priceDesc": arr.sort((a, b) => (b.hourlyRate || 0) - (a.hourlyRate || 0)); break;
    case "ratingDesc": arr.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0)); break;
  }
  return arr;
});

function clearFilters() {
  filters.value = { serviceType: "", zone: "", gender: "", minAge: "", maxAge: "", maxHourlyRate: "", minRating: "", availableDay: "" };
  availableWorkerIds.value = null;
  sortBy.value = "relevance";
  doSearch();
}

onMounted(doSearch);
</script>

<style scoped>
.view-container {
  max-width: 1280px;
  margin: 0 auto;
}

.search-header { 
  margin-bottom: 1.5rem; 
}
.page-title { 
  font-size: 1.875rem; 
  font-weight: 800; 
  color: #0f172a; 
  margin-bottom: 0.25rem; 
}
.page-subtitle { 
  color: #64748b; 
  font-size: 1rem;
}

.search-layout {
  display: flex;
  gap: 1.5rem;
}

.filters-sidebar {
  display: none;
  width: 260px;
  flex-shrink: 0;
}
@media (min-width: 1024px) {
  .filters-sidebar { display: block; }
}

.sticky-card {
  position: sticky;
  top: 6rem;
}

.filters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.filters-title { font-weight: 600; color: #1e293b; font-size: 1.125rem; }
.link-btn { font-size: 0.8125rem; color: #2563eb; background: none; border: none; cursor: pointer; }

.filters-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.grid-2-cols {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.results-area {
  flex: 1;
}

.mobile-filters-toggle {
  margin-bottom: 1rem;
}
@media (min-width: 1024px) {
  .mobile-filters-toggle { display: none; }
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.mt-3 { margin-top: 0.75rem; }

.filters-list-mobile {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.results-meta { font-size: 0.9375rem; color: #64748b; }
.results-count { font-weight: 600; color: #1e293b; margin-right: 0.25rem; }
.sort-control { display: flex; align-items: center; gap: 0.5rem; }
.sort-label { font-size: 0.8125rem; color: #64748b; white-space: nowrap; }
.sort-select { padding: 0.4rem 0.6rem; font-size: 0.8125rem; width: auto; min-width: 150px; }

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

.results-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}
@media (min-width: 640px) {
  .results-grid { grid-template-columns: repeat(2, 1fr); }
}

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }
@keyframes spin { to { transform: rotate(360deg); } }

.suspension-banner { background: #fee2e2; color: #991b1b; padding: 1rem 1.25rem; border-radius: 0.75rem; margin-bottom: 1.25rem; font-weight: 600; border-left: 4px solid #dc2626; }
.suspension-until { font-weight: 500; font-size: 0.875rem; margin-top: 0.25rem; }
.suspension-reason { font-weight: 400; font-size: 0.8125rem; color: #7f1d1d; margin-top: 0.25rem; font-style: italic; }
</style>
