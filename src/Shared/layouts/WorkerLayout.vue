<template>
  <div class="layout-wrapper">
    <nav class="top-nav">
      <div class="nav-container">
        <div class="nav-content">
          
          <router-link to="/worker/dashboard" class="brand-link">
            <div class="logo-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <span class="brand-text">InClean<span class="brand-accent">Home</span></span>
          </router-link>
          
          <div class="nav-menu">
            <router-link v-for="link in navLinks" :key="link.to" :to="link.to"
              class="nav-item"
              :class="{ 'active': $route.path.startsWith(link.to) }">
              <span v-html="link.icon" class="nav-icon"></span>
              <span class="nav-label">{{ t(link.label) }}</span>
            </router-link>

            
            <router-link to="/worker/notifications" class="nav-item notif-bell" :class="{ 'active': $route.path.startsWith('/worker/notifications') }" :title="t('nav.notifications')">
              <span class="nav-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
              </span>
              <span v-if="notifStore.unreadCount > 0" class="notif-badge">{{ notifStore.unreadCount > 9 ? '9+' : notifStore.unreadCount }}</span>
              <span class="nav-label">{{ t('nav.notifications') }}</span>
            </router-link>

            <button @click="handleLogout" class="nav-item nav-logout">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span class="nav-label">{{ t('nav.logout') }}</span>
            </button>
            
            <button @click="toggleLang" class="nav-item lang-btn">
              {{ locale === 'es' ? 'EN' : 'ES' }}
            </button>
          </div>
          
        </div>
      </div>
    </nav>
    
    <main class="main-container">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth.js";
import { useRoute } from "vue-router";
import { useNotificationsStore } from "../stores/notifications.js";
import { useAppLogout } from "../composables/useAppLogout.js";

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const route = useRoute();
const notifStore = useNotificationsStore();
const handleLogoutAction = useAppLogout();

async function refreshAll() {
  notifStore.fetch("worker");
  // Sync suspension status, rating, verified flag, etc. from backend.
  try { await auth.refreshUser(); } catch { /* JWT expired → handled inside */ }
}

onMounted(refreshAll);

// Re-fetch user + notifications whenever the worker navigates to a different
// section of the navbar. This covers the case where another browser profile
// (admin or client) changed something while this tab was just sitting there.
watch(() => route.path, refreshAll);

const navLinks = [
  { to: "/worker/dashboard", label: "nav.dashboard", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>' },
  { to: "/worker/requests", label: "nav.requests", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
  { to: "/worker/history", label: "nav.history", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 106 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>' },
  { to: "/worker/availability", label: "nav.availability", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' },
  { to: "/worker/payments", label: "nav.payments", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="2" y1="10" x2="22" y2="10"/></svg>' },
  { to: "/worker/messages", label: "nav.messages", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>' },
  { to: "/worker/profile", label: "nav.profile", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' }
];

async function handleLogout() {
  // Limpia JWT propio + cierra sesión Auth0 (returnTo /login).
  await handleLogoutAction();
}

function toggleLang() {
  locale.value = locale.value === "es" ? "en" : "es";
  localStorage.setItem("inclean_lang", locale.value);
}
</script>

<style scoped>
.layout-wrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg);
  position: relative;
}

.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background-color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(24px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  width: 100%;
  transition: all 0.3s;
}

.nav-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 1rem 1rem;
}

@media (min-width: 670px) {
  .nav-container { padding: 1rem 1.5rem; }
}
@media (min-width: 1300px) {
  .nav-container { padding: 1rem 2rem; }
}

.nav-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: transform 0.3s;
  flex-shrink: 0;
}
.brand-link:hover { transform: scale(1.05); }
.brand-link:active { transform: scale(0.95); }

.logo-box {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
}

.brand-text {
  font-weight: 800;
  font-size: 1.5rem;
  color: #0f172a;
  letter-spacing: -0.025em;
  display: none;
  white-space: nowrap;
}
@media (min-width: 830px) and (max-width: 1299px) {
  .brand-text { display: block; }
}
@media (min-width: 1500px) {
  .brand-text { display: block; }
}
.brand-accent { color: var(--color-primary);  }

.nav-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.nav-menu::-webkit-scrollbar { display: none; }
@media (min-width: 640px) {
  .nav-menu { gap: 0.25rem; }
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.75rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: #475569;
  transition: all 0.3s ease;
  white-space: nowrap;
}
@media (min-width: 670px) {
  .nav-item {
    padding: 0.6rem 0.75rem;
    font-size: 0.95rem;
  }
}

.nav-icon {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-icon :deep(svg) { width: 1.5rem; height: 1.5rem; }

.nav-label { display: none; }
@media (min-width: 1300px) {
  .nav-label { display: inline; }
}

.nav-item:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  background-color: #f8fafc;
  color: var(--color-primary);
}
.nav-item:active { transform: translateY(0) scale(0.95); }

.nav-item.active {
  background-color: #ede9fe;
  color: #1d4ed8;
  box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);
  border: 1px solid rgba(221,214,254,0.5);
}

.nav-logout:hover {
  background-color: #fef2f2;
  color: #dc2626;
  border: 1px solid rgba(254,202,202,0.5);
}

.lang-btn {
  margin-left: 0.25rem;
  padding: 0.625rem 1rem;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}
@media (min-width: 640px) {
  .lang-btn { padding: 0.75rem 1.25rem; }
}
.lang-btn:hover { background-color: white; }

.notif-bell { position: relative; }
.notif-badge {
  position: absolute;
  top: 0.25rem;
  right: 0.35rem;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background-color: #dc2626;
  color: white;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
@media (min-width: 1300px) {
  .notif-badge { top: 0.1rem; right: auto; left: 2rem; }
}

.main-container {
  flex: 1;
  max-width: 1024px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1rem;
}
@media (min-width: 640px) {
  .main-container { padding: 3rem 1.5rem; }
}
@media (min-width: 1024px) {
  .main-container { padding: 3rem 2rem; }
}
</style>
