import type { Transition } from '../state/params';

const SLIDE_TRANSITION_MS = 600;
/** Share of the interval a transition may take, so fast slides never overlap. */
const TRANSITION_SHARE = 0.4;
/** Shorter transitions than this are cut instead. */
const MIN_TRANSITION_MS = 50;

type Frames = [Keyframe[], Keyframe[]]; // incoming slide, outgoing slide

const TRANSITION_FRAMES: Record<Exclude<Transition, 'none'>, Frames> = {
  slide: [
    [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }],
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-100%)' }],
  ],
  up: [
    [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
    [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
  ],
  fade: [
    [{ opacity: 0 }, { opacity: 1 }],
    [{ opacity: 1 }, { opacity: 0 }],
  ],
  zoom: [
    [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }],
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.15)' }],
  ],
};

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface TransitionPlan {
  incoming: Keyframe[];
  outgoing: Keyframe[];
  duration: number; // ms
}

/** How to move between slides, or null to cut straight to the next one. */
export function planTransition(trans: Transition, intervalSeconds: number, reducedMotion: boolean): TransitionPlan | null {
  const duration = Math.min(SLIDE_TRANSITION_MS, intervalSeconds * 1000 * TRANSITION_SHARE);
  // Fading isn't movement, so it stands in for the moving transitions when
  // the viewer's system asks for reduced motion.
  const t = trans !== 'none' && reducedMotion ? 'fade' : trans;
  if (t === 'none' || duration < MIN_TRANSITION_MS) return null;
  const [incoming, outgoing] = TRANSITION_FRAMES[t];
  return { incoming, outgoing, duration };
}
