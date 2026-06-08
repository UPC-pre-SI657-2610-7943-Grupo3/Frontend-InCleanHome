<template>
  <div class="view-container max-w-4xl">
    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>
    <div v-else-if="!worker" class="empty-state py-16"><p class="muted-text">Trabajador(a) no encontrada</p></div>
    <div v-else>
      <button @click="$router.back()" class="btn btn-secondary btn-sm mb-4">← {{ t('common.back') }}</button>

      <div class="profile-layout">
        <!-- Left: Profile card -->
        <div class="profile-sidebar">
          <div class="card text-center">
            <div class="worker-avatar-lg mx-auto mb-4" :style="worker.photoUrl ? {} : { background: avatarBg }">
              <img v-if="worker.photoUrl" :src="worker.photoUrl" class="avatar-img-lg" alt="profile" />
              <span v-else class="avatar-initials-lg">{{ initials }}</span>
            </div>
            <h1 class="profile-name">{{ worker.name }}</h1>

            <div class="rating-display mt-1">
              <span v-for="i in 5" :key="i" :style="{ color: i <= Math.round(worker.averageRating || 0) ? '#f59e0b' : '#e2e8f0' }">★</span>
              <span class="rating-value">{{ (worker.averageRating || 0).toFixed(1) }}</span>
              <span class="rating-count">({{ worker.totalServices || 0 }})</span>
            </div>

            <div v-if="worker.documentsVerified" class="verified-badge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 11l3 3L22 4"/></svg>
              {{ t('profile.verified') }}
            </div>

            <div v-if="worker.hasConfirmedReports" class="confirmed-report-alert">
              ⚠ Perfil con {{ worker.confirmedReportsCount }} reporte(s) confirmado(s) por administración.
            </div>

             <div class="worker-rate">S/. {{ worker.hourlyRate }}</div>
             <div class="per-hour">{{ t('search.perHour') }}</div>

            <div class="profile-actions mt-4">
              <!-- Banner de cuenta suspendida (si la trabajadora tiene suspensión vigente). -->
              <div v-if="workerSuspended" class="suspended-banner">
                🚫 Cuenta suspendida hasta {{ formatSuspendedUntil(worker.suspendedUntil) }}
              </div>
              <router-link v-if="!workerSuspended" :to="`/client/worker/${worker.id}/book`" class="btn btn-primary btn-full">📅 {{ t('profile.book') }}</router-link>
              <button v-else class="btn btn-disabled btn-full" disabled>📅 {{ t('profile.book') }}</button>

              <router-link v-if="!workerSuspended" :to="{ path: `/client/messages/${worker.id}`, query: { name: worker.name } }" class="btn btn-secondary btn-full">💬 {{ t('profile.contact') }}</router-link>
              <button v-else class="btn btn-disabled btn-full" disabled>💬 {{ t('profile.contact') }}</button>

              <button @click="showReport = true" class="btn btn-ghost btn-full report-link">⚐ {{ t('report.reportWorker') }}</button>
            </div>

            <div class="profile-info-section">
              <div v-if="worker.age" class="info-row"><span>🎂</span><span>{{ worker.age }} años</span></div>
              <div v-if="worker.gender" class="info-row"><span>👤</span><span>{{ t(`worker.${worker.gender}`) }}</span></div>
              <div v-if="worker.experienceYears" class="info-row"><span>⏱️</span><span>{{ worker.experienceYears }} años de experiencia</span></div>
              <div v-if="worker.phone" class="info-row"><span>📞</span><span>{{ worker.phone }}</span></div>
            </div>
          </div>
        </div>

        <!-- Right: Details -->
        <div class="profile-main">
          <!-- Bio -->
          <div v-if="worker.bio" class="card">
              <h3 class="section-title">Acerca de mí</h3>
             <p class="bio-text">{{ worker.bio }}</p>
          </div>

          <!-- Services -->
          <div class="card">
            <h3 class="section-title">{{ t('profile.services') }}</h3>
              <div class="badge-group">
              <span v-for="svc in worker.serviceTypes" :key="svc" class="badge badge-blue badge-md">
                {{ t(`worker.services.${svc}`) }}
              </span>
            </div>
          </div>

          <!-- Zones -->
          <div class="card">
            <h3 class="section-title">{{ t('profile.workZones') }}</h3>
              <div class="badge-group">
              <span v-for="zone in worker.zones" :key="zone" class="badge badge-gray badge-md">
                📍 {{ t(`worker.zones.${zone}`) }}
              </span>
            </div>
          </div>

          <!-- Availability -->
          <div class="card">
            <h3 class="section-title">{{ t('profile.availability') }}</h3>
             <div v-if="availability.length === 0" class="muted-text">Sin disponibilidad configurada</div>
             <div v-else class="badge-group">
               <span v-for="slot in availability.filter(s => s.isAvailable)" :key="slot.id" class="badge badge-green badge-md">
                 {{ days[slot.dayOfWeek] }} {{ slot.startTime }}–{{ slot.endTime }}
               </span>
             </div>
          </div>

          <!-- Reviews -->
          <div class="card">
            <h3 class="section-title">{{ t('profile.reviews') }}</h3>
             <div v-if="reviews.length === 0" class="muted-text">{{ t('profile.noReviews') }}</div>
             <div v-else class="reviews-list">
               <div v-for="r in reviews" :key="r.id" class="review-row">
                 <div class="review-header mb-1">
                   <span class="review-author">{{ r.clientName || 'Cliente' }}</span>
                   <div class="review-stars">
                     <span v-for="i in 5" :key="i" :style="{ color: i <= r.rating ? '#f59e0b' : '#e2e8f0' }" class="review-star">★</span>
                   </div>
                 </div>
                 <p class="review-text">{{ r.comment }}</p>
                 <p class="review-date">{{ formatDate(r.createdAt) }}</p>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Report modal -->
    <ReportModal v-if="showReport && worker" :target-user-id="worker.id" target-role="worker" :target-name="worker.name" @close="showReport = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import api from "../../Shared/api.js";
import ReportModal from "../../Shared/components/ReportModal.vue";
import { isActiveSuspension, formatSuspendedUntil } from "../../Shared/utils/suspension.js";

const { t } = useI18n();
const route = useRoute();
const worker = ref(null);
const availability = ref([]);
const reviews = ref([]);
const loading = ref(true);
const showReport = ref(false);

const workerSuspended = computed(() => isActiveSuspension(worker.value?.suspendedUntil));

const days = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const colors = ["#2563eb","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
const initials = computed(() => worker.value?.name?.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() || "?");
const avatarBg = computed(() => colors[(worker.value?.id || 0) % colors.length]);

function formatDate(d) { return d ? new Date(d).toLocaleDateString("es-PE", { year:"numeric", month:"long", day:"numeric" }) : ""; }

onMounted(async () => {
  try {
    const id = route.params.id;
    const [w, av, rv] = await Promise.all([
      api.get(`/workers/${id}`),
      api.get(`/workers/${id}/availability`),
      api.get(`/reviews/worker/${id}`),
    ]);
    worker.value = w.data;
    availability.value = av.data;
    reviews.value = rv.data;
  } catch { } finally { loading.value = false; }
});
</script>

<style scoped>
.view-container { max-width: 1024px; margin: 0 auto; padding: 1rem 0; }
.max-w-4xl { max-width: 896px; margin: 0 auto; }
.mb-4 { margin-bottom: 1rem; }

.loader-wrapper { display: flex; justify-content: center; padding: 4rem 0; }
.empty-state { text-align: center; padding: 4rem 0; }
.muted-text { color:#94a3b8; font-size:0.875rem; }

.profile-layout { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
@media (min-width: 1024px) {
  .profile-layout { grid-template-columns: 1fr 2fr; }
}

.text-center { text-align: center; }
.mx-auto { margin-left: auto; margin-right: auto; }
.mt-1 { margin-top: 0.25rem; }
.mt-4 { margin-top: 1rem; }
.mb-1 { margin-bottom: 0.25rem; }

.worker-avatar-lg { width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;overflow:hidden; }
.avatar-initials-lg { font-size:2rem;font-weight:700;color:white; }
.avatar-img-lg { width:100%; height:100%; object-fit:cover; border-radius:50%; }
.profile-name { font-size:1.375rem;font-weight:800;color:#1e293b; margin:0; }

.rating-display { display: flex; align-items: center; justify-content: center; gap: 0.25rem; }
.rating-value { font-size:0.875rem; font-weight:600; color:#1e293b; margin-left:0.25rem; }
.rating-count { font-size:0.8125rem; color:#94a3b8; }

.verified-badge { display:inline-flex; align-items:center; gap:0.25rem; margin-top:0.5rem; background:#d1fae5; color:#065f46; padding:0.3rem 0.75rem; border-radius:9999px; font-size:0.8125rem; font-weight:500; }

.confirmed-report-alert { margin-top: .75rem; background:#fef3c7; color:#92400e; padding:.65rem; border-radius:.75rem; font-size:.82rem; font-weight:700; line-height:1.3; }

.worker-rate { font-size:1.5rem; font-weight:800; color:#2563eb; margin-top:1rem; }
.per-hour { font-size:0.8125rem; color:#64748b; }

.profile-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.profile-info-section { border-top:1px solid #e2e8f0; margin-top:1.25rem; padding-top:1.25rem; text-align:left; }
.info-row { display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;color:#475569;margin-bottom:0.5rem; }

.profile-main { display: flex; flex-direction: column; gap: 1.25rem; }
.section-title { font-size:1rem;font-weight:700;color:#1e293b;margin-bottom:0.875rem; }
.bio-text { color:#475569; line-height:1.6; font-size:0.9375rem; margin: 0; }

.badge-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.badge-md { font-size:0.875rem; padding:0.375rem 0.875rem; }
.badge-green { background:#ecfdf5; color:#059669; }

.reviews-list { display: flex; flex-direction: column; gap: 1rem; }
.review-row { border-bottom:1px solid #f1f5f9; padding-bottom:1rem; }
.review-row:last-child { border-bottom: none; padding-bottom: 0; }
.review-header { display: flex; align-items: center; justify-content: space-between; }
.review-author { font-weight:600; font-size:0.9375rem; color:#1e293b; }
.review-stars { display: flex; }
.review-star { font-size:0.875rem; margin-left:0.125rem; }
.review-text { color:#475569; font-size:0.875rem; margin-top: 0.25rem; margin-bottom: 0.25rem; }
.review-date { font-size:0.75rem; color:#94a3b8; margin-top:0.25rem; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }

@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 767px) {
  .worker-avatar-lg { width:72px; height:72px; }
  .avatar-initials-lg { font-size:1.5rem; }
  .worker-rate { font-size:1.25rem; }
}
.suspended-banner {
  padding: 0.75rem;
  background: #fee2e2;
  color: #991b1b;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 0.5rem;
  line-height: 1.3;
}
.btn-disabled {
  background: #e2e8f0 !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
  border: none;
}
</style>
