<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="card receipt-card" id="receipt-printable">
      <div class="receipt-header">
        <div class="logo-row">
          <div class="logo-box">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span class="brand">InClean<span class="brand-accent">Home</span></span>
        </div>
        <span class="badge badge-green">{{ t(`booking.status.${booking.status}`) }}</span>
      </div>

      <h3 class="receipt-title">{{ t('booking.receipt') }}</h3>
      <div class="receipt-meta">
        <span>{{ t('booking.receiptNumber') }}: <strong>#{{ String(booking.id).padStart(6, '0') }}</strong></span>
        <span>{{ t('booking.receiptDate') }}: <strong>{{ formatDate(booking.createdAt) }}</strong></span>
      </div>

      <div class="receipt-rows">
        <div class="r-row"><span>{{ t('booking.receiptService') }}</span><span>{{ serviceLabel }}</span></div>
        <div class="r-row"><span>{{ t('booking.receiptWorker') }}</span><span>{{ booking.workerName }}</span></div>
        <div class="r-row"><span>{{ t('booking.receiptClient') }}</span><span>{{ booking.clientName }}</span></div>
        <div class="r-row"><span>{{ t('history.date') }}</span><span>{{ booking.date }} · {{ booking.startTime }}–{{ booking.endTime }}</span></div>
        <div v-if="channelLabel" class="r-row"><span>Método de pago</span><span>{{ channelLabel }}</span></div>
        <div v-if="payment && payment.izipayOrderId" class="r-row"><span>Orden Izipay</span><span style="font-family: ui-monospace, monospace; font-size: 0.75rem;">{{ payment.izipayOrderId }}</span></div>
        <div v-if="payment && payment.paypalOrderId" class="r-row"><span>Orden PayPal</span><span style="font-family: ui-monospace, monospace; font-size: 0.75rem;">{{ payment.paypalOrderId }}</span></div>
        <div v-if="payment && payment.paypalCaptureId" class="r-row"><span>Captura PayPal</span><span style="font-family: ui-monospace, monospace; font-size: 0.75rem;">{{ payment.paypalCaptureId }}</span></div>
      </div>

      <div class="receipt-amounts">
        <!-- Vista TRABAJADORA: ve el desglose con la comisión descontada y su neto -->
        <template v-if="showWorkerNet">
          <div class="a-row"><span>{{ t('booking.receiptServiceAmount') }}</span><span>S/. {{ num(booking.totalAmount) }}</span></div>
          <div class="a-row muted"><span>{{ t('booking.receiptFee') }}</span><span>− S/. {{ num(booking.platformFee) }}</span></div>
          <div class="a-row total worker-net"><span>{{ t('booking.receiptYouReceive') }}</span><span>S/. {{ num(booking.workerEarning) }}</span></div>
        </template>

        <!-- Vista CLIENTE: solo ve el total cobrado (sin desglose de comisión). -->
        <template v-else>
          <div class="a-row"><span>{{ t('booking.receiptServiceAmount') }}</span><span>S/. {{ num(booking.totalAmount) }}</span></div>
          <div class="a-row total"><span>{{ t('booking.receiptTotal') }}</span><span>S/. {{ num(booking.totalAmount) }}</span></div>
        </template>
      </div>

      <div class="modal-actions no-print">
        <button @click="$emit('close')" class="btn btn-secondary flex-1">{{ t('common.back') }}</button>
        <button @click="downloadPdf" class="btn btn-primary flex-1">{{ t('booking.downloadReceipt') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  booking: { type: Object, required: true },
  // Pago efectivo si existe (ServicePayment). Si está presente y el canal fue
  // izipay_card, se muestra una línea adicional con el order ID. Si no se
  // pasa, el modal sigue funcionando con solo los datos del booking.
  payment: { type: Object, default: null },
  showWorkerNet: { type: Boolean, default: false },
});
defineEmits(["close"]);

const { t } = useI18n();

const channelLabel = computed(() => {
  if (!props.payment) return null;
  return ({
    izipay_card: "💳 Tarjeta (Izipay)",
    paypal: "🅿️ PayPal",
    yape: "📱 Yape",
    plin: "📲 Plin",
    bank_transfer: "🏦 Transferencia bancaria",
    cash: "💵 Efectivo",
  })[props.payment.channel] || props.payment.channel;
});

const serviceLabel = computed(() => {
  const key = `worker.services.${props.booking.serviceType}`;
  const translated = t(key);
  return translated === key ? props.booking.serviceType : translated;
});

function num(v) { return (Number(v) || 0).toFixed(2); }
function formatDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

// Genera un comprobante en PDF con el mismo diseño que la ventana modal.
// El desglose de montos depende del rol (showWorkerNet).
async function downloadPdf() {
  // Carga jsPDF perezosamente para que no se descargue si no hace falta.
  const { jsPDF } = await import("jspdf");
  const b = props.booking;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Paleta (coincide con el modal).
  const NAVY = [30, 41, 59];
  const BLUE = [37, 99, 235];
  const MUTED = [100, 116, 139];
  const LIGHT = [148, 163, 184];
  const GREEN = [22, 163, 74];
  const PAD_X = 56;
  let y = 60;

  // --- Encabezado: logo + brand a la izquierda, badge de estado a la derecha ---
// Logo: fondo azul + casita blanca
  doc.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.roundedRect(PAD_X, y - 20, 30, 30, 7, 7, "F");

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(2);
  doc.setLineCap("round");
  doc.setLineJoin("round");

// Coordenadas del logo
  const lx = PAD_X;
  const ly = y - 20;

// Techo de la casa
  doc.line(lx + 9, ly + 15, lx + 15, ly + 9);
  doc.line(lx + 15, ly + 9, lx + 21, ly + 15);

// Cuerpo de la casa
  doc.line(lx + 9, ly + 15, lx + 9, ly + 24);
  doc.line(lx + 9, ly + 24, lx + 21, ly + 24);
  doc.line(lx + 21, ly + 24, lx + 21, ly + 15);

// Puerta
  doc.line(lx + 13, ly + 24, lx + 13, ly + 18);
  doc.line(lx + 13, ly + 18, lx + 17, ly + 18);
  doc.line(lx + 17, ly + 18, lx + 17, ly + 24);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("InClean", PAD_X + 42, y);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text("Home", PAD_X + 42 + doc.getTextWidth("InClean"), y);

  // Badge "completed" en verde
  const badgeText = t(`booking.status.${b.status}`);
  doc.setFillColor(209, 250, 229);
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const bw = doc.getTextWidth(badgeText) + 18;
  doc.roundedRect(595 - PAD_X - bw, y - 14, bw, 20, 10, 10, "F");
  doc.text(badgeText, 595 - PAD_X - bw + 9, y);

  y += 30;
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(t('booking.receipt'), PAD_X, y);


  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(t('booking.receiptNumber') + `: #${String(b.id).padStart(6, "0")}`, PAD_X, y);
  y += 14;
  doc.text(t('booking.receiptDate') + `: ${formatDate(b.createdAt)}`, PAD_X, y);

  // --- Detalle del servicio (filas etiqueta/valor) ---
  y += 22;
  doc.setDrawColor(226, 232, 240);
  doc.line(PAD_X, y, 595 - PAD_X, y);
  y += 16;

  const rowDetail = (label, value) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label, PAD_X, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const text = String(value ?? "—");
    doc.text(text, 595 - PAD_X - doc.getTextWidth(text), y);
    y += 16;
  };
  rowDetail(t('booking.receiptService'), serviceLabel.value);
  rowDetail(t('booking.receiptWorker'), b.workerName);
  rowDetail(t('booking.receiptClient'), b.clientName);
  rowDetail(t('history.date'), `${b.date} · ${b.startTime}–${b.endTime}`);

  y += 6;
  doc.line(PAD_X, y, 595 - PAD_X, y);
  y += 22;

  // --- Montos (vista según rol) ---
  const rowAmount = (label, value, opts = {}) => {
    doc.setFontSize(opts.size || 11);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const color = opts.color || NAVY;
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(label, PAD_X, y);
    doc.text(value, 595 - PAD_X - doc.getTextWidth(value), y);
    y += opts.bold ? 20 : 17;
  };

  if (props.showWorkerNet) {
    rowAmount(t('booking.receiptServiceAmount'), `S/. ${num(b.totalAmount)}`);
    rowAmount(t('booking.receiptFee'), `S/.${num(b.platformFee)}`, { color: LIGHT });
    y += 4;
    doc.setLineDashPattern([2, 2], 0);
    doc.line(PAD_X, y, 595 - PAD_X, y);
    doc.setLineDashPattern([], 0);
    y += 16;
    rowAmount(t('booking.receiptYouReceive'), `S/. ${num(b.workerEarning)}`, { bold: true, size: 13, color: GREEN });
  } else {
    rowAmount(t('booking.receiptServiceAmount'), `S/. ${num(b.totalAmount)}`);
    y += 2;
    doc.setLineDashPattern([2, 2], 0);
    doc.line(PAD_X, y, 595 - PAD_X, y);
    doc.setLineDashPattern([], 0);
    y += 16;
    rowAmount(t('booking.receiptTotal'), `S/. ${num(b.totalAmount)}`, { bold: true, size: 13 });
  }

  // Pie de página
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.text("InCleanHome — Documento generado automáticamente. No requiere firma.",
    PAD_X, 800);

  doc.save(`comprobante-${String(b.id).padStart(6, "0")}.pdf`);
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.receipt-card { width: 100%; max-width: 460px; padding: 1.75rem; }
.receipt-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
.logo-row { display: flex; align-items: center; gap: 0.5rem; }
.logo-box { width:32px; height:32px; background: linear-gradient(135deg,#2563eb,#06b6d4); border-radius:9px; display:flex; align-items:center; justify-content:center; }
.brand { font-size:1.1rem; font-weight:800; color:#1e293b; }
.brand-accent { color:#2563eb; }
.badge { padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
.badge-green { background:#d1fae5; color:#065f46; }
.receipt-title { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem; }
.receipt-meta { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.8125rem; color: #64748b; margin-bottom: 1rem; }
.receipt-rows { border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 0.75rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
.r-row { display: flex; justify-content: space-between; font-size: 0.875rem; }
.r-row span:first-child { color: #64748b; }
.r-row span:last-child { color: #1e293b; font-weight: 500; }
.receipt-amounts { padding: 1rem 0; display: flex; flex-direction: column; gap: 0.5rem; }
.a-row { display: flex; justify-content: space-between; font-size: 0.9375rem; }
.a-row.muted { color: #94a3b8; }
.a-row.total { font-weight: 700; color: #1e293b; font-size: 1.0625rem; border-top: 1px dashed #cbd5e1; padding-top: 0.5rem; }
.a-row.worker-net { color: #16a34a; font-weight: 600; }
.a-row.note { color: #94a3b8; font-size: 0.8125rem; font-style: italic; }
.modal-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.flex-1 { flex: 1; }
</style>
