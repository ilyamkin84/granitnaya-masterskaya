// All dimensions are metres. World +Z leads from the main headstone towards the entrance.
function seededRandom(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function stoneFinish(THREE, anisotropy) {
  const rng = seededRandom(84113);
  const size = 192;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    const mineral = rng();
    const level = mineral < .06 ? 120 + rng()*55 : mineral > .82 ? 222 + rng()*32 : 190 + rng()*38;
    data[i] = level;
    data[i + 1] = level - rng()*3;
    data[i + 2] = level - rng()*5;
    data[i + 3] = 255;
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.generateMipmaps = true;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(anisotropy, 4);
  map.needsUpdate = true;
  return map;
}

// Real grain stays visible at arm's length; one map is shared across all of the plots.
function photographicMap(THREE, config, name) {
  if (typeof document==='undefined' || !document.createElementNS) return null;
  const map=new THREE.TextureLoader().load(new URL('./assets/cemetery/'+name,import.meta.url).href,
    ()=>{config.invalidate?.();config.requestRender?.();});
  map.wrapS=map.wrapT=THREE.RepeatWrapping;
  map.anisotropy=Math.min(config.anisotropy||1,8);map.colorSpace=THREE.SRGBColorSpace;
  return map;
}

// Sandblasted branch / cross, two fine rules and a tiny inscription. The linework
// is drawn at its physical scale on the fronts only. No personal details are used.
function etching(THREE, variant) {
  const canvas = document.createElement('canvas');
  canvas.width = 360;
  canvas.height = 480;
  const g = canvas.getContext('2d');
  g.scale(2,2);
  g.strokeStyle = '#ffffff';
  g.fillStyle = '#ffffff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const drawLine = (x1, y1, x2, y2, width = 2) => {
    g.lineWidth = width;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  function leaf(x, y, angle, size) {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(-.42*size, -.48*size, 0, -size);
    g.quadraticCurveTo(.27*size, -.50*size, 0, 0);
    g.fill();
    g.restore();
  }
  if (variant === 0) {
    drawLine(90, 15, 90, 99, 3.5);
    drawLine(73, 33, 107, 33, 3.1);
    drawLine(64, 51, 116, 51, 3.6);
    drawLine(76, 72, 104, 85, 2.9);
  } else if (variant === 1) {
    g.lineWidth = 2.3;
    g.beginPath(); g.moveTo(56,99); g.quadraticCurveTo(93,90,111,22); g.stroke();
    for (let i=0; i<8; i++) {
      const t=i/8, x=61+50*t+7*Math.sin(Math.PI*t), y=97-50*t-24*t*t;
      leaf(x,y,-.56,14+6*Math.sin(Math.PI*t));
      leaf(x+4,y-4,1.01,13+7*Math.sin(Math.PI*t));
    }
  } else {
    // An engraved eight-petal rosette within two incomplete leaf boughs.
    for (let i=0; i<8; i++) leaf(90,53,i*Math.PI/4,14);
    for (const side of [-1,1]) {
      g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(90,97); g.quadraticCurveTo(90+side*31,80,90+side*34,38); g.stroke();
      for (let i=0; i<5; i++) {
        const t=i/5;
        leaf(90+side*(10+24*t),90-44*t,side*(.7+.4*t),10);
      }
    }
  }
  // Actual lettering survives a close walk-up without putting personal information on scenery.
  const lines=[['ВЕЧНАЯ','ПАМЯТЬ'],['СВЕТЛАЯ','ПАМЯТЬ'],['ПОМНИМ','И ЛЮБИМ']][variant];
  g.textAlign='center';
  g.font='15px Georgia, serif'; g.fillText(lines[0],90,129,148);
  g.font='13px Georgia, serif'; g.fillText(lines[1],90,150,143);
  drawLine(63,169,82,169,.9);drawLine(98,169,117,169,.9);
  leaf(90,173,0,7);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function tablet(THREE, kind) {
  const s = new THREE.Shape();
  s.moveTo(-.50,0);
  switch (kind) {
  case 'classic': // Upright slab, clipped corners and a small polished chamfer.
    s.lineTo(-.50,.933);s.lineTo(-.424,1);s.lineTo(.424,1);s.lineTo(.50,.933);break;
  case 'arch': // Tall, continuous segment arch, vertical sides.
    s.lineTo(-.50,.727);s.bezierCurveTo(-.50,.875,-.291,1,0,1);
    s.bezierCurveTo(.291,1,.50,.875,.50,.727);break;
  case 'wave': // High left crest falling into a low, curling lip at the right.
    s.lineTo(-.50,.863);s.bezierCurveTo(-.423,1.025,-.195,1.029,-.035,.907);
    s.bezierCurveTo(.183,.734,.345,.738,.50,.791);break;
  case 'family': // A wide, low stele with two shoulders and a single central crown.
    s.lineTo(-.50,.704);s.lineTo(-.425,.704);s.bezierCurveTo(-.378,.704,-.380,.785,-.318,.806);
    s.bezierCurveTo(-.197,.842,-.126,.978,0,1);
    s.bezierCurveTo(.126,.978,.197,.842,.318,.806);
    s.bezierCurveTo(.380,.785,.378,.704,.425,.704);s.lineTo(.50,.704);break;
  }
  s.lineTo(.50,0); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelOffset:0,bevelThickness:.008,bevelSize:.010,bevelSegments:2,curveSegments:12});
  geo.translate(0,0,-.06);
  geo.clearGroups();
  return geo;
}

function urnShape(THREE) {
  const profile = [[.063,0],[.068,.018],[.055,.035],[.037,.052],[.042,.087],
    [.063,.118],[.074,.158],[.066,.195],[.057,.209],[.069,.217],[.069,.226],[.048,.226],[.04,.203]];
  return new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),12);
}

export function createCemeteryGraves(THREE, config = {}) {
  const root = new THREE.Group();
  root.name = 'Соседние участки';
  root.position.y = config.groundY ?? -.095;
  const random = seededRandom(360481);
  const between = (a,b) => a+(b-a)*random();
  const choose = a => a[Math.min(a.length-1,Math.floor(random()*a.length))];
  const stoneMap = photographicMap(THREE,config,'granite-grain.jpg')||stoneFinish(THREE,config.anisotropy || 1);
  const timberMap = photographicMap(THREE,config,'cross-timber.jpg');
  const pbr = params => new THREE.MeshStandardMaterial(params);
  const materials = {
    polished:pbr({map:stoneMap,roughness:.235,metalness:0,envMapIntensity:.82}),
    rough:pbr({map:stoneMap,roughness:.85,envMapIntensity:.48}),
    metal:pbr({roughness:.47,metalness:.43,envMapIntensity:.66}),
    timber:pbr({map:timberMap,roughness:.80,metalness:0,envMapIntensity:.55}),
    plant:pbr({roughness:.87,metalness:0,side:THREE.DoubleSide,envMapIntensity:.25}),
  };
  for (let i=0;i<3;i++){
    materials['inscription'+i]=pbr({map:etching(THREE,i),alphaTest:.075,depthWrite:false,
      roughness:.84,metalness:.07,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  }
  const pieces = {
    box:new THREE.BoxGeometry(1,1,1),
    plaque:new THREE.PlaneGeometry(1,1),
    urn:urnShape(THREE),
    leaves:new THREE.IcosahedronGeometry(.5,0),
    postTop:new THREE.ConeGeometry(.5,1,4),
    soil:new THREE.SphereGeometry(.5,10,5),
    fastener:new THREE.CylinderGeometry(.5,.5,1,8),
  };
  const profiles = ['classic','arch','wave','family'];
  for (const name of profiles) pieces[name]=tablet(THREE,name);
  // Uprights and bars use a long-grain local Y axis; turning a bar also turns its fibres.
  for(let k=0;k<3;k++){
    const beam=new THREE.BoxGeometry(1,1,1),uv=beam.attributes.uv,n=beam.attributes.normal;
    for(let i=0;i<uv.count;i++){
      const end=Math.abs(n.getY(i))>.9;
      const strip=(Math.abs(n.getX(i))>.9?k+1:k)%3;
      uv.setXY(i,(strip+.035+.93*uv.getX(i))/3,end?.89+.079*uv.getY(i):.018+.957*uv.getY(i));
    }
    pieces['beam'+k]=beam;
  }

  let siteX=0, siteZ=0, sine=0, cosine=1;
  const quatSite = new THREE.Quaternion();
  const local = new THREE.Object3D();
  const axisY = new THREE.Vector3(0,1,0);
  const bins = new Map();
  function put(geometry,surface,x,y,z,sx,sy,sz,color,rx=0,ry=0,rz=0){
    const key = geometry+'|'+surface;
    if (!bins.has(key)) bins.set(key,{geometry,surface,items:[]});
    local.position.set(siteX+x*cosine+z*sine,y,siteZ-x*sine+z*cosine);
    local.rotation.set(rx,ry,rz);
    local.quaternion.premultiply(quatSite);
    local.scale.set(sx,sy,sz);
    local.updateMatrix();
    bins.get(key).items.push([local.matrix.clone(),color]);
  }
  const block=(surface,x,y,z,sx,sy,sz,color) => put('box',surface,x,y,z,sx,sy,sz,color);
  const stones=['#36393a','#333638','#424241','#494647','#46494b','#555554','#635353','#5b4945','#686963','#353b3f'];
  const concretes=['#a19c8d','#918e82','#a9a69b','#949187','#84857c'];
  const inks=['#b2b1a5','#bcb7a6','#a49c84','#aba99c'];
  const irons=['#343a35','#363d3b','#44483f','#45483a','#464440'];
  const leaves=['#667346','#52653d','#546741','#708059','#596846','#657455'];
  const paintedWood=['#666252','#776a58','#6e6150','#5d6258'];
  const timberTints=['#f1d2ad','#dbb68f','#d7c4ae','#c7beb0','#e7ccae'];

  function timberCross(z,height,base,orthodox,detailed) {
    const width=orthodox?.102:.112,depth=.075,finish=choose(timberTints);
    const main=.724*height;
    put('beam0','timber',0,base+height*.5,z,width,height,depth,finish);
    // Surface-mounted bars, with a small visible lap and ends that project beyond the post.
    function bar(h,span,face,angle,texture){
      put('beam'+texture,'timber',0,base+h,z+depth*.48,face,span,depth*.75,finish,0,0,-Math.PI/2+angle);
      if(detailed)put('fastener','metal',0,base+h,z+depth*.89,.012,.004,.012,'#544b40',Math.PI/2);
    }
    bar(main,height*(orthodox?.435:.475),width*.94,0,1);
    if(orthodox){
      bar(height*.868,height*.221,width*.65,0,2);
      bar(height*.426,height*.277,width*.76,-.32,2);
    }
  }
  function boundary(width,depth,height,iron,decor) {
    const w=width*.5,d=depth*.5;
    // A continuous railing has a physical entrance centred at the front.
    const sides=[[-w,-d,w,-d],[-w,-d,-w,d],[w,-d,w,d],[-w,d,-.35,d],[.35,d,w,d]];
    const posts=new Set();
    for (const [x1,z1,x2,z2] of sides) {
      const dx=x2-x1,dz=z2-z1,length=Math.hypot(dx,dz);
      const count=Math.max(1,Math.ceil(length/1.31)),angle=-Math.atan2(dz,dx);
      for (const f of [.34,.83]) {
        put('box','metal',(x1+x2)/2,height*f,(z1+z2)/2,length,.018,.018,iron,0,angle);
      }
      for (let j=0;j<=count;j++) {
        const t=j/count, x=x1+dx*t,z=z1+dz*t;
        if (!posts.has(x.toFixed(3)+','+z.toFixed(3))) {
          posts.add(x.toFixed(3)+','+z.toFixed(3));
          block('metal',x,height*.48,z,.035,height*.96,.035,iron);
          put('postTop','metal',x,height*.99,z,.058,.061,.058,iron,0,Math.PI*.25);
        }
        if (j===count) continue;
        for (let k=1;k<=3;k++) {
          const t=(j+k*.25)/count;
          const h=(decor && k===2?1.08:.88)*height;
          block('metal',x1+dx*t,h*.58,z1+dz*t,.013,h*.78,.013,iron);
        }
      }
    }
  }
  function bouquet(x,z,base,large=false) {
    const shade=choose(stones);
    const vaseScale=large?1.16:.85;
    put('urn','polished',x,base,z,vaseScale,vaseScale,vaseScale,shade);
    const top=base+.22*vaseScale;
    const flowerColor=choose(['#b27778','#c5956f','#dbbd81','#ac7473','#c6bca8','#b8ae98']);
    for(let j=0;j<7;j++){
      const angle=j*2.4, radius=.058*Math.sqrt(j/7);
      const ox=Math.cos(angle)*radius,oz=Math.sin(angle)*radius;
      const h=between(.12,.23);
      put('box','plant',x+ox*.7,top+h*.43,z+oz*.7,.007,h,.007,'#5b6945',oz*.9,0,-ox*.9);
      put('leaves','plant',x+ox,top+h*.65,z+oz,.030,.085,.016,choose(leaves),.5*Math.cos(angle),angle,.3*Math.sin(angle));
      put('soil','plant',x+ox,top+h,z+oz,.043,.033,.043,flowerColor,0,angle);
    }
  }
  function flowerBed(x,z,width,length,rich) {
    const wall=choose(concretes);
    const soil=choose(['#615748','#655e4d','#5e5748','#716853']);
    block('rough',x,.070,z,width,.11,length,wall);
    block('rough',x,.129,z,width-.12,.034,length-.12,soil);
    // Very low rosettes and blooms break the mirror-flat surfaces of maintained graves.
    const amount=rich?12:5;
    const flower=choose(['#cab7a6','#b98578','#c0ad7d','#9c7480']);
    for (let j=0;j<amount;j++) {
      const px=x+between(-.34,.34)*width,pz=z+between(-.37,.37)*length;
      const size=between(.08,.16);
      put('leaves','plant',px,.16+size*.20,pz,size,size*.73,size*.79,choose(leaves),.15,random()*Math.PI);
      if(rich&&j%3===0)put('soil','plant',px+.006,.165+size*.49,pz,size*.38,size*.23,size*.34,flower);
    }
  }
  function restBench(x,z) {
    const wood=choose(paintedWood),metal=choose(irons);
    for(const offset of [-.25,.25]) {
      block('metal',x+offset,.175,z,.036,.35,.23,metal);
      block('metal',x+offset,.402,z-.104,.030,.46,.025,metal);
    }
    for(const f of [-.10,0,.10])block('rough',x,.365,z+f,.69,.035,.084,wood);
    block('rough',x,.58,z-.11,.69,.095,.03,wood);
  }

  const footprints=[];
  const counts={classic:0,arch:0,wave:0,family:0,'wood-cross':0};
  function makeSite(x,z,yaw,visibleDetail,profile,hint) {
    siteX=x; siteZ=z; cosine=Math.cos(yaw); sine=Math.sin(yaw);
    quatSite.setFromAxisAngle(axisY,yaw);
    const width=between(1.50,2.34), depth=between(2.12,2.70);
    const timber=profile==='wood-cross',family=profile==='family';
    counts[profile]++;
    const stone=choose(stones),baseStone=choose(concretes),metal=choose(irons);
    const tabletZ=-depth*.5+.35;
    const tw=between(.535,.710), height=between(.92,1.15), shade=choose(inks);
    const grade=timber?1:random();
    footprints.push({x,z,yaw,plotWidth:width,plotDepth:depth,w:width*(grade<.72?1:.66),d:depth*(grade<.72?1:.87),marker:profile});
    if (grade<.72) {
      const thickness=grade<.35?.072:.045;
      block('rough',0,thickness/2,0,width,thickness,depth,baseStone);
      block('rough',0,thickness+.004,0,width-.12,.015,depth-.12,choose(['#938876','#978c7b','#898275','#a09888']));
    }
    const footing=grade<.72?.09:.018;
    if(timber){
      timberCross(tabletZ,between(1.38,1.66),.012,hint,visibleDetail);
    }else{
      const sw=family?between(.99,1.24):profile==='wave'?tw*1.09:tw;
      const sh=family?between(.64,.77):profile==='arch'?height*1.07:height;
      // Each granite headstone sits on an independent two-stage shoe.
      block('rough',0,footing+.043,tabletZ,sw+.225,.087,.37,choose([baseStone,stone]));
      block('polished',0,footing+.138,tabletZ,sw+.122,.115,.259,stone);
      block('polished',0,footing+.201,tabletZ,sw+.147,.018,.274,stone);
      const start=footing+.214,thickness=between(.83,1.08);
      put(profile,'polished',0,start+.001,tabletZ,sw,sh,thickness,stone);
      const count=family?2:1,motif=Math.floor(random()*3);
      for(let i=0;i<count;i++){
        const offset=family?(i===0?-.222:.222)*sw:0;
        put('plaque','inscription'+((motif+i)%3),offset,start+sh*(family?.46:.48),tabletZ+.068*thickness+.0015,
          sw*(family?.395:.70),sh*(family?.62:.71),1,shade);
      }
    }
    const bedWidth=Math.min(tw+.26,width*.62);
    const length=depth*.55;
    const choice=timber?(hint?.95:.65):random();
    if(choice<.43) {
      const color=choose([stone,stone,...concretes]);
      block('rough',0,.111,.23,bedWidth+.06,.080,length+.05,baseStone);
      block('polished',0,.174,.23,bedWidth,.06,length,color);
      if(visibleDetail&&random()<.56)bouquet(bedWidth*.39,tabletZ+.26,footing+.018);
    }else if(choice<.89){
      flowerBed(0,.23,bedWidth,length,visibleDetail);
      if(!timber&&visibleDetail&&random()<.33)bouquet(-tw*.55,tabletZ+.10,footing+.01);
    }else{
      put('soil','rough',0,.05,.21,bedWidth,.24,length,choose(['#78705b','#726954','#79725c']));
    }
    if(random()<(timber?.16:.48)){
      boundary(width+.08,depth+.03,between(.39,.59),metal,random()<.45);
    }else if(random()<.44){
      for(const side of [-1,1]) {
        block('rough',side*(width-.07)*.5,.102,0,.069,.115,depth,baseStone);
        block('rough',0,.10,side*(depth-.07)*.5,width,.11,.071,baseStone);
      }
    }
    if(visibleDetail&&width>1.8&&random()<.26) restBench(-width*.29,depth*.38);
  }

  const cols=[-17.2,-13.8,-10.1,-7.05,-3.63,0,3.72,6.85,12.45,15.65,19.3];
  const rows=[1.02,-4.50,-9.16,-13.83,-18.52,7.75,12.36,17.00];
  let count=0;
  for (let row=0;row<rows.length;row++) {
    for (let col=0;col<cols.length;col++) {
      const nearOrigin=Math.abs(cols[col])<1,nearFront=rows[row]>3;
      if (nearOrigin&&(row===0||nearFront)) continue;
      // Keep the near approach clear throughout the normal orbit and from the gate.
      if (row===5 && Math.abs(cols[col])<4.7) continue;
      if (nearOrigin && row===1) continue;
      const alongWalk=(row===0||row===1||row===5)&&Math.abs(cols[col])<8.5;
      if (!alongWalk&&Math.abs(cols[col])>5&&random()<.16) continue;
      const x=cols[col]+between(-.25,.24),z=rows[row]+between(-.12,.12);
      const yaw=(nearFront?Math.PI:0)+between(-.055,.055);
      const detailed=Math.hypot(x,z)<13;
      // Hand-set the nearest silhouettes so either turn along the avenue reveals both stone and wood.
      // More distant plots are sampled independently rather than repeating an obvious parade.
      const front={3:'wood-cross',4:'arch',6:'wood-cross',7:'wave'};
      const behind={3:'classic',4:'wave',6:'family',7:'wood-cross'};
      const across={3:'family',7:'classic'};
      const pick=row===0?front[col]:row===1?behind[col]:row===5?across[col]:null;
      const profile=pick || (random()<.235?'wood-cross':choose(profiles));
      makeSite(x,z,yaw,detailed,profile,row===0?col===3:random()<.53);
      count++;
    }
  }
  root.userData.plots=count;root.userData.footprints=footprints;root.userData.markerCounts=counts;
  const instanceColor=new THREE.Color();
  for (const {geometry,surface,items} of bins.values()){
    const mesh=new THREE.InstancedMesh(pieces[geometry],materials[surface],items.length);
    mesh.name=geometry+' / '+surface;
    for(let i=0;i<items.length;i++){
      mesh.setMatrixAt(i,items[i][0]);
      mesh.setColorAt(i,instanceColor.set(items[i][1]));
    }
    mesh.computeBoundingSphere();
    const etch=surface.startsWith('inscription');
    mesh.castShadow=!etch && !(config.mobile && (surface==='plant' ||surface==='metal'));
    mesh.receiveShadow=!etch;
    if(etch)mesh.renderOrder=1;
    root.add(mesh);
  }
  return root;
}
