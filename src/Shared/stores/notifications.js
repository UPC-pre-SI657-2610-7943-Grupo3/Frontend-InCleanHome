import { defineStore } from "pinia";
import { ref, computed } from "vue";
import api from "../api.js";

// Store de notificaciones.
//
// Consume el endpoint real del backend GET /notifications. Si ese endpoint no
// está disponible (p. ej. backend antiguo sin el contexto Notifications), hace
// un fallback que deriva notificaciones a partir de las reservas (GET /bookings)
// para que la UI siga siendo usable.
export const useNotificationsStore = defineStore("notifications", () => {
  const items = ref([]);
  const loading = ref(false);
  // Para el modo fallback (derivado de bookings) se conservan los IDs leídos localmente.
  const readIds = ref(new Set(JSON.parse(localStorage.getItem("inclean_notif_read") || "[]")));
  // Indica si estamos en modo fallback (sin endpoint real).
  const fallbackMode = ref(false);

  const unreadCount = computed(
    () => items.value.filter((n) => !n.read).length
  );

  function persistRead() {
    localStorage.setItem("inclean_notif_read", JSON.stringify([...readIds.value]));
  }

  // Convierte una reserva en una notificación legible según su estado y rol (fallback).
  function bookingToNotification(b, role) {
    const id = `booking-${b.id}-${b.status}`;
    const map = {
      client: {
        accepted: { title: "Reserva aceptada", body: `${b.workerName} aceptó tu reserva del ${b.date}.` },
        rejected: { title: "Reserva rechazada", body: `${b.workerName} no pudo aceptar tu reserva del ${b.date}.` },
        completed: { title: "Servicio completado", body: `Tu servicio con ${b.workerName} fue marcado como completado.` },
        cancelled: { title: "Reserva cancelada", body: `La reserva del ${b.date} fue cancelada.` },
        pending: { title: "Reserva enviada", body: `Tu solicitud a ${b.workerName} está pendiente de confirmación.` },
      },
      worker: {
        pending: { title: "Nueva solicitud", body: `${b.clientName} solicitó un servicio para el ${b.date}.` },
        accepted: { title: "Reserva confirmada", body: `Confirmaste el servicio con ${b.clientName} el ${b.date}.` },
        completed: { title: "Servicio completado", body: `Servicio con ${b.clientName} completado. Pago registrado.` },
        cancelled: { title: "Reserva cancelada", body: `La reserva con ${b.clientName} del ${b.date} fue cancelada.` },
        rejected: { title: "Reserva rechazada", body: `Rechazaste la solicitud de ${b.clientName}.` },
      },
    };
    const info = (map[role] || {})[b.status];
    if (!info) return null;
    return {
      id,
      type: b.status,
      title: info.title,
      body: info.body,
      read: readIds.value.has(id),
      createdAt: b.createdAt || new Date().toISOString(),
      link: role === "worker" ? "/worker/requests" : "/client/bookings",
    };
  }

  async function fetchFromBookings(role) {
    const { data } = await api.get("/bookings");
    const notifs = (data || [])
      .map((b) => bookingToNotification(b, role))
      .filter(Boolean);
    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    items.value = notifs;
  }

  async function fetch(role) {
    loading.value = true;
    try {
      // Endpoint real del backend (contexto Notifications).
      const { data } = await api.get("/notifications");
      items.value = (data || []).map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt,
        link: n.link,
      }));
      fallbackMode.value = false;
    } catch (e) {
      // Fallback: si /notifications no existe (404) u otro error, derivar de bookings.
      fallbackMode.value = true;
      try {
        await fetchFromBookings(role);
      } catch {
        items.value = [];
      }
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id) {
    const n = items.value.find((x) => x.id === id);
    if (n) n.read = true;

    if (fallbackMode.value) {
      readIds.value.add(id);
      persistRead();
      return;
    }
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch { /* no-op: el estado local ya refleja la lectura */ }
  }

  async function markAllRead() {
    items.value.forEach((n) => { n.read = true; });

    if (fallbackMode.value) {
      items.value.forEach((n) => readIds.value.add(n.id));
      persistRead();
      return;
    }
    try {
      await api.patch("/notifications/read-all");
    } catch { /* no-op */ }
  }

  async function deleteNotif(id) {
    // Remove from local list immediately for instant feedback
    items.value = items.value.filter((n) => n.id !== id);

    if (fallbackMode.value) {
      readIds.value.delete(id);
      persistRead();
      return;
    }
    try {
      await api.delete(`/notifications/${id}`);
    } catch { /* no-op: already removed from UI */ }
  }

  return { items, loading, unreadCount, fetch, markRead, markAllRead, deleteNotif };
});
