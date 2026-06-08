<template>
  <!-- Modal de pago Izipay. Tiene dos modos:
       1) Simulación: muestra dos botones "Aprobar" / "Rechazar" para demo.
       2) Real: inyecta el SDK Krypton de Izipay y renderiza el formulario de tarjeta. -->
  <div class="izp-overlay" @click.self="cancel">
    <div class="izp-card">
      <div class="izp-header">
        <h3 class="izp-title">
          <span class="izp-logo-icon">💳</span>
          Pagar con Izipay
        </h3>
        <button class="izp-close" @click="cancel" aria-label="cerrar">×</button>
      </div>

      <div class="izp-amount-row">
        <span class="izp-amount-label">Total a pagar</span>
        <span class="izp-amount-value">S/. {{ amount > 0 ? Number(amount).toFixed(2) : '—' }}</span>
      </div>

      <!-- Cargando token -->
      <div v-if="state === 'loading'" class="izp-state">
        <div class="izp-spinner"></div>
        <p class="izp-text">Preparando formulario seguro de pago…</p>
      </div>

      <!-- Error al pedir el formToken -->
      <div v-else-if="state === 'error'" class="izp-state">
        <div class="izp-icon-error">⚠️</div>
        <p class="izp-text">{{ errorMessage }}</p>
        <button class="izp-btn izp-btn-secondary" @click="cancel">Cerrar</button>
      </div>

      <!-- Modo simulación -->
      <div v-else-if="state === 'sim'" class="izp-state">
        <div class="izp-sim-card">
          <div class="izp-sim-banner">⚙️ Modo simulación — no se cobrará nada</div>
          <div class="izp-sim-fields">
            <div class="izp-field">
              <label>Número de tarjeta</label>
              <input value="4970 1000 0000 0055" disabled />
            </div>
            <div class="izp-field-row">
              <div class="izp-field">
                <label>Vencimiento</label>
                <input value="12/30" disabled />
              </div>
              <div class="izp-field">
                <label>CVV</label>
                <input value="123" disabled />
              </div>
            </div>
            <div class="izp-field">
              <label>Orden</label>
              <input :value="orderId" disabled />
            </div>
          </div>
        </div>
        <div class="izp-actions">
          <button class="izp-btn izp-btn-success" :disabled="busy" @click="simConfirm(true)">
            <span v-if="busy" class="izp-spinner-sm"></span>
            ✓ Simular pago aprobado
          </button>
          <button class="izp-btn izp-btn-danger" :disabled="busy" @click="simConfirm(false)">
            ✕ Simular rechazo
          </button>
        </div>
      </div>

      <!-- Modo real: contenedor del SDK Krypton -->
      <div v-else-if="state === 'real'" class="izp-state">
        <div ref="krContainer" class="kr-embedded" :kr-form-token="formToken"></div>
        <p class="izp-fine-print">
          🔒 Tu información se procesa de forma segura por Izipay. InCleanHome no almacena datos de tarjeta.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Modal de pago Izipay para servicio completado.
//
// Props:
//   bookingId (Number, requerido) — El booking que se va a pagar. El backend
//                                   toma el monto del booking, no se pasa
//                                   por aquí (previene manipulación).
//
// Emits:
//   success(payload) — Pago aprobado. payload = { orderId, simulated, paymentId,
//                       amount, workerEarning, platformFee }
//   failed(reason)   — Pago rechazado o cancelado
//   close()          — Usuario cerró el modal sin completar

import { ref, onMounted, onBeforeUnmount } from "vue";
import api from "../../Shared/api.js";

const props = defineProps({
  bookingId: { type: Number, required: true },
});
const emit = defineEmits(["success", "failed", "close"]);

const state = ref("loading");   // "loading" | "error" | "sim" | "real"
const errorMessage = ref("");
const formToken = ref("");
const orderId = ref("");
const publicKey = ref("");
const endpoint = ref("");
const amount = ref(0);          // El backend lo devuelve junto con el formToken
const busy = ref(false);
const krContainer = ref(null);

let krScriptEl = null;

function cancel() {
  emit("close");
}

async function simConfirm(success) {
  if (busy.value) return;
  busy.value = true;
  try {
    const { data } = await api.post("/payments/izipay/confirm-simulation", {
      bookingId: props.bookingId,
      orderId: orderId.value,
      success,
    });
    if (success) {
      emit("success", {
        orderId: orderId.value,
        simulated: true,
        paymentId: data.paymentId,
        amount: data.amount,
        workerEarning: data.workerEarning,
        platformFee: data.platformFee,
      });
    } else {
      emit("failed", "Pago rechazado por el usuario (simulación)");
    }
  } catch (e) {
    errorMessage.value = e?.response?.data?.error || e.message || "Error de simulación";
    state.value = "error";
  } finally {
    busy.value = false;
  }
}

// Carga el SDK Krypton y monta el formulario real (solo en modo real).
function loadKryptonAndMount() {
  // El SDK exige el public key en la URL del script.
  const src = `${endpoint.value}/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js?kr-public-key=${encodeURIComponent(publicKey.value)}`;
  krScriptEl = document.createElement("script");
  krScriptEl.src = src;
  krScriptEl.async = true;
  krScriptEl.onload = () => {
    if (window.KR) {
      window.KR.onSubmit((event) => {
        const ok = event?.clientAnswer?.orderStatus === "PAID";
        if (ok) emit("success", { orderId: orderId.value, simulated: false });
        else emit("failed", event?.clientAnswer?.orderStatus || "Pago no completado");
        return false;
      });
      window.KR.onError((err) => {
        emit("failed", err?.errorMessage || "Error en el formulario de pago");
      });
    }
  };
  krScriptEl.onerror = () => {
    errorMessage.value = "No se pudo cargar el SDK de Izipay.";
    state.value = "error";
  };
  document.head.appendChild(krScriptEl);
}

onMounted(async () => {
  try {
    // Nuevo contrato: el backend toma el monto del booking, no del request.
    const { data } = await api.post("/payments/izipay/create-charge", {
      bookingId: props.bookingId,
    });
    formToken.value = data.formToken;
    publicKey.value = data.publicKey;
    endpoint.value  = data.endpoint;
    orderId.value   = data.orderId;
    amount.value    = data.amount;

    if (data.simulated) {
      state.value = "sim";
    } else {
      state.value = "real";
      setTimeout(loadKryptonAndMount, 50);
    }
  } catch (e) {
    errorMessage.value = e?.response?.data?.error || e.message || "Error al iniciar el pago";
    state.value = "error";
  }
});

onBeforeUnmount(() => {
  if (krScriptEl && krScriptEl.parentNode) {
    krScriptEl.parentNode.removeChild(krScriptEl);
  }
});
</script>

<style scoped>
.izp-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 1rem;
  z-index: 1000;
}
.izp-card {
  background: white; width: 100%; max-width: 460px;
  border-radius: 1rem; box-shadow: 0 30px 60px rgba(0,0,0,0.25);
  padding: 1.5rem; max-height: 92vh; overflow-y: auto;
}
.izp-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.izp-title { font-size: 1.125rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 0.5rem; margin: 0; }
.izp-logo-icon { font-size: 1.375rem; }
.izp-close { background: none; border: none; font-size: 1.75rem; line-height: 1; color: #94a3b8; cursor: pointer; padding: 0; }
.izp-close:hover { color: #475569; }

.izp-amount-row {
  display: flex; align-items: baseline; justify-content: space-between;
  padding: 1rem; background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
  border-radius: 0.75rem; margin-bottom: 1.25rem;
}
.izp-amount-label { color: #64748b; font-size: 0.875rem; }
.izp-amount-value { font-size: 1.5rem; font-weight: 800; color: #2563eb; }

.izp-state { display: flex; flex-direction: column; align-items: stretch; gap: 1rem; }
.izp-state .izp-text { color: #64748b; font-size: 0.9375rem; text-align: center; margin: 0; }

.izp-spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; align-self: center; }
.izp-spinner-sm { border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; width: 14px; height: 14px; animation: spin 0.8s linear infinite; display: inline-block; margin-right: 0.375rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
.izp-icon-error { font-size: 2.5rem; text-align: center; }

/* Simulación */
.izp-sim-card { background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; }
.izp-sim-banner {
  background: #fef3c7; color: #92400e; padding: 0.5rem 0.75rem;
  border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600;
  text-align: center; margin-bottom: 0.875rem;
}
.izp-sim-fields { display: flex; flex-direction: column; gap: 0.75rem; }
.izp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.izp-field { display: flex; flex-direction: column; gap: 0.25rem; }
.izp-field label { font-size: 0.75rem; font-weight: 600; color: #64748b; }
.izp-field input {
  background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem;
  padding: 0.5rem 0.625rem; font-size: 0.875rem; color: #475569;
  font-family: ui-monospace, monospace;
}

.izp-actions { display: flex; flex-direction: column; gap: 0.625rem; }

.izp-btn {
  width: 100%; padding: 0.75rem 1rem; border-radius: 0.625rem;
  font-size: 0.9375rem; font-weight: 600; border: none; cursor: pointer;
  transition: filter 0.15s, transform 0.05s;
  display: flex; align-items: center; justify-content: center; gap: 0.25rem;
}
.izp-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.izp-btn:not(:disabled):hover { filter: brightness(0.95); }
.izp-btn:not(:disabled):active { transform: translateY(1px); }

.izp-btn-success { background: #16a34a; color: white; }
.izp-btn-danger  { background: #dc2626; color: white; }
.izp-btn-secondary { background: #f1f5f9; color: #475569; }

.izp-fine-print { font-size: 0.75rem; color: #94a3b8; text-align: center; margin: 0; }
</style>
