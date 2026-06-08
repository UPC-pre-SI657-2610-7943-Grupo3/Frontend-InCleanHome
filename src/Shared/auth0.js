// Configuración del plugin Auth0 para Vue 3.
//
// Se exporta `auth0Plugin` (instancia de createAuth0) y `isAuth0Enabled` (booleano).
// `main.js` registra el plugin sólo si está habilitado, de modo que cuando
// VITE_AUTH0_ENABLED=false el botón se esconde y nada más cambia.
//
// El redirect_uri DEBE coincidir EXACTAMENTE con uno de los valores que
// agregaste en "Allowed Callback URLs" en el dashboard de Auth0:
//   http://localhost:5173/auth0/callback
//
// El audience hace que el access_token sea un JWT de la API (no opaco).
// Sin audience, Auth0 devuelve un token opaco que no se puede validar contra
// las JWKS del tenant en el backend.

import { createAuth0 } from "@auth0/auth0-vue";

export const isAuth0Enabled =
  String(import.meta.env.VITE_AUTH0_ENABLED || "false").toLowerCase() === "true";

export const auth0Plugin = isAuth0Enabled
  ? createAuth0({
      domain:       import.meta.env.VITE_AUTH0_DOMAIN,
      clientId:     import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin + "/auth0/callback",
        audience:     import.meta.env.VITE_AUTH0_AUDIENCE,
        scope:        "openid profile email",
      },
      // Guardamos el estado en localStorage para sobrevivir refresh del callback.
      cacheLocation: "localstorage",
      // Recupera la sesión silenciosamente si el usuario ya entró antes.
      useRefreshTokens: true,
    })
  : null;
