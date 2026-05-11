<template>
  <div class="view-container">
    <h1 class="page-title mb-6">{{ t('nav.bookings') }}</h1>

    <!-- Show loading spinner -->
    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>

    <!-- Empty state if no bookings -->
    <div v-else-if="!bookings.length" class="card empty-state">
      <div class="empty-illustration">📅</div>
      <p class="empty-text">{{ t('dashboard.noBookings') }}</p>
      <router-link to="/client/search" class="btn btn-primary submit-btn">Buscar trabajadoras</router-link>
    </div>

    <!-- Display booking list -->
    <div v-else class="booking-list">
      <div v-for="b in bookings" :key="b.id" class="card">
        <!-- Booking header with worker info and status -->
        <div class="booking-header">
          <div class="worker-info">
            <div class="worker-avatar-sm avatar-blue">
              <span class="avatar-initial">{{ (b.workerName || 'W')[0] }}</span>
            </div>
            <div>
              <div class="worker-name">{{ b.workerName }}</div>
              <div class="worker-service">{{ t(`worker.services.${b.serviceType}`) }}</div>
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
            <!-- Show rating button if completed and not reviewed -->
            <button v-if="b.status === 'completed' && !b._reviewed" @click="openReview(b)" class="btn btn-outline btn-sm">⭐ Calificar</button>
            <!-- Show cancel button if pending -->
            <button v-if="b.status === 'pending'" @click="cancelBooking(b.id)" class="btn btn-danger btn-sm">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Review modal overlay -->
    <div v-if="reviewBooking" class="modal-overlay" @click.self="reviewBooking = null">
      <div class="modal-box">
        <h3 class="card-title">Calificar servicio</h3>
        <p class="muted-text mb-3">{{ reviewBooking.workerName }}</p>
        <!-- Star rating selector -->
        <div class="rating-container">
          <button v-for="i in 5" :key="i" @click="reviewForm.rating = i" class="rating-btn" :style="{ opacity: i <= reviewForm.rating ? 1 : 0.3 }">⭐</button>
        </div>
        <!-- Review comment textarea -->
        <textarea v-model="reviewForm.comment" class="input-field mb-4" rows="3" placeholder="Escribe tu reseña..."></textarea>
        <!-- Modal actions -->
        <div class="modal-actions">
          <button @click="reviewBooking = null" class="btn btn-secondary flex-1">{{ t('common.cancel') }}</button>
          <button @click="submitReview" class="btn btn-primary flex-1" :disabled="!reviewForm.rating">Enviar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "../../Shared/stores/toast.js";
import api from "../../Shared/api.js";

const { t } = useI18n();
const toast = useToastStore();
const bookings = ref([]);
const loading = ref(true);
const reviewBooking = ref(null);
const reviewForm = ref({ rating: 0, comment: "" });

// Return CSS class based on booking status
function statusBadge(s) {
  return { pending:"badge badge-yellow", accepted:"badge badge-blue", completed:"badge badge-green", rejected:"badge badge-red", cancelled:"badge badge-gray" }[s] || "badge badge-gray";
}

// Open review modal for booking
function openReview(b) { reviewBooking.value = b; reviewForm.value = { rating: 0, comment: "" }; }

// Cancel a booking
async function cancelBooking(id) {
  await api.patch(`/bookings/${id}/status`, { status: "cancelled" });
  await load();
  toast.success("Reserva cancelada");
}

// Submit rating and review
async function submitReview() {
  await api.post("/reviews", { bookingId: reviewBooking.value.id, workerId: reviewBooking.value.workerId, ...reviewForm.value });
  reviewBooking.value = null;
  toast.success("¡Gracias por tu reseña!");
  await load();
}

// Fetch all bookings for current user
async function load() {
  loading.value = true;
  const { data } = await api.get("/bookings");
  // Sort by creation date (newest first)
  bookings.value = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  loading.value = false;
}

// Load data on component mount
onMounted(load);
</script>

<style scoped>
.view-container {
  max-width: 1024px;
  margin: 0 auto;
}

.page-title {
  font-size: 1.875rem;
  font-weight: 800;
  color: #0f172a;
}
.mb-6 { margin-bottom: 1.5rem; }

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
.empty-text { color: #64748b; margin-bottom: 1.5rem; }
.submit-btn { display: inline-block; }

.booking-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.booking-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.worker-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.worker-avatar-sm { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.avatar-blue { background:#2563eb; }
.avatar-initial { color:white; font-size:0.875rem; font-weight:700; }
.worker-name { font-weight:700; color:#1e293b; }
.worker-service { font-size:0.8125rem; color:#64748b; }

.meta-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: #64748b;
  flex-wrap: wrap;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.card-footer { 
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top:1px solid #f1f5f9; 
  margin-top:0.875rem; 
  padding-top:0.875rem; 
}
.total-label { font-size:0.8125rem; color:#64748b; }
.total-amount { font-weight:700; color:#1e293b; margin-left:0.25rem; }

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.modal-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;padding:1rem; }
.modal-box { background:white;border-radius:1rem;padding:1.5rem;width:100%;max-width:400px; }

.card-title { font-weight:700; margin-bottom:1rem; font-size: 1.25rem; }
.muted-text { font-size:0.875rem; color:#64748b; }
.mb-3 { margin-bottom: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }

.rating-container {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.rating-btn { font-size:1.75rem; background:none; border:none; cursor:pointer; padding: 0; }

.modal-actions {
  display: flex;
  gap: 0.75rem;
}
.flex-1 { flex: 1; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
.spinner-lg { width:36px; height:36px; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
