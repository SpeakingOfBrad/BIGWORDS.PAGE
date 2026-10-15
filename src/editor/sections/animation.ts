import { h } from '../../chrome';
import { ANIMATIONS, SPEEDS } from '../../state/params';
import { group, label, options, row, uid, type EditorContext } from '../context';
import { animationAdvice } from '../model';

const ANIM_LABELS: Record<string, string> = {
  none: 'None',
  pulse: 'Pulse',
  flash: 'Flash',
  shake: 'Shake',
  bounce: 'Bounce',
  scroll: 'Scroll (marquee)',
  crawl: 'Crawl (vertical)',
  typewriter: 'Typewriter',
  fadein: 'Fade in',
  rainbow: 'Rainbow',
};

/** The animation and its speed, with a warning for risky combinations. */
export function animationSection(ctx: EditorContext): HTMLElement {
  const { set, onSync } = ctx;
  const animGroup = group(ctx, 'Animation');
  const animSel = options(h('select', { id: uid('anim') }), ANIMATIONS, ANIM_LABELS);
  const speedSel = options(h('select', { id: uid('speed') }), SPEEDS, { slow: 'Slow', normal: 'Normal', fast: 'Fast' });
  const animAdvice = h('p', { class: 'advisory', hidden: true });
  animSel.addEventListener('change', () => set('anim', animSel.value));
  speedSel.addEventListener('change', () => set('speed', speedSel.value));
  ctx.onCommit(() => {
    const msg = animationAdvice(ctx.settings());
    animAdvice.textContent = msg;
    animAdvice.hidden = !msg;
  });
  onSync(() => {
    const s = ctx.settings();
    animSel.value = s.anim;
    speedSel.value = s.speed;
  });
  animGroup.append(row(label('Type', animSel.id), animSel), row(label('Speed', speedSel.id), speedSel), animAdvice);
  return animGroup;
}
