'use client';

import { useEffect, useRef, useState } from 'react';
import { sharinganSound } from '@/lib/site-audio-library';
import * as THREE from 'three';
import { EXPERIENCE_EVENT, getExperienceMode, type ExperienceMode } from './experience-gate';

/* -------------------------------------------------------------------------- */
/* Shaders                                                                     */
/* -------------------------------------------------------------------------- */
const eyeVertex = /* glsl */ `
uniform float uTime;
uniform float uGlitch;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;
void main() {
  vObj = normalize(position);
  vec3 p = position;
  float slice = step(0.975, fract(sin(floor(p.y * 16.0) * 91.7 + floor(uTime * 10.0)) * 43758.5453));
  p.x += slice * uGlitch * 0.16;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vV = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const eyeFragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSpin;
uniform float uPupil;
uniform float uMange;
uniform float uBlink;
uniform float uGlitch;
uniform vec3 uRed;
uniform vec3 uDeep;
uniform vec3 uInk;
uniform vec3 uRim;
varying vec3 vObj;
varying vec3 vN;
varying vec3 vV;

#define PI 3.14159265
#define TAU 6.28318530

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float wrapA(float a) { return mod(a + PI, TAU) - PI; }

// three tomoe (comma marks) travelling on the inner ring
float tomoe(vec2 uv, float spin) {
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float m = 0.0;
  for (int k = 0; k < 3; k++) {
    float th = spin + float(k) * TAU / 3.0;
    vec2 c = 0.52 * vec2(cos(th), sin(th));
    float head = 1.0 - smoothstep(0.098, 0.11, length(uv - c));
    float d = wrapA(th - a);
    float L = 1.05;
    float t = clamp(d / L, 0.0, 1.0);
    float inRange = step(0.0, d) * step(d, L);
    float cr = 0.52 + 0.075 * t * t;
    float hw = 0.1 * pow(1.0 - t, 1.3);
    float tail = inRange * (1.0 - smoothstep(hw - 0.012, hw, abs(r - cr)));
    m = max(m, max(head, tail));
  }
  return m;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec2 uv = vObj.xy / 0.62; // iris radius = 62% of the eyeball
  float r = length(uv);
  float a = atan(uv.y, uv.x);

  // sclera: dark glossy with faint veins
  float key = max(dot(N, normalize(vec3(-0.4, 0.6, 1.0))), 0.0);
  vec3 col = uInk * (0.5 + 0.5 * key);
  float veins = smoothstep(0.74, 0.96, noise(vec2(a * 7.0, r * 5.0) + 3.0)) * smoothstep(1.0, 1.5, r);
  col += uDeep * veins * 0.35;

  if (vObj.z > 0.0 && r < 1.03) {
    float fib = noise(vec2(a * 30.0, r * 4.0)) * 0.55 + noise(vec2(a * 64.0, r * 10.0)) * 0.3;
    vec3 iris = mix(uRed * 1.2, uDeep, smoothstep(0.2, 1.0, r));
    iris *= 0.72 + 0.5 * fib;
    iris += uRed * 0.4 * (1.0 - smoothstep(0.18, 0.5, r));
    col = mix(col, iris, 1.0 - smoothstep(0.985, 1.0, r));

    // outer (limbal) ring
    float limbal = smoothstep(0.9, 0.95, r) * (1.0 - smoothstep(1.0, 1.03, r));
    col = mix(col, uInk * 0.2, limbal);

    // inner ring the tomoe ride on
    float ring = 1.0 - smoothstep(0.011, 0.021, abs(r - 0.52));
    col = mix(col, uInk * 0.12, ring * (1.0 - uMange));

    // tomoe -> mangekyo pinwheel
    float tm = tomoe(uv, uSpin);
    float s = fract((a + 2.6 * r - uSpin * 0.8) / TAU * 3.0);
    float blade = (1.0 - smoothstep(0.23, 0.29, s)) * smoothstep(0.1, 0.18, r) * (1.0 - smoothstep(0.84, 0.9, r));
    col = mix(col, uInk * 0.08, mix(tm, blade, uMange));

    // pupil
    col = mix(col, vec3(0.0), 1.0 - smoothstep(uPupil - 0.012, uPupil + 0.012, r));
  }

  // rim light
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.4);
  col += uRim * fres * 0.8;

  // glitch bands
  float sl = step(0.986, fract(sin(floor(vObj.y * 40.0) * 78.2 + floor(uTime * 12.0)) * 43758.5453));
  col = mix(col, vec3(col.r * 0.2, col.g + 0.45, col.b + 0.45), sl * uGlitch);

  // eyelids (blink)
  if (uBlink > 0.001 && vObj.z > -0.2) {
    float open = 1.0 - uBlink;
    float lidY = abs(vObj.y) / max(0.001, 1.0 - 0.3 * vObj.x * vObj.x);
    float lid = smoothstep(open - 0.03, open + 0.03, lidY);
    col = mix(col, uInk * 0.55, lid);
  }

  col *= 0.95 + 0.05 * sin(vObj.y * 190.0 + uTime * 6.0);
  gl_FragColor = vec4(col, 1.0);
}`;

const corneaVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
void main() {
  vObj = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const corneaFragment = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vV;
varying vec3 vObj;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 H1 = normalize(normalize(vec3(-0.55, 0.65, 1.0)) + V);
  vec3 H2 = normalize(normalize(vec3(0.6, -0.35, 1.0)) + V);
  float spec = pow(max(dot(N, H1), 0.0), 220.0) * 1.3 + pow(max(dot(N, H2), 0.0), 45.0) * 0.22;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.28;
  float front = smoothstep(0.0, 0.35, vObj.z);
  gl_FragColor = vec4(vec3(1.0), clamp((spec + fres) * front, 0.0, 1.0));
}`;

const shadowFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uInk;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(uInk, (1.0 - smoothstep(0.25, 1.0, d)) * 0.55);
}`;

/* -------------------------------------------------------------------------- */
/* Tomoe shape for the orbiting 3D marks                                       */
/* -------------------------------------------------------------------------- */
function tomoeShape() {
  const s = new THREE.Shape();
  s.moveTo(-1, 0);
  s.absarc(0, 0, 1, Math.PI, -Math.PI / 2, true);
  s.quadraticCurveTo(-0.3, -2.1, -2.3, -1.4);
  s.quadraticCurveTo(-1.5, -0.9, -1, 0);
  return s;
}

/* -------------------------------------------------------------------------- */
/* Static SVG fallback (no WebGL)                                              */
/* -------------------------------------------------------------------------- */
export function SharinganSvg({ className }: { className?: string }) {
  const tomoe = 'M -1 0 A 1 1 0 1 1 0 1 Q -0.3 2.1 -2.3 1.4 Q -1.5 0.9 -1 0 Z';
  return (
    <svg viewBox="-10 -10 20 20" className={className} aria-hidden>
      <defs>
        <radialGradient id="sg-iris">
          <stop offset="0%" stopColor="#ff3b30" />
          <stop offset="70%" stopColor="#c20000" />
          <stop offset="100%" stopColor="#5a0000" />
        </radialGradient>
      </defs>
      <circle r="9.6" fill="#12141c" />
      <circle r="6" fill="url(#sg-iris)" stroke="#07080b" strokeWidth="0.55" />
      <circle r="3.12" fill="none" stroke="#07080b" strokeWidth="0.14" />
      <g className="origin-center animate-spin-slow">
        {[0, 120, 240].map((deg) => (
          <g key={deg} transform={`rotate(${deg}) translate(3.12 0) scale(0.62)`}>
            <path d={tomoe} fill="#07080b" />
          </g>
        ))}
      </g>
      <circle r="1.25" fill="#000" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* 3D Sharingan                                                                */
/* -------------------------------------------------------------------------- */
export function SharinganEye({ className }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      setFailed(true);
      return;
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode: ExperienceMode = getExperienceMode() ?? 'safe';

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.cursor = 'crosshair';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    const INK = new THREE.Color('#12141c');
    const BONE = new THREE.Color('#e9e2d0');
    const CYAN = new THREE.Color('#1fd6c6');

    const root = new THREE.Group();
    scene.add(root);

    /* soft shadow disc behind the eye */
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(6.5, 6.5),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uInk: { value: INK } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: shadowFragment,
      })
    );
    shadow.position.z = -1.8;
    root.add(shadow);

    /* eyeball */
    const eye = new THREE.Group();
    root.add(eye);
    const eyeUniforms = {
      uTime: { value: 0 },
      uSpin: { value: 0 },
      uPupil: { value: 0.2 },
      uMange: { value: 0 },
      uBlink: { value: 0 },
      uGlitch: { value: 0 },
      uRed: { value: new THREE.Color('#e3140f') },
      uDeep: { value: new THREE.Color('#4a0303') },
      uInk: { value: INK },
      uRim: { value: CYAN },
    };
    const R = 1.45;
    eye.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(R, 96, 96),
        new THREE.ShaderMaterial({ vertexShader: eyeVertex, fragmentShader: eyeFragment, uniforms: eyeUniforms })
      )
    );
    const cornea = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.02, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: corneaVertex,
        fragmentShader: corneaFragment,
        transparent: true,
        depthWrite: false,
      })
    );
    eye.add(cornea);

    /* HUD orbit rings with tick marks */
    const rings: THREE.Object3D[] = [];
    const ringDefs = [
      { r: 2.35, tilt: [0, 0, 0], color: INK, ticks: 96, width: 0.014 },
      { r: 2.75, tilt: [1.25, 0.25, 0], color: BONE, ticks: 48, width: 0.008 },
      { r: 3.15, tilt: [1.55, -0.6, 0.8], color: INK, ticks: 72, width: 0.012 },
    ];
    ringDefs.forEach((d, idx) => {
      const g = new THREE.Group();
      g.add(
        new THREE.Mesh(
          new THREE.TorusGeometry(d.r, d.width, 6, 220),
          new THREE.MeshBasicMaterial({ color: d.color, transparent: true, opacity: idx === 1 ? 0.8 : 0.9 })
        )
      );
      const pts: number[] = [];
      for (let i = 0; i < d.ticks; i++) {
        const ang = (i / d.ticks) * Math.PI * 2;
        const len = i % 6 === 0 ? 0.2 : 0.07;
        pts.push(Math.cos(ang) * d.r, Math.sin(ang) * d.r, 0, Math.cos(ang) * (d.r + len), Math.sin(ang) * (d.r + len), 0);
      }
      g.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
          new THREE.LineBasicMaterial({ color: d.color })
        )
      );
      const sat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshBasicMaterial({ color: idx === 1 ? CYAN : BONE }));
      sat.position.set(d.r, 0, 0);
      g.add(sat);
      g.rotation.set(d.tilt[0], d.tilt[1], d.tilt[2]);
      root.add(g);
      rings.push(g);
    });

    /* orbiting 3D tomoe */
    const tomoeGeo = new THREE.ExtrudeGeometry(tomoeShape(), {
      depth: 0.35,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 2,
      curveSegments: 24,
    });
    tomoeGeo.center();
    const marks: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(
        tomoeGeo,
        new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? CYAN : INK, wireframe: i % 3 === 0 })
      );
      const s = 0.07 + (i % 3) * 0.025;
      m.scale.setScalar(s);
      const a = (i / 9) * Math.PI * 2;
      m.userData = { a, rad: 3.7 + (i % 3) * 0.45, speed: 0.12 + (i % 4) * 0.05, y: (Math.random() - 0.5) * 2.6 };
      marks.push(m);
      scene.add(m);
    }

    /* dust */
    const COUNT = window.innerWidth < 768 ? 500 : 1200;
    const pPos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const rr = 3.6 + Math.random() * 4.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pPos[i * 3] = rr * Math.sin(ph) * Math.cos(th);
      pPos[i * 3 + 1] = rr * Math.sin(ph) * Math.sin(th) * 0.6;
      pPos[i * 3 + 2] = rr * Math.cos(ph);
    }
    const particles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pPos, 3)),
      new THREE.PointsMaterial({ color: INK, size: 0.035, transparent: true, opacity: 0.75 })
    );
    scene.add(particles);

    /* sizing */
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = w / h < 0.8 ? 9 : 7.2;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* interaction: the eye follows the pointer */
    const look = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      look.x = THREE.MathUtils.clamp((e.clientX - cx) / (window.innerWidth * 0.5), -1, 1);
      look.y = THREE.MathUtils.clamp((e.clientY - cy) / (window.innerHeight * 0.5), -1, 1);
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    let scroll = 0;
    const onScroll = () => {
      scroll = Math.min(window.scrollY / window.innerHeight, 2);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    const onMode = (e: Event) => {
      mode = (e as CustomEvent<ExperienceMode>).detail;
    };
    window.addEventListener(EXPERIENCE_EVENT, onMode);

    /* click / tap: spin burst + Mangekyō */
    let burst = 0;
    let mangeUntil = 0;
    const onActivate = () => {
      if (performance.now() >= mangeUntil) sharinganSound('mangekyo');
      burst = 1;
      mangeUntil = performance.now() + 3500;
    };
    mount.addEventListener('pointerdown', onActivate);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(mount);

    /* loop */
    const clock = new THREE.Clock();
    let raf = 0;
    let glitchPulse = 0;
    let nextBlink = performance.now() + 2500;
    let blinkStart = -1;
    let nextIdleBurst = performance.now() + 9000;
    let wasMangekyo = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const now = performance.now();
      const dt = Math.min(clock.getDelta(), 0.05);
      const calm = mode === 'safe' || reduceMotion;
      const t = (eyeUniforms.uTime.value += dt * (calm ? 0.5 : 1));

      // idle activation in glitch mode
      if (!calm && now > nextIdleBurst) {
        burst = Math.max(burst, 0.6);
        nextIdleBurst = now + 8000 + Math.random() * 6000;
      }
      burst *= calm ? 0.94 : 0.965;

      // tomoe spin + pupil
      const spinSpeed = (calm ? 0.35 : 0.7) + burst * (calm ? 3 : 11);
      eyeUniforms.uSpin.value -= dt * spinSpeed;
      const pupilTarget = 0.2 - burst * 0.06 + Math.min(scroll, 1) * 0.05;
      eyeUniforms.uPupil.value += (pupilTarget - eyeUniforms.uPupil.value) * 0.12;
      const mangeTarget = now < mangeUntil ? 1 : 0;
      if (!mangeTarget && wasMangekyo) sharinganSound('sharingan');
      wasMangekyo = !!mangeTarget;
      eyeUniforms.uMange.value += (mangeTarget - eyeUniforms.uMange.value) * 0.08;

      // blink
      if (blinkStart < 0 && now > nextBlink) blinkStart = now;
      if (blinkStart >= 0) {
        const p = (now - blinkStart) / 220;
        eyeUniforms.uBlink.value = p < 0.5 ? p * 2 : Math.max(0, 2 - p * 2);
        if (p >= 1) {
          blinkStart = -1;
          eyeUniforms.uBlink.value = 0;
          nextBlink = now + 3500 + Math.random() * 4500;
        }
      }

      // glitch
      if (!calm && Math.random() < 0.01) glitchPulse = 1;
      glitchPulse *= 0.9;
      eyeUniforms.uGlitch.value = calm ? 0 : glitchPulse;

      // gaze follows the pointer
      const targetY = look.x * 0.55;
      const targetX = look.y * 0.4 + scroll * 0.25;
      eye.rotation.y += (targetY - eye.rotation.y) * 0.08;
      eye.rotation.x += (targetX - eye.rotation.x) * 0.08;

      // whole rig drifts
      root.rotation.y += (look.x * 0.12 + scroll * 0.6 - root.rotation.y) * 0.04;
      root.position.y = Math.sin(t * 0.9) * 0.07 + scroll * 0.6;

      rings.forEach((r, i) => {
        r.rotation.z += dt * (calm ? 0.35 : 1) * (0.15 + i * 0.1 + burst * 1.5) * (i % 2 ? -1 : 1);
      });
      particles.rotation.y = t * 0.03;

      marks.forEach((m) => {
        const u = m.userData as { a: number; rad: number; speed: number; y: number };
        const ang = u.a + t * u.speed * (1 + burst * 3);
        m.position.set(Math.cos(ang) * u.rad, u.y + Math.sin(t * u.speed * 3 + u.a) * 0.25, Math.sin(ang) * u.rad * 0.55);
        m.rotation.z = -ang * 2;
        m.rotation.y = Math.sin(t + u.a) * 0.6;
      });

      camera.position.x = glitchPulse * (Math.random() - 0.5) * 0.12;
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(EXPERIENCE_EVENT, onMode);
      mount.removeEventListener('pointerdown', onActivate);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={mountRef} className={className} aria-hidden>
      {failed && (
        <div className="flex h-full w-full items-center justify-center p-10">
          <SharinganSvg className="h-full max-h-80 w-full" />
        </div>
      )}
    </div>
  );
}
