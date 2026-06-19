<template>
  <!-- Pantalla a la que Mercado Pago redirige tras un pago.
       URL ejemplo (back_url success):
         /client/payment-success?collection_id=12345678&collection_status=approved
         &payment_id=12345678&status=approved&external_reference=42&preference_id=abc-123
       (los nombres exactos del query dependen de MP; usamos payment_id y external_reference)

       Flujo:
         1) Tomamos payment_id del query.
         2) Si no viene en el query, intentamos collection_id (alias) como fallback.
         3) Recuperamos preference_id (del query o de sessionStorage si MP no lo mandó).
         4) Llamamos a POST /api/payments/mercadopago/confirm con bookingId+paymentId.
         5) El backend consulta el estado autoritativo en MP y persiste el ServicePayment. -->
  <div class="pp-wrapper">
    <div class="pp-card">

      <!-- Verificando -->
      <div v-if="state === 'verifying'" class="pp-state">
        <div class="pp-spinner"></div>
        <h2 class="pp-title">Procesando tu pago…</h2>
        <p class="pp-text">Confirmando con Mercado Pago, no cierres esta ventana.</p>
      </div>

      <!-- OK -->
      <div v-else-if="state === 'success'" class="pp-state">
        <div class="pp-icon-ok">✓</div>
        <h2 class="pp-title">¡Pago completado!</h2>
        <p class="pp-text">
          Se cobraron <strong>S/. {{ amount?.toFixed(2) }}</strong> a través de Mercado Pago.
        </p>
        <p v-if="paymentId" class="pp-fine-print">
          ID de transacción: <code>{{ paymentId }}</code>
        </p>
        <button class="pp-btn pp-btn-primary" @click="goBookings">Volver a Reservas</button>
      </div>

      <!-- Pendiente: MP devolvió pending o in_process (PagoEfectivo, etc.) -->
      <div v-else-if="state === 'pending'" class="pp-state">
        <div class="pp-icon-pending">⏳</div>
        <h2 class="pp-title">Pago en proceso</h2>
        <p class="pp-text">
          Mercado Pago aún está procesando tu pago. Cuando se confirme, tu reserva
          quedará marcada como pagada automáticamente. Puedes cerrar esta ventana.
        </p>
        <button class="pp-btn pp-btn-secondary" @click="goBookings">Volver a Reservas</button>
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
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../Shared/stores/auth.js";
import api from "../../Shared/api.js";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const state = ref("verifying"); // "verifying" | "success" | "pending" | "error"
const errorMessage = ref("");
const paymentId = ref(null);
const amount = ref(null);

function goBookings() {
  router.replace("/client/bookings");
}

onMounted(async () => {
  if (!auth.isLoggedIn) {
    state.value = "error";
    errorMessage.value = "Sesión expirada. Vuelve a entrar para ver el estado del pago.";
    return;
  }

  // MP devuelve el id del pago en payment_id (a veces collection_id como alias).
  const mpPaymentId = route.query.payment_id || route.query.collection_id;
  // external_reference es nuestro bookingId, lo configuramos al crear la preferencia.
  const bookingIdFromQuery = route.query.external_reference || route.query.bookingId;
  const bookingId = bookingIdFromQuery ? parseInt(bookingIdFromQuery, 10) : null;

  if (!mpPaymentId || !bookingId) {
    state.value = "error";
    errorMessage.value = "Faltan datos del pago. Vuelve a iniciar el pago desde Reservas.";
    return;
  }

  // Si MP marcó el pago como pending (PagoEfectivo, transferencia en proceso),
  // no intentamos confirmar — mostramos un mensaje y dejamos que el cliente
  // espere. Cuando el pago se complete, lo verá al refrescar Mis Reservas.
  const queryStatus = String(route.query.status || route.query.collection_status || "").toLowerCase();
  if (queryStatus === "pending" || queryStatus === "in_process" || route.query.pending === "1") {
    state.value = "pending";
    return;
  }

  // Recuperamos el preferenceId que guardamos en sessionStorage antes del redirect.
  // Es opcional — el backend ya tiene todo lo necesario con paymentId — pero útil
  // para trazabilidad / debug.
  let preferenceId = route.query.preference_id || null;
  try {
    if (!preferenceId) preferenceId = sessionStorage.getItem(`mp_pref_${bookingId}`) || null;
  } catch { /* sessionStorage puede no estar disponible */ }

  try {
    const { data } = await api.post("/payments/mercadopago/confirm", {
      bookingId,
      paymentId: String(mpPaymentId),
      preferenceId,
    });
    state.value = "success";
    paymentId.value = mpPaymentId;
    amount.value = data.amount;
    // Limpiamos el preferenceId persistido — ya cumplió su rol.
    try { sessionStorage.removeItem(`mp_pref_${bookingId}`); } catch { /* noop */ }
  } catch (e) {
    state.value = "error";
    errorMessage.value = e?.response?.data?.error || e?.message || "Error al confirmar el pago.";
  }
});
</script>

<style scoped>
.pp-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%); }
.pp-card { width: 100%; max-width: 460px; background: white; border-radius: 1rem; box-shadow: 0 20px 40px rgba(0,0,0,0.08); padding: 2.5rem 2rem; text-align: center; }
.pp-state { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.pp-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
.pp-text { color: #475569; font-size: 0.9375rem; margin: 0; line-height: 1.5; }
.pp-fine-print { color: #94a3b8; font-size: 0.75rem; margin: 0; }
.pp-fine-print code { background: #f1f5f9; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: ui-monospace, monospace; font-size: 0.7rem; }
.pp-spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #009ee3; border-radius: 50%; width: 56px; height: 56px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.pp-icon-ok { font-size: 3rem; color: #10b981; }
.pp-icon-pending { font-size: 3rem; color: #f59e0b; }
.pp-icon-err { font-size: 3rem; }
.pp-btn { margin-top: 0.5rem; padding: 0.625rem 1.25rem; border-radius: 0.5rem; font-size: 0.9375rem; font-weight: 600; border: none; cursor: pointer; }
.pp-btn-primary { background: #009ee3; color: white; }
.pp-btn-primary:hover { background: #007eb5; }
.pp-btn-secondary { background: #f1f5f9; color: #475569; }
.pp-btn-secondary:hover { background: #e2e8f0; }
</style>
