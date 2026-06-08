<template>
  <section>
    <div class="page-head"><div><h1>{{ t("auth.admin.reports") }}</h1><p>{{ t("auth.admin.rsubtitle") }}</p></div></div>
    <div v-if="error" class="error-box">{{ error }}</div>
    <div class="filters"><button :class="{active: status === ''}" @click="status='';load()">{{ t("auth.admin.rall") }}</button>
      <button :class="{active: status === 'open'}" @click="status='open';load()">{{ t("auth.admin.ropen") }}</button>
      <button :class="{active: status === 'confirmed'}" @click="status='confirmed';load()">{{ t("auth.admin.rconfirmed") }}</button>
      <button :class="{active: status === 'dismissed'}" @click="status='dismissed';load()">{{ t("auth.admin.rdiscarded") }}</button>
    </div>
    <div class="card table-card">
      <table>
        <thead><tr><th>ID</th><th>{{ t("auth.admin.reported") }}</th><th>{{ t("auth.admin.reporter") }}</th><th>{{ t("auth.admin.motive") }}</th><th>{{ t("auth.admin.status") }}</th><th>{{ t("auth.admin.actions") }}</th></tr></thead>
        <tbody>
          <tr v-for="r in reports" :key="r.id">
            <td>{{ r.id }}</td>
            <td>#{{ r.reportedUserId }} <span class="muted">{{ r.reportedRole }}</span></td>
            <td>#{{ r.reporterUserId }}</td>
            <td><strong>{{ r.reason }}</strong><br><span class="muted">{{ r.details ||  t("auth.admin.nodetail")  }}</span></td>
            <td><span class="badge" :class="statusClass(r.status)">{{ r.status }}</span></td>
            <td class="actions">
              <button class="small success" :disabled="r.status === 'confirmed'" @click="confirmReport(r)">{{ t("auth.admin.confirm") }}</button>
              <button class="small" :disabled="r.status === 'dismissed'" @click="dismissReport(r)">{{ t("auth.admin.discard") }}</button>
              <router-link class="small link" :to="`/admin/suspend?userId=${r.reportedUserId}`">{{ t("auth.admin.suspend") }}</router-link>
            </td>
          </tr>
          <tr v-if="reports.length === 0"><td colspan="6" class="empty">{{ t("auth.admin.noreports") }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import api from '../../Shared/api.js';
import {useI18n} from "vue-i18n";
const { t } = useI18n();
const reports = ref([]); const status = ref(''); const error = ref('');
const statusClass = s => ({ confirmed: 'danger', open: 'warning', dismissed: 'muted-badge' }[s] || '');
async function load(){ try { const q = status.value ? `?status=${status.value}` : ''; reports.value = (await api.get(`/reports${q}`)).data; } catch(e){ error.value = e.response?.data?.error || 'Error al cargar reportes.'; } }
async function confirmReport(r){ const adminNotes = prompt( t("auth.admin.note"),  t("auth.admin.note2")); await api.patch(`/reports/${r.id}/confirm`, { adminNotes }); await load(); }
async function dismissReport(r){ const adminNotes = prompt(t("auth.admin.reason1"), t("auth.admin.reason2")); await api.patch(`/reports/${r.id}/dismiss`, { adminNotes }); await load(); }
onMounted(load);
</script>

<style scoped src="./admin.css"></style>
