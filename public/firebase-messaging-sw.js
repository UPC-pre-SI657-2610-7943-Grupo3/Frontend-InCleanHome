// Service Worker que recibe los pushes de Firebase Cloud Messaging cuando la
// pestaña de la app está cerrada o en segundo plano. Cuando está en primer
// plano, el listener `onMessage` en src/Shared/services/pushNotifications.js
// se encarga de mostrar la alerta.

// 1. Importamos los scripts del SDK de Firebase desde el CDN oficial
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// 2. Configuración del proyecto (debe coincidir con firebaseConfig en pushNotifications.js)
const firebaseConfig = {
  apiKey: "AIzaSyAFdIvqBlM5mEgi8OShL_0pB504E7NPAA8",
  authDomain: "incleanhome.firebaseapp.com",
  projectId: "incleanhome",
  storageBucket: "incleanhome.firebasestorage.app",
  messagingSenderId: "508871035369",
  appId: "1:508871035369:web:5ce2b1396f86fafa2ca378"
};

// 3. Inicializamos Firebase dentro del contexto del Service Worker
firebase.initializeApp(firebaseConfig);

// 4. Recuperamos la instancia de Messaging
const messaging = firebase.messaging();

// 5. Handler de notificaciones recibidas cuando la app está en background.
//
// IMPORTANTE: cuando el payload contiene el campo `notification`, el navegador
// muestra automáticamente la notificación visual. Si llamamos también a
// self.registration.showNotification() aquí, aparecen DUPLICADAS. Por eso solo
// hacemos postMessage a las pestañas abiertas (para refrescar el badge) y NO
// volvemos a renderizar la notificación.
//
// Si en el futuro envías desde el backend SOLO `data` (sin `notification`), aquí
// tendrías que volver a llamar showNotification — pero ese cambio es global y
// cambiaría también el comportamiento del listener foreground.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificación recibida en segundo plano:', payload);

  // Notify any open tabs so they can refresh the in-app unread badge.
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: 'fcm-message-received', payload });
        }
      });
});

// 6. Al hacer click en la notificación: enfoca una pestaña abierta del sitio
//    (y navega al link) o abre una nueva.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = event.notification?.data?.link || '/';
  const targetUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // Reutiliza una pestaña abierta y navega al link
          if ('navigate' in client) client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    }),
  );
});
