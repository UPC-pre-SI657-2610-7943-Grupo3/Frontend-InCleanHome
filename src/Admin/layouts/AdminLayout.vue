<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="brand-row">
        <div class="logo-box">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div>
          <h2>InCleanHome</h2>
          <p>{{ t('auth.admin.logotitle') }}</p>
        </div>
      </div>

      <nav class="admin-nav">
        <router-link to="/admin/users">{{ t('auth.admin.users') }}</router-link>
        <router-link to="/admin/approve">{{ t('auth.admin.approve') }}</router-link>
        <router-link to="/admin/reports">{{ t('auth.admin.reports') }}</router-link>
        <router-link to="/admin/suspend">{{ t('auth.admin.suspend') }}</router-link>
      </nav>

      <button @click="toggleLang" class="nav-item lang-btn">
        {{ locale === 'es' ? t('auth.admin.lang') + ': Ingles' : t('auth.admin.lang') + ': Spanish' }}
      </button>

      <button class="logout-btn" @click="logout">{{ t('auth.admin.logout') }}</button>
    </aside>

    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../Shared/stores/auth.js';
import { useAppLogout } from '../../Shared/composables/useAppLogout.js';
import {useI18n} from "vue-i18n";

const { t, locale } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const handleLogoutAction = useAppLogout();

async function logout() {
  // Limpia JWT propio + cierra sesión Auth0 (returnTo /login).
  await handleLogoutAction();
}

function toggleLang() {
  locale.value = locale.value === "es" ? "en" : "es";
  localStorage.setItem("inclean_lang", locale.value);
}
</script>

<style scoped>
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

.lang-btn {
  margin-left: 0.25rem;
  padding: 0.625rem 1rem;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
}
@media (min-width: 670px) {
  .lang-btn { padding: 0.75rem 1.25rem; }
}
.lang-btn:hover { background-color: white; }
.admin-shell { min-height: 100vh; display: grid; grid-template-columns: 260px 1fr; background: #f8fafc; }
.admin-sidebar { background: #0f172a; color: white; padding: 1.25rem; display: flex; flex-direction: column; gap: 1.5rem; }
.brand-row { display: flex; align-items: center; gap: .75rem; }
.logo-box { width: 44px; height: 44px; border-radius: 12px; background: #2563eb; display: flex; align-items: center; justify-content: center; font-weight: 800; }
h2 { margin: 0; font-size: 1.05rem; }
p { margin: .15rem 0 0; color: #94a3b8; font-size: .8rem; }
.admin-nav { display: flex; flex-direction: column; gap: .4rem; }
.admin-nav a { color: #cbd5e1; text-decoration: none; padding: .75rem; border-radius: .75rem; font-weight: 600; }
.admin-nav a.router-link-active, .admin-nav a:hover { background: #1e293b; color: white; }
.logout-btn { margin-top: auto; border: 0; background: #ef4444; color: white; padding: .75rem; border-radius: .75rem; cursor: pointer; font-weight: 700; }
.admin-main { padding: 1.5rem; overflow-x: auto; }
@media (max-width: 800px) { .admin-shell { grid-template-columns: 1fr; } .admin-sidebar { position: static; } }
</style>
