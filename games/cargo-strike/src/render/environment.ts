import * as THREE from 'three';
export function environment(scene: THREE.Scene) {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(650, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
        vertexShader: `varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `varying vec3 v;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(v);float h=max(d.y,0.);vec3 c=mix(vec3(.74,.79,.78),vec3(.23,.43,.56),pow(h,.48));
    vec2 p=d.xz/max(.12,d.y+.16)*2.2;float n=noise(p)*.55+noise(p*2.1)*.25+noise(p*4.2)*.13+noise(p*8.4)*.07;
    float cloud=smoothstep(.45,.69,n)*smoothstep(0.,.25,d.y);c=mix(c,vec3(.94,.92,.84),cloud*.85);
    float sun=pow(max(0.,dot(d,normalize(vec3(-.5,.7,-.35)))),180.);c+=vec3(1.,.82,.57)*sun*.5;gl_FragColor=vec4(c,1.);}` }));
    scene.add(sky);
    const seaMat = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 } },
        vertexShader: `varying vec3 p;uniform float time;void main(){vec3 q=position;q.z+=sin(q.x*.12+time*.6)*.18+sin(q.y*.18+time*.8)*.12;p=q;gl_Position=projectionMatrix*modelViewMatrix*vec4(q,1.);}`,
        fragmentShader: `varying vec3 p;uniform float time;
    float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
    float wave(vec2 q){return noise(q*.12+time*.07)*.7+noise(q*.42-time*.11)*.22+noise(q*1.6+time*.17)*.08;}
    void main(){vec2 q=p.xy;float n=wave(q);vec3 normal=normalize(vec3((n-wave(q+vec2(.3,0)))*3.,1.,(n-wave(q+vec2(0,.3)))*3.));
    float highlight=pow(max(0.,dot(normal,normalize(vec3(-.4,1.,-.3)))),70.);
    vec3 c=mix(vec3(.06,.17,.20),vec3(.25,.39,.40),n);c+=vec3(.37,.38,.31)*highlight;
    c=mix(c,vec3(.53,.63,.65),smoothstep(75.,570.,length(q)));gl_FragColor=vec4(c,1.);}` });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1300, 1300, 100, 100), seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -3;
    scene.add(sea);
    return { update: (time: number) => { seaMat.uniforms.time.value = time; } };
}
