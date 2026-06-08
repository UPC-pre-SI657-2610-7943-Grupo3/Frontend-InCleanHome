<template>
  <router-link :to="`/client/worker/${worker.id}`" class="card-link">
    <div class="worker-card">

      <!-- ROW 1: avatar + info izquierda / precio derecha -->
      <div class="top-row">
        <div class="left-col">
          <div class="worker-avatar" :style="worker.photoUrl ? {} : { background: avatarBg }">
            <img v-if="worker.photoUrl" :src="worker.photoUrl" class="avatar-img" alt="" />
            <span v-else class="avatar-initials">{{ initials }}</span>
          </div>
          <div class="name-rating">
            <h3 class="worker-name">{{ worker.name }}</h3>
            <div class="rating-row">
              <span class="rating-star">★</span>
              <span class="rating-value">{{ worker.averageRating?.toFixed(1) || '0.0' }}</span>
              <span class="rating-count">({{ worker.totalServices || 0 }} {{ t('common.services') }})</span>
            </div>
          </div>
        </div>
        <div class="price-col">
          <span class="price">S/. {{ worker.hourlyRate }}</span>
          <span class="per-hour">{{ t('search.perHour') }}</span>
        </div>
      </div>

      <!-- ROW 2: badges verificado / reportado -->
      <div class="badges-row">
        <span v-if="worker.documentsVerified" class="verified-badge">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 11l3 3L22 4"/></svg>
          {{ t('profile.verified') }}
        </span>
        <span v-if="worker.hasConfirmedReports" class="report-badge">
          ⚠ {{ worker.confirmedReportsCount }} reporte(s)
        </span>
      </div>

      <!-- ROW 3: servicios -->
      <div class="services-row">
        <span v-for="svc in worker.serviceTypes.slice(0,3)" :key="svc" class="tag tag-blue">
          {{ t(`worker.services.${svc}`) }}
        </span>
        <span v-if="worker.serviceTypes.length > 3" class="tag tag-gray">+{{ worker.serviceTypes.length - 3 }}</span>
      </div>

      <!-- ROW 4: zonas + experiencia -->
      <div class="info-row">
        <span class="info-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {{ worker.zones.slice(0,2).map(z => t(`worker.zones.${z}`)).join(', ') }}
        </span>
        <span v-if="worker.experienceYears" class="info-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          {{ worker.experienceYears }} {{ t('search.experience') }}
        </span>
      </div>

      <button class="view-btn">{{ t('search.viewProfile') }}</button>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
const { t } = useI18n();
const props = defineProps({ worker: Object });
const initials = computed(() => props.worker.name?.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase() || "?");
const colors = ["#2563eb","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
const avatarBg = computed(() => colors[props.worker.id % colors.length]);
</script>

<style scoped>
.card-link { display: block; text-decoration: none; color: inherit; }

.worker-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: box-shadow 0.15s, transform 0.15s;
  cursor: pointer;
  height: 100%;
}
.worker-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.09); transform: translateY(-2px); }

/* ROW 1 */
.top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}
.left-col {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
  flex: 1;
}
.worker-avatar {
  width: 52px; height: 52px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.avatar-img { width: 100%; height: 100%; object-fit: cover; }
.avatar-initials { font-size: 1.25rem; font-weight: 700; color: #fff; }

.name-rating { min-width: 0; }
.worker-name {
  font-weight: 700; font-size: 1rem; color: #1e293b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin: 0;
}
.rating-row { display: flex; align-items: center; gap: 0.25rem; margin-top: 0.2rem; }
.rating-star { color: #f59e0b; font-size: 0.875rem; }
.rating-value { font-size: 0.8125rem; font-weight: 600; color: #1e293b; }
.rating-count { font-size: 0.75rem; color: #94a3b8; }

.price-col { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.price { font-size: 1.125rem; font-weight: 800; color: #2563eb; line-height: 1.2; }
.per-hour { font-size: 0.75rem; color: #64748b; }

/* ROW 2 badges */
.badges-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.verified-badge {
  display: inline-flex; align-items: center; gap: 0.25rem;
  background: #d1fae5; color: #065f46;
  padding: 0.2rem 0.6rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 600;
}
.report-badge {
  display: inline-flex; align-items: center; gap: 0.25rem;
  background: #fef3c7; color: #92400e;
  padding: 0.2rem 0.6rem; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 600;
}

/* ROW 3 servicios */
.services-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
.tag {
  display: inline-flex; align-items: center;
  border-radius: 9999px; padding: 0.25rem 0.625rem;
  font-size: 0.75rem; font-weight: 500;
}
.tag-blue { background: #eef2ff; color: #4f46e5; }
.tag-gray { background: #f1f5f9; color: #475569; }

/* ROW 4 info */
.info-row { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.8125rem; color: #64748b; }
.info-item { display: flex; align-items: center; gap: 0.3rem; }

/* Botón */
.view-btn {
  width: 100%; padding: 0.5rem;
  border: 1px solid #e2e8f0; border-radius: 0.5rem;
  background: white; color: #334155;
  font-size: 0.875rem; font-weight: 500;
  cursor: pointer; text-align: center;
  transition: background 0.12s;
  margin-top: auto;
}
.view-btn:hover { background: #f8fafc; }
</style>
