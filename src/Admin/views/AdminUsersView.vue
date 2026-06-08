<template>
  <section>
    <div class="page-head">
      <div>
        <h1>{{ t('auth.admin.users') }}</h1>
        <p>{{ t('auth.admin.usubtitle') }}</p>
      </div>
    </div>

    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Email</th><th>{{ t('auth.admin.role') }}</th>
            <th>{{ t('auth.admin.verified') }}</th><th>{{ t('auth.admin.docs') }}</th>
            <th>{{ t('auth.admin.suspension') }}</th><th>{{ t('auth.admin.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.email }}</td>
            <td><span class="badge">{{ u.role }}</span></td>
            <td>{{ u.role === 'worker' ? (u.isVerified ? t('auth.admin.yes') : t('auth.admin.users') ) :  t('auth.admin.doesnotapply') }}</td>
            <td>{{ u.role === 'worker' ? (u.documentsVerified ? t('auth.admin.yes') : t('auth.admin.users')) : t('auth.admin.doesnotapply') }}</td>
            <td>
              <span v-if="isSuspended(u)" class="badge danger">{{t('auth.admin.suspensionuntil')}} {{ formatDate(u.suspendedUntil) }}</span>
              <span v-else class="muted">{{t('auth.admin.nosuspension')}}</span>
            </td>
            <td>
              <button
                v-if="u.role !== 'admin'"
                class="small danger-btn"
                @click="confirmDelete(u)"
                title="Eliminar usuario">
                🗑 {{t('auth.admin.btndelete')}}
              </button>
              <span v-else class="muted">—</span>
            </td>
          </tr>
          <tr v-if="!loading && users.length === 0">
            <td colspan="7" class="empty">{{t('auth.admin.umessage')}}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal confirmación eliminación -->
    <div v-if="deleteModal.show" class="modal-overlay" @click.self="deleteModal.show = false">
      <div class="modal-box">
        <div class="modal-icon">🗑</div>
        <h2 class="modal-title">{{t('auth.admin.deleteuser')}}</h2>
        <p class="modal-text">
          {{t('auth.admin.deletemessage1')}}
          <strong>{{ deleteModal.user?.email }}</strong>
          {{t('auth.admin.deletemessage2')}}
        </p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="deleteModal.show = false">{{t('auth.admin.cancelbtn')}}</button>
          <button class="btn-confirm-delete" @click="executeDelete" :disabled="deleting">
            {{ deleting ? t('auth.admin.deletebtn2') : t('auth.admin.deletebtn1') }}
          </button>
        </div>
        <div v-if="deleteError" class="error-box mt-2">{{ deleteError }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../../Shared/api.js';
import {useI18n} from "vue-i18n";

const { t } = useI18n();
const users = ref([]);
const loading = ref(false);
const error = ref('');
const deleteModal = ref({ show: false, user: null });
const deleting = ref(false);
const deleteError = ref('');

const isSuspended = (u) => u.suspendedUntil && new Date(u.suspendedUntil) > new Date();
const formatDate = (d) => new Date(d).toLocaleString('es-PE');

async function load() {
  loading.value = true; error.value = '';
  try {
    const { data } = await api.get('/admin/users');
    users.value = data;
  } catch (e) {
    error.value = e.response?.data?.error || 'No se pudieron cargar los usuarios.';
  } finally {
    loading.value = false;
  }
}

function confirmDelete(u) {
  deleteError.value = '';
  deleteModal.value = { show: true, user: u };
}

async function executeDelete() {
  if (!deleteModal.value.user) return;
  deleting.value = true;
  deleteError.value = '';
  try {
    await api.delete(`/admin/users/${deleteModal.value.user.id}`);
    deleteModal.value.show = false;
    await load();
  } catch (e) {
    deleteError.value = e.response?.data?.error || 'No se pudo eliminar el usuario.';
  } finally {
    deleting.value = false;
  }
}

onMounted(load);
</script>

<style scoped src="./admin.css"></style>
<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: white; border-radius: 1rem; padding: 2rem;
  width: 90%; max-width: 420px; text-align: center;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.modal-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.modal-title { font-size: 1.25rem; font-weight: 800; color: #1e293b; margin: 0 0 0.75rem; }
.modal-text { color: #475569; font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.5rem; }
.modal-actions { display: flex; gap: 0.75rem; justify-content: center; }
.btn-cancel {
  padding: 0.625rem 1.5rem; border-radius: 0.625rem;
  border: 1px solid #e2e8f0; background: white; color: #475569;
  font-weight: 600; cursor: pointer;
}
.btn-cancel:hover { background: #f8fafc; }
.btn-confirm-delete {
  padding: 0.625rem 1.5rem; border-radius: 0.625rem;
  background: #dc2626; color: white; border: none;
  font-weight: 600; cursor: pointer;
}
.btn-confirm-delete:hover:not(:disabled) { background: #b91c1c; }
.btn-confirm-delete:disabled { opacity: 0.6; cursor: not-allowed; }
.mt-2 { margin-top: 0.5rem; }
</style>
