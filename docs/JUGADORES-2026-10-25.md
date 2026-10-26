# Jugadores (USR) en el panel de LOTERÍA · 25 oct 2026

Mismo esquema de NEXUS, con las funciones de `backend/sys.web` (repo `scad-sys`) y `APP = 'LOT'`.

- **Cupo:** sólo cuentan los USR activos; Asistencia SYS no cuenta (sys.web v0.11.18). Límites por plan: 20, 50 o 100.
- **Cómo entra un jugador:** en la app toca *Iniciar sesión* → `/sys-autenticacion?app=LOT` → si aún no está vinculado, escribe el **Código de la empresa** (código de localización de la EO) y su **código de acceso** individual, o lo encuentra su **registro directo** (prealta por correo). SYS valida el cupo.
- **Panel:** `/panel-loteria` incluye los componentes compartidos *Gestión de acceso* (`#htmlGestionAcceso`) y *Gestión de usuarios* (`#htmlGestionUsuarios`), con textos de "jugadores" y sin Plan de pago. Asistencia SYS no se lista.

## Instalación en Wix
1. `backend/sysComercialCore.js` (v1.5) desde `scad-sys`.
2. `backend/loteria.web.js` (devuelve el Código de la empresa en el contexto).
3. En `/panel-loteria`, debajo del panel, agregar dos componentes HTML (Insertar → Incrustar código → HTML):
   - ID `htmlGestionAcceso` con `scad-sys/html/sysGestionAcceso.html`
   - ID `htmlGestionUsuarios` con `scad-sys/html/sysGestionUsuarios.html`
4. Código de la página `/panel-loteria`: `wix/panel-loteria.page.js` (v2.2.0).
5. En NEXUS, los mismos dos componentes pueden actualizarse a estas versiones sin cambios en su página.
