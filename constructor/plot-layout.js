export const DEFAULT_PLOT = Object.freeze({
  size:'wide', left:'flower-rect', right:'slab-solid', fence:'fence-forged',
  leftFill:'marble', rightFill:'marble', surface:'paving', paving:'black', bench:false, vase:false, gateOpen:false, entrance:'right', vaseSide:'left'
});

const dimensions = {standard:[2.4,3], wide:[2.8,3.2], large:[3.2,3.6]};
export const STONE_FENCES = Object.freeze(['fence-stone-plinth', 'fence-stone-wave', 'fence-stone-baluster']);
export const FENCE_OPTIONS = Object.freeze(['none', 'fence-simple', 'fence-forged', ...STONE_FENCES]);
const stonePostWidth = .130;
const metalPostWidth = .078;
const coverWidth = .66;
const serviceAisle = .60;
const coverSizes = {
  standard: {width:.60, joint:.08, length:1.00},
  wide: {width:.66, joint:.126, length:1.20},
  large: {width:.66, joint:.126, length:1.56}
};
export const FENCE_HEIGHTS = Object.freeze({
  'fence-simple':{post:.590,rail:.503}, 'fence-forged':{post:.649,rail:.596},
  'fence-stone-plinth':{post:.23,rail:.11}, 'fence-stone-wave':{post:.23,rail:.21},
  'fence-stone-baluster':{post:.35,rail:.11}
});
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
  const postWidth = stoneFence ? stonePostWidth : metalPostWidth;
  const gateLatch = gateHinge - gateWidth - postWidth;
  const sign = plot.entrance === 'left' ? -1 : 1;
  const cover = coverSizes[plot.size];
  const centers = (cover.width + cover.joint) / 2;
  const pairEdge = centers + cover.width / 2;
  const innerSide = plot.fence === 'none' ? width / 2 : right - postWidth / 2;
  // Move the paired assembly together; neither portraits nor stones stretch sideways.
  // Keep the entrance-side service aisle clear of the protruding post feet.
  const memorialX = -sign * Math.max(0, serviceAisle - (innerSide - pairEdge));
  monument.offsetX = memorialX;
  // The glass pair has a recessed ledge. The horizontal models meet the base at a 4 mm joint.
  const head = monument.model === 'classic' ? .312 : monument.baseFront + .004;
  const length = cover.length;
  const instances = [];
  const round = n => Math.round(n * 100000) / 100000;
  function add(asset,x,z,angle=0,sx=1,sz=1) {
    instances.push({asset,x:round(x),z:round(z),angle:round(angle),sx:round(sx),sz:round(sz)});
  }
  function covering(asset,x,start,extent) {
    const templateLength = asset === 'slab-half' ? .57 : 1.14;
    add(asset,x,start+extent/2,0,cover.width/coverWidth,extent/templateLength);
  }
  for (const [side,x] of [['left',memorialX-centers],['right',memorialX+centers]]) {
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
  const entranceSign = sign;
  if (plot.bench) add('bench',entranceSign*(-width/2+.54),frontPosts-(stoneFence ? .28 : .25),Math.PI);
  if (plot.vase) {
    const vaseSign = plot.vaseSide === 'left' ? -1 : 1;
    const headEdge = vaseSign*memorialX + Math.max(monument.width/2, pairEdge);
    if (vaseSign !== entranceSign && innerSide-headEdge >= .21) {
      add('vase',vaseSign*(headEdge+.105),.12);
    } else {
      // On the service side or against a close fence, the vase belongs at the foot
      // of its selected grave, safely clear of both the route and the pedestal.
      const piece = plot[plot.vaseSide];
      const coveredLength = piece === 'none' ? 0 : piece === 'slab-half' ? length/2 : length;
      add('vase',memorialX+vaseSign*centers,head+coveredLength+.11);
    }
  }
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
      // The hinge is just inside the corner post; the leaf opens against the side rail.
      const hingeOffset=postWidth/2+.010;
      boundaryPart('gate-'+style,gateHinge-hingeOffset,frontPosts,
        plot.gateOpen ? Math.PI/2 : Math.PI, (gateWidth-.015)/.983);
    }
  }
  return {monument,memorialX,size:[width,depth],groundCenterZ:round(back+depth/2),gateWidth,
          surface:plot.surface,paving:plot.paving,instances};
}

// Measured to the innermost post foot (or paved edge). The path is for an open gate.
export function getVisitRoute(layout, plot) {
  plot = normalizePlot(plot);
  const side = plot.entrance === 'left' ? -1 : 1;
  const [width,depth] = layout.size;
  const size = coverSizes[plot.size];
  const posts = layout.instances.filter(i => i.asset.startsWith('post-'));
  const front = layout.groundCenterZ + depth/2;
  const innerHalf = posts.length
    ? Math.max(...posts.map(i => side*i.x)) - (posts[0].asset.startsWith('post-stone-') ? stonePostWidth : metalPostWidth)/2
    : width/2;
  const covers = coverBounds(layout.instances);
  const edge = covers ? (side === 1 ? covers.right : -covers.left) : side*layout.monument.offsetX;
  const sideClearance = innerHalf - edge;
  // A missing near-side covering leaves extra room; still approach the headstone.
  const nominalEdge = side*layout.monument.offsetX + size.width + size.joint/2;
  const aisleEdge = Math.max(edge,nominalEdge);
  const aisleX = side * (aisleEdge + Math.min((innerHalf-aisleEdge)/2,.32));
  const frontZ = posts.length ? Math.max(...posts.map(i => i.z)) : front;
  const gatePosts = posts.filter(i => i.z === frontZ).sort((a,b) => side*(b.x-a.x));
  const gateX = gatePosts.length ? (gatePosts[0].x+gatePosts[1].x)/2 : aisleX;
  const postRadius = posts.length ? (posts[0].asset.startsWith('post-stone-') ? stonePostWidth : metalPostWidth)/2 : 0;
  const clearFront = frontZ-postRadius;
  const gate = {x:gateX,z:frontZ};
  // A metal leaf folds into the plot. Pass its free end before turning towards
  // the side aisle so a visitor's shoulders clear both the leaf and the slab.
  const hasLeaf = layout.instances.some(i => i.asset.startsWith('gate-'));
  const path = [
    {x:gateX,z:frontZ+.40}, gate,
    {x:gateX,z:frontZ-(hasLeaf ? .84 : .28)}, {x:aisleX,z:frontZ-(hasLeaf ? 1.08 : .82)},
    {x:aisleX,z:layout.monument.baseFront+.28}
  ];
  return {gate,path,aisleX,sideClearance,frontClearance:clearFront-(covers?.front??layout.monument.baseFront),
    coverLength:size.length, entryWidth:posts.length ? Math.abs(gatePosts[0].x-gatePosts[1].x)-2*postRadius : null};
}
