<template>
  <section>
    <div class="page-head"><div><h1>{{ t("auth.admin.approve") }}</h1><p>{{ t("auth.admin.asubtitle") }}</p></div></div>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="card table-card">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>Email</th><th>{{ t("auth.admin.role") }}</th><th>{{ t("auth.admin.status") }}</th>
            <th class="col-docs">{{ t("auth.admin.docs") }}</th>
            <th class="col-actions">{{ t("auth.admin.actions") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in pendingUsers" :key="u.id">
            <td>{{ u.id }}</td>
            <td>{{ u.email }}</td>
            <td>{{ u.role }}</td>
            <td>
              <span v-if="u.documentsUploaded && !u.documentsVerified" class="badge warning">{{ t("auth.admin.astatusmessage") }}</span>
              <span v-else class="badge gray">{{ t("auth.admin.nodocs") }}</span>
            </td>
            <td class="col-docs">
              <button v-if="u.documentsUploaded" class="small" @click="viewDocs(u)">
                📄 {{ t("auth.admin.seedocs") }}
              </button>
              <span v-else class="muted">—</span>
            </td>
            <td class="col-actions">
              <button v-if="u.documentsUploaded" class="small success" @click="approveDocs(u)">✅ {{ t("auth.admin.btnapprove") }}</button>
              <button v-if="u.documentsUploaded" class="small danger" @click="rejectDocs(u)" style="margin-left: 6px;">❌ Rechazar</button>
              <span v-else class="muted">{{ t("auth.admin.nodocs") }}</span>
            </td>
          </tr>
          <tr v-if="pendingUsers.length === 0">
            <td colspan="6" class="empty">{{ t("auth.admin.amessage") }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: ver PDFs -->
    <div v-if="docsModal.show" class="modal-overlay" @click.self="docsModal.show = false">
      <div class="modal-box docs-modal">
        <div class="modal-header">
          <h2>{{ t("auth.admin.docsof") }} {{ docsModal.email }}</h2>
          <button class="modal-close" @click="docsModal.show = false">✕</button>
        </div>
        <div v-if="docsModal.loading" class="modal-loading">{{ t("auth.admin.loadingdocs") }}</div>
        <div v-else-if="!docsModal.docs.length" class="modal-empty">{{ t("auth.admin.nodocs") }}</div>
        <div v-else class="docs-list">
          <div v-for="doc in docsModal.docs" :key="doc.id" class="doc-item">
            <div class="doc-meta">
              <span class="doc-type">{{ docTypeLabel(doc.documentType) }}</span>
              <span class="doc-name">{{ doc.fileName }}</span>
            </div>
            <button class="small primary" @click="openDoc(doc)">👁 {{ t("auth.admin.btnpdf") }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: visualizar PDF -->
    <div v-if="pdfModal.show" class="modal-overlay" @click.self="pdfModal.show = false">
      <div class="modal-box pdf-modal">
        <div class="modal-header">
          <h2>{{ pdfModal.fileName }}</h2>
          <button class="modal-close" @click="pdfModal.show = false">✕</button>
        </div>
        <iframe v-if="pdfModal.src" :src="pdfModal.src" class="pdf-frame" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import api from '../../Shared/api.js';
import {useI18n} from "vue-i18n";

const { t } = useI18n();
const users = ref([]);
const error = ref('');

const docsModal = ref({ show: false, email: '', loading: false, docs: [] });
const pdfModal = ref({ show: false, src: '', fileName: '' });

// Solo trabajadoras (workers) que aún no están completamente verificadas
const pendingUsers = computed(() => users.value.filter(u =>
  u.role === 'worker' && !u.documentsVerified
));

async function load() {
  try { users.value = (await api.get('/admin/users')).data; }
  catch(e) { error.value = e.response?.data?.error || 'Error al cargar usuarios.'; }
}

async function approveDocs(u) {
  await api.patch(`/admin/users/${u.id}/approve-documents`);
  await load();
}

async function rejectDocs(u) {
  if (!confirm(`¿Rechazar documentos de ${u.email}? El usuario podrá volver a subirlos.`)) return;
  try {
    await api.patch(`/admin/users/${u.id}/reject-documents`);
    await load();
  } catch (e) {
    error.value = e.response?.data?.error || 'Error al rechazar documentos.';
  }
}

async function viewDocs(u) {
  docsModal.value = { show: true, email: u.email, loading: true, docs: [] };
  try {
    const { data } = await api.get(`/admin/users/${u.id}/documents`);
    docsModal.value.docs = data;
  } catch {
    docsModal.value.docs = [];
  } finally {
    docsModal.value.loading = false;
  }
}

function openDoc(doc) {
  const src = doc.fileBase64.startsWith('data:')
    ? doc.fileBase64
    : `data:application/pdf;base64,${doc.fileBase64}`;
  pdfModal.value = { show: true, src, fileName: doc.fileName };
}

function docTypeLabel(type) {
  const map = { background_check: "auth.admin.record", experience: "auth.admin.experience" };
  return t(map[type]) || type;
}

onMounted(load);
</script>

<style scoped src="./admin.css"></style>
<style scoped>
/* Columnas con ancho fijo para evitar desnivel */
.col-docs    { width: 170px; text-align: center; vertical-align: middle; }
.col-actions { width: 160px; text-align: center; vertical-align: middle; }

/* Todas las celdas alineadas verticalmente */
table td, table th { vertical-align: middle; }

/* Altura mínima por fila para que vacíos y botones no difieran */
table tbody tr { height: 56px; }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: white; border-radius: 1rem; padding: 1.5rem;
  width: 90%; max-width: 600px; max-height: 85vh; overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.pdf-modal { max-width: 860px; height: 85vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.modal-header h2 { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0; }
.modal-close { background: none; border: none; font-size: 1.25rem; cursor: pointer; color: #64748b; padding: 0.25rem 0.5rem; }
.modal-close:hover { color: #1e293b; }
.modal-loading, .modal-empty { color: #64748b; padding: 1rem 0; text-align: center; }
.docs-list { display: flex; flex-direction: column; gap: 0.75rem; }
.doc-item { display: flex; justify-content: space-between; align-items: center; padding: 0.875rem 1rem; background: #f8fafc; border-radius: 0.625rem; border: 1px solid #e2e8f0; }
.doc-meta { display: flex; flex-direction: column; gap: 0.25rem; }
.doc-type { font-weight: 700; font-size: 0.875rem; color: #1e293b; }
.doc-name { font-size: 0.8125rem; color: #64748b; }
.pdf-frame { flex: 1; border: none; border-radius: 0.5rem; width: 100%; min-height: 0; }
.small.primary { background: #2563eb; color: white; }
.small.primary:hover { background: #1d4ed8; }
.small.danger { background: #ef4444; color: white; border-color: #dc2626; }
.small.danger:hover { background: #dc2626; }
</style>
