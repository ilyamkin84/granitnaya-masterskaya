import {DEFAULT_PLOT, getPlotLayout} from './constructor/plot-layout.js?v=4';

document.documentElement.classList.remove('no-script');

const menu = document.getElementById('compact-menu');
const menuToggle = document.getElementById('menu-toggle');
function setMenu(open) {
  menu.hidden = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
}
menuToggle.addEventListener('click', () => setMenu(menu.hidden));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('click', e => {
  if (!menu.hidden && !e.target.closest('.mast')) setMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !menu.hidden) {setMenu(false); menuToggle.focus();}
});
matchMedia('(min-width:801px)').addEventListener('change', e => {if(e.matches)setMenu(false);});

const cards = Array.from(document.querySelectorAll('[data-project]'));
const ids = new Set(cards.map(card => card.dataset.project));
const storageKey = 'granite-workshop-saved-projects-v1';
function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    return new Set(Array.isArray(stored) ? stored.filter(id => ids.has(id)) : []);
  } catch { return new Set(); }
}
const stateMessage=document.getElementById('save-status');
let saved=readSaved();
function refreshCatalogue() {
  const selectedOnly = location.hash === '#saved';
  document.getElementById('catalog-title').textContent = selectedOnly ? 'Избранные проекты' : 'Каталог памятников';
  document.getElementById('catalog-total').hidden = selectedOnly;
  document.getElementById('back-catalog').hidden = !selectedOnly;
  document.getElementById('empty-saved').hidden = !selectedOnly || saved.size > 0;
  const count = document.getElementById('saved-count');
  count.textContent = String(saved.size);count.hidden = saved.size===0;
  document.querySelector('.saved-link').setAttribute('aria-label','Избранное, проектов: '+saved.size);
  for (const card of cards) {
    const active=saved.has(card.dataset.project);
    card.hidden = selectedOnly && !active;
    const toggle=card.querySelector('.save-project');
    toggle.setAttribute('aria-pressed',String(active));
    const title = card.querySelector('h3').textContent;
    const action = active ? 'Убрать из избранного' : 'Добавить в избранное';
    toggle.setAttribute('aria-label',action+' — '+title);
    toggle.title = action;
  }
}
for (const card of cards) {
  card.querySelector('.save-project').addEventListener('click', () => {
    const id=card.dataset.project, removing=saved.has(id);
    if(removing)saved.delete(id);else saved.add(id);
    let persisted=true;
    try {localStorage.setItem(storageKey,JSON.stringify([...saved]));} catch {persisted=false;}
    refreshCatalogue();
    stateMessage.textContent = card.querySelector('h3').textContent + (removing ? ' убран из избранного.' : ' добавлен в избранное.')
      + (persisted?'':' Подборка доступна до закрытия страницы.');
    if(card.hidden) {
      const focus=cards.find(c=>!c.hidden)?.querySelector('.save-project') || document.getElementById('back-catalog');
      focus.focus({preventScroll:true});
    }
  });
}
refreshCatalogue();
window.addEventListener('hashchange',refreshCatalogue);
window.addEventListener('pageshow',()=>{saved=readSaved();refreshCatalogue();});
window.addEventListener('storage',e=>{if(e.key===storageKey||e.key===null){saved=readSaved();refreshCatalogue();}});

function updateLink(link,key,value) {
  const url=new URL(link.href);
  url.searchParams.set(key,value);
  link.href=url.href;
}
const stoneLink=document.getElementById('stone-link');
function syncStone() {
  const selected=document.querySelector('input[name="stone"]:checked');
  updateLink(stoneLink,'stone',selected.value);
  stoneLink.setAttribute('aria-label','Примерить в 3D: '+selected.parentElement.textContent.trim());
}
document.querySelector('.samples').addEventListener('change',syncStone);
syncStone();

const planCanvas = document.getElementById('plot-sketch');
const planLink=document.getElementById('plan-link');
const decimal=value=>value.toLocaleString('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1});

function drawPlan() {
  const size=document.querySelector('input[name="plot-size"]:checked').value;
  const layout=getPlotLayout({...DEFAULT_PLOT,size});
  const [width,depth]=layout.size;
  updateLink(planLink,'size',size);
  planCanvas.setAttribute('aria-label','План участка '+decimal(width)+' на '+decimal(depth)+' метра. Слева цветник, справа плита, калитка спереди.');
  const box=planCanvas.getBoundingClientRect();
  if(!box.width||!box.height)return;
  const ratio=Math.min(2,window.devicePixelRatio||1), w=box.width,h=box.height;
  planCanvas.width=Math.round(w*ratio);planCanvas.height=Math.round(h*ratio);
  const c=planCanvas.getContext('2d');
  c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);
  const scale=Math.min((w-87)/3.2,(h-53)/3.6);
  if(scale<10)return;
  const front=layout.groundCenterZ+depth/2,back=front-depth;
  const centerX=w*.5+3, top=(h-depth*scale)/2+6;
  const X=x=>centerX+x*scale,Y=z=>top+(z-back)*scale;
  function line(x1,y1,x2,y2,color='#546859',weight=1) {
    c.strokeStyle=color;c.lineWidth=weight;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  }
  function metric(x,z,wm,dm,color,stroke='#5f6f61') {
    c.fillStyle=color;c.fillRect(X(x-wm/2),Y(z-dm/2),wm*scale,dm*scale);
    c.strokeStyle=stroke;c.lineWidth=1;c.strokeRect(X(x-wm/2),Y(z-dm/2),wm*scale,dm*scale);
  }
  c.fillStyle='#e1e3d7';c.fillRect(X(-width/2),Y(back),width*scale,depth*scale);
  c.strokeStyle='#93a28f';c.strokeRect(X(-width/2),Y(back),width*scale,depth*scale);
  for (const item of layout.instances) {
    if(item.asset.startsWith('flower-')||item.asset.startsWith('slab-')) {
      const isFlower=item.asset.startsWith('flower-'), length=(item.asset==='slab-half'?.57:1.14)*item.sz;
      metric(item.x,item.z,.66*item.sx,length,isFlower?'#b9c5ad':'#a0ad9e');
      if(isFlower) {
        const sx=X(item.x-.27*item.sx),sy=Y(item.z-length/2+.06),sw=.54*item.sx*scale,sh=(length-.12)*scale;
        c.strokeStyle='#849780';c.strokeRect(sx,sy,sw,sh);
        for(let row=0;row<5;row++)for(let col=0;col<3;col++){
          const px=sx+sw*(col+.47)/3,py=sy+sh*(row+.45+(col%2)*.2)/5;
          c.beginPath();c.ellipse(px,py,2.5,1.5,(col-row)*.64,0,2*Math.PI);c.fillStyle='#7b927a';c.fill();
        }
      } else line(X(item.x-.265),Y(item.z-length/2+.06),X(item.x+.265),Y(item.z-length/2+.06),'#6b7e70');
    }
    if(item.asset.startsWith('fence-')||item.asset.startsWith('gate-')) {
      const x2=item.x+item.sx*Math.cos(item.angle),z2=item.z-item.sx*Math.sin(item.angle);
      line(X(item.x),Y(item.z),X(x2),Y(z2),'#506355',1.45);
    }else if(item.asset.startsWith('post-')){
      c.fillStyle='#46594c';c.fillRect(X(item.x)-1.9,Y(item.z)-1.9,3.8,3.8);
    }
  }
  const headX=layout.memorialX;
  metric(headX,.04,1.65,.45,'#9ba99c','#4b5c50');metric(headX-.34,-.026,.60,.125,'#516355');metric(headX+.34,-.026,.60,.125,'#516355');
  const gate=layout.instances.find(o=>o.asset.startsWith('gate-'));
  c.setLineDash([3,3]);c.lineWidth=.7;c.strokeStyle='#8b9c86';
  c.beginPath();c.moveTo(X(gate.x),Y(gate.z));c.lineTo(X(gate.x),Y(gate.z-gate.sx));c.stroke();
  c.beginPath();c.arc(X(gate.x),Y(gate.z),gate.sx*scale,Math.PI,Math.PI*1.5);c.stroke();c.setLineDash([]);
  const l=X(-width/2),r=X(width/2),b=Y(front),t=Y(back),gap=12;
  function measure(length,horizontal) {
    c.save();if(horizontal)c.translate((l+r)/2,t-gap);else{c.translate(r+gap,(b+t)/2);c.rotate(Math.PI/2);}
    const span=(horizontal?width:depth)*scale/2;
    line(-span,0,span,0,'#7d8f7d',.75);
    line(-span,-3,-span,3,'#7d8f7d');line(span,-3,span,3,'#7d8f7d');
    const label=decimal(length)+' м';c.font='500 11px Inter, Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
    const tw=c.measureText(label).width;c.fillStyle='#e8ece3';c.fillRect(-tw/2-4,-7,tw+8,14);c.fillStyle='#455448';c.fillText(label,0,0);c.restore();
  }
  measure(width,true);measure(depth,false);
}
document.querySelector('.sizes').addEventListener('change',drawPlan);
new ResizeObserver(drawPlan).observe(planCanvas);
document.fonts.ready.then(drawPlan);
window.addEventListener('pageshow',()=>{syncStone();drawPlan();});

/* The complete catalogue remains available as ordinary links without JavaScript. */
(() => {
  const root = document.getElementById('components');
  if (!root) return;
  const filters = root.querySelector('.piece-filters');
  const links = [...filters.querySelectorAll('[data-piece-filter]')];
  const items = [...root.querySelectorAll('[data-piece-category]')];
  const bottom = root.querySelector('.piece-bottom');
  const more = bottom.querySelector('button');
  const groups = new Set(links.map(link => link.dataset.pieceFilter));
  const countLabel = new Intl.PluralRules('ru');

  function showPieces() {
    const anchor = location.hash.slice(1);
    const full = anchor === 'components-all';
    const group = groups.has(anchor) ? anchor : 'all';
    let visible = 0;
    for (const item of items) {
      const show = group === 'all' ? full || item.hasAttribute('data-piece-featured') : item.dataset.pieceCategory === group;
      item.hidden = !show;
      if (show) visible++;
    }
    for (const link of links) {
      if (link.dataset.pieceFilter === group) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    filters.hidden = false;
    bottom.hidden = group !== 'all';
    more.setAttribute('aria-expanded', String(full));
    more.querySelector('span').textContent = full ? 'Свернуть каталог' : `Все ${items.length} изделий`;
    const forms = {one:'изделие',few:'изделия',many:'изделий',other:'изделия'};
    root.querySelector('#piece-result').textContent = visible + ' ' + forms[countLabel.select(visible)];
  }

  more.addEventListener('click', () => {
    const expand = more.getAttribute('aria-expanded') !== 'true';
    history.pushState(null, '', expand ? '#components-all' : '#components');
    showPieces();
    if (expand) {
      const next = items.find(item => !item.hasAttribute('data-piece-featured'));
      next?.querySelector('a')?.focus({preventScroll:true});
    }
    if (!expand && root.getBoundingClientRect().bottom < 90) root.scrollIntoView({block:'start'});
  });
  window.addEventListener('hashchange', showPieces);
  window.addEventListener('popstate', showPieces);
  showPieces();
})();

const compositions = {
  family: {
    title:'Семейный участок', size:'2,8 × 3,2 м', surface:'Чёрный гранит', entry:'Справа, с калиткой',
    text:'Цветник и гранитная плита у общего памятника. Кованая ограда очерчивает границы участка.',
    alt:'Парный памятник, один цветник и плита внутри кованой ограды.'
  },
  garden: {
    title:'Два цветника', size:'2,4 × 3,0 м', surface:'Щебень', entry:'Свободный',
    text:'В прямом цветнике слева — светлая мраморная крошка, в скруглённом справа — живая трава. У левой стелы стоит ваза.',
    alt:'Компактный открытый участок с парой цветников и вазой у памятника.'
  },
  paving: {
    title:'Участок с мощением', size:'3,2 × 3,6 м', surface:'Зелёная мозаика', entry:'Слева, с калиткой',
    text:'Полуплита с цветником слева, скруглённый цветник справа. В переднем углу помещается скамейка.',
    alt:'Мощёный участок с простой оградой, двумя цветниками и скамьёй.'
  }
};
const ideaOpen=document.getElementById('idea-open');
const ideaButtons=Array.from(document.querySelectorAll('[data-idea]'));
function selectIdea(key) {
  const item=compositions[key];
  if (!item) return;
  ideaButtons.forEach(button=>button.setAttribute('aria-pressed', String(button.dataset.idea===key)));
  const photo=document.getElementById('idea-photo');
  photo.src='./home-assets/preset-'+key+'.webp';
  photo.alt=item.alt;
  document.getElementById('idea-name').textContent=item.title;
  document.getElementById('idea-intro').textContent=item.text;
  document.getElementById('idea-size').textContent=item.size;
  document.getElementById('idea-surface').textContent=item.surface;
  document.getElementById('idea-entry').textContent=item.entry;
  updateLink(ideaOpen,'preset',key);
}
ideaButtons.forEach(button=>button.addEventListener('click',()=>selectIdea(button.dataset.idea)));

const dialog=document.getElementById('catalog-search');
const query=document.getElementById('catalog-query');
const searchResults=document.getElementById('search-results');
const searchMessage=document.getElementById('search-message');
const searchEntries=[];
function normalized(value) {
  return String(value).toLocaleLowerCase('ru-RU').replaceAll('ё','е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function addEntry(title,group,link,words='') {
  searchEntries.push({title,group,link,
    tokens:normalized(title+' '+group+' '+words).split(' '), label:normalized(title)});
}
for(const card of cards) {
  addEntry(card.querySelector('h3').textContent,'Памятники',card.querySelector('.project-link').href,
    card.querySelector('p').textContent+' '+({single:'одинарный один крест',pair:'двойной семейный для двоих',plot:'участок семейный'}[card.dataset.project]||''));
}
for(const link of document.querySelectorAll('a[data-search-title]')) {
  addEntry(link.dataset.searchTitle,link.dataset.searchGroup,link.href,link.dataset.searchWords);
}
for(const button of ideaButtons) {
  const item=compositions[button.dataset.idea],url=new URL(ideaOpen.href);
  url.searchParams.set('preset',button.dataset.idea);
  addEntry(item.title,'Готовая компоновка',url.href,item.text+' '+item.size+' '+item.surface);
}
for(const input of document.querySelectorAll('input[name=stone]')) {
  const url=new URL(stoneLink.href);url.searchParams.set('stone',input.value);
  addEntry(input.parentElement.textContent.trim(),'Камень',url.href,'материал гранит порода цвет фактура оттенок');
}
let lastSearchButton=null;
const plural=new Intl.PluralRules('ru');
function renderResults(){
  const terms=normalized(query.value).split(' ').filter(Boolean);
  let results=searchEntries.slice(0,5);
  if(terms.length){
    const ranked=searchEntries.map(entry=>{
      let score=0;
      for(const term of terms){
        // The common stem also matches forms such as «ваза» / «вазы».
        const stem=term.length>3?term.replace(/(ая|ой|ую|ые|ый|ие|ых|ия|ов|ами|а|ы|у|и|е)$/u,''):term;
        const part=stem.length>2?stem:term;
        if(!entry.tokens.some(token=>token.startsWith(part)))return {entry,score:0};
        score+=entry.label.includes(part)?3:1;
      }
      return {entry,score};
    });
    results=ranked.filter(r=>r.score>0).sort((a,b)=>b.score-a.score).map(r=>r.entry);
  }
  searchResults.replaceChildren();
  for(const result of results){
    const li=document.createElement('li'),link=document.createElement('a'),label=document.createElement('span'),group=document.createElement('small');
    link.href=result.link;label.textContent=result.title;group.textContent=result.group;
    if(new URL(link.href).pathname.endsWith('.pdf'))link.download='Лист замера участка.pdf';
    link.append(label,group);li.append(link);searchResults.append(li);
  }
  const forms={one:'результат',few:'результата',many:'результатов',other:'результата'};
  searchMessage.textContent=terms.length?(results.length?results.length+' '+forms[plural.select(results.length)]:'Совпадений нет. Попробуйте название изделия или камня.'):'Быстрые переходы';
}
for(const trigger of document.querySelectorAll('[aria-controls="catalog-search"]')) {
  trigger.addEventListener('click',()=>{
    setMenu(false);
    lastSearchButton=trigger;query.value='';renderResults();dialog.showModal();query.focus();
  });
}
query.addEventListener('input',renderResults);
dialog.querySelector('.close-search').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>lastSearchButton?.focus({preventScroll:true}));
dialog.addEventListener('click',event=>{
  if(event.target.closest('#search-results a')){dialog.close();return;}
  if(event.target!==dialog)return;
  const r=dialog.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
});
dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();return;}
  const links=Array.from(searchResults.querySelectorAll('a'));
  if(!links.length)return;
  if(event.key==='Enter'&&event.target===query){event.preventDefault();links[0].click();return;}
  if(!['ArrowDown','ArrowUp'].includes(event.key))return;
  event.preventDefault();
  const index=links.indexOf(document.activeElement);
  if(event.key==='ArrowUp'&&index<=0){query.focus();return;}
  links[Math.min(links.length-1,event.key==='ArrowDown'?index+1:index-1)].focus();
});
