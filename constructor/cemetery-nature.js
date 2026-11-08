// The far tree line uses camera-facing botanical cutouts. Trees on the paths have
// actual branching stems and individual sprays so they retain depth during orbit.
export function createCemeteryNature(THREE, config = {}) {
  const group = new THREE.Group();
  group.name = 'Деревья и травы';
  const groundY = config.groundY ?? -.095;
  const invalidate = config.invalidate || (() => {});
  const asset = file => new URL('./cemetery-assets/' + file, import.meta.url).href;
  let seed = 98347123;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  const between = (low, high) => low + random() * (high - low);
  const tau = Math.PI * 2;
  const loader = new THREE.TextureLoader();
  function foliageTexture(name) {
    const texture = loader.load(asset(name + '.webp'), invalidate);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, config.anisotropy || 1);
    return texture;
  }

  // Each tree rotates only about its vertical stem, so the base cannot tilt
  // toward the camera on a descending path or while orbiting above a grave.
  const outskirts = {birch: [], linden: [], pine: [], hazel: [], spruce: []};
  const ratios = {birch: .422, linden: .713, pine: .494, hazel: .92, spruce: .78};
  function distant(species, x, z, height) {
    outskirts[species].push({x, z, height, width: height * ratios[species] * between(.87, 1.2),
      mirror: random() < .5 ? -1 : 1, shade: between(.76, 1)});
  }
  for (let ring = 0; ring < 2; ring++) {
    const count = ring ? 53 : 38;
    for (let i = 0; i < count; i++) {
      const a = (i + between(-.38, .38)) / count * tau;
      const radius = between(ring ? 37 : 25, ring ? 49 : 34);
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      if (Math.abs(z - 4.45) < 2) continue;
      const pick = random();
      const species = pick < .44 ? 'linden' : pick < .72 ? 'birch' : 'pine';
      distant(species, x, z, between(8, 16.2));
    }
  }
  for (const [species,x,z,h] of [
    ['pine',-16,1.85,11.7],['linden',16.8,2.75,9.2],['birch',13.4,-7.7,9.9],
    ['pine',-13.25,-12.4,10.9],['linden',-16.8,-4,8.8],['birch',6,-15.8,9.5],
    ['linden',-5.85,-16.8,9.1],['pine',-2.3,-18,12.1],['birch',-9.3,15.9,10],
    ['pine',12.4,14.7,9.8],['linden',2.4,17,9.2],['birch',14.5,7.2,8.9],
  ]) distant(species,x,z,h);

  // Hazel patches break up the trunks at the forest edge. Leave the gravel
  // aisle open on its two long sight lines.
  for (let i=0;i<63;i++) {
    const a=between(0,tau),radius=between(22.5,37);
    const x=Math.cos(a)*radius,z=Math.sin(a)*radius;
    if(Math.abs(z-4.45)<2.1)continue;
    distant('hazel',x,z,between(1.85,4.3));
    if(i%3===0)distant('spruce',x+between(1.1,2.8),z+between(-1.5,1.5),between(1.9,4.9));
  }
  for(const [x,z,h] of [[-10.2,-9.6,2.3],[-5.9,-15.8,2.2],[8.7,-14.35,1.9],[11.8,13.85,2.6],[-13.3,2.2,1.5],[-10.3,9.75,1.8],[16.0,-10.55,2.0]]) {
    distant('spruce',x,z,h);
  }

  for (const [species, trees] of Object.entries(outskirts)) {
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);
    geo.setIndex(plane.index);
    const root = [], dimensions = [];
    for (const {x,z,height,width,mirror,shade} of trees) {
      root.push(x,groundY-(species==='hazel'||species==='spruce'?.14:.40),z); dimensions.push(width,height,mirror,shade);
    }
    geo.setAttribute('treeRoot',new THREE.InstancedBufferAttribute(new Float32Array(root),3));
    geo.setAttribute('treeSize',new THREE.InstancedBufferAttribute(new Float32Array(dimensions),4));
    geo.instanceCount = trees.length;
    const mat = new THREE.MeshBasicMaterial({map:foliageTexture(species), alphaTest:.30, side:THREE.DoubleSide});
    mat.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 treeRoot; attribute vec4 treeSize; varying float foliageShade;')
        .replace('#include <begin_vertex>', `
          vec2 viewHeading = cameraPosition.xz - treeRoot.xz;
          vec2 right = normalize(vec2(viewHeading.y, -viewHeading.x) + vec2(.000001));
          vec3 transformed = treeRoot + vec3(right.x * position.x * treeSize.x * treeSize.z,
                    position.y * treeSize.y, right.y * position.x * treeSize.x * treeSize.z);
          foliageShade = treeSize.w;
        `);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>','#include <common>\nvarying float foliageShade;')
        .replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= foliageShade;');
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'Опушка — ' + species;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const trunkData = { birch: plainGeometry(), linden: plainGeometry() };
  const foliage = {birch: plainGeometry(), linden: plainGeometry(), grass: plainGeometry()};
  function plainGeometry() { return { positions: [], normals: [], uvs: [], colors: [], indices: [] }; }
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  const up = v(0,1,0);
  function twig(species, points, radii, segments = 6) {
    const geo = trunkData[species];
    const start = geo.positions.length / 3;
    let length = 0;
    points.forEach((p,k) => {
      if (k) length += p.distanceTo(points[k-1]);
      const axis = points[Math.min(points.length-1,k+1)].clone().sub(points[Math.max(0,k-1)]).normalize();
      const first = new THREE.Vector3().crossVectors(axis,Math.abs(axis.z)<.92?v(0,0,1):v(1,0,0)).normalize();
      const second = new THREE.Vector3().crossVectors(axis,first).normalize();
      for(let j=0;j<=segments;j++) {
        const angle = tau*j/segments;
        const normal = first.clone().multiplyScalar(Math.cos(angle)).addScaledVector(second,Math.sin(angle));
        const vertex = p.clone().addScaledVector(normal,radii[k]);
        geo.positions.push(vertex.x,vertex.y,vertex.z); geo.normals.push(normal.x,normal.y,normal.z);
        geo.uvs.push(j/segments,length/(species==='birch'?1.12:1.55));
        if (k && j) {
          const a = start+k*(segments+1)+j;
          geo.indices.push(a-segments-2,a-segments-1,a,a-segments-2,a,a-1);
        }
      }
    });
  }
  function spray(species, root, angle, width, height, tilt, brightness) {
    const geo = foliage[species], start = geo.positions.length/3;
    const axis = v(Math.sin(angle),0,Math.cos(angle));
    const dir = v(-axis.z,0,axis.x);
    const droops = species==='birch';
    // Five rows bend the foliage into a drooping/arching bough. A curved
    // cross section gives edge-on sprays depth and hides the card silhouette.
    for (let r=0;r<=4;r++) {
      const t=r/4;
      const rise = droops ? -height * t : height * t;
      const projected = droops ? height*(tilt*t+.12*Math.sin(t*Math.PI)) : height*(tilt*t-.13*t*t);
      for(let col=0;col<=2;col++) {
        const u=col*.5;
        const p=root.clone().addScaledVector(dir,(u-.5)*width)
          .addScaledVector(up,rise).addScaledVector(axis,projected - Math.abs(u-.5)*.18*width);
        geo.positions.push(p.x,p.y,p.z); geo.uvs.push(u,droops ? 1-t:t);
        const light=brightness*(.80+.2*(droops?1-t:t));
        geo.colors.push(light*.76, light*.86, light*.98);
        if (r && col) {
          const a=start+r*3+col;
          geo.indices.push(a-4,a-3,a,a-4,a,a-1);
        }
      }
    }
  }
  const knots=[];
  function planted(species,x,z,height) {
    const base=v(x,groundY,z), birch=species==='birch';
    knots.push({x,z,radius:height*(birch?.17:.22)});
    const h=height, trunkRadius=h*(birch?.0105:.017);
    const lean=between(0,tau), leanX=h*.055*Math.cos(lean), leanZ=h*.055*Math.sin(lean);
    const core=t=>base.clone().add(v(leanX*t*t+Math.sin(t*5.7)*h*.018,h*t,leanZ*t*t+Math.sin(t*4.9)*h*.017));
    twig(species,[core(0),core(.035),core(.25),core(.56),core(.78),core(.96)],
      [trunkRadius*1.57,trunkRadius*1.03,trunkRadius*.84,trunkRadius*.57,trunkRadius*.29,.009],9);
    const n=birch?19:21;
    for (let i=0;i<n;i++) {
      const portion=i/(n-1), at=.31+portion*.59, ang=i*2.39996+between(-.55,.55);
      const horizontal=v(Math.cos(ang),0,Math.sin(ang)), perp=v(-horizontal.z,0,horizontal.x);
      const sideLight=.60+.28*(-horizontal.x*.70 + horizontal.z*.45)+between(-.12,.09);
      const origin=core(at);
      const span=h*(birch?.22:.285)*Math.pow(1-portion*.85,.61)*between(.69,1.24)*(.83+.23*Math.sin(Math.PI*portion));
      const rise=h*(birch?.23:.20)*between(.82,1.15)*(1-portion*.53);
      const side=between(-.24,.24)*span;
      const branch=t=>origin.clone().addScaledVector(horizontal,span*t)
        .addScaledVector(up,rise*(Math.sin(t*1.8)*.8+.20*t)).addScaledVector(perp,side*t*t);
      const radius=trunkRadius*(.26+(1-portion)*.23);
      twig(species,[branch(0),branch(.28),branch(.58),branch(.85),branch(1)],[radius,radius*.76,radius*.48,radius*.23,.005]);
      for (let level=0;level<5;level++) {
        const dist=.37+level*.145, pos=branch(dist);
        for (const sign of [-1,1]) {
          const reach=span*between(.20,.45)*(1.14-dist*.52);
          const outer=pos.clone().addScaledVector(perp,sign*reach).addScaledVector(horizontal,reach*between(.28,.68))
            .addScaledVector(up,reach*between(.22,.56));
          const middle=pos.clone().lerp(outer,.5).addScaledVector(up,.06*height);
          twig(species,[pos,middle,outer],[radius*.30,radius*.15,.003],4);
          const facing=ang+sign*between(.48,1.5);
          const size=h*between(birch?.115:.082,birch?.205:.155)*(1-.30*portion);
          const light=sideLight*(.74+.21*dist+.14*portion)+between(-.07,.08);
          spray(species,outer,facing,size*(birch?.77:1.14),size,between(.16,.56),light);
          if(random()<.62)spray(species,middle,facing+between(-1.6,1.6),size*.78,size*.88,between(.36,.88),light*.95);
        }
      }
    }
    // Ground growth only at the base of an existing tree, away from the graves.
    const grassBays=[between(0,tau),between(0,tau)];
    for(let i=0;i<18;i++) {
      const a=grassBays[i%2]+between(-.65,.65), r=.05+Math.pow(random(),1.6)*.88;
      const grass=base.clone().add(v(Math.cos(a)*r,.006,Math.sin(a)*r));
      const stem=between(.075,.235);
      spray('grass',grass,a,stem*1.15,stem,between(.08,.6),between(.29,.56));
    }
  }
  planted('birch',-4.75,2.86,8.7);
  planted('linden',6.12,-3.14,7.05);
  planted('birch',-6.23,-8.1,8.35);
  planted('linden',-10.45,6.35,8.15);
  planted('birch',10.32,6.55,8.95);
  planted('birch',2.05,-12.49,8.3);
  planted('linden',-6.10,10.8,7.45);

  function barkTexture(species) {
    const paper=document.createElement('canvas'); paper.width=256;paper.height=512;
    const ctx=paper.getContext('2d'), birch=species==='birch';
    ctx.fillStyle=birch?'#d9d7c9':'#615b4b';ctx.fillRect(0,0,paper.width,paper.height);
    for(let i=0;i<9000;i++) {
      const a=random()*.23, light=random()>.52;
      ctx.fillStyle=light?'rgba(251,242,212,'+a+')':'rgba(42,40,29,'+a+')';
      ctx.fillRect(random()*256,random()*512,between(1,birch?11:3),between(1,birch?3:14));
    }
    for(let i=0;i<(birch?244:420);i++) {
      const x=between(-8,256),y=random()*512,w=between(2,22)*random(),h=between(.7,3.6);
      ctx.strokeStyle=birch?'rgba(50,48,42,'+between(.27,.91)+')':'rgba(35,35,29,.70)';
      ctx.lineWidth=between(.45,1.75);ctx.beginPath();ctx.moveTo(x,y);
      if(birch)ctx.bezierCurveTo(x+w*.28,y-h,x+w*.75,y+h*.6,x+w,y-h*.3);
      else ctx.bezierCurveTo(x+2,y+4,x-3,y+12,x+2,y+between(13,32));
      ctx.stroke();
    }
    if(birch)for(let i=0;i<21;i++) {
      const x=random()*256,y=random()*512,w=between(28,83),h=between(4.8,13.2);
      ctx.fillStyle='rgba(34,33,28,.92)';ctx.beginPath();ctx.moveTo(x,y);
      ctx.bezierCurveTo(x+w*.29,y+h,x+w*.77,y+h*.5,x+w,y-h*.45);
      ctx.quadraticCurveTo(x+w*.48,y+h*.42,x,y-h);ctx.fill();
    }
    const texture=new THREE.CanvasTexture(paper);texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.anisotropy=Math.min(4,config.anisotropy||1);
    return texture;
  }
  function geometry(data) {
    const geo=new THREE.BufferGeometry();
    geo.setIndex(data.indices);
    geo.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
    if(data.normals.length)geo.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));
    if(data.colors.length)geo.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));
    geo.computeBoundingSphere();
    return geo;
  }
  for(const species of ['birch','linden']) {
    const trunk=new THREE.Mesh(geometry(trunkData[species]),new THREE.MeshStandardMaterial({
      map:barkTexture(species),roughness:.99,envMapIntensity:.4,
    }));
    trunk.name='Стволы и ветви — '+species;
    trunk.castShadow=true;trunk.receiveShadow=true;
    group.add(trunk);
  }
  for(const species of ['birch','linden','grass']) {
    const texture=foliageTexture(species==='grass'?'grass-tuft':species+'-spray');
    const leaves=new THREE.Mesh(geometry(foliage[species]),new THREE.MeshBasicMaterial({
      map:texture,vertexColors:true,alphaTest:.32,side:THREE.DoubleSide,
    }));
    leaves.name='Листва — '+species;
    if(species!=='grass') {
      leaves.castShadow=true;
      leaves.customDepthMaterial=new THREE.MeshDepthMaterial({
        map:texture,alphaTest:.36,side:THREE.DoubleSide,depthPacking:THREE.RGBADepthPacking,
      });
    }
    group.add(leaves);
  }
  // Soft contact darkening under a trunk remains visible outside the local
  // shadow-map footprint used for the edited memorial.
  const shade=document.createElement('canvas');shade.width=shade.height=96;
  const ctx=shade.getContext('2d'),fade=ctx.createRadialGradient(48,48,1,48,48,47);
  fade.addColorStop(0,'rgba(26,26,15,.42)');fade.addColorStop(.3,'rgba(27,32,17,.23)');
  fade.addColorStop(.7,'rgba(36,36,20,.09)');fade.addColorStop(1,'rgba(36,36,20,0)');
  ctx.fillStyle=fade;ctx.fillRect(0,0,96,96);
  const tex=new THREE.CanvasTexture(shade);tex.colorSpace=THREE.SRGBColorSpace;
  const shadowGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const shaded=new THREE.InstancedMesh(shadowGeo,new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),knots.length);
  shaded.name='Тень под деревьями';
  const pose=new THREE.Object3D();
  knots.forEach(({x,z,radius},i)=>{
    pose.position.set(x+.15,groundY+.009,z-.14);pose.scale.set(radius*2,1,radius*1.7);
    pose.updateMatrix();shaded.setMatrixAt(i,pose.matrix);
  });
  group.add(shaded);
  group.userData.walkTrunks=knots.map(({x,z,radius})=>({x,z,radius:radius*.1+.05}));
  return group;
}
