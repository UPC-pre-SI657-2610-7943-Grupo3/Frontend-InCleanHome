<template>
  <div class="chat-container">
    <!-- Header -->
    <div class="chat-header mb-4">
      <button @click="$router.back()" class="btn btn-secondary btn-sm">←</button>
      <div class="conv-avatar" :style="otherPhoto ? {} : { background: getColor(Number(route.params.userId)) }">
        <img v-if="otherPhoto" :src="otherPhoto" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />
        <span v-else class="conv-initial">{{ initialOf(otherName) }}</span>
      </div>
      <span class="chat-title">{{ otherName }}</span>
      <span v-if="connecting" class="connecting-badge">Conectando...</span>
      <span v-else-if="connected" class="connected-badge">● En línea</span>
      <span v-else-if="errorMsg" class="error-badge">● Sin conexión</span>
    </div>

    <!-- Error banner -->
    <div v-if="errorMsg" class="error-banner">
      ⚠️ {{ errorMsg }}
      <button @click="retryConnection" class="retry-btn">Reintentar</button>
    </div>

    <!-- Messages -->
    <div ref="msgContainer" class="messages-list">
      <div v-if="loading" class="loader-wrapper py-8"><div class="spinner"></div></div>
      <div v-else-if="!messages.length && !errorMsg" class="empty-text py-8">Sé el primero en escribir</div>
      <div v-for="msg in messages" :key="msg.sid"
           :class="['msg-wrap', msg.author === myIdentity ? 'msg-mine' : 'msg-theirs']">
        <div :class="['msg-bubble', msg.author === myIdentity ? 'bubble-mine' : 'bubble-theirs']">
          {{ msg.body }}
        </div>
        <span class="msg-time">{{ formatTime(msg.dateCreated) }}</span>
      </div>
    </div>

    <!-- Input -->
    <div class="chat-input mt-3 pt-3">
      <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          class="input-field chat-input-field"
          :placeholder="connected ? t('messages.typeMessage') : (errorMsg ? 'Error de conexión' : 'Conectando al chat...')"
          :disabled="!connected" />
      <button @click="sendMessage" class="btn btn-primary" :disabled="!newMessage.trim() || !connected">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth.js";
import { Client } from "@twilio/conversations";
import api from "../api.js";

const { t } = useI18n();
const route = useRoute();
const auth = useAuthStore();

const messages = ref([]);
const loading = ref(true);
const connecting = ref(true);
const connected = ref(false);
const errorMsg = ref("");
const newMessage = ref("");
const msgContainer = ref(null);
const myIdentity = ref("");
const otherName = ref(route.query.name || "");
const otherPhoto = ref(route.query.photo ? decodeURIComponent(route.query.photo) : "");

let twilioClient = null;
let activeConversation = null;

const colors = ["#2563eb","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444"];
function getColor(id) { return colors[id % colors.length]; }
function initialOf(name) {
  if (!name) return "?";
  const first = name.trim()[0];
  return first && /[a-zA-Z\u00C0-\u024F]/.test(first) ? first.toUpperCase() : "?";
}
function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

async function scrollBottom() {
  await nextTick();
  if (msgContainer.value) msgContainer.value.scrollTop = msgContainer.value.scrollHeight;
}

async function sendMessage() {
  if (!newMessage.value.trim() || !activeConversation) return;
  const content = newMessage.value.trim();
  newMessage.value = "";
  try {
    await activeConversation.sendMessage(content);

    // After the message is sent via Twilio, ping our backend so it creates the
    // in-app notification + FCM push for the recipient. Fire-and-forget: if
    // this fails, the message is still delivered (Twilio is the source of truth).
    const recipientId = parseInt(route.params.userId);
    if (recipientId) {
      api.post(`/messages/${recipientId}/notify`, { content })
         .catch(err => console.warn("[Chat] No se pudo notificar al destinatario:", err));
    }
  } catch (e) {
    newMessage.value = content; // restore if failed
    console.error("Error sending message:", e);
  }
}

async function loadMessages(conversation) {
  const paginator = await conversation.getMessages(100);
  messages.value = paginator.items;
  await scrollBottom();
}

function cleanupTwilio() {
  if (activeConversation) {
    activeConversation.removeAllListeners();
    activeConversation = null;
  }
  if (twilioClient) {
    twilioClient.shutdown();
    twilioClient = null;
  }
}

async function initChat() {
  connecting.value = true;
  connected.value = false;
  errorMsg.value = "";

  try {
    // 1+2. Pedimos el token Y la conversación EN PARALELO para ahorrar un
    // round-trip. Antes era secuencial (token, luego conversation), ahora
    // ambas peticiones viajan al backend al mismo tiempo.
    const [tokenResp, convResp] = await Promise.all([
      api.get("/messages/token"),
      api.post(`/messages/conversation/${route.params.userId}`)
    ]);
    const tokenData = tokenResp.data;
    const convData  = convResp.data;
    myIdentity.value = tokenData.identity;
    const conversationSid = convData.conversationSid;

    // 3. Initialize the Twilio Conversations SDK client
    twilioClient = new Client(tokenData.token);

    twilioClient.on("stateChanged", async (state) => {
      console.log("[Twilio] stateChanged:", state);

      if (state === "initialized") {
        try {
          // 4. Join the conversation
          activeConversation = await twilioClient.getConversationBySid(conversationSid);

          // 5. Load existing messages
          await loadMessages(activeConversation);

          // 6. Listen for new messages in real time
          activeConversation.on("messageAdded", async (message) => {
            messages.value.push(message);
            await scrollBottom();
          });

          connecting.value = false;
          connected.value = true;
          errorMsg.value = "";
        } catch (e) {
          console.error("[Twilio] Error joining conversation:", e);
          connecting.value = false;
          errorMsg.value = "No se pudo unir a la conversación. Intenta de nuevo.";
        }
      } else if (state === "failed") {
        console.error("[Twilio] Client state: failed");
        connecting.value = false;
        errorMsg.value = "Error al conectar con el servicio de chat (token inválido o expirado).";
      } else if (state === "denied") {
        console.error("[Twilio] Client state: denied");
        connecting.value = false;
        errorMsg.value = "Acceso denegado al chat. Verifica tus credenciales.";
      }
    });

    twilioClient.on("connectionError", (error) => {
      console.error("[Twilio] connectionError:", error);
      connecting.value = false;
      connected.value = false;
      errorMsg.value = "Error de conexión con el chat. Verifica tu internet.";
    });

  } catch (e) {
    console.error("[Twilio] Error initializing chat:", e);
    connecting.value = false;

    // Mensaje de error más específico según el tipo de fallo
    if (e.response?.status === 401) {
      errorMsg.value = "Tu sesión expiró. Vuelve a iniciar sesión.";
    } else if (e.response?.status === 400) {
      errorMsg.value = "Error al crear la conversación: " + (e.response?.data?.error || "error desconocido");
    } else {
      errorMsg.value = "No se pudo conectar al chat. Verifica tu conexión a internet.";
    }
  } finally {
    loading.value = false;
  }
}

async function retryConnection() {
  cleanupTwilio();
  loading.value = true;
  await initChat();
}

// Resuelve nombre/foto del otro usuario probando primero como trabajadora y,
// si no, como cliente. Necesario porque cuando la trabajadora abre el chat
// el "otro" es un cliente y antes nunca se resolvía → quedaba "Usuario".
async function resolveOtherUser() {
  if (otherName.value && otherPhoto.value) return; // ya vino por query, no hace falta

  // Intento 1: trabajadora
  try {
    const { data } = await api.get(`/workers/${route.params.userId}`);
    if (data) {
      if (!otherName.value && data.name) otherName.value = data.name;
      if (!otherPhoto.value && data.photoUrl) otherPhoto.value = data.photoUrl;
      if (otherName.value) return;
    }
  } catch {}

  // Intento 2: cliente
  try {
    const { data } = await api.get(`/clients/${route.params.userId}`);
    if (data) {
      if (!otherName.value && data.name) otherName.value = data.name;
      if (!otherPhoto.value && data.photoUrl) otherPhoto.value = data.photoUrl;
    }
  } catch {}
}

onMounted(() => {
  // Disparamos en PARALELO la resolución del nombre y la conexión a Twilio:
  // antes eran secuenciales (primero name, luego initChat), ahora corren a
  // la vez. El name puede mostrarse aunque el chat siga conectando.
  resolveOtherUser().finally(() => {
    if (!otherName.value) otherName.value = "Usuario";
  });
  initChat();
});

onUnmounted(() => {
  cleanupTwilio();
});
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 220px);
  min-height: 400px;
  max-width: 800px;
  margin: 0 auto;
}

.chat-header { display: flex; align-items: center; gap: 0.75rem; }
.mb-4 { margin-bottom: 1rem; }

.conv-avatar { width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0; }
.conv-initial { color:white; font-weight:700; }
.chat-title { font-weight:700; font-size:1.0625rem; color:#1e293b; flex:1; }

.connecting-badge { font-size:0.75rem; color:#f59e0b; font-weight:500; }
.connected-badge { font-size:0.75rem; color:#10b981; font-weight:500; }
.error-badge { font-size:0.75rem; color:#ef4444; font-weight:500; }

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  border-radius: 8px;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.retry-btn {
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8125rem;
  cursor: pointer;
  white-space: nowrap;
}
.retry-btn:hover { background: #dc2626; }

.messages-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-right: 0.5rem;
  padding-bottom: 0.5rem;
}
.loader-wrapper { display: flex; justify-content: center; }
.py-8 { padding-top: 2rem; padding-bottom: 2rem; }
.empty-text { color:#94a3b8; font-size:0.875rem; text-align: center; }

.msg-wrap { display:flex;flex-direction:column;max-width:70%; }
.msg-mine { align-self:flex-end;align-items:flex-end; }
.msg-theirs { align-self:flex-start;align-items:flex-start; }

.msg-bubble { padding:0.625rem 0.875rem;border-radius:1rem;font-size:0.9375rem;line-height:1.4;word-break:break-word; }
.bubble-mine { background:#2563eb;color:white;border-bottom-right-radius:4px; }
.bubble-theirs { background:white;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:4px; }
.msg-time { font-size:0.6875rem;color:#94a3b8;margin-top:2px; }

.chat-input {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-top:1px solid #e2e8f0;
}
.mt-3 { margin-top: 0.75rem; }
.pt-3 { padding-top: 0.75rem; }
.chat-input-field { flex: 1; }

.spinner { border: 3px solid rgba(0,0,0,0.08); border-top-color: #2563eb; border-radius:50%; width:28px; height:28px; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
