<template>
  <!-- Pantalla cuando el cliente cancela o el pago falla en Mercado Pago.
       URL ejemplo (back_url failure):
         /client/payment-cancel?status=rejected&bookingId=42
       No persiste nada; solo informa y permite volver a intentar. -->
  <div class="pp-wrapper">
    <div class="pp-card">
      <div class="pp-icon">✖️</div>
      <h2 class="pp-title">Pago cancelado</h2>
      <p class="pp-text">
        No se completó el pago con Mercado Pago. Si fue un error, puedes volver a
        intentarlo desde tus reservas.
      </p>
      <button class="pp-btn pp-btn-primary" @click="goBookings">Volver a Reservas</button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
const router = useRouter();
function goBookings() { router.replace("/client/bookings"); }
</script>

<style scoped>
.pp-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%); }
.pp-card { width: 100%; max-width: 460px; background: white; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.08); padding: 2.5rem 2rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.pp-icon { font-size: 3rem; }
.pp-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
.pp-text { color: #475569; font-size: 0.9375rem; margin: 0; line-height: 1.5; }
.pp-btn { margin-top: 0.5rem; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; border: none; cursor: pointer; }
.pp-btn-primary { background: #2563eb; color: white; }
.pp-btn-primary:hover { background: #1d4ed8; }
</style>
