// Push notifications — Firebase Cloud Messaging integration for the Vue frontend.
//
// Responsibilities (single source of truth for everything push-related):
//   1. Initialize the Firebase Web SDK with the project credentials.
//   2. Register the service worker that handles background pushes.
//   3. Request browser permission and obtain the device token (with VAPID key).
//   4. Send the token to the backend (POST /auth/device-token) so notifications
//      created server-side can be delivered to this device.
//   5. Listen for foreground messages and show an in-app toast (plus the native
//      Notification only when the tab is hidden, to avoid double-alert).
//   6. Refresh the notifications store so the bell badge unread count updates.
//
// Call setupPushNotifications() AFTER the user has logged in — that way the
// token always gets associated with the right userId on the backend.

import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import api from "../api.js";

const firebaseConfig = {
  apiKey: "AIzaSyAFdIvqBlM5mEgi8OShL_0pB504E7NPAA8",
  authDomain: "incleanhome.firebaseapp.com",
  projectId: "incleanhome",
  storageBucket: "incleanhome.firebasestorage.app",
  messagingSenderId: "508871035369",
  appId: "1:508871035369:web:5ce2b1396f86fafa2ca378",
};

// VAPID public key from Firebase Console → Cloud Messaging → Web Push certificates.
const VAPID_KEY =
  "BHt71dq1h3LMUiMA8RJxXr2PvmKEGzPwg5d0Wpx9xvvZYEzOjRv3GcvN93W8xuCv3I-y-ZAAxlGXcKck-v_2tqA";

let firebaseApp = null;
let messaging = null;
let foregroundListenerRegistered = false;

// Cache key tracks the (userId + token) pair, not just the token alone.
// Two different users on the same browser get the same FCM token, so we must
// re-POST when the logged-in user changes — even if the token itself didn't.
const LAST_SYNC_KEY = "inclean_fcm_sync";

function getOrInitMessaging() {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
  }
  if (!messaging) {
    messaging = getMessaging(firebaseApp);
  }
  return messaging;
}

/**
 * Registers the public/firebase-messaging-sw.js service worker explicitly.
 */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker no soportado en este navegador.");
  }
  return await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
    scope: "/",
  });
}

/**
 * Foreground listener — when a push arrives while the tab is focused, we:
 *   1. Show an in-app toast (always — it's the primary cue in-app).
 *   2. Show a native Notification ONLY when the tab is hidden, to avoid
 *      a double-alert (toast + OS banner) when the user is actively in the app.
 *   3. Refresh the notifications store so the bell badge unread count updates.
 */
function listenForForegroundMessages() {
  if (foregroundListenerRegistered) return;
  foregroundListenerRegistered = true;

  onMessage(getOrInitMessaging(), async (payload) => {
    console.log("[FCM] Mensaje push recibido en primer plano:", payload);

    const title = payload.notification?.title || "InCleanHome";
    const body  = payload.notification?.body  || "";
    const link  = payload.data?.link || "";

    // 1. In-app toast — always shown when tab is in foreground.
    try {
      const { useToastStore } = await import("../stores/toast.js");
      const toast = useToastStore();
      const message = body ? `${title} — ${body}` : title;
      // The toast store currently exposes only success/error. We use success
      // for informational pushes (green, non-intrusive). If later you add a
      // dedicated "info" type, switch this to toast.info(message).
      toast.success(message);
    } catch (err) {
      console.warn("[FCM] No se pudo mostrar el toast:", err);
    }

    // 2. Native OS notification — only when tab is hidden.
    const tabHidden = document.visibilityState === "hidden";
    if (tabHidden && "Notification" in window && Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        icon: "/favicon.svg",
        data: payload.data || {},
      });
      n.onclick = (event) => {
        event.preventDefault();
        if (link) window.open(link, "_blank");
        n.close();
      };
    }

    // 3. Refresh the in-app store so the bell badge unread count updates.
    refreshNotificationsStore();
  });

  // Also listen for messages from the service worker (background pushes).
  // The SW posts a "fcm-message-received" message whenever onBackgroundMessage fires.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "fcm-message-received") {
        console.log("[FCM] Background push notified to tab, refreshing store.");
        refreshNotificationsStore();
      }
    });
  }
}

/**
 * Reads the currently-logged-in userId from localStorage (set by the auth store).
 */
function getCurrentUserId() {
  try {
    const raw = localStorage.getItem("inclean_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Refreshes the notifications store so the bell-badge unread count stays in sync
 * when a new push arrives. Reads the current user role from localStorage to
 * decide which fetch variant to call (worker or client).
 */
async function refreshNotificationsStore() {
  try {
    const { useNotificationsStore } = await import("../stores/notifications.js");
    const store = useNotificationsStore();
    const raw = localStorage.getItem("inclean_user");
    const role = raw ? (JSON.parse(raw)?.role || "client") : "client";
    await store.fetch(role);
  } catch (err) {
    console.warn("[FCM] No se pudo refrescar el store de notificaciones:", err);
  }
}

/**
 * Sends the device token to the backend so it can be persisted on users.device_token.
 * Skips the request only if the (userId, token) pair was already synced — so if the
 * SAME token is now associated to a DIFFERENT user (logout+login on same browser),
 * we re-POST it to reassign ownership server-side.
 */
async function persistTokenOnBackend(token) {
  const userId = getCurrentUserId();
  const currentSync = `${userId}:${token}`;
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);

  if (lastSync === currentSync) {
    console.log("[FCM] Token ya sincronizado para este usuario, omitiendo POST.");
    return;
  }
  try {
    await api.post("/auth/device-token", { token });
    localStorage.setItem(LAST_SYNC_KEY, currentSync);
    console.log("[FCM] Token registrado en backend para userId:", userId);
  } catch (err) {
    console.error("[FCM] No se pudo registrar el token en el backend:", err);
  }
}

/**
 * Public entry point. Call once the user is authenticated.
 * Returns the FCM token on success, or null if anything failed (permission
 * denied, unsupported browser, no service worker, etc.).
 */
export async function setupPushNotifications() {
  try {
    if (!(await isSupported())) {
      console.warn("[FCM] Firebase Messaging no soportado en este navegador.");
      return null;
    }
    if (!("Notification" in window)) {
      console.warn("[FCM] API Notification no disponible.");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[FCM] Permiso de notificaciones denegado o ignorado:", permission);
      return null;
    }

    const swRegistration = await registerServiceWorker();

    const token = await getToken(getOrInitMessaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      console.warn(
        "[FCM] getToken devolvió vacío. Revisa que /firebase-messaging-sw.js esté accesible.",
      );
      return null;
    }

    console.log("[FCM] Device token:", token);

    await persistTokenOnBackend(token);
    listenForForegroundMessages();

    return token;
  } catch (err) {
    console.error("[FCM] Error inicializando push notifications:", err);
    return null;
  }
}

/**
 * Clears the device token on the backend. Call on logout so the previous user
 * doesn't keep receiving pushes meant for the new user on this device.
 */
export async function clearPushNotifications() {
  try {
    await api.post("/auth/device-token", { token: null });
  } catch (err) {
    console.warn("[FCM] No se pudo limpiar el token en backend:", err);
  } finally {
    localStorage.removeItem(LAST_SYNC_KEY);
    // Legacy key cleanup — used by an earlier version.
    localStorage.removeItem("inclean_fcm_token");
  }
}
