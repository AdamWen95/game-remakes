import * as T from 'three';

export const sun = new T.Vector3(-.46, .45, -.75).normalize();
const vertex = `
varying vec3 worldPoint;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  worldPoint = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const noise = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p);
  vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+1.0),u.x),u.y);
}
float fbm(vec2 p) {
  return .52*noise(p)+.25*noise(p*2.11)+.12*noise(p*4.13)+.065*noise(p*8.4);
}`;

export function createSeascape(scene: T.Scene) {
  const sky = new T.Mesh(new T.SphereGeometry(350, 32, 18), new T.ShaderMaterial({
    side: T.BackSide, depthWrite: false, vertexShader: vertex, uniforms: { sun: { value: sun } },
    fragmentShader: `
      varying vec3 worldPoint;
      uniform vec3 sun;
      ${noise}
      void main() {
        vec3 ray=normalize(worldPoint-cameraPosition);
        float h=max(0.0,ray.y);
        float facing=clamp(dot(ray,sun),0.0,1.0);
        vec3 color=mix(vec3(.47,.60,.64),vec3(.052,.20,.36),pow(h,.53));
        color+=vec3(.59,.25,.09)*pow(facing,8.0)*(.57+.43*(1.-h));
        vec2 cloudUV=ray.xz/(max(.085,ray.y)+.16)*4.4+vec2(8.2,12.6);
        float c=fbm(cloudUV+vec2(fbm(cloudUV*1.2),fbm(cloudUV*.44))*1.72);
        float wisps=fbm(cloudUV*vec2(.53,1.45)+5.0);
        float spread=smoothstep(.45,.72,c*.78+wisps*.22)*smoothstep(.012,.19,h);
        vec3 cloud=mix(vec3(.32,.42,.49),vec3(.98,.74,.51),pow(facing,.65))*(.8+.8*c);
        color=mix(color,cloud,spread*.85);
        color += vec3(1.8,1.25,.76)*pow(facing,210.0);
        color += vec3(8.0,6.0,4.1)*smoothstep(.99935,.99977,facing);
        gl_FragColor=vec4(color,1);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -8;
  const material = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, sun: { value: sun } }, vertexShader: vertex,
    fragmentShader: `
      varying vec3 worldPoint;
      uniform float time;
      uniform vec3 sun;
      ${noise}
      void main() {
        vec2 uv=worldPoint.xz;
        vec3 v=normalize(cameraPosition-worldPoint);
        float fade=1.-smoothstep(32.,190.,length(cameraPosition-worldPoint));
        float u=(uv.x*.96+uv.y*.52)*1.12+time*1.3;
        float t=(uv.x*-.38+uv.y*.9)*1.66-time*.87;
        float fractal=fbm(uv*.76+vec2(time*.14,-time*.24));
        vec3 n=normalize(vec3(.09*cos(u)+.058*sin(t)+.10*(fractal-.48),1.,.073*cos(t)+.063*cos(u)));
        float fresnel=pow(1.-max(0.,dot(n,v)),4.);
        vec3 color=mix(vec3(.026,.117,.156),vec3(.30,.43,.52),fresnel);
        color*=.81+.36*fractal;
        vec3 r=reflect(-sun,n);
        color+=vec3(1.,.68,.36)*pow(max(0.,dot(r,v)),32.)*1.25;
        float wake=(1.-smoothstep(0.2,5.8,abs(abs(uv.x)-15.4)))*smoothstep(-30.,14.,uv.y);
        color+=vec3(.18,.29,.30)*wake*smoothstep(.55,.8,fractal+.095*sin(t))*fade;
        color=mix(vec3(.48,.59,.61),color,.42+.58*fade);
        gl_FragColor=vec4(color,1);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sea = new T.Mesh(new T.PlaneGeometry(580, 580), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -5.25;
  scene.add(sky, sea);
  return (time: number) => { material.uniforms.time.value = time; };
}
