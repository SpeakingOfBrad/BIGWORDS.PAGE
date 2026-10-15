import { h } from '../../chrome';
import { splitRawSlides } from '../../render/text';
import { MIN_INTERVAL, TRANSITIONS, parseInterval } from '../../state/params';
import { group, label, options, row, uid, type EditorContext } from '../context';
import { slideAdvice as slideAdviceText, slideRange } from '../model';

const TRANS_LABELS: Record<string, string> = {
  slide: 'Slide',
  none: 'None (cut)',
  fade: 'Fade',
  up: 'Slide up',
  zoom: 'Zoom',
};

/**
 * The message, word wrap, its slides with their timing and transition, and a
 * formatting cheat sheet. `urlAdvice` is the note about the link's length, shown under
 * the message. `renderSlides` rebuilds the slide list from the message.
 */
export function messageSection(ctx: EditorContext, urlAdvice: HTMLElement): { element: HTMLElement; renderSlides(): void } {
  const { set, commit, syncAll, onSync } = ctx;
  const msgGroup = group(ctx, 'Message');
  const msgId = uid('msg');
  const textarea = h('textarea', { id: msgId, rows: '4', spellcheck: 'true', 'aria-label': 'Message' });
  textarea.addEventListener('input', () => {
    ctx.state.message = textarea.value;
    commit();
    renderSlides();
  });
  onSync(() => {
    if (textarea.value !== ctx.state.message) textarea.value = ctx.state.message;
  });

  const wrap = h('input', { type: 'checkbox' });
  wrap.addEventListener('change', () => set('wrap', wrap.checked ? '' : 'off'));
  onSync(() => {
    wrap.checked = ctx.settings().wrap;
  });
  const wrapHint = h('p', { class: 'hint' }, 'Breaks lines between words to fit the screen, so long messages come out bigger on any screen. Your own line breaks stay. Turn it off to keep each line of the message on one line. Scroll never wraps.');

  const slideList = h('ol', { class: 'slides', 'aria-label': 'Slides' });
  const addSlide = h('button', { class: 'btn btn-sm', type: 'button' }, '+ Add slide');
  const insertCd = h('button', { class: 'btn btn-sm', type: 'button', title: 'Insert {countdown} at the cursor' }, '+ {countdown}');
  const intervalInput = h('input', { type: 'number', min: String(MIN_INTERVAL), max: '86400', step: 'any', id: uid('interval') });
  const intervalRow = row(label('Seconds per slide', intervalInput.id), intervalInput);
  const transSel = options(h('select', { id: uid('trans') }), TRANSITIONS, TRANS_LABELS);
  const transRow = row(label('Transition', transSel.id), transSel);
  const slideAdvice = h('p', { class: 'advisory', hidden: true });

  const setSlides = (slides: string[], focusIndex?: number) => {
    ctx.state.message = slides.join('||');
    commit();
    syncAll();
    renderSlides();
    if (focusIndex !== undefined) selectSlide(focusIndex);
  };
  const selectSlide = (i: number) => {
    textarea.focus();
    textarea.setSelectionRange(...slideRange(ctx.state.message, i));
  };
  function renderSlides() {
    const slides = splitRawSlides(ctx.state.message);
    intervalRow.hidden = slides.length < 2;
    transRow.hidden = slides.length < 2;
    slideList.hidden = slides.length < 2;
    slideList.replaceChildren(
      ...slides.map((src, i) => {
        const up = h('button', { class: 'icon-btn', type: 'button', title: 'Move up', 'aria-label': `Move slide ${i + 1} up`, disabled: i === 0 }, '↑');
        const down = h('button', { class: 'icon-btn', type: 'button', title: 'Move down', 'aria-label': `Move slide ${i + 1} down`, disabled: i === slides.length - 1 }, '↓');
        const del = h('button', { class: 'icon-btn', type: 'button', title: 'Delete', 'aria-label': `Delete slide ${i + 1}` }, '✕');
        const txt = h('button', { class: 'txt', type: 'button', title: 'Select in message' }, src.replace(/\n/g, ' ⏎ ') || '(empty)');
        up.addEventListener('click', () => {
          [slides[i - 1], slides[i]] = [slides[i], slides[i - 1]];
          setSlides(slides);
        });
        down.addEventListener('click', () => {
          [slides[i + 1], slides[i]] = [slides[i], slides[i + 1]];
          setSlides(slides);
        });
        del.addEventListener('click', () => {
          slides.splice(i, 1);
          setSlides(slides);
        });
        txt.addEventListener('click', () => selectSlide(i));
        return h('li', {}, h('span', { class: 'n' }, String(i + 1)), txt, up, down, del);
      }),
    );
  }
  addSlide.addEventListener('click', () => {
    const slides = splitRawSlides(ctx.state.message);
    slides.push('New slide');
    setSlides(slides, slides.length - 1);
  });
  insertCd.addEventListener('click', () => {
    const { selectionStart: a, selectionEnd: b, value } = textarea;
    textarea.value = value.slice(0, a) + '{countdown}' + value.slice(b);
    textarea.setSelectionRange(a + 11, a + 11);
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
  });
  intervalInput.addEventListener('input', () => set('interval', parseInterval(intervalInput.value) === null ? '' : intervalInput.value.trim()));
  // On Enter or leaving the field, show the value the display uses, such as
  // 0.2 for 0.05, or the default for an invalid one.
  intervalInput.addEventListener('change', () => {
    const n = parseInterval(intervalInput.value);
    if (n !== null) set('interval', String(n));
    intervalInput.value = String(ctx.settings().interval);
  });
  transSel.addEventListener('change', () => set('trans', transSel.value));
  ctx.onCommit(() => {
    const msg = slideAdviceText(ctx.settings(), splitRawSlides(ctx.state.message).length);
    slideAdvice.textContent = msg;
    slideAdvice.hidden = !msg;
  });
  onSync(() => {
    const s = ctx.settings();
    if (document.activeElement !== intervalInput) intervalInput.value = String(s.interval);
    transSel.value = s.trans;
  });

  const cheats: [string, string][] = [
    ['**bold**  __bold__', 'Bold'],
    ['*italic*  _italic_', 'Italic'],
    ['~~struck~~', 'Strikethrough'],
    ['`code`', 'Code, shown exactly as typed'],
    ['# Title', 'Heading, 2× size (line start)'],
    ['## Subtitle', 'Heading, 1.5× size (line start)'],
    ['Enter', 'New line (%0A in the URL)'],
    ['||', 'Next slide'],
    ['{countdown}', 'Live countdown (set a target below)'],
    ['\\*  \\_  \\~  \\`  \\#  \\||  \\{  \\\\', 'Backslash shows the next character literally'],
  ];
  msgGroup.append(
    textarea,
    // Lives here rather than under the preview so it can't change the preview's size.
    urlAdvice,
    row(h('label', { class: 'check' }, wrap, 'Word wrap')),
    wrapHint,
    row(addSlide, insertCd),
    slideList,
    intervalRow,
    transRow,
    slideAdvice,
    h(
      'details',
      { class: 'mini-details' },
      h('summary', {}, 'Formatting cheat sheet'),
      h('table', { class: 'cheats' }, h('tbody', {}, ...cheats.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))))),
    ),
  );
  return { element: msgGroup, renderSlides };
}
