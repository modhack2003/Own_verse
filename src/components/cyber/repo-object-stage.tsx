'use client';

/**
 * The single WebGL host for the projects showcase.
 *
 * One renderer, created once and kept alive; only the scene *contents* are swapped when the active
 * repository changes, so cycling every card cannot grow the context count, the RAF loops or the
 * listeners. The canvas is decorative and inert: `aria-hidden`, `pointer-events-none`, and not a
 * single pointer/touch/wheel listener anywhere, so a vertical swipe over the card always scrolls the
 * page and a click always reaches the link beneath.
 *
 * Note for AC8: React Strict Mode double-invokes the mount effect in development, so you may briefly
 * see a renderer constructed, disposed and constructed again. That is the cleanup working, not a leak.
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EXPERIENCE_EVENT, getExperienceMode, type ExperienceMode } from './experience-gate';
import type { ObjectKind } from './repo-object-kind';
import { FOV, MAX_DPR, type BuiltObject, createBuildContext, disposeObject, frameObject } from './repo-object-kit';
import { buildObject } from './repo-object-registry';

export type StageStatus = 'live' | 'fallback';

export interface RepoObjectStageProps {
  kind: ObjectKind;
  accent: string;
  className?: string;
  /** held in a ref, never an effect dependency, so an unstable callback cannot rebuild the object */
  onStatus?: (status: StageStatus) => void;
}

interface StageState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  built: BuiltObject | null;
  kind: ObjectKind | null;
  accent: string;
  raf: number;
  time: number;
  visible: boolean;
  crashed: boolean;
  /** true between `webglcontextlost` and `webglcontextrestored`; rendering is a silent no-op then */
  lost: boolean;
  aspect: number;
}

interface StageApi {
  swap: (kind: ObjectKind, accent: string) => void;
}

function safeMode(): ExperienceMode {
  try {
    return getExperienceMode() ?? 'safe';
  } catch {
    return 'glitch';
  }
}

export function RepoObjectStage({ kind, accent, className, onStatus }: RepoObjectStageProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<StageState | null>(null);
  const apiRef = useRef<StageApi | null>(null);
  const statusRef = useRef<RepoObjectStageProps['onStatus']>(undefined);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    statusRef.current = onStatus;
  }, [onStatus]);

  // Anything that can change *whether* WebGL should run only bumps `epoch`; the effect below stays
  // the single place a renderer is ever constructed, which is what bounds the context count at one.
  useEffect(() => {
    const bump = () => setEpoch((e) => e + 1);
    window.addEventListener(EXPERIENCE_EVENT, bump);
    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    mql?.addEventListener?.('change', bump);
    return () => {
      window.removeEventListener(EXPERIENCE_EVENT, bump);
      mql?.removeEventListener?.('change', bump);
    };
  }, []);

  // Renderer lifetime.
  useEffect(() => {
    void epoch; // re-runs when safe mode / reduced motion flips, so the two paths can swap live
    const mount = mountRef.current;
    if (!mount) return;
    const status = (s: StageStatus) => statusRef.current?.(s);

    // Safe mode and prefers-reduced-motion both degrade to the untouched activity grid — the
    // zero-regression fallback. Safe mode takes precedence when both are set.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (safeMode() === 'safe' || reduce) {
      status('fallback');
      return;
    }
    if (stateRef.current) return; // never a second renderer

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      status('fallback');
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    mount.appendChild(canvas);

    const state: StageState = {
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(FOV, 1, 0.1, 100),
      clock: new THREE.Clock(),
      built: null,
      kind: null,
      accent: '#1fd6c6',
      raf: 0,
      time: 0,
      visible: true,
      crashed: false,
      lost: false,
      aspect: 1,
    };
    stateRef.current = state;
    let running = false;

    const stop = () => {
      if (!running) return;
      running = false;
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    };

    const drop = () => {
      if (!state.built) return;
      state.scene.remove(state.built.group);
      disposeObject(state.built.group);
      state.built = null;
    };

    const crash = (error: unknown) => {
      if (state.crashed) return;
      state.crashed = true;
      console.error('repo 3D object crashed', error);
      stop();
      drop();
      status('fallback');
    };

    const tick = () => {
      state.raf = requestAnimationFrame(tick);
      const dt = Math.min(state.clock.getDelta(), 0.05);
      state.time += dt;
      try {
        state.built?.update(state.time, dt, false);
        state.renderer.render(state.scene, state.camera);
      } catch (error) {
        crash(error);
      }
    };

    const start = () => {
      if (running || state.crashed || state.lost || !state.built) return;
      running = true;
      state.clock.getDelta(); // drop the accumulated gap so dt cannot spike on resume
      state.raf = requestAnimationFrame(tick);
    };

    const renderOnce = () => {
      if (!state.built || state.crashed || state.lost) return;
      try {
        state.built.update(state.time, 0, !running);
        state.renderer.render(state.scene, state.camera);
      } catch (error) {
        crash(error);
      }
    };

    // Sized from the container's measured box, never from `window`.
    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      // Re-read the DPR here too: dragging the window to a display of a different density fires a
      // resize but not an epoch bump, and a ratio sampled only at construction would stay stale.
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
      state.renderer.setSize(w, h, false);
      state.aspect = w / h;
      if (state.built) frameObject(state.built, state.camera, state.aspect);
      else {
        state.camera.aspect = state.aspect;
        state.camera.updateProjectionMatrix();
      }
      renderOnce();
    };

    const swap = (nextKind: ObjectKind, nextAccent: string) => {
      if (state.crashed) return;
      // Recorded before the lost-context guard, so `onRestored` rebuilds whatever the user selected
      // while the context was down rather than the repo that was showing when it died.
      state.kind = nextKind;
      state.accent = nextAccent;
      // While the context is lost `render()` silently no-ops, so reporting 'live' here would fade the
      // activity grid out over an empty slot. Stay in the fallback until the context comes back.
      if (state.lost) return;
      drop();
      const result = buildObject(nextKind, createBuildContext(nextAccent));
      if (!result) {
        stop();
        status('fallback');
        return;
      }
      state.built = result.built;
      state.scene.add(result.built.group);
      frameObject(result.built, state.camera, state.aspect);
      status('live');
      if (state.visible && !document.hidden) start();
      else renderOnce();
    };
    apiRef.current = { swap };

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(mount);
    const onWindowResize = ro ? null : resize;
    if (onWindowResize) window.addEventListener('resize', onWindowResize);

    const sync = () => {
      if (state.visible && !document.hidden) start();
      else stop();
    };
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              state.visible = entry.isIntersecting;
              sync();
            },
            { rootMargin: '120px' }
          )
        : null;
    io?.observe(mount); // absent IO -> treated as permanently visible
    document.addEventListener('visibilitychange', sync);

    const onLost = (event: Event) => {
      event.preventDefault(); // asks for restoration; not guaranteed, hence the `lost` flag
      console.warn(`repo 3D object lost its WebGL context (kind: ${state.kind ?? 'none'})`);
      state.lost = true;
      stop();
      status('fallback');
    };
    const onRestored = () => {
      state.lost = false;
      state.crashed = false;
      if (state.kind) swap(state.kind, state.accent);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    resize();

    return () => {
      stop();
      ro?.disconnect();
      if (onWindowResize) window.removeEventListener('resize', onWindowResize);
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      drop();
      // Hand the context back immediately instead of waiting on GC, so a remount can never be the
      // thing that pushes the page past the browser's context cap. Safe after the listeners above
      // are removed: the synthetic loss event this fires has nobody left to handle it.
      state.renderer.forceContextLoss();
      state.renderer.dispose();
      canvas.remove();
      apiRef.current = null;
      stateRef.current = null;
    };
  }, [epoch]);

  // Object swap. Runs after the effect above on the same commit, and no-ops while no renderer exists.
  useEffect(() => {
    void epoch;
    apiRef.current?.swap(kind, accent);
  }, [epoch, kind, accent]);

  return <div ref={mountRef} className={className} aria-hidden />;
}
