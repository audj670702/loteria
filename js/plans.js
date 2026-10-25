// Planes de LOTERÍA para organizadores (Wix Pricing Plans · scad.mx).
// Precios y prueba tomados de Pricing el 25 oct 2026; si cambian en Wix, actualizar aquí.
// Las características son las que el servidor valida hoy (wix/lotPlan.js).
import {TRADITIONAL} from './traditional.js';

const COMPRA='https://www.scad.mx/pricing-plans/list?planIds=';
export const PRUEBA_DIAS=14;
export const PLANES=[
  {id:'4cb541ef-a7a1-4c30-927d-a137664a19fa',nombre:'BÁSICO',precio:199,imagen:'./assets/plan_basico.png',
   incluye:['Baraja tradicional y cartones listos para jugar','Partidas presenciales y remotas con premios','Cartones aleatorios y validación automática del ganador','Canto manual y en vivo']},
  {id:'c8f67fe9-44f7-4693-9619-d63c897174d4',nombre:'ESTÁNDAR',precio:220,imagen:'./assets/plan_estandar.png',
   incluye:['Todo lo del Plan Básico','Tu propia baraja personalizada','Edita y reutiliza tu baraja']},
  {id:'d82f6e6d-fc22-49b9-93d3-c8eac6a3be62',nombre:'PRO',precio:299,imagen:'./assets/plan_pro.png',etiqueta:'El más completo',
   incluye:['Todo lo del Plan Estándar','Barajas personalizadas sin límite','Canto automático con intervalo configurable'],
   proximamente:['Modalidades de victoria configurables','Catálogo de juegos personalizado']}
];
export function urlCompra(plan){return COMPRA+encodeURIComponent(plan.id);}

const COLLAGE=['El Gallo','La Dama','El Catrín','La Sirena','La Luna','El Corazón','El Valiente'];
export function cartasCollage(){
  const pick=COLLAGE.map(n=>TRADITIONAL.find(f=>f.nombre===n)).filter(Boolean);
  return (pick.length>=5?pick:TRADITIONAL.slice(0,7)).filter(f=>f.imagen);
}

function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}

/** Collage de cartas tradicionales del banner. */
export function renderCollage(container){
  container.replaceChildren(...cartasCollage().map(f=>{const img=el('img');img.src=f.imagen;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.remove(),{once:true});return img;}));
}

/** Tarjetas del modal de planes. abrir(url) abre la compra. */
export function renderPlanes(grid,abrir){
  grid.replaceChildren(...PLANES.map(p=>{
    const card=el('article','plan-card'+(p.etiqueta?' is-featured':''));
    if(p.etiqueta)card.append(el('span','plan-badge',p.etiqueta));
    const img=el('img');img.src=p.imagen;img.alt='Plan '+p.nombre;img.loading='lazy';
    const head=el('div','plan-head');head.append(el('h3',null,'Plan '+p.nombre));
    const price=el('p','plan-price');price.append(el('strong',null,'$'+p.precio),el('span',null,' MXN al mes'));head.append(price);
    head.append(el('p','plan-trial',PRUEBA_DIAS+' días gratis · Cancela cuando quieras'));
    const list=el('ul','plan-features');p.incluye.forEach(t=>list.append(el('li',null,t)));
    (p.proximamente||[]).forEach(t=>{const li=el('li','is-soon',t);li.append(el('em',null,' Próximamente'));list.append(li);});
    const cta=el('button','plan-checkout','Empezar mis '+PRUEBA_DIAS+' días gratis');cta.type='button';cta.dataset.plan=p.nombre;
    cta.onclick=()=>abrir(urlCompra(p),p);
    card.append(img,head,list,cta);return card;
  }));
}
