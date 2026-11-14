import * as THREE from 'three';
import { Track } from '../game/track';
import { CARS, type Race } from '../game/race';
import { createCar } from './car';
import { createScenery } from './scenery';

const up = new THREE.Vector3(0,1,0);
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(56,1,0.2,2200);
  private trackGroup = new THREE.Group();
  private cars: THREE.Group[] = [];
  private trail: THREE.InstancedMesh;
  private trailIndex = 0;
  private trailClock = 0;
  private dummy = new THREE.Object3D();
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private water?: THREE.Mesh;
  private look = new THREE.Vector3();
  private target = new THREE.Vector3();
  private position = new THREE.Vector3();
  private wasRacing = false;
  private quality: 'high'|'low' = 'high';
  private track!: Track;
  cameraMode = 0;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.add(new THREE.HemisphereLight(0xd4efff,0x657779,2.2));
    this.sun = new THREE.DirectionalLight(0xffe5bf,3.1);
    this.sun.position.set(-100,180,80); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024,1024);
    Object.assign(this.sun.shadow.camera,{ left:-42,right:42,top:42,bottom:-42,near:1,far:400 });
    this.sun.shadow.bias=-0.001; this.sun.shadow.normalBias=0.12;
    this.scene.add(this.sun,this.sun.target);
    const skyMaterial = new THREE.ShaderMaterial({
      side:THREE.BackSide, depthWrite:false,
      uniforms:{ top:{value:new THREE.Color(0x459fc2)}, bottom:{value:new THREE.Color(0xdaf2e9)} },
      vertexShader:'varying vec3 vPos; void main(){vPos=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; void main(){float h=clamp(normalize(vPos).y*1.5,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,pow(h,0.55)),1.0);}',
    });
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1800,24,12),skyMaterial); this.scene.add(this.sky);
    this.trail = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2,1.2),new THREE.MeshBasicMaterial({color:0x152b39,transparent:true,opacity:0.48,depthWrite:false}),300);
    this.trail.frustumCulled=false;
    this.clearTrails(); this.scene.add(this.trail);
    this.resize();
  }
  setQuality(value: 'high'|'low') {
    this.quality=value; this.renderer.shadowMap.enabled=value==='high'; this.resize();
  }
  resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,this.quality==='high'?1.6:1));
    this.renderer.setSize(innerWidth,innerHeight,false);
    this.camera.aspect=innerWidth/innerHeight; this.camera.updateProjectionMatrix();
  }
  setTrack(track: Track, car: number) {
    this.disposeGroup(this.trackGroup); this.scene.remove(this.trackGroup);
    this.trackGroup=new THREE.Group(); this.track=track; this.scene.add(this.trackGroup);
    const def=track.definition, night=def.id==='city';
    this.scene.fog=new THREE.Fog(def.fog,150,night?670:1000);
    const skyMat=this.sky.material as THREE.ShaderMaterial;
    skyMat.uniforms.top.value.setHex(def.sky); skyMat.uniforms.bottom.value.setHex(def.fog);
    this.sun.intensity=night?1.5:3.1; this.sun.color.setHex(night?0xb0bcff:0xffe7ca);
    this.renderer.toneMappingExposure=night?1.25:1.3;
    const floorMaterial=new THREE.MeshStandardMaterial({color:def.ground,roughness:0.58,metalness:def.id==='coast'?0.28:0.05});
    this.water=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),floorMaterial);
    this.water.rotation.x=-Math.PI/2; this.water.position.y=-0.4; this.water.receiveShadow=true;
    this.trackGroup.add(this.water);
    if (def.id==='coast') this.addWaterLines();
    this.addRoad(); this.trackGroup.add(createScenery(track)); this.addGates();
    this.setCars(car); this.clearTrails(); this.wasRacing=false;
  }
  setCars(index: number, race?: Race) {
    for (const car of this.cars) { this.scene.remove(car); this.disposeGroup(car); }
    const definitions=race?.racers || [{color:CARS[index].color}];
    this.cars=definitions.map((r,i)=>{
      const group=createCar(r.color,i===0?index:i%3);
      const shadow=new THREE.Mesh(new THREE.CircleGeometry(1,24),new THREE.MeshBasicMaterial({color:0x08212b,transparent:true,opacity:0.22,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2; shadow.scale.set(1.6,2.7,1); shadow.position.y=0.04; group.add(shadow);
      this.scene.add(group); return group;
    });
    this.clearTrails(); this.wasRacing=false;
  }
  private strip(d1: number,d2: number, height: number, color: number, alternating=false) {
    const verts:number[]=[], colors:number[]=[], indices:number[]=[];
    const steps=Math.ceil(this.track.length/2.8), a=new THREE.Color(color), b=new THREE.Color(0xf4f4e4);
    for (let i=0;i<=steps;i++) {
      const s=i/steps*this.track.length;
      const c=alternating && Math.floor(s/5)%2?b:a;
      for (const d of [d1,d2]) { const p=this.track.sample(s,d); verts.push(p.x,p.y+height,p.z); colors.push(c.r,c.g,c.b); }
      if (i<steps) { const n=i*2; indices.push(n,n+2,n+1,n+1,n+2,n+3); }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.85,side:THREE.DoubleSide}));
    mesh.receiveShadow=true; this.trackGroup.add(mesh);
  }
  private rail(lateral: number) {
    const positions:number[]=[], indices:number[]=[], steps=Math.ceil(this.track.length/4);
    for(let i=0;i<=steps;i++) {
      const p=this.track.sample(i/steps*this.track.length,lateral);
      positions.push(p.x,p.y+0.3,p.z,p.x,p.y+0.85,p.z);
      if(i<steps) {const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xd3eff1,metalness:0.6,roughness:0.4,side:THREE.DoubleSide,emissive:this.track.definition.accent,emissiveIntensity:this.track.definition.id==='city'?0.4:0.03}));
    this.trackGroup.add(mesh);
  }
  private addRoad() {
    const w=this.track.definition.width/2;
    this.strip(-w-2,w+2,-0.13,0xc6c5ae);
    this.strip(-w,w,0,this.track.definition.road);
    for (const side of [-1,1]) {
      this.strip(side*(w-0.95),side*w,0.025,this.track.definition.accent,true);
      this.strip(side*(w-1.5),side*(w-1.36),0.03,0xf0ecd4);
      this.rail(side*(w+0.25));
    }
    const count=Math.floor(this.track.length/12), dash=new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16,4.5),new THREE.MeshBasicMaterial({color:0xbacccf,transparent:true,opacity:0.5,side:THREE.DoubleSide}),count*2);
    let n=0;
    for(let i=0;i<count;i++) for(const d of [-w/3,w/3]) {
      const p=this.track.sample(i*12,d); this.dummy.position.set(p.x,p.y+0.04,p.z);this.dummy.rotation.set(-Math.PI/2,0,-p.yaw);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();dash.setMatrixAt(n++,this.dummy.matrix);
    }
    this.trackGroup.add(dash);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#183f57';ctx.fillRect(0,0,256,256);ctx.strokeStyle='#bfff4e';ctx.lineWidth=18;
    for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(30,60+i*80);ctx.lineTo(128,15+i*80);ctx.lineTo(226,60+i*80);ctx.stroke();}
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    for(const s of this.track.boosts){
      const p=this.track.sample(s),pad=new THREE.Mesh(new THREE.PlaneGeometry(11.5,9),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
      pad.position.set(p.x,p.y+0.06,p.z);pad.rotation.set(-Math.PI/2,0,-p.yaw);this.trackGroup.add(pad);
    }
  }
  private label(text: string, width: number, height: number) {
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#122b3c';ctx.fillRect(0,0,1024,192);ctx.fillStyle='#c5fc4c';ctx.fillRect(0,176,1024,16);
    ctx.font='italic 900 91px Arial';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText(text,512,125);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.BoxGeometry(width,height,0.5),new THREE.MeshStandardMaterial({map:texture,roughness:0.5,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:0.25}));
  }
  private addGates() {
    const width=this.track.definition.width;
    const p=this.track.sample(0), group=new THREE.Group();group.position.set(p.x,p.y,p.z);group.rotation.y=p.yaw;
    const material=new THREE.MeshStandardMaterial({color:0x1e4156,metalness:0.35,roughness:0.5});
    for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.BoxGeometry(0.65,9,1),material);post.position.set(side*(width/2+1),4.5,0);group.add(post);}
    const banner=this.label('APEX  /  RUSH',width+3,2.6);banner.position.y=8;group.add(banner);this.trackGroup.add(group);
    const tile=new THREE.InstancedMesh(new THREE.PlaneGeometry(width/12,1.4),new THREE.MeshBasicMaterial({vertexColors:false,side:THREE.DoubleSide}),36);
    const white=new THREE.Color(0xf4f8ed),black=new THREE.Color(0x162d3b);
    for(let row=0;row<3;row++)for(let col=0;col<12;col++){
      this.dummy.position.set((col-5.5)*width/12,0.05,(row-1)*1.4);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();tile.setMatrixAt(row*12+col,this.dummy.matrix);tile.setColorAt(row*12+col,(row+col)%2?white:black);
    }
    group.add(tile);
    for(const f of [0.28,0.61,0.89]){
      const s=this.track.sample(this.track.length*f,-width/2-3), sign=this.label('»  KEEP GOING  »',13,2.5);
      sign.position.set(s.x,s.y+3.5,s.z);sign.rotation.y=s.yaw;this.trackGroup.add(sign);
    }
  }
  private addWaterLines() {
    const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:0xaff6e6,transparent:true,opacity:0.16,depthWrite:false}),160);
    for(let i=0;i<160;i++){
      this.dummy.position.set(Math.sin(i*456.7)*900,-0.3,Math.cos(i*123.8)*900);this.dummy.rotation.set(-Math.PI/2,0,0);this.dummy.scale.set(4+(i%7)*3,0.22,1);this.dummy.updateMatrix();mesh.setMatrixAt(i,this.dummy.matrix);
    }this.trackGroup.add(mesh);
  }
  private clearTrails() {
    this.dummy.scale.set(0,0,0);this.dummy.updateMatrix();
    for(let i=0;i<300;i++)this.trail.setMatrixAt(i,this.dummy.matrix);
    this.trail.instanceMatrix.needsUpdate=true;this.trailIndex=0;
  }
  update(dt: number, time: number, race: Race|null) {
    if(!this.track || !this.cars.length)return;
    const racing=!!race;
    for(let i=0;i<this.cars.length;i++){
      const state=race?.racers[i],s=state?.s??27,d=state?.d??0;
      const p=this.track.sample(s,d),car=this.cars[i];
      car.position.set(p.x,p.y+0.13,p.z);car.rotation.set(0,p.yaw+(state?.slide??0),-(state?.slide??0)*0.06);
      const ahead=this.track.sample(s+2),behind=this.track.sample(s-2);car.rotation.x=-Math.atan2(ahead.y-behind.y,4);
      for(const wheel of car.userData.wheels as THREE.Group[])wheel.rotation.x+=(state?.speed??0)*dt*2.5;
      for(const wheel of car.userData.frontWheels as THREE.Group[])wheel.rotation.y=(state?.slide??0)*0.5;
      for(const flame of car.userData.flames as THREE.Group[]){flame.visible=!!state && state.boost>0;flame.scale.z=1+Math.sin(time*45)*0.2;}
    }
    const p=this.cars[0].position,yaw=this.track.sample(race?.player.s??27).yaw;
    const forward=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
    if(racing){
      const speed=race.player.speed,portrait=innerHeight>innerWidth,far=this.cameraMode===1 || portrait;
      this.position.copy(p).addScaledVector(forward,-(far?13:8.8)-speed*0.025);this.position.y+=far?7.2:4.7;
      const ahead=this.track.sample(race.player.s+(portrait?9:18),race.player.d*0.6);
      this.target.set(ahead.x,ahead.y+1.3,ahead.z);
      const fov=(portrait?70:56)+Math.min(9,speed*0.1)+(race.player.boost>0?8:0);
      this.camera.fov+=(fov-this.camera.fov)*Math.min(1,dt*3);
      if(race.driftTime>0 && race.phase==='racing'){
        this.trailClock+=dt;
        if(this.trailClock>0.035){this.trailClock=0;for(const offset of [-0.95,0.95]){
          const pos=this.track.sample(race.player.s-1.8,race.player.d+offset);
          this.dummy.position.set(pos.x,pos.y+0.055,pos.z);this.dummy.rotation.set(-Math.PI/2,0,-yaw);this.dummy.scale.set(1,1,1);this.dummy.updateMatrix();this.trail.setMatrixAt(this.trailIndex++%300,this.dummy.matrix);
        }this.trail.instanceMatrix.needsUpdate=true;}
      }
    }else{
      const orbit=Math.sin(time*0.12)*0.5;
      this.position.copy(p).addScaledVector(forward,8.5+orbit).addScaledVector(right,7.5);this.position.y+=4;
      this.target.copy(p).addScaledVector(right,innerWidth>760?-3.2:0);this.target.y+=0.6;
      this.camera.fov=innerWidth>760?44:55;
    }
    const smooth=this.wasRacing!==racing || dt===0?1:1-Math.exp(-dt*7);
    this.camera.position.lerp(this.position,smooth);this.look.lerp(this.target,smooth);this.camera.up.copy(up);this.camera.lookAt(this.look);this.camera.updateProjectionMatrix();
    this.wasRacing=racing;this.sky.position.copy(this.camera.position);
    this.sun.position.copy(p).add(new THREE.Vector3(-50,100,40));this.sun.target.position.copy(p);
    this.renderer.render(this.scene,this.camera);
  }
  private disposeGroup(group: THREE.Group) {
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    group.traverse(object=>{if(object instanceof THREE.InstancedMesh)object.dispose();if(object instanceof THREE.Mesh){geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
  }
}
