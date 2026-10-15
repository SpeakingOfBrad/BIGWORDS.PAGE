import type { Transition } from '../state/params';

const SLIDE_TRANSITION_MS = 600;
/** Share of the interval a transition may take, so fast slides never overlap. */
const TRANSITION_SHARE = 0.4;
/** Shorter transitions than this are cut instead. */
const MIN_TRANSITION_MS = 50;

type Frames = [Keyframe[], Keyframe[]]; // incoming slide, outgoing slide

const FIXED_FRAMES: Record<'fade' | 'zoom', Frames> = {
  fade: [
    [{ opacity: 0 }, { opacity: 1 }],
    [{ opacity: 1 }, { opacity: 0 }],
  ],
  zoom: [
    [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }],
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.15)' }],
  ],
};

const moving = (axis: 'X' | 'Y', px: number): Frames => [
  [{ transform: `translate${axis}(${px}px)` }, { transform: `translate${axis}(0)` }],
  [{ transform: `translate${axis}(0)` }, { transform: `translate${axis}(${-px}px)` }],
];

/** Where a slide's text is, in px from the display's top left corner. */
export interface Extent {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far the moving transitions travel, in px. */
export interface Travel {
  x: number;
  y: number;
}

/**
 * The travel that starts the incoming slide wholly past the display's right
 * (or bottom) edge and ends the outgoing one wholly past its left (or top)
 * edge. Both slides move the same distance, so they stay together like one
 * strip. `width` and `height` are the display's size.
 */
export function slideTravel(width: number, height: number, incoming: Extent, outgoing: Extent): Travel {
  // A pixel more, so antialiased edges don't leave a sliver behind.
  return {
    x: Math.ceil(Math.max(width - incoming.left, outgoing.right, 0)) + 1,
    y: Math.ceil(Math.max(height - incoming.top, outgoing.bottom, 0)) + 1,
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export interface TransitionPlan {
  incoming: Keyframe[];
  outgoing: Keyframe[];
  duration: number; // ms
}

/** How to move between slides, or null to cut straight to the next one. */
export function planTransition(trans: Transition, intervalSeconds: number, reducedMotion: boolean, travel: Travel): TransitionPlan | null {
  const duration = Math.min(SLIDE_TRANSITION_MS, intervalSeconds * 1000 * TRANSITION_SHARE);
  // Fading isn't movement, so it stands in for the moving transitions when
  // the viewer's system asks for reduced motion.
  const t = trans !== 'none' && reducedMotion ? 'fade' : trans;
  if (t === 'none' || duration < MIN_TRANSITION_MS) return null;
  const [incoming, outgoing] = t === 'slide' ? moving('X', travel.x) : t === 'up' ? moving('Y', travel.y) : FIXED_FRAMES[t];
  return { incoming, outgoing, duration };
}
