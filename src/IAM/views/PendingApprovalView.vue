<template>
  <div class="pending-wrapper">
    <div class="pending-card">
      <!-- Icono animado -->
      <div class="icon-wrap">
        <svg class="icon-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>

      <h1 class="title">Tu cuenta está en revisión</h1>
      <p class="subtitle">
        Hemos recibido tus documentos correctamente. El equipo de administración
        los revisará y aprobará tu perfil en breve.
      </p>

      <div class="steps">
        <div class="step step-done">
          <div class="step-icon">✓</div>
          <div class="step-text">
            <div class="step-label">Registro completado</div>
            <div class="step-desc">Creaste tu cuenta exitosamente.</div>
          </div>
        </div>
        <div class="step step-done">
          <div class="step-icon">✓</div>
          <div class="step-text">
            <div class="step-label">Documentos subidos</div>
            <div class="step-desc">Antecedentes y experiencia recibidos.</div>
          </div>
        </div>
        <div class="step step-pending">
          <div class="step-icon">⏳</div>
          <div class="step-text">
            <div class="step-label">Revisión del administrador</div>
            <div class="step-desc">En proceso — te notificaremos cuando estés aprobada.</div>
          </div>
        </div>
        <div class="step step-locked">
          <div class="step-icon">🔒</div>
          <div class="step-text">
            <div class="step-label">Perfil activo</div>
            <div class="step-desc">Podrás recibir reservas una vez aprobada.</div>
          </div>
        </div>
      </div>

      <div class="info-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Recibirás una notificación en la app cuando tu cuenta sea aprobada. El proceso generalmente toma menos de 24 horas.</span>
      </div>

      <div class="actions">
        <button @click="checkStatus" class="btn btn-primary" :disabled="checking">
          <span v-if="checking">Verificando...</span>
          <span v-else>🔄 Verificar estado</span>
        </button>
        <button @click="logout" class="btn btn-secondary">Cerrar sesión</button>
      </div>

      <div v-if="approved" class="approved-banner">
        ✅ ¡Tu cuenta fue aprobada! Redirigiendo...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../Shared/stores/auth.js";
import { useAppLogout } from "../../Shared/composables/useAppLogout.js";

const auth = useAuthStore();
const router = useRouter();
const handleLogoutAction = useAppLogout();
const checking = ref(false);
const approved = ref(false);

async function checkStatus() {
  checking.value = true;
  try {
    await auth.refreshUser();
    if (auth.user?.documentsVerified) {
      approved.value = true;
      setTimeout(() => router.push("/worker/dashboard"), 1500);
    }
  } finally {
    checking.value = false;
  }
}

async function logout() {
  // Cierra sesión Auth0 también, no solo el JWT propio.
  await handleLogoutAction();
}
</script>

<style scoped>
.pending-wrapper {
  min-height: 100vh;
  background: linear-gradient(135deg, #ede9fe 0%, #f0fdf4 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

.pending-card {
  width: 100%;
  max-width: 520px;
  background: white;
  border-radius: 1.5rem;
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.08);
  text-align: center;
}

.icon-wrap {
  width: 80px;
  height: 80px;
  background: #ede9fe;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
}
.icon-clock {
  width: 44px;
  height: 44px;
  color: #7c3aed;
  animation: spin 4s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 0.75rem;
}
.subtitle {
  color: #64748b;
  font-size: 0.9375rem;
  line-height: 1.6;
  margin-bottom: 2rem;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  text-align: left;
  margin-bottom: 1.5rem;
}
.step {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem;
  border-radius: 0.75rem;
}
.step-done { background: #d1fae5; }
.step-pending { background: #fef3c7; }
.step-locked { background: #f1f5f9; }

.step-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
  background: white;
}
.step-label { font-weight: 600; font-size: 0.9rem; color: #1e293b; }
.step-desc { font-size: 0.8125rem; color: #64748b; margin-top: 0.125rem; }

.info-box {
  background: #ede9fe;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  text-align: left;
  font-size: 0.8125rem;
  color: #5b21b6;
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.75rem;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  border: none;
  transition: all 0.15s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: #7c3aed; color: white; }
.btn-primary:hover:not(:disabled) { background: #6d28d9; }
.btn-secondary { background: #f1f5f9; color: #475569; }
.btn-secondary:hover { background: #e2e8f0; }

.approved-banner {
  margin-top: 1rem;
  background: #d1fae5;
  color: #065f46;
  padding: 0.875rem;
  border-radius: 0.75rem;
  font-weight: 600;
}

@media (max-width: 480px) {
  .pending-card { padding: 1.75rem 1.25rem; }
  .title { font-size: 1.25rem; }
}
</style>
