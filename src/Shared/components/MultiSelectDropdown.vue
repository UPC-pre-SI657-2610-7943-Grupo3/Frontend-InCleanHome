<template>
  <!-- Dropdown con checkboxes: botón que muestra el resumen de seleccionados;
       al abrir, despliega un panel con un checkbox por opción.
       Sin dependencias externas para mantener bundle pequeño. -->
  <div class="msd" v-click-outside="close">
    <button type="button" class="msd-trigger input-field" @click="toggle" :aria-expanded="open">
      <span class="msd-label">{{ summary }}</span>
      <span class="msd-caret" :class="{ open }">▾</span>
    </button>

    <div v-if="open" class="msd-panel">
      <!-- Opción "todos" cuando no es required (limpia la selección). -->
      <label v-if="allowAll" class="msd-option msd-all">
        <input type="checkbox" :checked="modelValue.length === 0" @change="clearAll" />
        <span>{{ allLabel }}</span>
      </label>
      <label v-for="opt in options" :key="opt.value" class="msd-option">
        <input
          type="checkbox"
          :value="opt.value"
          :checked="modelValue.includes(opt.value)"
          @change="toggleOption(opt.value)"
        />
        <span>{{ opt.label }}</span>
      </label>
      <div v-if="options.length === 0" class="msd-empty">{{ emptyLabel }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  // v-model: array de valores seleccionados.
  modelValue: { type: Array, default: () => [] },
  // options: lista de { value, label } a renderizar.
  options:    { type: Array, required: true },
  // Texto del trigger cuando no hay nada seleccionado.
  placeholder: { type: String, default: "Seleccionar" },
  // Texto cuando todo está seleccionado (opcional). Si no se pasa, mostramos "Todos".
  allLabel:    { type: String, default: "Todos" },
  // Mostrar la opción "Todos" arriba del listado.
  allowAll:    { type: Boolean, default: true },
  // Texto cuando la lista de opciones está vacía.
  emptyLabel:  { type: String, default: "Sin opciones" },
  // Formateador para el resumen del trigger (recibe lista de opciones seleccionadas).
  summaryFormatter: { type: Function, default: null },
});
const emit = defineEmits(["update:modelValue", "change"]);

const open = ref(false);
function toggle() { open.value = !open.value; }
function close()  { open.value = false; }

function toggleOption(value) {
  const set = new Set(props.modelValue);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  const next = Array.from(set);
  emit("update:modelValue", next);
  emit("change", next);
}
function clearAll() {
  emit("update:modelValue", []);
  emit("change", []);
}

// Construye el texto resumido. Si hay menos de 3, muestra los labels separados
// por coma; si hay más, muestra "N seleccionados".
const summary = computed(() => {
  const selected = props.options.filter(o => props.modelValue.includes(o.value));
  if (props.summaryFormatter) return props.summaryFormatter(selected) || props.placeholder;
  if (selected.length === 0) return props.placeholder;
  if (selected.length <= 2) return selected.map(s => s.label).join(", ");
  return `${selected.length} seleccionados`;
});

// Directiva "click fuera del componente" para cerrar el panel cuando el usuario
// hace click en otro lado. Se registra localmente para no contaminar el global.
const vClickOutside = {
  mounted(el, binding) {
    el.__msdClickOutside = (e) => { if (!el.contains(e.target)) binding.value(); };
    document.addEventListener("click", el.__msdClickOutside);
  },
  unmounted(el) {
    document.removeEventListener("click", el.__msdClickOutside);
    delete el.__msdClickOutside;
  },
};
</script>

<style scoped>
.msd { position: relative; width: 100%; }

.msd-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  text-align: left;
  background: white;
}
.msd-label { flex: 1; color: #1e293b; font-size: 0.875rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msd-caret { color: #64748b; font-size: 0.75rem; margin-left: 0.5rem; transition: transform 0.15s; }
.msd-caret.open { transform: rotate(180deg); }

.msd-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  max-height: 240px;
  overflow-y: auto;
  padding: 0.375rem;
}

.msd-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.875rem;
  color: #334155;
}
.msd-option:hover { background: #f1f5f9; }
.msd-option input[type="checkbox"] { width: 1rem; height: 1rem; accent-color: #2563eb; cursor: pointer; }

.msd-all { font-weight: 600; border-bottom: 1px solid #f1f5f9; margin-bottom: 0.25rem; padding-bottom: 0.5rem; }

.msd-empty { padding: 0.75rem; text-align: center; color: #94a3b8; font-size: 0.875rem; }
</style>
