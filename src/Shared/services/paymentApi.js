// Helper centralizado para consultar/operar sobre ServicePayments del backend.
//
// Reemplaza el uso de localStorage.inclean_paid / inclean_charged / inclean_payment_X
// del flujo viejo. Ahora todo viene de /api/service-payments/.
//
// Patrón: las vistas llaman a fetchPaymentsForBookings(ids) y reciben un Map
// { bookingId => ServicePayment | null } para renderizar el estado correcto.

import api from "../api.js";

/**
 * Carga en paralelo el pago de varios bookings. Bookings sin pago aparecen
 * como null en el Map.
 */
export async function fetchPaymentsForBookings(bookingIds) {
  const result = new Map();
  // Llamadas en paralelo. Cada 404 lo tratamos como "no hay pago".
  await Promise.all(bookingIds.map(async (id) => {
    try {
      const { data } = await api.get(`/service-payments/booking/${id}`);
      result.set(id, data);
    } catch (e) {
      if (e?.response?.status === 404) {
        result.set(id, null);
      } else {
        // Cualquier otro error: lo tratamos como "no sabemos" → no pagado
        // pero loggeamos para debug.
        console.warn(`[paymentApi] Error fetching payment for booking ${id}:`, e?.message);
        result.set(id, null);
      }
    }
  }));
  return result;
}

/**
 * Registra el pago de un booking por canal manual (yape/plin/bank_transfer/cash).
 * Para tarjeta el flujo es vía /payments/izipay/* (no usar este).
 */
export async function payBookingManual(bookingId, channel) {
  const { data } = await api.post(`/service-payments/booking/${bookingId}/pay-manual`, {
    channel,
  });
  return data;
}

/**
 * Lista los pagos del worker logueado (orden desc por fecha).
 */
export async function listMyWorkerPayments() {
  const { data } = await api.get("/service-payments/worker");
  return data;
}

/**
 * Stats agregadas del worker: ganancias, comisión, pendiente de cobro, etc.
 */
export async function getMyWorkerBalance() {
  const { data } = await api.get("/service-payments/worker/balance");
  return data;
}

/**
 * Worker solicita el cobro de todos sus pagos Izipay pendientes.
 * Devuelve { payoutsProcessed: N }.
 */
export async function requestWorkerPayout() {
  const { data } = await api.post("/service-payments/worker/request-payout");
  return data;
}
