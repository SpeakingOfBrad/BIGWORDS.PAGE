import { h } from '../../chrome';
import { CD_FORMATS, formatTimer, parseTimer } from '../../state/params';
import { group, label, options, row, uid, type EditorContext } from '../context';
import { TIMER_UNITS, countdownHint, isFloatingUntil, localInputToUtc, TIMER_HINT, timerParts, timerTotal, toLocalInput, untilHint as untilHintText } from '../model';

/**
 * A countdown or a timer. They're two different things that share
 * {countdown}, the format and what happens at zero: a countdown ends at a
 * fixed moment, a timer runs for a length of time from when the display
 * opens. Only one can be in the URL, so the editor shows one at a time.
 * Switching keeps the other's value here, out of the URL, so switching back
 * restores it.
 */
export function countdownSection(ctx: EditorContext): HTMLElement {
  const { get, set, syncAll, onSync } = ctx;
  const cdGroup = group(ctx, 'Countdown or timer', true, () => !!get('until') || !!get('timer'));
  type CdKind = 'until' | 'timer';
  let cdKind: CdKind = get('timer') ? 'timer' : 'until';
  const stashed: Record<CdKind, string> = { until: '', timer: '' };
  const kindBtn = (title: string, desc: string) =>
    h('button', { class: 'kind-btn', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'title' }, title), h('span', { class: 'desc' }, desc));
  const kindBtns: Record<CdKind, HTMLButtonElement> = {
    until: kindBtn('Countdown', 'Ends at a date and time, the same moment on every screen.'),
    timer: kindBtn('Timer', 'Runs for a length of time, starting when the display opens.'),
  };
  const kindGrid = h('div', { class: 'kind-grid', role: 'group', 'aria-label': 'Countdown or timer' }, kindBtns.until, kindBtns.timer);

  const until = h('input', { type: 'datetime-local', step: '1', id: uid('until') });
  const untilClear = h('button', { class: 'btn btn-sm', type: 'button' }, 'Clear');
  const untilHint = h('p', { class: 'hint' });
  const untilPanel = h('div', { class: 'kind-panel' }, row(label('Ends at', until.id), until, untilClear), untilHint);

  const timerInputs = TIMER_UNITS.map(() => h('input', { type: 'number', min: '0', step: '1', placeholder: '0', id: uid('timer') }));
  const timerBox = h('div', { class: 'pad-sides' }, ...timerInputs.map((inp, i) => h('label', {}, TIMER_UNITS[i][0], inp)));
  const timerClear = h('button', { class: 'btn btn-sm', type: 'button' }, 'Clear');
  const timerHint = h('p', { class: 'hint' });
  const timerPanel = h('div', { class: 'kind-panel' }, row(label('Runs for', timerInputs[0].id), timerClear), timerBox, timerHint);

  const cdfmt = options(h('select', { id: uid('cdfmt') }), CD_FORMATS, { label: 'Labels (2d 14h 06m 32s)', colon: 'Colons (02:14:06:32)' });
  const zeroSel = options(h('select', { id: uid('zero') }), ['freeze', 'hide', 'message'], { freeze: 'Freeze at zero', hide: 'Hide', message: 'Show a message' });
  const zeroMsg = h('textarea', { class: 'zero-msg', rows: '2', spellcheck: 'true', placeholder: 'Message shown at zero', 'aria-label': 'Message shown at zero' });
  const cdHint = h('p', { class: 'hint' });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local time';

  (Object.keys(kindBtns) as CdKind[]).forEach((kind) => {
    kindBtns[kind].addEventListener('click', () => {
      if (kind === cdKind) return;
      const other = cdKind;
      stashed[other] = get(other);
      cdKind = kind;
      delete ctx.state.params[other];
      set(kind, stashed[kind]);
      syncAll();
    });
  });
  // The picker shows the editing device's time zone; the URL gets UTC, so the
  // countdown ends at the same moment on every viewing device.
  until.addEventListener('input', () => {
    set('until', localInputToUtc(until.value));
    syncCountdown();
  });
  untilClear.addEventListener('click', () => {
    set('until', '');
    syncAll();
  });
  // Any amounts add up, so 90 minutes or 28 hours work; leaving a field
  // rewrites them in whole units (1h 30m, 1d 4h).
  timerInputs.forEach((inp) => {
    inp.addEventListener('input', () => {
      const total = timerTotal(timerInputs.map((el) => el.value));
      set('timer', total > 0 ? formatTimer(total) : '');
      syncCountdown();
    });
    inp.addEventListener('change', syncAll);
  });
  timerClear.addEventListener('click', () => {
    set('timer', '');
    syncAll();
  });
  cdfmt.addEventListener('change', () => set('cdfmt', cdfmt.value));
  const writeZero = () => {
    if (zeroSel.value === 'message') set('zero', zeroMsg.value.trim() ? zeroMsg.value : '');
    else set('zero', zeroSel.value);
    zeroMsg.hidden = zeroSel.value !== 'message';
  };
  zeroSel.addEventListener('change', writeZero);
  zeroMsg.addEventListener('input', writeZero);
  const syncCountdown = () => {
    // A link opened or typed in the address bar decides which one is showing.
    if (get('until')) cdKind = 'until';
    else if (get('timer')) cdKind = 'timer';
    kindBtns.until.setAttribute('aria-pressed', String(cdKind === 'until'));
    kindBtns.timer.setAttribute('aria-pressed', String(cdKind === 'timer'));
    untilPanel.hidden = cdKind !== 'until';
    timerPanel.hidden = cdKind !== 'timer';

    const s = ctx.settings();
    if (document.activeElement !== until) until.value = s.until ? toLocalInput(s.until) : '';
    if (!timerInputs.includes(document.activeElement as HTMLInputElement)) {
      const parts = timerParts(parseTimer(get('timer')) ?? 0);
      timerInputs.forEach((inp, i) => {
        inp.value = parts[i] ? String(parts[i]) : '';
      });
    }
    cdfmt.value = s.cdfmt;
    if (document.activeElement !== zeroMsg && document.activeElement !== zeroSel) {
      zeroSel.value = s.zero.kind;
      zeroMsg.value = s.zero.kind === 'message' ? s.zero.message : '';
    }
    zeroMsg.hidden = zeroSel.value !== 'message';

    untilHint.textContent = untilHintText(!!s.until && isFloatingUntil(get('until')), timeZone);
    timerHint.textContent = TIMER_HINT;
    cdHint.textContent = countdownHint(s, ctx.state.message);
  };
  onSync(syncCountdown);
  cdGroup.append(
    kindGrid,
    untilPanel,
    timerPanel,
    row(label('Format', cdfmt.id), cdfmt),
    row(label('At zero', zeroSel.id), zeroSel),
    zeroMsg,
    cdHint,
  );
  return cdGroup;
}
