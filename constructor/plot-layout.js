export const DEFAULT_PLOT = Object.freeze({
  size:'wide', left:'flower-rect', right:'slab-solid', fence:'fence-forged',
  leftFill:'marble', rightFill:'marble', surface:'paving', paving:'black', bench:false, vase:false, gateOpen:false, entrance:'right', vaseSide:'left'
});

const dimensions = {standard:[2.4,3], wide:[2.8,3.2], large:[3.2,3.6]};
export const STONE_FENCES = Object.freeze(['fence-stone-plinth', 'fence-stone-wave', 'fence-stone-baluster']);
export const FENCE_OPTIONS = Object.freeze(['none', 'fence-simple', 'fence-forged', ...STONE_FENCES]);
const stonePostWidth = .168;
const metalPostWidth = .078;
const coverWidth = .66;
const graveOptions = ['none','flower-rect','flower-round','slab-solid','slab-half','mixed'];
export const BED_FILLS = Object.freeze(['marble', 'grass']);
export const hasBed = shape => shape === 'mixed' || shape === 'flower-rect' || shape === 'flower-round';
export const PAVING_FINISHES = Object.freeze(['black', 'bordo', 'graphite', 'green', 'marble', 'amber', 'paving']);
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;

export function normalizePlot(value) {
  const p = value || DEFAULT_PLOT;
  return {
    size:choice(p.size,Object.keys(dimensions),DEFAULT_PLOT.size),
    left:choice(p.left,graveOptions,DEFAULT_PLOT.left),
    right:choice(p.right,graveOptions,DEFAULT_PLOT.right),
    leftFill:choice(p.leftFill,BED_FILLS,DEFAULT_PLOT.leftFill),
    rightFill:choice(p.rightFill,BED_FILLS,DEFAULT_PLOT.rightFill),
    fence:choice(p.fence,FENCE_OPTIONS,DEFAULT_PLOT.fence),
    surface:choice(p.surface,['gravel','paving','grass'],DEFAULT_PLOT.surface),
    // Previously saved plots used grey rectangular pavers for their only tiled finish.
    paving:choice(p.paving,PAVING_FINISHES,'paving'),
    bench:p.bench === true, vase:p.vase === true, gateOpen:p.gateOpen === true,
    entrance:p.entrance === 'left' ? 'left' : 'right',
    vaseSide:p.vaseSide === 'right' ? 'right' : 'left'
  };
}

// Finished dimensions of the unscaled GLBs, including the polished bevels.
const horizontalShapes = Object.freeze({
  b05: {width:1, height:.808798},
  b20: {width:.9924462139606476, height:.810558},
  b37: {width:.9946965277194977, height:.831}
});

export function monumentDimensions(model, horizontalWidth = 150) {
  if (!Object.hasOwn(horizontalShapes, model)) {
    return {model:'classic', scale:1, width:1.65, height:1.5997, offsetZ:0,
      baseWidth:1.65, baseBack:-.186, baseFront:.314};
  }
  const shape = horizontalShapes[model];
  const width = horizontalWidth === 100 ? 1 : 1.5;
  const scale = width / shape.width;
  // Keep the back of the base clear of the rear fence as the memorial grows towards the aisle.
  const baseBack = -.1605;
  const offsetZ = .1605 * (scale - 1);
  return {model, scale, width, height:shape.height * scale, offsetZ,
    baseWidth:.81 * scale, baseBack, baseFront:.1245 * scale + offsetZ};
}

export function coverBounds(instances) {
  const covers = instances.filter(item => item.asset.startsWith('flower-') || item.asset.startsWith('slab-'));
  if (!covers.length) return null;
  return {
    left:Math.min(...covers.map(i => i.x - coverWidth * i.sx / 2)),
    right:Math.max(...covers.map(i => i.x + coverWidth * i.sx / 2)),
    front:Math.max(...covers.map(i => i.z + (i.asset === 'slab-half' ? .285 : .57) * i.sz)),
    places:new Set(covers.map(i => i.x)).size
  };
}

export function outerFenceWidth(instances) {
  const posts = instances.filter(i => i.asset.startsWith('post-'));
  if (!posts.length) return null;
  const cap = posts[0].asset.startsWith('post-stone-') ? stonePostWidth : metalPostWidth;
  return Math.max(...posts.map(i => i.x)) - Math.min(...posts.map(i => i.x)) + cap;
}

// Coordinates are metres, +Z runs from the common plinth to the entrance.
// All footprint centres and hinges are shared by the WebGL and Unreal renderers.
export function getPlotLayout(value, model = 'classic', horizontalWidth = 150) {
  const plot = normalizePlot(value);
  const monument = monumentDimensions(model, horizontalWidth);
  const [width, depth] = dimensions[plot.size];
  const back = -.40, front = back + depth;
  const stoneFence = STONE_FENCES.includes(plot.fence);
  const inset = stoneFence ? .100 : .065;
  const left = -width / 2 + inset, right = -left;
  const rearPosts = back + inset, frontPosts = front - inset;
  const gateWidth = .82;
  const gateHinge = right;
  const gateLatch = gateHinge - gateWidth - (stoneFence ? stonePostWidth : .05);
  // The glass pair has a recessed ledge. The horizontal models meet the base at a 4 mm joint.
  const head = monument.model === 'classic' ? .312 : monument.baseFront + .004;
  const length = Math.min(1.80, frontPosts - head - gateWidth - .054);
  const instances = [];
  const round = n => Math.round(n * 100000) / 100000;
  function add(asset,x,z,angle=0,sx=1,sz=1) {
    instances.push({asset,x:round(x),z:round(z),angle:round(angle),sx:round(sx),sz:round(sz)});
  }
  function covering(asset,x,start,extent) {
    const templateLength = asset === 'slab-half' ? .57 : 1.14;
    add(asset,x,start+extent/2,0,1,extent/templateLength);
  }
  for (const [side,x] of [['left',-.393],['right',.393]]) {
    const option = plot[side], fill = plot[side+'Fill'];
    const bedShape = option === 'mixed' ? 'flower-rect' : option;
    const bedAsset = bedShape+'-'+fill;
    if (option === 'none') continue;
    if (option === 'mixed') {
      const half = (length-.012)/2;
      covering('slab-half',x,head,half);
      covering(bedAsset,x,head+half+.012,half);
    } else {
      covering(hasBed(option) ? bedAsset : option,x,head,option === 'slab-half' ? length/2 : length);
    }
  }
  const entranceSign = plot.entrance === 'left' ? -1 : 1;
  if (plot.bench) add('bench',entranceSign*(-width/2+.54),frontPosts-(stoneFence ? .28 : .25),Math.PI);
  if (plot.vase) add('vase',plot.vaseSide === 'left' ? -.982 : .982,.12);
  if (plot.fence !== 'none') {
    const style = plot.fence.slice('fence-'.length);
    const posts = new Set();
    function boundaryPart(asset,x,z,angle=0,sx=1) {
      add(asset,entranceSign*x,z,entranceSign<0 ? Math.PI-angle : angle,sx,1);
    }
    function post(x,z) {
      const key = round(x)+','+round(z);
      if (posts.has(key)) return;
      posts.add(key);boundaryPart('post-'+style,x,z);
    }
    function run(x1,z1,x2,z2) {
      const dx=x2-x1,dz=z2-z1,span=Math.hypot(dx,dz);
      const count=Math.ceil(span/1.13), angle=Math.atan2(-dz,dx);
      post(x1,z1);
      for (let i=0; i<count; i++) {
        const x=x1+dx*i/count,z=z1+dz*i/count;
        boundaryPart(plot.fence,x,z,angle,span/count);
        post(x1+dx*(i+1)/count,z1+dz*(i+1)/count);
      }
    }
    run(left,rearPosts,right,rearPosts);
    run(left,frontPosts,left,rearPosts);
    run(right,rearPosts,right,frontPosts);
    run(left,frontPosts,gateLatch,frontPosts);
    // The corner post carries the hinge. The leaf swings into the clear front approach.
    if (!stoneFence) {
      boundaryPart('gate-'+style,gateHinge-.027,frontPosts,plot.gateOpen ? Math.PI*98/180 : Math.PI,gateWidth-.006);
    }
  }
  return {monument,size:[width,depth],groundCenterZ:round(back+depth/2),gateWidth,
          surface:plot.surface,paving:plot.paving,instances};
}
