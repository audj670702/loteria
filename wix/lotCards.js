import crypto from 'crypto';
const encode = b => Buffer.from(b).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const digest = (secret,data) => crypto.createHmac('sha256',secret).update('LOT_CARTON_V1:'+data).digest();
export function poolHash(pool) { return crypto.createHash('sha256').update(JSON.stringify(pool)).digest('hex'); }
export function deterministicCard(secret,game,user) {
  const pool=game.reglas?.figuras;
  if(!Array.isArray(pool)||pool.length<16||pool.length>1000||new Set(pool).size!==pool.length)throw new Error('Baraja inválida.');
  return [...pool].sort((a,b)=>{
    const prefix=game._id+':'+user._id+':'+poolHash(pool)+':';
    return digest(secret,prefix+a).compare(digest(secret,prefix+b))||a.localeCompare(b);
  }).slice(0,16);
}
export function issueCard(secret,game,user,now=Date.now()) {
  if(game.estado!=='BORRADOR')throw new Error('El ingreso se cierra al iniciar la partida.');
  const payload={v:1,g:game._id,u:user._id,e:game.enteOperador,p:poolHash(game.reglas.figuras),iat:now,exp:now+7*24*60*60*1000,c:deterministicCard(secret,game,user)};
  const body=encode(JSON.stringify(payload));
  return {carton:payload.c,comprobante:body+'.'+encode(digest(secret,body))};
}
export function verifyCard(secret,ticket,game,user,now=Date.now()) {
  if(typeof ticket!=='string'||ticket.length>12000)throw new Error('Comprobante inválido.');
  const parts=ticket.split('.');if(parts.length!==2)throw new Error('Comprobante inválido.');
  const expected=encode(digest(secret,parts[0]));
  const a=Buffer.from(expected),b=Buffer.from(parts[1]);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Error('Firma de cartón inválida.');
  let p;try{p=JSON.parse(Buffer.from(parts[0].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));}catch{throw new Error('Comprobante inválido.');}
  if(p.v!==1||p.g!==game._id||p.u!==user._id||p.e!==game.enteOperador||p.p!==poolHash(game.reglas.figuras))throw new Error('El comprobante no corresponde al usuario o partida.');
  if(!Number.isFinite(p.iat)||!Number.isFinite(p.exp)||p.iat>now||p.exp<now||p.exp-p.iat!==7*24*60*60*1000)throw new Error('Comprobante vencido o inválido.');
  if(game.inicio&&p.iat>new Date(game.inicio).getTime())throw new Error('El cartón fue emitido después del inicio.');
  const card=deterministicCard(secret,game,user);
  if(!Array.isArray(p.c)||JSON.stringify(p.c)!==JSON.stringify(card))throw new Error('Cartón alterado.');
  return card;
}
// Reconstruye el mismo comprobante solo a partir de una inscripción del servidor.
export function restoreCard(secret,game,user,enrollment,now=Date.now()) {
  const id=v=>typeof v==='string'?v:v?._id||'';
  const at=new Date(enrollment?.fechaInscripcion).getTime();
  if(!['BORRADOR','EN_CURSO'].includes(game.estado)||!Number.isFinite(at)||at>now||id(enrollment?.partida)!==game._id||id(enrollment?.usuario)!==user._id||id(enrollment?.enteOperador)!==id(game.enteOperador))throw new Error('Inscripción no válida para recuperar el cartón.');
  const issued=issueCard(secret,{...game,estado:'BORRADOR'},user,at);
  verifyCard(secret,issued.comprobante,game,user,now);
  return issued;
}
