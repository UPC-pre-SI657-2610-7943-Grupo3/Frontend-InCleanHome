// Catálogo de distritos con cobertura de servicio.
// Estos valores coinciden con las zonas usadas en el registro de trabajadoras
// (ver IAM/views/WelcomeView.vue y Profiles/views/WorkerProfileEditView.vue) para que el filtrado y la validación de
// cobertura sean consistentes en toda la aplicación.
export const COVERAGE_ZONES = [
  "miraflores", "san_isidro", "surco", "la_molina", "barranco", "san_borja",
  "lince", "jesus_maria", "pueblo_libre", "magdalena", "san_miguel", "callao",
  "los_olivos", "san_martin", "ate", "comas",
];

// Verifica si un distrito está dentro del catálogo de zonas de atención.
export function hasCoverage(zone) {
  return COVERAGE_ZONES.includes(zone);
}
