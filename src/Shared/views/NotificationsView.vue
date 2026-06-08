<template>
  <div class="page-container">
    <div class="notif-header">
      <h1 class="page-title">{{ t('notifications.title') }}</h1>
      <button v-if="store.unreadCount > 0" @click="store.markAllRead()" class="link-btn">{{ t('notifications.markAllRead') }}</button>
    </div>

    <div v-if="store.loading" class="center-pad"><div class="spinner"></div></div>

    <div v-else-if="!store.items.length" class="card empty-state">
      <div class="empty-icon">🔔</div>
      <p class="empty-text">{{ t('notifications.empty') }}</p>
    </div>

    <div v-else class="notif-list">
      <div v-for="n in store.items" :key="n.id"
        :class="['notif-item', n.read ? '' : 'notif-unread']">
        <div :class="['notif-dot', dotClass(n.type)]" style="margin-top:0.35rem;flex-shrink:0;"></div>
        <div class="notif-body" @click="open(n)" style="cursor:pointer;flex:1;">
          <div class="notif-row">
            <span class="notif-title">{{ n.title }}</span>
            <span class="notif-date">{{ formatDate(n.createdAt) }}</span>
          </div>
          <p class="notif-text">{{ n.body }}</p>
        </div>
        <span v-if="!n.read" class="unread-pill"></span>
        <button class="delete-btn" @click.stop="store.deleteNotif(n.id)" title="Eliminar notificación">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useNotificationsStore } from "../stores/notifications.js";
import { useAuthStore } from "../stores/auth.js";

const { t } = useI18n();
const router = useRouter();
const store = useNotificationsStore();
const auth = useAuthStore();

onMounted(() => store.fetch(auth.user?.role));

function open(n) {
  store.markRead(n.id);
  if (n.link) router.push(n.link);
}

function dotClass(type) {
  return {
    pending: "dot-yellow", accepted: "dot-blue", completed: "dot-green",
    rejected: "dot-red", cancelled: "dot-gray",
  }[type] || "dot-blue";
}

function formatDate(d) {
  if (!d) return "";
  try {
    const date = new Date(d);
    const now = new Date();
    const diffH = Math.floor((now - date) / 36e5);
    if (diffH < 1) return "Ahora";
    if (diffH < 24) return `Hace ${diffH}h`;
    return date.toLocaleDateString();
  } catch { return ""; }
}
</script>

<style scoped>
.page-container { max-width: 720px; margin: 0 auto; padding: 1.5rem 1rem; }
.notif-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
.page-title { font-size: 1.5rem; font-weight: 700; color: #1e293b; }
.link-btn { background: none; border: none; color: #2563eb; font-size: 0.875rem; font-weight: 500; cursor: pointer; }
.link-btn:hover { text-decoration: underline; }
.center-pad { display: flex; justify-content: center; padding: 3rem; }
.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:32px; height:32px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 3rem 1.5rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty-text { color: #64748b; }
.notif-list { display: flex; flex-direction: column; gap: 0.5rem; }
.notif-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; background: white; border: 1px solid #e2e8f0; border-radius: 0.75rem; cursor: pointer; transition: all 0.15s; position: relative; }
.notif-item:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.notif-unread { background: #f8fafc; border-color: #bfdbfe; }
.notif-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 0.35rem; flex-shrink: 0; }
.dot-yellow { background: #f59e0b; } .dot-blue { background: #2563eb; } .dot-green { background: #16a34a; }
.dot-red { background: #dc2626; } .dot-gray { background: #94a3b8; }
.notif-body { flex: 1; }
.notif-row { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
.notif-title { font-weight: 600; color: #1e293b; font-size: 0.9375rem; }
.notif-date { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; }
.notif-text { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }
.unread-pill { width: 8px; height: 8px; border-radius: 50%; background: #2563eb; flex-shrink: 0; margin-top: 0.4rem; }
.delete-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.25rem 0.375rem;
  border-radius: 0.375rem;
  line-height: 1;
  transition: background 0.12s, color 0.12s;
  margin-left: 0.25rem;
}
.delete-btn:hover { background: #fee2e2; color: #dc2626; }
</style>
