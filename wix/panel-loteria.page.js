// LOT_Panel · Velo v2.2.0 · Página /panel-loteria
// v2.2.0: módulo Jugadores con los componentes SYS compartidos (los mismos de NEXUS):
//         #htmlGestionAcceso (forma de registro, códigos, registro directo) y
//         #htmlGestionUsuarios (lista, activo, acceso por código, roles).
//         Mismas funciones de backend/sys.web con APP = 'LOT'. Asistencia SYS no se lista.
// v2.1.2: puente del panel (#htmlPanelLoteria) + carga nativa de imágenes (#boxCarga, #uploadCarga).
import { lotOperacion } from 'backend/loteria.web';
import {
  sysListAccessCodes, sysGenerateAccessCode, sysRevokeAccessCode,
  sysGetEOAccessPolicy, sysSaveEOAccessPolicy, sysPreRegisterEOUser,
  sysListEOUsers, sysSetEOUserCodeAccess, sysSetEOUserActive, sysSetEOUserRoles,
  sysGetEORoleLabels, sysSaveEORoleLabels, sysResolveEOAdminContext
} from 'backend/sys.web';

const VERSION = '2.2.0';
const APP = 'LOT';
const OPCIONES = { planesDePago: false };                 // en LOT los jugadores nunca pagan
const TERMINOS = { usuario: 'jugador', usuarios: 'jugadores' };
const ACCESS = { html: '#htmlGestionAcceso', in: 'SCAD_NEXUS_ACCESS_CODES', out: 'SCAD_NEXUS_ACCESS_CODES_VELO' };
const USERS = { html: '#htmlGestionUsuarios', in: 'SCAD_PAEO_USERS', out: 'SCAD_PAEO_USERS_VELO' };

let selectedCatalog = '', selectedEO = '', uploadBusy = false;
// EO activa del panel (la resuelve lotOperacion 'contexto'); los módulos SYS sólo operan si está vigente.
let eo = { codigoEO: '', codigoLocalizacion: '', vigente: false };
let accessBusy = false;

$w.onReady(function () {
  console.info('LOT Panel Velo', VERSION);
  const panel = $w('#htmlPanelLoteria');
  const box = $w('#boxCarga');
  const upload = $w('#uploadCarga');
  box.hide();
  async function call(request) { return lotOperacion(request); }

  panel.onMessage(async event => {
    const m = event.data;
    if (!m || typeof m !== 'object') return;
    if (m.channel === 'LOT_PANEL_READY') { panel.postMessage({ channel: 'LOT_PANEL_INIT' }); return; }
    if (m.channel === 'LOT_UPLOAD_OPEN') {
      if (uploadBusy) return;
      selectedCatalog = typeof m.catalogo === 'string' ? m.catalogo : '';
      if (!selectedCatalog) return;
      box.show();
      return;
    }
    if (m.channel !== 'LOT_PANEL' || typeof m.rid !== 'string' || !m.request) return;
    let result;
    try {
      result = await call(m.request);
      if (result?.ok && (m.request.accion === 'contexto' || m.request.accion === 'registrar')) await applyContext(result.data);
    } catch (error) {
      console.error('LOT backend', error);
      result = { ok: false, error: { message: 'No se pudo completar. Verifica sesión y acceso LOT.' } };
    }
    panel.postMessage({ channel: 'LOT_PANEL_RESULT', rid: m.rid, result });
  });

  upload.onChange(async () => {
    if (uploadBusy || !selectedCatalog) return;
    uploadBusy = true;
    const catalogo = selectedCatalog;
    try {
      if (!upload.value?.length) throw new Error('Selecciona imágenes para cargar.');
      const uploaded = await upload.uploadFiles();
      const archivos = uploaded.map(f => {
        const url = String(f.fileUrl || '');
        const match = url.match(/^wix:image:\/\/v1\/([^/]+)/) || url.match(/\/media\/([^/?#]+)/);
        if (!match) throw new Error('No se pudo identificar el archivo cargado en Wix Media: ' + url);
        return { fileId: match[1], url, nombre: f.originalFileName || f.fileName || '' };
      });
      const placed = await call({ accion: 'imagenesUbicar', eo: selectedEO, datos: { catalogo, archivos } });
      if (!placed?.ok) throw new Error(placed?.error?.message || 'No se pudieron ubicar las imágenes.');
      panel.postMessage({ channel: 'LOT_UPLOAD_RESULT', catalogo, archivos: placed.data.archivos });
      box.hide();
    } catch (error) {
      console.error('LOT upload', error);
      panel.postMessage({ channel: 'LOT_UPLOAD_RESULT', catalogo, error: error.message || 'Error al cargar imágenes.' });
    } finally { uploadBusy = false; }
  });

  setupAccess();
  setupUsers();
  panel.postMessage({ channel: 'LOT_PANEL_INIT' });
});

// ---------------------------------------------------------------- contexto
async function applyContext(data = {}) {
  selectedEO = data.seleccionado || '';
  const ente = (data.entes || []).find(e => e._id === selectedEO);
  eo = {
    codigoEO: ente?.codigo || data.identidad?.codigoEO || '',
    codigoLocalizacion: data.identidad?.codigoLocalizacion || '',
    vigente: !!selectedEO && data.suspendida !== true
  };
  await Promise.all([sendAccessContext().catch(e => accessError(e)), sendUsersContext().catch(e => usersError(e))]);
}
function requireEO() {
  if (!eo.codigoEO) throw new Error('Abre el panel con tu empresa de LOTERÍA para administrar jugadores.');
  if (!eo.vigente) throw new Error('La suscripción de LOTERÍA de tu empresa no está vigente. Renueva tu plan para administrar jugadores.');
  return { app: APP, codigoEO: eo.codigoEO };
}
function ok(result, mensaje) { if (!result?.ok) throw new Error(result?.mensaje || mensaje); return result; }
async function capacidad() {
  const r = await sysResolveEOAdminContext({ app: APP, codigoEO: eo.codigoEO });
  const x = r?.ok && r.autorizado ? r.eo : {};
  return {
    modalidad: x.usuariosIlimitados === true ? 'LIBRE' : 'LIMITADO',
    usuariosIlimitados: x.usuariosIlimitados === true,
    limiteUsuarios: Number.isInteger(x.limiteUsuarios) ? x.limiteUsuarios : null,
    usuariosActivos: Number.isInteger(x.usuariosActivos) ? x.usuariosActivos : 0,
    usuariosDisponibles: Number.isInteger(x.usuariosDisponibles) ? x.usuariosDisponibles : null,
    usuariosExcedentes: Number.isInteger(x.usuariosExcedentes) ? x.usuariosExcedentes : 0,
    porcentajeCapacidadUsuarios: Number.isFinite(x.porcentajeCapacidadUsuarios) ? x.porcentajeCapacidadUsuarios : null,
    estadoCapacidadUsuarios: String(x.estadoCapacidadUsuarios || 'SIN_CONFIGURAR')
  };
}

// ---------------------------------------------------------------- Gestión de acceso
function postAccess(type, payload = {}) { try { $w(ACCESS.html).postMessage({ source: ACCESS.out, type, payload }); } catch (e) { console.warn('LOT acceso', e); } }
function accessError(error) { postAccess('ERROR', { mensaje: error?.message || 'No fue posible completar la operación.' }); }
function setupAccess() {
  let html; try { html = $w(ACCESS.html); } catch (e) { console.warn('LOT: falta #htmlGestionAcceso'); return; }
  html.onMessage(async event => {
    const m = event?.data || {};
    if (m.source !== ACCESS.in) return;
    if (accessBusy && ['GENERATE', 'REVOKE', 'SAVE_POLICY', 'PREALTA_SAVE'].includes(m.action)) return;
    try {
      switch (m.action) {
        case 'INIT': if (eo.codigoEO) await sendAccessContext(); break;
        case 'GENERATE': accessBusy = true; {
          const r = ok(await sysGenerateAccessCode({ ...requireEO(), referencia: String(m.payload?.referencia || '').trim() }), 'No fue posible generar el código.');
          const list = ok(await sysListAccessCodes({ ...requireEO(), limit: 250 }), 'No se pudo actualizar la lista.');
          postAccess('GENERATED', { codigo: r.codigo, items: list.items || [] });
          await sendAccessContext();
        } break;
        case 'REVOKE': accessBusy = true; {
          requireEO();
          const r = ok(await sysRevokeAccessCode({ id: String(m.payload?.id || '').trim() }), 'No fue posible revocar el código.');
          const list = ok(await sysListAccessCodes({ ...requireEO(), limit: 250 }), 'No se pudo actualizar la lista.');
          postAccess('UPDATED', { mensaje: r.mensaje || 'Código revocado.', items: list.items || [] });
          await sendAccessContext();
        } break;
        case 'SAVE_POLICY': accessBusy = true; {
          const p = m.payload || {};
          const r = ok(await sysSaveEOAccessPolicy({ ...requireEO(), modoAcceso: String(p.modoAcceso || 'SIN_CONFIGURAR').toUpperCase(), accesoPricing: false, accesoCodigo: p.accesoCodigo === true, accesoDirecto: p.accesoDirecto === true }), 'No fue posible guardar la forma de registro.');
          postAccess('POLICY_SAVED', { mensaje: r.mensaje || 'Configuración guardada.', policy: r.policy });
          await sendAccessContext();
        } break;
        case 'SAVE_PRICING': throw new Error('En LOTERÍA los jugadores no pagan: no hay planes de pago para jugadores.');
        case 'OPEN_PREALTA': case 'CLOSE_PREALTA': break; // sin fotografía en LOT (avatar opcional)
        case 'PREALTA_SAVE': accessBusy = true; {
          const p = m.payload || {};
          const r = ok(await sysPreRegisterEOUser({ ...requireEO(), nombre: p.nombre, apellidoPaterno: p.apellidoPaterno, apellidoMaterno: p.apellidoMaterno, nombreVisible: p.nombreVisible, telefono: p.telefono, email: String(p.email || '').trim().toLowerCase() }), 'No fue posible registrar al jugador.');
          postAccess('PREALTA_SAVED', { ok: true, mensaje: r.mensaje || 'Jugador registrado.', user: r.user || null });
          await Promise.all([sendAccessContext(), sendUsersContext()]);
        } break;
        default: break;
      }
    } catch (error) { console.error('LOT acceso', m.action, error); accessError(error); }
    finally { accessBusy = false; }
  });
}
async function sendAccessContext() {
  if (!eo.codigoEO) return;
  const ctx = requireEO();
  const [codes, policy, cap] = await Promise.all([
    sysListAccessCodes({ ...ctx, limit: 250 }), sysGetEOAccessPolicy(ctx), capacidad()
  ]);
  ok(codes, 'No fue posible cargar los códigos.'); ok(policy, 'No fue posible cargar la forma de registro.');
  postAccess('CONTEXT', {
    eo: { codigoEO: eo.codigoEO }, items: codes.items || [], pricing: { plans: [], selectedPlanIds: [] },
    policy: policy.policy, capacidadUsuarios: cap,
    opciones: OPCIONES, terminos: TERMINOS, codigoLocalizacion: eo.codigoLocalizacion
  });
}

// ---------------------------------------------------------------- Gestión de usuarios (jugadores)
function postUsers(type, payload = {}) { try { $w(USERS.html).postMessage({ source: USERS.out, type, payload }); } catch (e) { console.warn('LOT usuarios', e); } }
function usersError(error) { postUsers('ERROR', { mensaje: error?.message || 'No fue posible completar la operación.' }); }
function setupUsers() {
  let html; try { html = $w(USERS.html); } catch (e) { console.warn('LOT: falta #htmlGestionUsuarios'); return; }
  html.onMessage(async event => {
    const m = event?.data || {};
    if (m.source !== USERS.in) return;
    try {
      const usrId = String(m.payload?.usrId || '').trim();
      switch (m.action) {
        case 'INIT': if (eo.codigoEO) await sendUsersContext(); break;
        case 'SET_ACTIVE': {
          const r = ok(await sysSetEOUserActive({ ...requireEO(), usrId, activo: m.payload?.activo === true }), 'SYS rechazó el cambio de estado.');
          postUsers('UPDATED', { mensaje: r.mensaje, user: r.user || null });
          await Promise.all([sendUsersContext(), sendAccessContext()]);
        } break;
        case 'SET_CODE_ACCESS': {
          const r = ok(await sysSetEOUserCodeAccess({ ...requireEO(), usrId, activoCodigo: m.payload?.activoCodigo === true }), 'SYS rechazó el acceso por código.');
          postUsers('UPDATED', { mensaje: r.mensaje, user: r.user || null });
        } break;
        case 'SET_ROLES': {
          const r = ok(await sysSetEOUserRoles({ ...requireEO(), usrId, roles: Array.isArray(m.payload?.roles) ? m.payload.roles : [] }), 'SYS rechazó los roles.');
          postUsers('UPDATED', { mensaje: r.mensaje, user: r.user || null });
        } break;
        case 'SAVE_ROLE_LABELS': {
          const r = ok(await sysSaveEORoleLabels({ ...requireEO(), etiquetas: m.payload?.etiquetas || {} }), 'No se guardaron las etiquetas.');
          postUsers('ROLE_LABELS_SAVED', r);
        } break;
        default: break;
      }
    } catch (error) { console.error('LOT usuarios', m.action, error); usersError(error); }
  });
}
async function sendUsersContext() {
  if (!eo.codigoEO) return;
  const ctx = requireEO();
  const [users, labels, cap] = await Promise.all([
    sysListEOUsers(ctx),
    sysGetEORoleLabels(ctx).catch(e => ({ ok: false, mensaje: e?.message })),
    capacidad()
  ]);
  ok(users, 'No fue posible cargar los jugadores.');
  // Asistencia SYS es apoyo silencioso: no se lista (salvo que sea también el titular).
  const items = (users.items || []).filter(u => !(u.esAdmSys === true && u.esAdmPrincipal !== true));
  postUsers('CONTEXT', {
    eo: { codigoEO: eo.codigoEO }, items,
    rolesConfigurables: labels?.ok ? labels.roles || [] : [],
    etiquetasRoles: labels?.ok ? labels.etiquetas || {} : {},
    rolesDisponibles: labels?.ok === true,
    errorRoles: labels?.ok ? '' : labels?.mensaje || '',
    capacidadUsuarios: cap, opciones: OPCIONES, terminos: TERMINOS
  });
}
