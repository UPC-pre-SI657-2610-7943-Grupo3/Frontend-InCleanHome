import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./Shared/stores/auth.js";

const routes = [
  // ── Públicas ────────────────────────────────────────────────────────────
  { path: "/", redirect: "/login" },
  // Login: solo botón "Continuar con Auth0".
  { path: "/login", component: () => import("./IAM/views/LoginView.vue"), meta: { public: true } },
  // Callback de Auth0: procesa code+state y decide a dónde ir.
  { path: "/auth0/callback", component: () => import("./IAM/views/Auth0CallbackView.vue"), meta: { public: true } },
  // /welcome: vista para que un usuario NUEVO elija rol después del primer login Auth0.
  // No es ni public ni requiresAuth en el sentido tradicional — el usuario está
  // logueado en Auth0 pero AÚN NO TIENE JWT propio. Lo manejamos como public:
  // si no tiene sesión Auth0 dentro de la vista lo redirigimos al login.
  { path: "/welcome", component: () => import("./IAM/views/WelcomeView.vue"), meta: { public: true } },
  // /upload-documents: pantalla para trabajadora pendiente. No requiere JWT
  // porque a veces se entra ahí mientras se sube docs.
  { path: "/upload-documents", component: () => import("./IAM/views/UploadDocumentsView.vue"), meta: { public: true } },
  // Pending approval (worker logueada esperando admin).
  { path: "/pending-approval", component: () => import("./IAM/views/PendingApprovalView.vue"), meta: { requiresAuth: true } },

  // Mercado Pago: pantallas de retorno tras el redirect al checkout.
  // Las URLs deben coincidir EXACTAMENTE con MercadoPago:FrontendBaseUrl en el
  // backend (back_urls success/failure/pending). Las marcamos public porque al
  // volver desde MP el query string es lo único que portamos; la vista valida
  // sesión y muestra el resultado.
  // Aceptamos las dos formas para soportar links históricos (/client/...) y
  // nuevos (/payment-...). MP solo llama a las nuevas.
  { path: "/payment-success",         component: () => import("./IAM/views/PaymentSuccessView.vue"), meta: { public: true } },
  { path: "/payment-failure",         component: () => import("./IAM/views/PaymentCancelView.vue"),  meta: { public: true } },
  { path: "/client/payment-success",  component: () => import("./IAM/views/PaymentSuccessView.vue"), meta: { public: true } },
  { path: "/client/payment-cancel",   component: () => import("./IAM/views/PaymentCancelView.vue"),  meta: { public: true } },

  // ── Cliente ─────────────────────────────────────────────────────────────
  {
    path: "/client",
    component: () => import("./Shared/layouts/ClientLayout.vue"),
    meta: { requiresAuth: true, role: "client" },
    children: [
      { path: "", redirect: "/client/search" },
      { path: "search", component: () => import("./SearchAndCatalog/views/SearchView.vue") },
      { path: "worker/:id", component: () => import("./SearchAndCatalog/views/WorkerProfileView.vue") },
      { path: "worker/:id/book", component: () => import("./Booking/views/BookingView.vue") },
      { path: "bookings", component: () => import("./Booking/views/ClientBookingsView.vue") },
      { path: "payments", component: () => import("./Payments/views/PaymentMethodsView.vue") },
      { path: "messages", component: () => import("./Shared/views/MessagesView.vue") },
      { path: "messages/:userId", component: () => import("./Shared/views/ChatView.vue") },
      { path: "notifications", component: () => import("./Shared/views/NotificationsView.vue") },
      { path: "history", component: () => import("./Shared/views/ServiceHistoryView.vue") },
      { path: "profile", component: () => import("./Profiles/views/ClientProfileView.vue") },
    ],
  },

  // ── Admin ───────────────────────────────────────────────────────────────
  {
    path: "/admin",
    component: () => import("./Admin/layouts/AdminLayout.vue"),
    meta: { requiresAuth: true, role: "admin" },
    children: [
      { path: "", redirect: "/admin/users" },
      { path: "users", component: () => import("./Admin/views/AdminUsersView.vue") },
      { path: "approve", component: () => import("./Admin/views/AdminApproveView.vue") },
      { path: "reports", component: () => import("./Admin/views/AdminReportsView.vue") },
      { path: "suspend", component: () => import("./Admin/views/AdminSuspendView.vue") },
      // F2: bandeja de reclamos de suspensión (apelaciones de usuarios suspendidos).
      { path: "appeals", component: () => import("./Admin/views/AdminSuspensionAppealsView.vue") },
      // F3: configuración global (tasa de comisión).
      { path: "settings", component: () => import("./Admin/views/AdminSettingsView.vue") },
    ],
  },

  // ── Worker ──────────────────────────────────────────────────────────────
  {
    path: "/worker",
    component: () => import("./Shared/layouts/WorkerLayout.vue"),
    meta: { requiresAuth: true, role: "worker" },
    children: [
      { path: "", redirect: "/worker/dashboard" },
      { path: "dashboard", component: () => import("./Profiles/views/WorkerDashboardView.vue") },
      { path: "profile", component: () => import("./Profiles/views/WorkerProfileEditView.vue") },
      { path: "availability", component: () => import("./Booking/views/AvailabilityView.vue") },
      { path: "requests", component: () => import("./Booking/views/WorkerRequestsView.vue") },
      { path: "reviews", component: () => import("./ReviewsAndEvaluation/views/MyReviewsView.vue") },
      { path: "payments", component: () => import("./Payments/views/WorkerPaymentsView.vue") },
      { path: "messages", component: () => import("./Shared/views/MessagesView.vue") },
      { path: "messages/:userId", component: () => import("./Shared/views/ChatView.vue") },
      { path: "notifications", component: () => import("./Shared/views/NotificationsView.vue") },
      { path: "history", component: () => import("./Shared/views/ServiceHistoryView.vue") },
    ],
  },

  // Catch-all: rutas viejas o desconocidas → al login.
  { path: "/:pathMatch(.*)*", redirect: "/login" },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.public) {
    // Si ya está logueado (con JWT propio) y va al login, lo mandamos a su menú.
    if (auth.isLoggedIn && to.path === "/login") {
      if (auth.user?.role === "admin") return "/admin/users";
      return auth.user?.role === "worker" ? "/worker/dashboard" : "/client/search";
    }
    return true;
  } else if (to.meta.requiresAuth) {
    if (!auth.isLoggedIn) return "/login";
    if (to.meta.role && auth.user?.role !== to.meta.role) {
      const targetPath = auth.user?.role === "admin" ? "/admin/users"
                       : (auth.user?.role === "worker" ? "/worker/dashboard" : "/client/search");
      // Si por algún motivo el targetPath es la misma URL a la que intenta ir,
      // limpiamos y mandamos al login para evitar loop infinito.
      if (to.path === targetPath) {
        auth.clearAuth();
        return "/login";
      }
      return targetPath;
    }
    return true;
  }
  return true;
});

export default router;
