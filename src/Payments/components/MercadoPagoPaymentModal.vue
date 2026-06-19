<template>
  <!-- Modal de pago vía Mercado Pago Perú.
       Tiene DOS comportamientos según el entorno:

       (A) Localhost (dev): el botón "Ir a pagar" abre el checkout en una NUEVA
           pestaña, no redirige la actual. La pestaña original cambia a un
           estado "esperando" con un botón "Ya pagué, verificar". El cliente
           paga en la otra pestaña, vuelve a esta y aprieta el botón para que
           el backend busque su pago en MP por external_reference y lo
           registre. Esto evita la limitación de MP en sandbox + localhost
           donde el redirect automático no funciona.

       (B) Producción (HTTPS): el botón redirige la pestaña actual al checkout
           normalmente. MP hace auto-redirect de vuelta a /payment-success
           gracias a auto_return = "approved" que sí funciona con dominios
           públicos. PaymentSuccessView confirma el pago automáticamente. -->
  <div class="modal-overlay" @click.self="close">
    <div class="modal-box">
      <h3 class="modal-title">💳 {{ t('mppayments.mercadoPago.title') || 'Pagar con Mercado Pago' }}</h3>

      <!-- Resumen del booking. -->
      <div class="summary">
        <div class="row">
          <span>{{ t('mppayments.amount') || 'Monto' }}</span>
          <strong>S/. {{ Number(booking.totalAmount).toFixed(2) }}</strong>
        </div>
        <div class="row muted">
          <span>{{ t('mppayments.bookingRef') || 'Reserva' }}</span>
          <span>#{{ booking.id }}</span>
        </div>
      </div>

      <!-- ESTADO INICIAL: instrucciones + botón "Ir a pagar" -->
      <template v-if="phase === 'initial'">
        <p class="help-text">
          <template v-if="isLocalhost">
            <span v-html="t('mppayments.mercadoPago.newTabInstructions')"></span>
          </template>
          <template v-else>
            {{ t('mppayments.mercadoPago.instructions') ||
               'Serás redirigido al checkout seguro de Mercado Pago para completar tu pago. Al volver, tu reserva quedará marcada como pagada.' }}
          </template>
        </p>

        <div v-if="isSandbox" class="sandbox-banner">
          🧪 {{ t('mppayments.mercadoPago.sandbox') || 'Modo sandbox: usa las tarjetas de prueba que te dio MP.' }}
        </div>

        <div v-if="error" class="alert error-box">{{ error }}</div>

        <div class="modal-actions">
          <button class="btn btn-secondary flex-1" :disabled="loading" @click="close">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary flex-1" :disabled="loading" @click="startCheckout">
            <span v-if="loading" class="spinner-sm"></span>
            {{ loading ? (t('mppayments.processing') || 'Procesando…') : (t('mppayments.mercadoPago.payNow') || 'Ir a pagar →') }}
          </button>
        </div>
      </template>

      <!-- ESTADO ESPERANDO (solo localhost): "Ya pagué, verificar" -->
      <template v-else-if="phase === 'waiting'">
        <div class="waiting-box">
          <div class="waiting-icon">⏳</div>
          <p class="waiting-text">
            {{ t('mppayments.waitingText') }}
          </p>
          <p class="waiting-hint">
            {{ t('mppayments.waitingHint') }}
          </p>
        </div>

        <div v-if="error" class="alert error-box">{{ error }}</div>
        <div v-if="info" class="alert info-box">{{ info }}</div>

        <div class="modal-actions">
          <button class="btn btn-secondary flex-1" :disabled="verifying" @click="close">
            {{ t('common.cancel') }}
          </button>
          <button class="btn btn-primary flex-1" :disabled="verifying" @click="verifyPayment">
            <span v-if="verifying" class="spinner-sm"></span>
            {{ verifying ? t('mppayments.verifying') : t('mppayments.verifyPaying') }}
          </button>
        </div>
      </template>

      <!-- ESTADO ÉXITO -->
      <template v-else-if="phase === 'success'">
        <div class="success-box">
          <div class="success-icon">✅</div>
          <p class="success-text">{{ t('mppayments.successTitle') }}</p>
          <p class="success-hint">{{ t('mppayments.successHint') }}</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary flex-1" @click="closeWithSuccess">
            {{ t('common.close') || 'Cerrar' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import api from "../../Shared/api.js";

const props = defineProps({
  booking: { type: Object, required: true },
});
const emit = defineEmits(["close", "redirecting", "paid"]);

const { t } = useI18n();

// El frontend decide qué flujo usar según el hostname. Lo mismo el backend hace
// con auto_return: si la URL es localhost, omite el auto-redirect.
const isLocalhost = window.location.hostname === "localhost"
                 || window.location.hostname === "127.0.0.1";

const phase = ref("initial");     // initial | waiting | success
const loading = ref(false);
const verifying = ref(false);
const error = ref("");
const info = ref("");
const isSandbox = ref(false);

function close() {
  if (loading.value || verifying.value) return;
  emit("close");
}
function closeWithSuccess() {
  emit("paid");
  emit("close");
}

// Al montar, consultamos al backend si MP está en modo sandbox (solo para mostrar el banner).
onMounted(async () => {
  try {
    const { data } = await api.get("/payments/mercadopago/status");
    isSandbox.value = !!data?.sandbox;
  } catch { /* ignore */ }
});

async function startCheckout() {
  loading.value = true;
  error.value = "";
  try {
    const { data } = await api.post("/payments/mercadopago/preference", {
      bookingId: props.booking.id,
    });
    if (!data?.checkoutUrl) {
      throw new Error("Mercado Pago no devolvió URL de checkout.");
    }

    try {
      sessionStorage.setItem(`mp_pref_${props.booking.id}`, data.preferenceId);
    } catch { /* sessionStorage puede no estar en modo privado */ }

    if (isLocalhost) {
      // Localhost: nueva pestaña + modal espera al click "Ya pagué".
      window.open(data.checkoutUrl, "_blank", "noopener");
      phase.value = "waiting";
      loading.value = false;
    } else {
      // Deploy: redirige la pestaña actual. MP hace auto_return.
      emit("redirecting");
      window.location.href = data.checkoutUrl;
    }
  } catch (e) {
    error.value = e?.response?.data?.error || e?.message || (t('common.error') || 'Error');
    loading.value = false;
  }
}

async function verifyPayment() {
  verifying.value = true;
  error.value = "";
  info.value = "";
  try {
    const { data } = await api.post("/payments/mercadopago/confirm-by-booking", {
      bookingId: props.booking.id,
    });
    if (data?.status === "approved") {
      phase.value = "success";
    } else {
      info.value = "Aún no detectamos el pago. Intenta de nuevo en unos segundos.";
    }
  } catch (e) {
    // 404 = todavía no hay pago aprobado. No es un error real, es feedback.
    if (e?.response?.status === 404) {
      info.value = e?.response?.data?.error
        || t('mppayments.retryHint');
    } else {
      error.value = e?.response?.data?.error || e?.message || (t('common.error') || 'Error');
    }
  } finally {
    verifying.value = false;
  }
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 100; }
.modal-box { background: white; border-radius: 1rem; padding: 1.5rem; max-width: 440px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.modal-title { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0 0 0.75rem; }

.summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.75rem; }
.summary .row { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.9rem; color: #1e293b; }
.summary .row.muted { color: #64748b; font-size: 0.8rem; }
.summary strong { color: #2563eb; font-size: 1rem; }

.help-text { font-size: 0.8125rem; color: #475569; line-height: 1.5; margin: 0 0 0.75rem; }

.sandbox-banner { background: #fef3c7; color: #92400e; border-left: 3px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.75rem; margin-bottom: 0.75rem; }

.waiting-box { text-align: center; padding: 1.25rem 0.5rem; margin-bottom: 0.5rem; }
.waiting-icon { font-size: 2.25rem; margin-bottom: 0.5rem; }
.waiting-text { font-size: 0.9375rem; color: #1e293b; font-weight: 600; margin: 0 0 0.3rem; }
.waiting-hint { font-size: 0.8125rem; color: #64748b; margin: 0; }

.success-box { text-align: center; padding: 1.25rem 0.5rem; margin-bottom: 0.5rem; }
.success-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.success-text { font-size: 1.0625rem; color: #16a34a; font-weight: 700; margin: 0 0 0.3rem; }
.success-hint { font-size: 0.8125rem; color: #64748b; margin: 0; }

.alert.error-box { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; margin-bottom: 0.75rem; }
.alert.info-box { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 0.625rem 0.75rem; border-radius: 0.5rem; font-size: 0.8125rem; margin-bottom: 0.75rem; }

.modal-actions { display: flex; gap: 0.75rem; }
.flex-1 { flex: 1; }
.spinner-sm { width: 0.875rem; height: 0.875rem; border: 2px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; margin-right: 0.4rem; vertical-align: middle; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
