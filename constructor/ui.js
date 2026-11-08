import {BED_FILLS, DEFAULT_PLOT, PAVING_FINISHES, FENCE_OPTIONS, STONE_FENCES, hasBed, normalizePlot, getPlotLayout} from './plot-layout.js';

const $ = id => document.getElementById(id);
const fields = ['surname', 'given', 'patronymic', 'birth', 'death'];
const sides = ['left', 'right'];
const storageKey = 'pair-memorial-config-v1';
const initialPeople = {
  left: { surname: 'Васильев', given: 'Михаил', patronymic: 'Сергеевич', birth: '08.05.1970', death: '11.04.2022' },
  right: { surname: 'Васильева', given: 'Марина', patronymic: 'Сергеевна', birth: '27.09.1972', death: '21.12.2019' }
};
const stones = ['black', 'gray', 'red', 'green'];
const modelCodes = ['classic', 'b05', 'b20', 'b37'];
const defaults = () => ({ model:'classic', plot: normalizePlot(DEFAULT_PLOT), environment:'cemetery', stone: 'black', people: structuredClone(initialPeople), photos: {left: null, right: null} });
let draftFillMigrated = false;

function loadDraft() {
  const draft = defaults();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (!saved) return draft;
    draft.plot = normalizePlot(saved.plot);
    draftFillMigrated = sides.some(side => saved.plot?.[side+'Fill'] !== draft.plot[side+'Fill']);
    draft.environment=saved.environment==='studio'?'studio':'cemetery';
    if (modelCodes.includes(saved.model)) draft.model = saved.model;
    if (stones.includes(saved.stone)) draft.stone = saved.stone;
    for (const side of sides) {
      for (const field of fields) {
        const value = saved.people?.[side]?.[field];
        if (typeof value === 'string') {
          draft.people[side][field] = value.slice(0, field === 'birth' || field === 'death' ? 10 : 54);
        }
      }
      const photo = saved.photos?.[side];
      if (typeof photo === 'string' && /^data:image\/jpeg;base64,/.test(photo)) draft.photos[side] = photo;
    }
  } catch { /* Storage can be disabled in embedded and private browsing. */ }
  return draft;
}

const pieceFields = new Map([
  ['flower-rect', 'grave'], ['flower-round', 'grave'], ['slab-solid', 'grave'], ['slab-half', 'grave'], ['mixed', 'grave'],
  ...FENCE_OPTIONS.filter(fence => fence !== 'none').map(fence => [fence, 'fence']), ['vase', 'vase'], ['bench', 'bench']
]);
const plotPresets = new Map([
  ['garden', {...DEFAULT_PLOT, size:'standard', right:'flower-round', rightFill:'grass', surface:'gravel', fence:'none', vase:true}],
  ['family', DEFAULT_PLOT],
  ['paving', {...DEFAULT_PLOT, size:'large', left:'mixed', right:'flower-round', rightFill:'grass', surface:'paving', paving:'green',
    fence:'fence-simple', bench:true, vase:true, vaseSide:'right', entrance:'left', gateOpen:true}]
]);

const entry = new URLSearchParams(location.search);
const requestedSection = entry.get('section');
let holdWalkLink=entry.get('view')==='walk';
const requestedSize = ['standard', 'wide', 'large'].includes(entry.get('size')) ? entry.get('size') : null;
const requestedSurface = ['paving', 'grass', 'gravel'].includes(entry.get('surface')) ? entry.get('surface') : null;
const requestedFence = FENCE_OPTIONS.includes(entry.get('fence')) ? entry.get('fence') : null;
const requestedPaving = PAVING_FINISHES.includes(entry.get('paving')) ? entry.get('paving') : null;
const linkedFill = entry.get('bedFill');
const migratedFillLink = linkedFill === 'flowers' || linkedFill === 'mixed';
const requestedFill = migratedFillLink ? 'marble' : BED_FILLS.includes(linkedFill) ? linkedFill : null;
if (migratedFillLink) syncEntryOption('bedFill', requestedFill);
let graveSide = entry.get('side') === 'right' ? 'right' : 'left';
const requestedModel = modelCodes.includes(entry.get('model')) ? entry.get('model') : null;
const requestedStone = stones.includes(entry.get('stone')) ? entry.get('stone') : null;
const requestedView = [...$('camera-select').options].find(option => option.value === entry.get('view'))?.value;
const requestedPreset = plotPresets.get(entry.get('preset'));
const requestedPiece = pieceFields.has(entry.get('piece')) ? entry.get('piece') : null;
const pieceField = pieceFields.get(requestedPiece) === 'grave' ? graveSide : pieceFields.get(requestedPiece);
const requestedEdit = ['photo', 'inscription'].includes(entry.get('edit')) ? entry.get('edit') : null;

let startSection = 'plot';
if (requestedEdit) startSection = 'monument';
else if (requestedPreset || requestedPiece || requestedFill || (requestedFence && !requestedSection)) startSection = 'plot';
else if (['plot', 'monument'].includes(requestedSection)) startSection = requestedSection;
else if (requestedView) startSection = ['plot','top','visit','planting'].includes(requestedView) ? 'plot' : 'monument';
else if (requestedPaving || requestedSurface) startSection = 'plot';
else if ((requestedStone || requestedModel) && !requestedSize) startSection = 'monument';

let state = loadDraft();
if(['studio','cemetery'].includes(entry.get('environment'))) state.environment=entry.get('environment');
const oldStone = state.stone;
const oldModel = state.model;
if (requestedModel) state.model = requestedModel;
const oldPlot = JSON.stringify(state.plot);
if (requestedPreset) {
  state.plot = {...requestedPreset};
  state.stone = 'black';
} else {
  if (requestedStone) state.stone = requestedStone;
  if (requestedSize) state.plot.size = requestedSize;
  if (requestedPiece) state.plot[pieceField] = ['bench','vase'].includes(pieceField) ? true : requestedPiece;
}
if (requestedFill) {
  if (!hasBed(state.plot[graveSide])) state.plot[graveSide] = 'flower-rect';
  state.plot[graveSide+'Fill'] = requestedFill;
}
if (requestedFence) state.plot.fence = requestedFence;
if (requestedPaving) state.plot.paving = requestedPaving;
if (requestedSurface || requestedPaving) state.plot.surface = requestedSurface || 'paving';
const entryChanged = oldModel !== state.model || oldStone !== state.stone || oldPlot !== JSON.stringify(state.plot);
let side = 'left';
let view = requestedView || (holdWalkLink ? 'visit' : null) || (requestedFill ? 'planting' : startSection === 'monument' ? 'angle' : 'plot');
let scene;
let unrealAvailable = false;
let rendering = false;
let renderUrl;
let saveTimer;
let dirty = false;
let resetVersion = 0;
const photoVersion = {left: 0, right: 0};
const photoJobs = {};
const operations = new Map();

// An explicit incoming choice remains shareable after the visitor edits it.
function syncEntryOption(key, value, includeNew=false) {
  const url = new URL(location.href);
  if ((!includeNew && !url.searchParams.has(key)) || url.searchParams.get(key) === value) return;
  if (value === null) url.searchParams.delete(key);
  else url.searchParams.set(key, value);
  history.replaceState(history.state, '', url);
}

function persistDraft() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    $('save-state').textContent = 'Сохранено в браузере';
  } catch {
    $('save-state').textContent = 'Изменения сохранены до закрытия страницы';
  }
}
function changed() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistDraft, 450);
}
window.addEventListener('pagehide', persistDraft);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistDraft();
});

function showSceneError() {
  $('scene-state').hidden = false;
  $('scene-state').querySelector('.spinner').hidden = true;
  $('scene-message').textContent = 'Не удалось открыть 3D-сцену.';
  $('scene-retry').hidden = false;
}
$('scene-retry').addEventListener('click', () => location.reload());

// Edits to one material or image are applied in order even when texture loading
// is asynchronous. A newer edit can replace a queued edit before it starts.
function apply(key, callback) {
  if (!scene) return Promise.resolve();
  const last = operations.get(key);
  const job = {};
  job.promise = Promise.resolve(last?.promise).catch(() => {}).then(async () => {
    if (operations.get(key) === job) await callback();
  });
  operations.set(key, job);
  job.promise.catch(showSceneError);
  return job.promise;
}
function applyPerson(which) {
  const data = {...state.people[which]};
  return apply('text-' + which, () => scene.setInscription(which, data));
}
function applyPhoto(which) {
  const source = state.photos[which];
  return apply('photo-' + which, () => scene.setPhoto(which, source));
}

function updatePortrait() {
  $('photo-preview').src = state.photos[side] || './assets/portrait-' + side + '.jpg';
  $('photo-preview').alt = side === 'left' ? 'Левый портрет' : 'Правый портрет';
  $('restore-photo').hidden = !state.photos[side];
}
function selectSide(which) {
  side = which;
  document.querySelectorAll('[data-side]').forEach(tab => {
    const selected = tab.dataset.side === side;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
  });
  $('person').setAttribute('aria-labelledby', 'tab-' + side);
  for (const field of fields) $(field).value = state.people[side][field];
  $('photo-message').hidden = true;
  updatePortrait();
}
document.querySelectorAll('[data-side]').forEach(tab => {
  tab.addEventListener('click', () => selectSide(tab.dataset.side));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = side === 'left' ? 'right' : 'left';
    else if (event.key === 'Home') next = 'left';
    else if (event.key === 'End') next = 'right';
    else return;
    event.preventDefault();
    selectSide(next);
    $('tab-' + next).focus();
  });
});
for (const field of fields) {
  $(field).addEventListener('input', event => {
    state.people[side][field] = event.target.value;
    applyPerson(side);
    changed();
  });
}

function showModel() {
  for (const button of document.querySelectorAll('[data-model]')) {
    button.setAttribute('aria-pressed', button.dataset.model === state.model);
  }
  const reference = $('model-reference');
  reference.hidden = state.model === 'classic';
  if (!reference.hidden) reference.href = 'https://www.green-stone.by/horizontal-monuments/b-' + state.model.slice(1);
  else reference.removeAttribute('href');
  const classic = state.model === 'classic';
  $('walk-headstone').setAttribute('d', classic ? 'M-.79 -.11H.79V.23H-.79Z' : 'M-.5 -.04H.5V.04H.405V.125H-.405V.04H-.5Z');
  $('tab-left').textContent = classic ? 'Левая стела' : 'Левая сторона';
  $('tab-right').textContent = classic ? 'Правая стела' : 'Правая сторона';
}
for (const button of document.querySelectorAll('[data-model]')) {
  button.addEventListener('click', () => {
    const code = button.dataset.model;
    if (state.model === code) return;
    state.model = code;
    syncEntryOption('model', code, true);
    showModel();
    apply('model', () => scene.setModel(code));
    changed();
  });
}

function showStone() {
  document.querySelectorAll('[data-stone]').forEach(button =>
    button.setAttribute('aria-pressed', button.dataset.stone === state.stone));
}
document.querySelectorAll('[data-stone]').forEach(button => {
  button.addEventListener('click', () => {
    state.stone = button.dataset.stone;
    const id = state.stone;
    syncEntryOption('preset', null);
    syncEntryOption('stone', id);
    showStone();
    apply('stone', () => scene.setStone(id));
    changed();
  });
});

function setSection(name, focusView = true) {
  const panelNames = ['monument', 'plot'];
  for (const item of panelNames) {
    const selected = item === name;
    const tab = $('section-' + item);
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
    $(item + '-panel').hidden = !selected;
  }
  document.querySelector('.settings').scrollTop = 0;
  if (focusView) {
    if (name === 'plot') syncEntryOption('edit', null);
    else {
      syncEntryOption('piece', null);
      syncEntryOption('preset', null);
      syncEntryOption('bedFill', null);
      syncEntryOption('side', null);
    }
    syncEntryOption('section', name);
    setView(name === 'plot' ? 'plot' : 'angle');
  }
}
document.querySelectorAll('[data-section]').forEach(tab => {
  tab.addEventListener('click', () => setSection(tab.dataset.section));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') next = tab.dataset.section === 'plot' ? 'monument' : 'plot';
    else if (event.key === 'Home') next = 'monument';
    else if (event.key === 'End') next = 'plot';
    else return;
    event.preventDefault();
    setSection(next);
    $('section-' + next).focus();
  });
});

const graveButtons = [...document.querySelectorAll('[data-grave]')];
const graveNames = new Map(graveButtons.map(button => [button.dataset.grave, button.textContent.trim()]));
const bedFills = {
  grass: {name:'Газон', photo:'https://www.blumen-floristeria.at/leistungen/grabgestaltung-und-pflege/fertigrasen'},
  marble: {name:'Мраморная крошка', photo:'https://pohoronim.com/foto/'}
};
for (const fill of BED_FILLS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.bedFill = fill;
  const swatch = document.createElement('span');
  swatch.className = 'fill-image';
  const image = document.createElement('img');
  image.src = './assets/plot/bed-fill-'+fill+'.webp';
  image.alt = '';
  image.width = 150;
  image.height = 48;
  swatch.append(image);
  const label = document.createElement('span');
  label.className = 'fill-name';
  label.textContent = bedFills[fill].name;
  button.append(swatch, label);
  $('bed-fill-options').append(button);
}
const pavingSamples = {
  black: ['Чёрный гранит', 'Полировка'],
  bordo: ['Бордовый кант', 'Полировка'],
  graphite: ['Графит', 'Матовый сатин'],
  green: ['Зелёная мозаика', 'Мягкая полировка'],
  marble: ['Белый мрамор', 'Шелковистый блеск'],
  amber: ['Золотистый слэб', 'Полировка'],
  paving: ['Серая брусчатка', 'Шероховатая поверхность']
};
for (const finish of PAVING_FINISHES) {
  const [name, polish] = pavingSamples[finish];
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.plotKey = 'paving';
  button.dataset.value = finish;
  button.setAttribute('aria-label', name + ', ' + polish.toLowerCase());
  const sample = document.createElement('img');
  sample.src = './assets/plot/swatch-' + finish + '.webp';
  sample.alt = '';
  sample.width = 256;
  sample.height = 128;
  const label = document.createElement('span');
  label.textContent = name;
  button.append(sample, label);
  $('paving-options').append(button);
}
const areaFormat = new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2});
function hasFlowerbed(plot){return hasBed(plot.left)||hasBed(plot.right);}
function showPlot() {
  const plot = state.plot;
  $('paving-setting').hidden = plot.surface !== 'paving';
  $('paving-finish').textContent = pavingSamples[plot.paving][1];
  const fill = plot[graveSide+'Fill'];
  $('bed-fill-setting').hidden = !hasBed(plot[graveSide]);
  for (const control of document.querySelectorAll('[data-bed-fill]')) {
    control.setAttribute('aria-pressed', control.dataset.bedFill === fill);
  }
  const reference = $('bed-fill-reference');
  reference.hidden = false;
  reference.href = bedFills[fill].photo;
  reference.setAttribute('aria-label', 'Посмотреть фото примера «'+bedFills[fill].name+'» в новой вкладке');
  const flowers=hasFlowerbed(plot);
  for(const control of document.querySelectorAll('[data-view="planting"], #camera-select option[value="planting"]')){
    control.disabled=!flowers;
    control.title=flowers?'Посмотреть наполнение цветника крупным планом':'Сначала добавьте цветник на участок';
  }
  if(!flowers&&view==='planting')setView('plot');
  const {size, gateWidth} = getPlotLayout(plot);
  $('plot-area').textContent = areaFormat.format(size[0] * size[1]) + ' м²';
  for (const button of document.querySelectorAll('[data-plot-key]')) {
    button.setAttribute('aria-pressed', plot[button.dataset.plotKey] === button.dataset.value);
  }
  for (const input of document.querySelectorAll('[data-plot-check]')) {
    input.checked = plot[input.dataset.plotCheck];
  }
  for (const which of sides) $('grave-summary-' + which).textContent = graveNames.get(plot[which]);
  for (const button of document.querySelectorAll('[data-grave-side]')) {
    button.setAttribute('aria-pressed', button.dataset.graveSide === graveSide);
  }
  $('grave-options').setAttribute('aria-label', graveSide === 'left' ? 'Оформление левой могилы' : 'Оформление правой могилы');
  for (const button of graveButtons) button.setAttribute('aria-pressed', button.dataset.grave === plot[graveSide]);
  const stoneFence = STONE_FENCES.includes(plot.fence);
  $('gate-setting').hidden = plot.fence === 'none';
  $('gate-open').closest('label').hidden = stoneFence;
  const source = $('stone-fence-source');
  const selectedFence = document.querySelector('[data-plot-key="fence"][aria-pressed="true"]');
  source.hidden = !stoneFence;
  if (stoneFence) {
    source.href = selectedFence.dataset.source;
    source.textContent = 'Образец ' + selectedFence.dataset.fenceReference + ' ↗';
  }
  $('entrance-setting').hidden = plot.fence === 'none';
  $('vase-setting').hidden = !plot.vase;
  $('bench-position').hidden = !plot.bench;
  $('bench-position').textContent = plot.entrance === 'left'
    ? 'Скамейка в переднем правом углу.'
    : 'Скамейка в переднем левом углу.';
  $('gate-size').textContent = 'Проём ' + Math.round(gateWidth * 100) + ' см';
}
function applyPlot() {
  const plot = {...state.plot};
  return apply('plot', () => scene.setPlot(plot));
}
// Keep the shape and filling together in a link to one grave. A closed slab
// has no fill link, even though its saved planting choice is kept for later.
function syncBedEntry(explicitFill=false) {
  const params = new URLSearchParams(location.search);
  const linkFill = explicitFill || params.has('bedFill');
  const linkCover = linkFill || pieceFields.get(params.get('piece')) === 'grave';
  if (linkCover) {
    const cover = state.plot[graveSide];
    syncEntryOption('piece', cover === 'none' ? null : cover, true);
    syncEntryOption('bedFill', linkFill && hasBed(cover) ? state.plot[graveSide+'Fill'] : null, true);
  }
  syncEntryOption('side', graveSide, true);
}
function changePlot(key, value) {
  state.plot = normalizePlot({...state.plot, [key]:value});
  syncEntryOption('preset', null);
  if (key === graveSide || key === graveSide+'Fill') syncBedEntry(key === graveSide+'Fill');
  else if (key === pieceFields.get(new URLSearchParams(location.search).get('piece'))) syncEntryOption('piece', null);
  if (key === 'fence') syncEntryOption('fence', state.plot.fence, true);
  if (key === 'size') syncEntryOption('size', state.plot.size);
  if (key === 'surface' || key === 'paving') {
    syncEntryOption('surface', state.plot.surface, true);
    syncEntryOption('paving', state.plot.surface === 'paving' ? state.plot.paving : null, true);
  }
  showPlot();
  applyPlot();
  changed();
}
for (const button of document.querySelectorAll('[data-plot-key]')) {
  button.addEventListener('click', () => changePlot(button.dataset.plotKey, button.dataset.value));
}
for (const input of document.querySelectorAll('[data-plot-check]')) {
  input.addEventListener('change', () => changePlot(input.dataset.plotCheck, input.checked));
}
for (const button of document.querySelectorAll('[data-grave-side]')) {
  button.addEventListener('click', () => {
    graveSide = button.dataset.graveSide;
    syncBedEntry();
    showPlot();
    if(view==='planting'&&scene)scene.setView(view,graveSide);
  });
}
for (const button of graveButtons) {
  button.addEventListener('click', () => changePlot(graveSide, button.dataset.grave));
}

$('bed-fill-options').addEventListener('click', event => {
  const button = event.target.closest('[data-bed-fill]');
  if (button) changePlot(graveSide+'Fill', button.dataset.bedFill);
});

const walkStart=$('walk-start'),walkHud=$('walk-hud'),walkGate=$('walk-gate');
let enteringWalk=false,walking=false,walkRestoreURL='',mapLayout=null,mapNeighbours=null,walkNoticeTimer;
const svgNS='http://www.w3.org/2000/svg';
function drawWalkMap(pose,info){
  if(info.neighbours!==mapNeighbours){
    mapNeighbours=info.neighbours;
    const rects=mapNeighbours.filter(p=>p.x>-14&&p.x<14&&p.z>-12&&p.z<13).map(p=>{
      const r=document.createElementNS(svgNS,'rect'),w=p.plotWidth||p.w,d=p.plotDepth||p.d;
      for(const [k,v] of Object.entries({x:-w/2,y:-d/2,width:w,height:d,rx:.08,transform:'translate('+p.x+' '+p.z+') rotate('+(-p.yaw*180/Math.PI)+')'}))r.setAttribute(k,v);
      return r;
    });
    $('walk-neighbours').replaceChildren(...rects);
  }
  if(mapLayout!==info.layout){
    mapLayout=info.layout;
    const [w,d]=mapLayout.size,rect=$('walk-plot-shape');
    Object.entries({x:-w/2,y:mapLayout.groundCenterZ-d/2,width:w,height:d}).forEach(([k,v])=>rect.setAttribute(k,v));
    $('walk-gate-mark').setAttribute('d',info.gate?'M'+(info.gate.x-.41)+' '+info.gate.z+'h.82':'');
  }
  $('walk-person').setAttribute('transform','translate('+pose.x.toFixed(3)+' '+pose.z.toFixed(3)+') rotate('+(-pose.yaw*180/Math.PI).toFixed(1)+')');
  const meters=Math.hypot(pose.x,pose.z).toFixed(1).replace('.',',')+' м';
  if($('walk-distance').textContent!==meters)$('walk-distance').textContent=meters;
  const near=info.gate&&!info.gate.fixed&&Math.hypot(pose.x-info.gate.x,pose.z-info.gate.z)<=1.8;
  if(walkGate.hidden===!!near)walkGate.hidden=!near;
  walkGate.disabled=info.pending;
  const label=info.open?'Закрыть калитку':'Открыть калитку';
  if(walkGate.textContent!==label)walkGate.textContent=label;
  const travel=info.gate?.fixed?'К входу':info.gate?'К калитке':'К участку';
  if($('walk-at-gate').textContent!==travel)$('walk-at-gate').textContent=travel;
}
function focusWalk(){document.querySelector('#scene canvas')?.focus({preventScroll:true});}
function walkNotice(message){
  clearTimeout(walkNoticeTimer);$('walk-notice').textContent=message;$('walk-notice').hidden=!message;
  if(message)walkNoticeTimer=setTimeout(()=>{$('walk-notice').hidden=true;},3100);
}
async function enterWalk(){
  if(!scene||walking||enteringWalk)return;
  enteringWalk=true;walkStart.disabled=true;
  walkStart.setAttribute('aria-busy','true');
  const prior=location.href,savedView=view;
  try {
    await Promise.all([...operations.values()].map(o=>o.promise));
    await scene.startWalk();
    const restored=new URL(prior);if(restored.searchParams.get('view')==='walk')restored.searchParams.set('view',savedView);
    walkRestoreURL=restored.href;
    const current=new URL(prior);current.searchParams.set('view','walk');history.replaceState(history.state,'',current);
    walking=true;document.body.classList.add('walking');walkHud.hidden=false;focusWalk();
  } catch(error){
    console.error('Walk:',error);scene.leaveWalk();showSceneError();
  } finally {
    enteringWalk=false;walkStart.disabled=false;walkStart.removeAttribute('aria-busy');
  }
}
function exitWalk(){
  if(!walking)return;
  walking=false;walkHud.hidden=true;document.body.classList.remove('walking');scene.leaveWalk();
  walkNotice('');holdWalkLink=false;
  if(walkRestoreURL)history.replaceState(history.state,'',walkRestoreURL);
  walkStart.focus({preventScroll:true});
}
function useWalkGate(){
  if(!walking||walkGate.hidden||walkGate.disabled)return;
  if(!scene.operateGate())walkNotice('Отойдите на шаг, чтобы створка могла открыться или закрыться.');
  else walkNotice('');
  focusWalk();
}
function jumpWalk(where){if(!walking)return;walkNotice('');scene.jumpWalk(where);focusWalk();}
walkStart.addEventListener('click',enterWalk);$('walk-exit').addEventListener('click',exitWalk);
walkGate.addEventListener('click',useWalkGate);
$('walk-return').addEventListener('click',()=>jumpWalk('alley'));
$('walk-at-gate').addEventListener('click',()=>jumpWalk('gate'));
$('walk-map-toggle').addEventListener('click',event=>{
  const wrap=$('walk-map-wrap');wrap.hidden=!wrap.hidden;
  event.currentTarget.setAttribute('aria-expanded',!wrap.hidden);
  event.currentTarget.setAttribute('aria-label',wrap.hidden?'Развернуть схему':'Свернуть схему');
  if(event.detail)focusWalk();
});
document.addEventListener('keydown',event=>{
  if(!walking||event.isComposing||event.altKey||event.metaKey||event.ctrlKey)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();exitWalk();}
  else if(event.code==='KeyE'&&!event.repeat){event.preventDefault();useWalkGate();}
});

const environmentTools=document.querySelector('.environment-tools');
function showEnvironment(){
  for(const button of environmentTools.querySelectorAll('[data-environment]'))button.setAttribute('aria-pressed',button.dataset.environment===state.environment);
}
environmentTools.addEventListener('click',event=>{
  const button=event.target.closest('[data-environment]');
  if(!button||state.environment===button.dataset.environment)return;
  state.environment=button.dataset.environment;showEnvironment();
  syncEntryOption('environment',state.environment);
  if(scene)apply('environment',()=>scene.setEnvironment(state.environment));
  changed();
});
function setView(next) {
  if(next==='planting'&&!hasFlowerbed(state.plot)) next='plot';
  environmentTools.hidden=next==='top';
  view = next;
  if(!holdWalkLink)syncEntryOption('view', view);
  $('camera-select').value = view;
  document.querySelectorAll('[data-view]').forEach(button =>
    button.setAttribute('aria-pressed', button.dataset.view === view));
  if (scene) scene.setView(view,graveSide);
}
document.querySelectorAll('[data-view]').forEach(button =>
  button.addEventListener('click', () => setView(button.dataset.view)));
$('camera-select').addEventListener('change', event => setView(event.target.value));
$('zoom-in').addEventListener('click', () => scene?.zoom(1.2));
$('zoom-out').addEventListener('click', () => scene?.zoom(1/1.2));

function expand(on) {
  document.body.classList.toggle('expanded', on);
  const button = $('expand');
  button.setAttribute('aria-pressed', on);
  button.title = on ? 'Вернуться к настройкам' : 'Развернуть просмотр';
  button.setAttribute('aria-label', button.title);
}
$('expand').addEventListener('click', () => expand(!document.body.classList.contains('expanded')));
document.addEventListener('keydown', event => {
  if (!walking && !event.defaultPrevented && event.key === 'Escape' && !document.querySelector('dialog[open]')) expand(false);
});

async function localPortrait(file) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, 1080 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f4f2eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', .88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
$('choose-photo').addEventListener('click', () => $('photo-file').click());
$('photo-file').addEventListener('change', event => {
  const which = side;
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';
  const version = ++photoVersion[which];
  $('photo-message').hidden = true;
  photoJobs[which] = localPortrait(file).then(async data => {
    if (version !== photoVersion[which]) return;
    state.photos[which] = data;
    if (side === which) updatePortrait();
    changed();
    await applyPhoto(which);
  }).catch(() => {
    if (side !== which || version !== photoVersion[which]) return;
    $('photo-message').textContent = 'Не удалось прочитать фото. Выберите изображение JPG, PNG или WebP.';
    $('photo-message').hidden = false;
  });
});
$('restore-photo').addEventListener('click', () => {
  photoVersion[side]++;
  state.photos[side] = null;
  applyPhoto(side);
  updatePortrait();
  $('photo-message').hidden = true;
  changed();
});

$('reset').addEventListener('click', () => $('reset-dialog').showModal());
$('keep').addEventListener('click', () => $('reset-dialog').close());
$('confirm-reset').addEventListener('click', () => {
  $('reset-dialog').close();
  resetVersion++;
  dirty = false;
  clearTimeout(saveTimer);
  state = defaults();
  syncEntryOption('environment','cemetery');showEnvironment();
  if(scene)apply('environment',()=>scene.setEnvironment('cemetery'));
  syncEntryOption('piece', null);
  syncEntryOption('preset', null);
  syncEntryOption('edit', null);
  syncEntryOption('side', null);
  syncEntryOption('bedFill', null);
  syncEntryOption('model', state.model);
  syncEntryOption('stone', state.stone);
  syncEntryOption('size', state.plot.size);
  syncEntryOption('surface', state.plot.surface);
  syncEntryOption('paving', state.plot.paving);
  try { localStorage.removeItem(storageKey); } catch {}
  showStone();
  showModel();
  apply('model', () => scene.setModel('classic'));
  apply('stone', () => scene.setStone('black'));
  for (const which of sides) {
    photoVersion[which]++;
    applyPerson(which);
    applyPhoto(which);
  }
  selectSide('left');
  graveSide = 'left';
  showPlot();
  applyPlot();
  setSection('plot');
  $('save-state').textContent = 'Исходные настройки';
});

function updateRenderButton() {
  $('unreal').hidden = !unrealAvailable && !rendering;
  $('render-tools').hidden = $('unreal').hidden && $('render-message').hidden;
  $('privacy').hidden = !unrealAvailable && !rendering;
  $('unreal').disabled = !scene || rendering || !unrealAvailable;
}
let statusEndpoint = 'unknown';
let checkingStatus = false;
let statusTimer;
async function detectUnreal() {
  clearTimeout(statusTimer);
  if (document.hidden || checkingStatus || statusEndpoint === 'absent') return;
  checkingStatus = true;
  try {
    const response = await fetch('../api/unreal/status', {
      cache:'no-store', headers:{Accept:'application/json'}, signal:AbortSignal.timeout(6000)
    });
    if (response.status === 404 || response.status === 410) statusEndpoint = 'absent';
    if (response.ok) {
      const status = await response.json();
      statusEndpoint = typeof status?.available === 'boolean' ? 'present' : 'absent';
      unrealAvailable = status?.available === true;
    } else unrealAvailable = false;
  } catch (error) {
    unrealAvailable = false;
    if (error instanceof SyntaxError) statusEndpoint = 'absent';
  } finally {
    checkingStatus = false;
    updateRenderButton();
    if (statusEndpoint === 'present' && !document.hidden) {
      statusTimer = setTimeout(detectUnreal, 8000);
    }
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(statusTimer);
  else detectUnreal();
});

// An explicit render request sends the current photo and engraving to Unreal.
$('unreal').addEventListener('click', async () => {
  if (!scene || !unrealAvailable || rendering) return;
  rendering = true;
  const version = resetVersion;
  $('render-message').textContent = 'Рендерим в Unreal…';
  $('render-message').hidden = false;
  updateRenderButton();
  try {
    await Promise.all(Object.values(photoJobs));
    await Promise.all([...operations.values()].map(job => job.promise));
    const result = await scene.renderUnreal();
    if (!result?.url) throw new Error('Missing render');
    if (version !== resetVersion) {
      URL.revokeObjectURL(result.url);
      $('render-message').hidden = true;
      return;
    }
    renderUrl = result.url;
    $('render-image').src = renderUrl;
    $('save-render').href = renderUrl;
    $('render-dialog').showModal();
    $('render-message').hidden = true;
  } catch {
    $('render-message').textContent = 'Не удалось получить рендер. Попробуйте ещё раз.';
  } finally {
    rendering = false;
    updateRenderButton();
  }
});
$('close-render').addEventListener('click', () => $('render-dialog').close());
$('render-dialog').addEventListener('close', () => {
  $('render-image').removeAttribute('src');
  $('save-render').removeAttribute('href');
  if (renderUrl) URL.revokeObjectURL(renderUrl);
  renderUrl = undefined;
});

function focusEntryControl() {
  let control;
  if (requestedEdit) control = requestedEdit === 'photo' ? $('choose-photo') : $('surname');
  else if (requestedFill && startSection === 'plot') control = document.querySelector('[data-bed-fill="'+requestedFill+'"]');
  else if (requestedPiece && !requestedPreset) {
    if (sides.includes(pieceField)) control = document.querySelector('[data-grave="' + requestedPiece + '"]');
    else if (pieceField === 'fence') control = document.querySelector('[data-plot-key="fence"][data-value="' + requestedPiece + '"]');
    else control = $('plot-' + pieceField);
  } else if (startSection === 'plot' && requestedFence) {
    control = document.querySelector('[data-plot-key="fence"][data-value="' + requestedFence + '"]');
  } else if (startSection === 'plot' && requestedPaving && state.plot.surface === 'paving') {
    control = document.querySelector('[data-plot-key="paving"][data-value="' + requestedPaving + '"]');
  }
  if (!control) return;
  const marker = control.closest('.toggle') || control;
  marker.classList.add('entry-target');
  control.focus({preventScroll:true});
  marker.scrollIntoView({block:'center', inline:'nearest'});
  control.addEventListener('blur', () => marker.classList.remove('entry-target'), {once:true});
}

showModel();
showStone();
showPlot();
selectSide('left');
showEnvironment();
setSection(startSection, false);
setView(view);
focusEntryControl();
if (entryChanged || draftFillMigrated) changed();
detectUnreal();
try {
  const { mountScene } = await import('./scene.js');
  const initialEnvironment=state.environment;
  scene = await mountScene($('scene'), {environment:initialEnvironment,startView:view,walkPad:$('walk-pad'),onWalkMove:drawWalkMap,onWalkExit:exitWalk,onReady: () => {}, onError: showSceneError});
  if (!scene) throw new Error('Missing scene');
  const jobs = [applyPlot()];
  if(initialEnvironment!==state.environment)jobs.push(apply('environment',()=>scene.setEnvironment(state.environment)));
  if (state.model !== 'classic') jobs.push(apply('model', () => scene.setModel(state.model)));
  if (state.stone !== 'black') jobs.push(apply('stone', () => scene.setStone(state.stone)));
  for (const which of sides) {
    if (fields.some(field => state.people[which][field] !== initialPeople[which][field])) jobs.push(applyPerson(which));
    if (state.photos[which]) jobs.push(applyPhoto(which));
  }
  await Promise.all(jobs);
  setView(view);
  $('scene-state').hidden = true;walkStart.disabled=false;
  updateRenderButton();
  if(holdWalkLink)await enterWalk();
} catch { showSceneError(); }
