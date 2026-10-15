import type { ZeroBehavior } from '../state/params';
import { COUNTDOWN_TOKEN, parseMessage, parseSingle, type Slide } from './text';

/**
 * The slides to show. With a countdown, an empty message shows just the
 * countdown, and once it reaches zero `zero` decides what replaces the slides
 * that contain it: they stay (`freeze`), go (`hide`) or become its message.
 * `countdown` is null when the display has no countdown.
 */
export function activeSlides(message: string, countdown: { expired: boolean; zero: ZeroBehavior } | null): Slide[] {
  if (countdown && message.trim() === '') message = COUNTDOWN_TOKEN;
  const slides = parseMessage(message);
  if (!countdown || !countdown.expired) return slides;
  const zero = countdown.zero;
  if (zero.kind === 'freeze') return slides;
  if (slides.length === 1) {
    return zero.kind === 'hide' ? [] : [parseSingle(zero.message)];
  }
  if (zero.kind === 'hide') return slides.filter((sl) => !sl.hasCountdown);
  const replacement = parseSingle(zero.message);
  return slides.map((sl) => (sl.hasCountdown ? replacement : sl));
}
