<template>
  <section>
    <div class="page-head"><div><h1>{{ t("auth.admin.suspend") }}</h1><p>{{ t("auth.admin.ssubtitle") }}</p></div></div>
    <div class="card form-card">
      <label>{{ t("auth.admin.sid") }}</label>
      <input v-model.number="form.userId" type="number" min="1" placeholder="Ej. 12" />
      <label>{{ t("auth.admin.sdays") }}</label>
      <input v-model.number="form.days" type="number" min="1" />
      <label>{{ t("auth.admin.smotive") }}</label>
      <textarea v-model="form.reason" rows="4" placeholder="Motivo de la suspensión"></textarea>
      <div v-if="message" class="success-box">{{ message }}</div>
      <div v-if="error" class="error-box">{{ error }}</div>
      <div class="actions">
        <button class="danger-btn" @click="suspend">{{ t("auth.admin.sbtnsuspended") }}</button>
        <button class="small" @click="clearSuspension">{{ t("auth.admin.sdays") }}</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import api from '../../Shared/api.js';
import {useI18n} from "vue-i18n";
const { t } = useI18n();
const route = useRoute();
const form = ref({ userId: null, days: 7, reason:  t("auth.admin.smessage")  });
const message = ref(''); const error = ref('');
onMounted(() => { if (route.query.userId) form.value.userId = Number(route.query.userId); });
async function suspend(){ message.value=''; error.value=''; try { await api.patch(`/admin/users/${form.value.userId}/suspend`, { days: form.value.days, reason: form.value.reason }); message.value=t("auth.admin.smessage2") ; } catch(e){ error.value=e.response?.data?.error || t("auth.admin.smessage3") ; } }
async function clearSuspension(){ message.value=''; error.value=''; try { await api.patch(`/admin/users/${form.value.userId}/clear-suspension`); message.value=t("auth.admin.smessage4") ; } catch(e){ error.value=e.response?.data?.error || t("auth.admin.smessage5") ; } }
</script>

<style scoped src="./admin.css"></style>
