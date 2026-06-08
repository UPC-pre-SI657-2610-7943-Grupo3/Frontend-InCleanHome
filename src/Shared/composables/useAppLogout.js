// Hook de logout unificado.
//
// El problema: `auth.clearAuth()` solo borra el JWT propio del localStorage.
// La sesión de Auth0 (que vive en `@@auth0spajs@@...`) queda intacta, así que
// el siguiente click en "Continuar con Auth0" entra automáticamente con la
// misma cuenta — el usuario percibe que "no se cerró sesión".
//
// useAppLogout devuelve una función que:
//   1) Limpia el JWT propio del store de Pinia.
//   2) Llama a auth0.logout() apuntando a /login para que el navegador vuelva
//      a esa URL después de cerrar la sesión en el tenant Auth0.
//
// Si Auth0 está deshabilitado o falla, hace fallback a una recarga manual.

import { useAuthStore } from "../stores/auth.js";
import { useAuth0 } from "@auth0/auth0-vue";
import { isAuth0Enabled } from "../auth0.js";

export function useAppLogout() {
  const auth = useAuthStore();

  // useAuth0 solo se puede llamar si el plugin está registrado.
  let auth0 = null;
  if (isAuth0Enabled) {
    try { auth0 = useAuth0(); } catch { auth0 = null; }
  }

  return async function logout() {
    // 1) Borrar JWT propio.
    auth.clearAuth();

    // 2) Cerrar sesión Auth0 y redirigir a /login. Auth0 redirige a la URL que
    //    le pasemos en returnTo (debe estar en "Allowed Logout URLs" del dashboard).
    const returnTo = window.location.origin + "/login";

    if (auth0) {
      try {
        await auth0.logout({ logoutParams: { returnTo } });
        return; // El navegador ya está navegando, no continuar.
      } catch (e) {
        // Si falla por config, hacemos fallback a recarga.
        console.warn("[logout] Auth0 logout failed, falling back:", e);
      }
    }
    // Fallback: forzar navegación.
    window.location.href = "/login";
  };
}
