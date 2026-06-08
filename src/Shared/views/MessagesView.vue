<template>
  <div class="view-container max-w-4xl">
    <h1 class="page-title mb-6">{{ t('messages.title') }}</h1>

    <div v-if="loading" class="loader-wrapper"><div class="spinner spinner-lg"></div></div>

    <div v-else-if="errorMsg" class="card empty-state">
      <div class="empty-illustration">⚠️</div>
      <p class="empty-text">{{ errorMsg }}</p>
      <button @click="loadConversations" class="retry-btn mt-4">Reintentar</button>
    </div>

    <div v-else-if="!conversations.length" class="card empty-state">
      <div class="empty-illustration">💬</div>
      <p class="empty-text">{{ t('messages.noConversations') }}</p>
      <p class="empty-subtext">{{ t('messages.startConversation') }}</p>
    </div>

    <div v-else class="conv-list">
      <router-link
          v-for="c in conversations" :key="c.userId"
          :to="`${baseRoute}/${c.userId}?name=${encodeURIComponent(c.userName || '')}&photo=${encodeURIComponent(c.userPhotoUrl || '')}`"
          class="card conv-card message-link">
        <div class="conv-avatar" :style="c.userPhotoUrl ? 'padding:0;overflow:hidden;' : `background: ${getColor(c.userId)}`">
          <img v-if="c.userPhotoUrl" :src="c.userPhotoUrl" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" />
          <span v-else class="conv-initial">{{ (c.userName || '?')[0].toUpperCase() }}</span>
        </div>
        <div class="conv-info">
          <div class="conv-header">
            <span class="conv-name">{{ c.userName }}</span>
            <span class="conv-time">{{ formatTime(c.lastMessageAt) }}</span>
          </div>
          <p class="conv-last">{{ c.lastMessage || 'Sin mensajes aún' }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth.js";
import { Client } from "@twilio/conversations";
import api from "../api.js";

const { t } = useI18n();
const auth = useAuthStore();
const conversations = ref([]);
const loading = ref(true);
const errorMsg = ref("");

const baseRoute = computed(() => auth.user?.role === "worker" ? "/worker/messages" : "/client/messages");
const colors = ["#2563eb","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
function getColor(id) { return colors[id % colors.length]; }
function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-PE", { month: "short", day: "numeric" });
}

function extractOtherUserId(uniqueName, myIdentity) {
  const myId = myIdentity.replace("user_", "");
  const numbers = uniqueName.match(/\d+/g);
  if (!numbers || numbers.length < 2) return null;
  const otherId = numbers.find(n => n !== myId);
  return otherId ? parseInt(otherId) : null;
}

// Fetch the other user's profile — tries worker first, then client
async function fetchUserInfo(otherId) {
  // Try as worker
  try {
    const { data } = await api.get(`/workers/${otherId}`);
    if (data?.name) return { userName: data.name, userPhotoUrl: data.photoUrl || null };
  } catch {}

  // Try as client
  try {
    const { data } = await api.get(`/clients/${otherId}`);
    if (data?.name) return { userName: data.name, userPhotoUrl: data.photoUrl || null };
  } catch {}

  return { userName: `Usuario ${otherId}`, userPhotoUrl: null };
}

// Cache simple por sesión: si la misma persona aparece en varios chats,
// solo resolvemos su nombre/foto una vez. Vive solo mientras dura la vista.
const userInfoCache = new Map();
function fetchUserInfoCached(otherId) {
  if (userInfoCache.has(otherId)) return userInfoCache.get(otherId);
  const promise = fetchUserInfo(otherId);
  userInfoCache.set(otherId, promise);
  return promise;
}

async function loadConversations() {
  loading.value = true;
  errorMsg.value = "";
  conversations.value = [];

  try {
    const { data: tokenData } = await api.get("/messages/token");
    const myIdentity = tokenData.identity;

    const client = new Client(tokenData.token);

    await new Promise((resolve, reject) => {
      client.on("stateChanged", async (state) => {
        if (state === "initialized") {
          try {
            const paginator = await client.getSubscribedConversations();
            const twilioConvs = paginator.items;

            if (!twilioConvs.length) { resolve(); client.shutdown(); return; }

            // PARALELIZADO: antes era un `for` secuencial que disparaba
            // (getMessages + fetchUserInfo) una a una. Ahora todas las
            // conversaciones se procesan al mismo tiempo con Promise.all.
            // Para 5 chats pasa de ~5x tiempo a ~1x tiempo.
            const results = (await Promise.all(twilioConvs.map(async (conv) => {
              const otherId = extractOtherUserId(conv.uniqueName, myIdentity);
              if (!otherId) return null;

              // Estas dos llamadas (último mensaje de Twilio + info del usuario
              // desde nuestro backend) son independientes entre sí, así que
              // también van en paralelo.
              const [msgResult, userInfo] = await Promise.all([
                conv.getMessages(1).catch(() => null),
                fetchUserInfoCached(otherId)
              ]);

              let lastMessage = "";
              let lastMessageAt = conv.dateUpdated;
              if (msgResult?.items?.length) {
                lastMessage   = msgResult.items[0].body;
                lastMessageAt = msgResult.items[0].dateCreated;
              }

              return {
                userId: otherId,
                userName: userInfo.userName,
                userPhotoUrl: userInfo.userPhotoUrl,
                lastMessage,
                lastMessageAt
              };
            }))).filter(Boolean);

            results.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
            conversations.value = results;
            resolve();
            client.shutdown();
          } catch (e) { reject(e); client.shutdown(); }
        } else if (state === "failed" || state === "denied") {
          reject(new Error(`Twilio state: ${state}`));
          client.shutdown();
        }
      });
      client.on("connectionError", (e) => { reject(e); client.shutdown(); });
    });

  } catch (e) {
    console.error("Error loading conversations:", e);
    errorMsg.value = e.response?.status === 401
        ? "Tu sesión expiró. Vuelve a iniciar sesión."
        : "No se pudieron cargar los mensajes. Verifica tu conexión.";
  } finally {
    loading.value = false;
  }
}

onMounted(loadConversations);
</script>

<style scoped>
.view-container { max-width: 896px; margin: 0 auto; }
.page-title { font-size: 1.875rem; font-weight: 800; color: #0f172a; }
.mb-6 { margin-bottom: 1.5rem; }

.loader-wrapper { display: flex; justify-content: center; padding: 4rem 0; }
.empty-state { text-align: center; padding: 4rem 0; }
.empty-illustration { font-size: 3rem; margin-bottom: 1rem; }
.empty-text { color: #64748b; margin-bottom: 0.5rem; font-size: 1.125rem; font-weight: 500; }
.empty-subtext { font-size: 0.875rem; color: #94a3b8; }

.conv-list { display: flex; flex-direction: column; gap: 0.75rem; }
.conv-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; transition: transform 0.2s, box-shadow 0.2s; }
.conv-card:hover { transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
.message-link { cursor: pointer; text-decoration: none; }

.conv-avatar { width: 48px; height: 48px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.conv-initial { color: white; font-weight: 700; font-size: 1.125rem; }

.conv-info { flex: 1; min-width: 0; }
.conv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
.conv-name { font-weight: 700; color: #1e293b; }
.conv-time { font-size: 0.75rem; color: #94a3b8; }
.conv-last { font-size: 0.875rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; }

.retry-btn { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 0.5rem 1.25rem; font-size: 0.875rem; cursor: pointer; }
.retry-btn:hover { background: #1d4ed8; }
.mt-4 { margin-top: 1rem; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius: 50%; width: 28px; height: 28px; animation: spin 1s linear infinite; }
.spinner-lg { width: 36px; height: 36px; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
