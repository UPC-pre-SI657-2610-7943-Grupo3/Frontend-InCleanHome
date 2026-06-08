<template>
  <div class="pp-wrapper">
    <div class="pp-card">
      <div class="pp-state">
        <div class="pp-icon">⊘</div>
        <h2 class="pp-title">Pago cancelado</h2>
        <p class="pp-text">
          Cancelaste el pago con PayPal antes de completarlo.<br/>
          La reserva sigue marcada como pendiente de pago.
        </p>
        <p class="pp-fine-print">
          Puedes intentar pagar otra vez desde tu lista de reservas.
        </p>
        <button class="pp-btn pp-btn-primary" @click="goBookings">Volver a Reservas</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

function goBookings() {
  sessionStorage.removeItem("paypal_pending_booking_id");
  router.replace("/client/bookings");
}

onMounted(() => {
  // No hacemos nada extra — el cliente puede reintentar el pago desde /bookings.
});
</script>

<style scoped>
.pp-wrapper {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: linear-gradient(135deg, #fff7ed 0%, #fef3c7 100%);
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
.pp-fine-print { color: #94a3b8; font-size: 0.8125rem; margin: 0; }
.pp-icon { font-size: 3rem; color: #f59e0b; }

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
</style>
