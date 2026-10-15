import { h, toast } from '../chrome';
import { Display } from '../render/display';
import { createQrSvg } from '../render/qr';
import { uid, type EditorContext } from './context';
import { newTabIcon, qrIcon } from './icons';
import { qrLinkNote } from './model';

async function copyText(text: string, fallbackInput?: HTMLInputElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (!fallbackInput) return false;
    fallbackInput.focus();
    fallbackInput.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

export interface Preview {
  /** The pane: the preview and the bar with the link and its actions. */
  element: HTMLElement;
  /** The dialog showing the link as a QR code, which goes at the end of the page. */
  qrDialog: HTMLDialogElement;
  display: Display;
  /** The viewer link, editable to paste or fix a link. */
  urlField: HTMLInputElement;
  urlCount: HTMLElement;
  /** Opens the display in this tab; openTabLink opens it in a new one. */
  openLink: HTMLAnchorElement;
  openTabLink: HTMLAnchorElement;
  /** Shown under the message when the link gets long. */
  urlAdvice: HTMLElement;
  /** Shown in the image section when the image fails to load. */
  imgWarning: HTMLElement;
}

/** The preview pane. `viewerUrl` gives the link to the display being edited. */
export function preview(ctx: EditorContext, viewerUrl: () => string): Preview {
  const previewStage = h('div');
  const imgWarning = h('p', { class: 'advisory', hidden: true });
  const display = new Display(previewStage, {
    editor: true,
    onImageError: (url) => {
      if (ctx.settings().img !== url) return;
      imgWarning.textContent = 'The image could not be loaded. The host may refuse to serve it to other sites, or the URL may be wrong. Viewers will see the display without it.';
      imgWarning.hidden = false;
    },
    onImageLoad: () => {
      imgWarning.hidden = true;
    },
  });
  // Editable, for pasting or fixing a link: an installed app has no address
  // bar. Enter or leaving the field loads it into the editor.
  const urlField = h('input', {
    class: 'url-field',
    type: 'text',
    inputmode: 'url',
    enterkeyhint: 'go',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-label': 'Viewer URL',
  });
  const urlCount = h('span', { class: 'url-count' });
  // Open viewer shows the display in this tab, so an installed app stays in
  // its own window, and Back returns to the editor. The icon next to it opens
  // the display in a new tab.
  const openLink = h('a', {}, 'Open viewer');
  const openTabLink = h('a', { target: '_blank', rel: 'noopener', 'aria-label': 'Open viewer in a new tab', title: 'Open viewer in a new tab' }, newTabIcon());
  const openViewer = h('span', { class: 'btn btn-split' }, openLink, openTabLink);
  const qrBtn = h('button', { class: 'btn btn-icon', type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Show QR code', title: 'Show QR code' }, qrIcon());
  const copyBtn = h('button', { class: 'btn btn-primary', type: 'button' }, 'Copy URL');
  const urlAdvice = h('p', { class: 'advisory', hidden: true });

  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(viewerUrl(), urlField);
    toast(ok ? 'Viewer URL copied' : 'Copy failed: select the URL and copy it');
  });

  // Shows the viewer URL as a QR code, so a phone or tablet can open the
  // display by scanning it instead of typing the link.
  const qrCode = h('div', { class: 'qr-code' });
  const qrNote = h('p', { class: 'hint' });
  const qrClose = h('button', { class: 'btn', type: 'button' }, 'Close');
  const qrTitleId = uid('qrtitle');
  const qrDialog = h(
    'dialog',
    { class: 'qr-dialog', 'aria-labelledby': qrTitleId },
    h('h2', { id: qrTitleId }, 'Scan to open this display'),
    qrCode,
    qrNote,
    h('div', { class: 'qr-actions' }, qrClose),
  );
  qrClose.addEventListener('click', () => qrDialog.close());
  // A click on the backdrop lands on the dialog element itself.
  qrDialog.addEventListener('click', (e) => {
    if (e.target === qrDialog) qrDialog.close();
  });
  qrBtn.addEventListener('click', () => {
    const url = viewerUrl();
    const svg = createQrSvg(url);
    qrCode.replaceChildren(svg ?? '');
    qrCode.hidden = !svg;
    qrNote.textContent = qrLinkNote(!!svg, url.length);
    qrDialog.showModal();
  });

  const element = h('section', { class: 'editor-preview', 'aria-label': 'Preview' }, h('div', { class: 'preview-frame' }, previewStage), h('div', { class: 'preview-bar' }, urlField, qrBtn, urlCount, openViewer, copyBtn));
  return { element, qrDialog, display, urlField, urlCount, openLink, openTabLink, urlAdvice, imgWarning };
}
