import { defineStore } from "pinia";
import { ref, computed } from "vue";
import api from "../api.js";
import { clearPushNotifications } from "../services/pushNotifications.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(JSON.parse(localStorage.getItem("inclean_user") || "null"));
  const token = ref(localStorage.getItem("inclean_token") || null);

  const isLoggedIn = computed(() => !!token.value && !!user.value);

  // True si el usuario tiene una suspensión vigente.
  const isSuspended = computed(() => {
    const until = user.value?.suspendedUntil;
    if (!until) return false;
    return new Date(until) > new Date();
  });
  const suspendedUntil = computed(() => user.value?.suspendedUntil || null);
  const suspensionReason = computed(() => user.value?.suspensionReason || null);

  // Trabajadora: documentos subidos pero pendiente de aprobación admin.
  const isPendingApproval = computed(() =>
    user.value?.role === "worker" &&
    user.value?.documentsUploaded === true &&
    user.value?.documentsVerified === false
  );

  function setAuth(userData, tokenData) {
    user.value = userData;
    token.value = tokenData;
    localStorage.setItem("inclean_user", JSON.stringify(userData));
    localStorage.setItem("inclean_token", tokenData);
    api.defaults.headers.common["Authorization"] = `Bearer ${tokenData}`;
  }

  function clearAuth() {
    // Limpia el token FCM en el backend ANTES de borrar las credenciales:
    // si lo hacemos después, la petición no llevaría Authorization header.
    // Es fire-and-forget; no bloqueamos el logout si la red falla.
    clearPushNotifications().catch(() => { /* no-op */ });

    user.value = null;
    token.value = null;
    localStorage.removeItem("inclean_user");
    localStorage.removeItem("inclean_token");
    delete api.defaults.headers.common["Authorization"];
  }

  async function refreshUser() {
    if (!token.value) return;
    try {
      const { data } = await api.get("/auth/me");
      user.value = data;
      localStorage.setItem("inclean_user", JSON.stringify(data));
    } catch { }
  }

  // Restore token on load
  if (token.value) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token.value}`;
  }

  return { user, token, isLoggedIn, isSuspended, suspendedUntil, suspensionReason, isPendingApproval, setAuth, clearAuth, refreshUser };
});
