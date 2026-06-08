// Utilidades de suspensión usadas en distintas vistas.

// True si el timestamp ISO de "suspended until" aún no ha pasado.
export function isActiveSuspension(suspendedUntil) {
  if (!suspendedUntil) return false;
  return new Date(suspendedUntil) > new Date();
}

// Devuelve un texto humano del momento en que termina la suspensión.
// Ej.: "29 may 2026, 18:30".
export function formatSuspendedUntil(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-PE", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
