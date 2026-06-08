<template>
  <!-- Pantalla que PayPal redirige tras pago exitoso.
       URL: /client/payment-success?token={orderId}&PayerID={payerId}
       Dispara automáticamente el capture en el backend y muestra resultado. -->
  <div class="pp-wrapper">
    <div class="pp-card">

      <!-- Capturando -->
      <div v-if="state === 'capturing'" class="pp-state">
        <div class="pp-spinner"></div>
        <h2 class="pp-title">Procesando tu pago…</h2>
        <p class="pp-text">Confirmando con PayPal, no cierres esta ventana.</p>
      </div>

      <!-- Capturado OK -->
      <div v-else-if="state === 'success'" class="pp-state">
        <div class="pp-icon-ok">✓</div>
        <h2 class="pp-title">¡Pago completado!</h2>
        <p class="pp-text">
          Se cobraron <strong>{{ currency }} {{ amount?.toFixed(2) }}</strong> a través de PayPal.
        </p>
        <p v-if="captureId" class="pp-fine-print">
          ID de transacción: <code>{{ captureId }}</code>
        </p>
        <button class="pp-btn pp-btn-primary" @click="goBookings">Volver a Reservas</button>
      </div>

      <!-- Error -->
      <div v-else class="pp-state">
        <div class="pp-icon-err">⚠️</div>
        <h2 class="pp-title">El pago no se pudo completar</h2>
        <p class="pp-text">{{ errorMessage }}</p>
        <button class="pp-btn pp-btn-secondary" @click="goBookings">Volver a Reservas</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Esta vista la dispara PayPal después del redirect de pago.
//
// URL ejemplo: /client/payment-success?token=8GR12345AB678901C&PayerID=Y2W123XYZ
//
// El "token" es el orderId que se creó en /create-order. Lo usamos para llamar a
// /capture-order y consolidar el pago en el backend.
//
// El bookingId no viene en la URL — lo recuperamos de sessionStorage donde lo
// guardamos justo antes del redirect (en ClientBookingsView.openPayModal).

import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const state = ref("capturing");   // "capturing" | "success" | "error"
const errorMessage = ref("");
const captureId = ref(null);
const amount = ref(null);
const currency = ref("USD");

function goBookings() {
  // Limpiamos lo que guardamos antes del redirect.
  sessionStorage.removeItem("paypal_pending_booking_id");
  router.replace("/client/bookings");
}

onMounted(async () => {
  // El usuario debería estar logueado todavía (su JWT propio sigue en localStorage).
  if (!auth.isLoggedIn) {
    state.value = "error";
    errorMessage.value = "Sesión expirada. Vuelve a entrar para ver el estado del pago.";
    return;
  }

  const orderId = route.query.token;
  const bookingIdStr = sessionStorage.getItem("paypal_pending_booking_id");
  const bookingId = bookingIdStr ? parseInt(bookingIdStr, 10) : null;

  if (!orderId || !bookingId) {
    state.value = "error";
    errorMessage.value = "Faltan datos del pago (orderId/bookingId). Vuelve a iniciar el pago desde Reservas.";
    return;
  }

  try {
    const { data } = await api.post("/payments/paypal/capture-order", {
      bookingId,
      orderId,
    });
    state.value = "success";
    captureId.value = data.captureId;
    amount.value = data.amount;
    // El monto se cobra en USD (PayPal), pero el booking estaba en S/. — mostramos
    // la moneda real con la que PayPal procesó.
    currency.value = "USD";
  } catch (e) {
    state.value = "error";
    errorMessage.value = e?.response?.data?.error || e?.message || "Error al capturar el pago.";
  }
});
</script>

<style scoped>
.pp-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
}
.pp-card {
  width: 100%;
  max-width: 460px;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  padding: 2.5rem 2rem;
  text-align: center;
}
.pp-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.pp-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
.pp-text { color: #475569; font-size: 0.9375rem; margin: 0; line-height: 1.5; }
.pp-fine-print { color: #94a3b8; font-size: 0.75rem; margin: 0; }
.pp-fine-print code { background: #f1f5f9; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: ui-monospace, monospace; font-size: 0.7rem; }

.pp-spinner {
  border: 3px solid rgba(0,0,0,0.08);
  border-top-color: #0070ba; /* PayPal blue */
  border-radius: 50%;
  width: 56px;
  height: 56px;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.pp-icon-ok { font-size: 3rem; color: #10b981; }
.pp-icon-err { font-size: 3rem; }

.pp-btn {
  margin-top: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
}
.pp-btn-primary { background: #2563eb; color: white; }
.pp-btn-primary:hover { background: #1d4ed8; }
.pp-btn-secondary { background: #f1f5f9; color: #475569; }
.pp-btn-secondary:hover { background: #e2e8f0; }
</style>
