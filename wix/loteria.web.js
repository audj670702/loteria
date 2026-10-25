// LOTERIA v2.1 · 2026-10-25 · presencial, carton lleno 4x4.
// Solo ADM puede operar. Usuarios y entes sólo se crean en el registro por
// autoservicio de backend/sysComercial (titular con plan vigente y sin EO).
// v2.1: planes BÁSICO/ESTÁNDAR/PRO (backend/lotPlan) y EO suspendida sin plan vigente.
// v2.2: retención (backend/lotRetencion). Ganadores sin cartón; baraja editable sin partidas activas.
import wixData from 'wix-data';
import crypto from 'crypto';
import { configPartida, ingresoAbierto, cantadas, vistaPartida, pausa } from 'backend/lotFlow';
import { listaPresencias, cerrarPresencias, retirarParticipante, comprobarParticipacion } from 'backend/lotPresence';
import { verifyDigitalCard, resolveDigitalResult } from 'backend/lotSala';
import { currentMember } from 'wix-members-backend';
import { webMethod, Permissions } from 'wix-web-module';
import { comercial } from 'backend/sysComercial';
import { CFG_COMERCIAL, capacidades, nombreNivel, barajasHabilitadas, puedeCrearBaraja, revisarCanto } from 'backend/lotPlan';
const C = comercial(CFG_COMERCIAL);
const O = { suppressAuth: true, consistentRead: true };
const id = v => typeof v === 'string' ? v : v?._id || '';
const text = v => typeof v === 'string' ? v.trim() : '';
function check(ok, message) { if (!ok) throw new Error(message); }
async function all(query) {
  let r = await query.limit(1000).find(O);
  const out = [...r.items];
  while (r.hasNext()) { r = await r.next(); out.push(...r.items); }
  return out;
}
async function context(eoKey) {
  const member = await currentMember.getMember({ fieldsets: ['FULL'] });
  check(member?._id, 'Inicia sesion en Wix.');
  const users = await all(wixData.query('SCaD_USR').eq('app','LOT').eq('activo',true).eq('memberId',member._id));
  const eos = await all(wixData.query('SCaD_EO').eq('app','LOT').eq('activo',true));
  const allowed = eos.map(eo => ({eo, usr:users.find(u => u.enteOperador === eo.codigoContexto), vigente:false})).filter(x => {
    if (!x.usr) return false;
    const roles = Array.isArray(x.usr.roles) ? x.usr.roles : [];
    return roles.map(r => String(r).toUpperCase()).includes('ADM') || id(x.eo.admPrincipal) === x.usr._id || id(x.eo.admSys) === x.usr._id;
  });
  const key = text(eoKey);
  const selected = key ? allowed.find(x => [x.eo._id,x.eo.codigoEO,x.eo.codigoContexto].includes(key)) : allowed.length === 1 ? allowed[0] : null;
  // Asistencia SYS opera aunque el plan del titular no esté vigente (soporte).
  if (selected) selected.vigente = C.esAsistencia(selected.eo, selected.usr) || await C.vigenciaEO(selected.eo);
  return {allowed, selected, member};
}
// Nivel con el que opera la EO (consulta Pricing): sólo donde se aplican límites.
async function plan(ctx) { const nivel = await C.nivelEO(ctx.eo); return {nivel, cap:capacidades(nivel)}; }
async function ownCatalogsOf(ctx) { return all(wixData.query('LOT_Catalogos').eq('enteOperador',ctx.eo._id)); }
async function checkCatalogEnabled(cat, ctx, nivel) {
  if (cat.compartido === true) return;
  check(barajasHabilitadas(await ownCatalogsOf(ctx), nivel).has(cat._id),'Esta baraja quedó fuera de tu plan actual. Usa la baraja tradicional o la baraja habilitada, o cambia de plan.');
}
async function owned(col, key, ctx) {
  const item = await wixData.get(col,text(key),O);
  check(item && id(item.enteOperador) === ctx.eo._id,'Registro fuera del ente autorizado.');
  return item;
}
function canReadCatalog(cat, eoId) { return !!cat && (id(cat.enteOperador) === eoId || cat.compartido === true); }
function canEditCatalog(cat, eoId) { return !!cat && cat.compartido !== true && id(cat.enteOperador) === eoId; }
function mergeCatalogs(own, shared) { return [...new Map([...own,...shared].map(c=>[c._id,c])).values()].sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')); }
async function catalog(key, ctx) {
  const cat = await wixData.get('LOT_Catalogos',text(key),O);
  check(canReadCatalog(cat,ctx.eo._id),'Catalogo fuera del ente autorizado.');
  return cat;
}
async function figures(key) { return all(wixData.query('LOT_Figuras').eq('catalogo',key).ascending('numero')); }
function evidence(cards, called, pool) {
  check(Array.isArray(cards) && cards.length === 16,'El carton debe tener 16 figuras.');
  check(cards.every(c => typeof c === 'string' && c.length > 0) && new Set(cards).size === 16,'El carton contiene figuras invalidas o repetidas.');
  check(cards.every(c => pool.includes(c)),'El carton contiene figuras ajenas a la partida.');
  check(cards.every(c => called.includes(c)),'El carton aun no esta lleno.');
  return {filas:4,columnas:4,figuras:[...cards],posicionesGanadoras:Array.from({length:16},(_,i)=>i)};
}
export const lotOperacion = webMethod(Permissions.SiteMember, async (request) => {
  request = request || {};
  try {
    const {accion, eo, datos = {}} = request;
    let resolved = await context(eo);
    if (accion === 'registrar') {
      check(!resolved.allowed.length,'Tu cuenta ya administra una empresa en LOTERÍA.');
      const r = await C.registrarEO({memberId:resolved.member._id,loginEmail:resolved.member.loginEmail || ''}, datos);
      resolved = await context(r.eo._id);
    }
    if (accion === 'contexto' || accion === 'registrar') {
      const x = resolved.selected;
      let registro = null, planActual = null;
      if (!resolved.allowed.length) { const nivel = await C.nivelDeMiembro(resolved.member._id); registro = {disponible:!!nivel,nivel,plan:nombreNivel(nivel)}; }
      if (x && x.vigente) { const p = await plan(x); planActual = {nivel:p.nivel,nombre:nombreNivel(p.nivel),comercial:C.esComercial(x.eo),barajasPropias:p.cap.barajasPropias === Infinity ? null : p.cap.barajasPropias,cantoAutomatico:p.cap.cantoAutomatico}; }
      return {ok:true,data:{entes:resolved.allowed.map(x=>({_id:x.eo._id,nombre:x.eo.nombreVisible || x.eo.nombre,codigo:x.eo.codigoEO})),seleccionado:x?.eo._id || '',identidad:x ? {usuario:x.usr.nombreVisible || x.usr.nombreCompleto || x.usr.nombre || x.usr.codigoUSR,rol:C.esAsistencia(x.eo,x.usr)?'Asistencia SYS':'ADM',ente:x.eo.nombreVisible || x.eo.nombre,codigoEO:x.eo.codigoEO,aplicacion:'LOTERÍA'} : null,suspendida:!!x && !x.vigente,plan:planActual,registro,modalidad:'CARTON_LLENO',filas:4,columnas:4}};
    }
    const ctx = resolved.selected;
    check(ctx,'Selecciona un ente LOT activo para el que tengas permiso ADM.');
    check(ctx.vigente,'La suscripción de LOTERÍA de tu empresa no está vigente. Renueva tu plan para continuar; tus datos se conservan 30 días después del fin del plan.');
    if (accion === 'usuarios') {
      const users = await all(wixData.query('SCaD_USR').eq('app','LOT').eq('activo',true).eq('enteOperador',ctx.eo.codigoContexto));
      return {ok:true,data:users.map(u=>({_id:u._id,nombre:u.nombreVisible || u.nombreCompleto || u.nombre || u.codigoUSR}))};
    }
    if (accion === 'cargar') {
      const ownCatalogs = await all(wixData.query('LOT_Catalogos').eq('enteOperador',ctx.eo._id).ascending('nombre'));
      const sharedCatalogs = await all(wixData.query('LOT_Catalogos').eq('compartido',true).eq('activo',true));
      const {nivel} = await plan(ctx);
      const enabled = barajasHabilitadas(ownCatalogs,nivel);
      const catalogs = mergeCatalogs(ownCatalogs,sharedCatalogs).map(c=>({...c,habilitada:c.compartido === true || enabled.has(c._id)}));
      const rawGames = await all(wixData.query('LOT_Partidas').eq('enteOperador',ctx.eo._id).descending('_createdDate'));
      return {ok:true,data:{catalogos:catalogs,partidas:rawGames.map(g=>vistaPartida(g))}};
    }
    if (accion === 'catalogoCrear') {
      check(text(datos.nombre).length >= 2,'Escribe el nombre del catalogo.');
      const {nivel} = await plan(ctx);
      check(puedeCrearBaraja((await ownCatalogsOf(ctx)).length,nivel),nivel === 'BASICO' ? 'El Plan Básico usa la baraja tradicional. Las barajas personalizadas están en los planes Estándar y PRO.' : 'Tu plan ya tiene su baraja personalizada. Edítala o cambia al Plan PRO para tener más barajas.');
      const saved = await wixData.insert('LOT_Catalogos',{nombre:text(datos.nombre).slice(0,120),descripcion:text(datos.descripcion).slice(0,1000),enteOperador:ctx.eo._id,activo:true,compartido:false},O);
      return {ok:true,data:saved};
    }
    if (accion === 'figuras') {
      const cat = await catalog(datos.catalogo,ctx);
      return {ok:true,data:await figures(cat._id)};
    }
    if (accion === 'figuraGuardar') {
      const cat = await catalog(datos.catalogo,ctx);
      check(canEditCatalog(cat,ctx.eo._id),'La baraja predeterminada es de solo lectura. Crea un catalogo personalizado para tus figuras.');
      await checkCatalogEnabled(cat,ctx,(await plan(ctx)).nivel);
      // Bloquea mientras una partida la use: en preparación, en curso o cerrada aún sin resumir.
      const used = (await all(wixData.query('LOT_Partidas').eq('catalogo',cat._id))).filter(g=>!g.fechaCompactacion);
      check(!used.length,'La baraja está en uso por una partida activa o recién cerrada. Edítala cuando la partida termine.');
      check(Number.isSafeInteger(datos.numero) && datos.numero > 0,'Numero de figura invalido.');
      check(text(datos.nombre),'Escribe el nombre de la figura.');
      const key = cat._id + '-' + datos.numero;
      const image = text(datos.imagen);
      check(!image || image.startsWith('https://') || image.startsWith('wix:image://'),'Usa una imagen HTTPS o Wix.');
      const existing = await wixData.query('LOT_Figuras').eq('_id',key).limit(1).find(O);
      const values = {_id:key,catalogo:cat._id,numero:datos.numero,nombre:text(datos.nombre).slice(0,120),imagen:image,activo:datos.activo !== false};
      const saved = existing.items.length ? await wixData.update('LOT_Figuras',{...existing.items[0],...values},O) : await wixData.insert('LOT_Figuras',values,O);
      return {ok:true,data:saved};
    }
    if (accion === 'partidaCrear') {
      const cat = await catalog(datos.catalogo,ctx);
      check(cat.activo === true,'El catalogo esta inactivo.');
      const {nivel} = await plan(ctx);
      await checkCatalogEnabled(cat,ctx,nivel);
      revisarCanto(configPartida(datos).canto.modo,nivel);
      const pool = (await figures(cat._id)).filter(f=>f.activo === true);
      check(pool.length >= 16 && pool.length <= 1000,'La baraja debe tener de 16 a 1000 figuras activas.');
      check(new Set(pool.map(f=>f.numero)).size === pool.length,'Hay numeros duplicados en la baraja.');
      const key = text(datos.solicitudId);
      check(/^[a-zA-Z0-9-]{16,64}$/.test(key),'Identificador de solicitud invalido.');
      const previous = await wixData.query('LOT_Partidas').eq('_id',key).limit(1).find(O);
      if (previous.items.length) {
        check(id(previous.items[0].enteOperador) === ctx.eo._id && id(previous.items[0].catalogo) === cat._id,'Solicitud ya utilizada.');
        return {ok:true,data:previous.items[0]};
      }
      check(text(datos.nombre).length>=2&&!/^LOT-[a-z0-9-]{16,}$/i.test(text(datos.nombre)),'Escribe un nombre convencional para la partida.');
      let saved;
      for(let attempt=0;attempt<5;attempt++){
      const latest=await wixData.query('LOT_Partidas').descending('numeroRegistro').limit(1).find(O);
      const numeroRegistro=(Number(latest.items[0]?.numeroRegistro)||0)+1;
      try{saved = await wixData.insert('LOT_Partidas',{_id:key,numeroRegistro,folio:'REG-'+String(numeroRegistro).padStart(6,'0'),enteOperador:ctx.eo._id,catalogo:cat._id,responsable:ctx.usr._id,estado:'BORRADOR',reglas:{version:2,modalidad:'CARTON_LLENO',filas:4,columnas:4,figuras:pool.map(f=>f._id),ingresoAbierto:false,...configPartida(datos)},figurasCantadas:[]},O);break;}catch(error){const existing=await wixData.query('LOT_Partidas').eq('_id',key).limit(1).find(O);if(existing.items.length){check(id(existing.items[0].enteOperador)===ctx.eo._id,'Solicitud ya utilizada.');saved=existing.items[0];break;}if(attempt===4)throw error;}
      }
      return {ok:true,data:saved};
    }
    if (accion === 'seguimiento') {
      const resolved=await resolveDigitalResult(await owned('LOT_Partidas',datos.partida,ctx));const game=resolved.game;
      const participants=await listaPresencias(game,ctx.eo);
      for(const w of resolved.winners){if(!participants.some(p=>p.usuario===id(w.usuario)))participants.push({usuario:id(w.usuario),nombre:w.cartonGanador?.nombre||w.jugador||'Jugador',fechaInscripcion:null,ultimaActividad:null,conectado:false});}
      const users=await all(wixData.query('SCaD_USR').eq('app','LOT').eq('enteOperador',ctx.eo.codigoContexto));
      return {ok:true,data:{partida:vistaPartida(game),participantes:participants.map(p=>{const u=users.find(u=>u._id===p.usuario);const w=resolved.winners.find(w=>id(w.usuario)===p.usuario);return {...p,nombre:u?.nombreVisible||u?.nombreCompleto||p.nombre,avatar:u?.avatar||w?.cartonGanador?.avatar||'',ganador:!!w,fechaValidacion:w?.fechaValidacion||null,premio:w?.premio||''};})}};
    }
    if (accion === 'ganadores') {
      const game = await owned('LOT_Partidas',datos.partida,ctx);
      const winners = await all(wixData.query('LOT_Ganadores').eq('partida',game._id));
      return {ok:true,data:winners};
    }
    if (['configurar','abrir','iniciar','cantar','pausar','reanudar','finalizar','cancelar','ganadorValidar','retirarParticipante'].includes(accion)) {
      const game = (await resolveDigitalResult(await owned('LOT_Partidas',datos.partida,ctx))).game;
      check(id(game.responsable) === ctx.usr._id,'Solo el responsable de la partida puede operarla.');
      check(game.reglas?.modalidad === 'CARTON_LLENO' && game.reglas.filas === 4 && game.reglas.columnas === 4,'Reglas incompatibles con esta version.');
      const called = cantadas(game);
      const pool = game.reglas.figuras || [];
      if(accion==='retirarParticipante'){
        check(['BORRADOR','EN_CURSO'].includes(game.estado),'La partida está cerrada.');
        const usr=await wixData.get('SCaD_USR',text(datos.usuario),O);
        check(usr?.app==='LOT'&&usr.enteOperador===ctx.eo.codigoContexto,'Participante ajeno al ente.');
        const winners=await wixData.query('LOT_Ganadores').eq('partida',game._id).eq('usuario',usr._id).limit(1).find(O);
        check(!winners.items.length,'La persona ya tiene un resultado validado en esta partida.');
        await retirarParticipante(game,usr);return {ok:true,data:{retirado:true}};
      }
      if(accion==='ganadorValidar')throw new Error('El ganador se valida automáticamente al presentar su cartón desde la app.');
      check(datos.version === new Date(game._updatedDate).toISOString(),'La partida cambio; actualiza el panel.');
      if (['configurar','abrir','iniciar'].includes(accion)) {
        const nivel = (await plan(ctx)).nivel;
        revisarCanto(accion === 'iniciar' || datos.modo === undefined ? game.reglas.canto?.modo : configPartida(datos).canto.modo,nivel);
      }
      if (accion === 'configurar') {
        check(game.estado === 'BORRADOR' && !ingresoAbierto(game),'La configuración se cierra al abrir el ingreso.');
        check(text(datos.nombre).length>=2&&!/^LOT-[a-z0-9-]{16,}$/i.test(text(datos.nombre)),'Escribe un nombre convencional para la partida.');
        game.reglas={...game.reglas,...configPartida(datos)};
      } else if (accion === 'abrir') {
        check(game.estado === 'BORRADOR','La partida ya inició o está cerrada.');
        if(datos.modo!==undefined){check(!ingresoAbierto(game),'El ingreso ya está abierto.');check(text(datos.nombre).length>=2,'Escribe un nombre para la partida.');game.reglas={...game.reglas,...configPartida(datos)};}
        game.reglas.ingresoAbierto=true;
      } else if (accion === 'iniciar') {
        check(ingresoAbierto(game),'Abre el ingreso antes de iniciar.');
        game.estado='EN_CURSO'; game.inicio=new Date();game.reglas.ingresoAbierto=false;
        const c=game.reglas.canto||configPartida().canto;
        const orden=[...pool];
        for(let i=orden.length-1;i>0;i--){const max=i+1,limit=0x100000000-0x100000000%max;let r;do{r=crypto.randomBytes(4).readUInt32BE(0);}while(r>=limit);const j=r%max;[orden[i],orden[j]]=[orden[j],orden[i]];}
        game.reglas.canto={...c,orden,desde:Date.now(),acumuladoMs:0,pausado:false};
        game.participantesTotal=(await listaPresencias(game,ctx.eo)).length;
      } else if (accion === 'pausar' || accion === 'reanudar') {
        pausa(game,accion === 'pausar');
      } else if (accion === 'cantar') {
        check(game.estado === 'EN_CURSO','La partida no está en curso.');
        check(game.reglas.canto?.modo !== 'AUTOMATICO','El canto está configurado en automático.');
        check(!game.reglas.canto?.pausado,'Reanuda el canto antes de avanzar.');
        const figure=text(datos.figura)||(game.reglas.canto?.orden||pool).find(k=>!called.includes(k));
        check(pool.includes(figure)&&!called.includes(figure),'Figura ajena a la baraja, ya cantada o baraja agotada.');
        game.figurasCantadas=[...called,figure];
      } else {
        check(['BORRADOR','EN_CURSO'].includes(game.estado),'La partida ya está cerrada.');
        check(accion !== 'finalizar'||game.estado === 'EN_CURSO','Inicia la partida antes de finalizar.');
        game.figurasCantadas=called;
        game.estado=accion === 'cancelar'?'CANCELADA':'FINALIZADA';game.fin=new Date();game.reglas.ingresoAbierto=false;
      }
      const saved=await wixData.update('LOT_Partidas',game,O);
      if(['FINALIZADA','CANCELADA'].includes(saved.estado))await cerrarPresencias(saved);
      return {ok:true,data:vistaPartida(saved)};
    }
    throw new Error('Operacion no disponible.');
  } catch (error) {
    return {ok:false,error:{message:error instanceof Error ? error.message : 'No se pudo completar la operacion.'}};
  }
});
