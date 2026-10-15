import { h } from '../../chrome';
import { QR_POSITIONS, QR_SIZE_MAX, QR_SIZE_MIN } from '../../state/params';
import { QR_KINDS, WIFI_SECURITY, buildQr, parseQr, type QrFields, type QrKind } from '../../state/qr-payload';
import { group, label, optLabel, options, row, uid, type EditorContext } from '../context';

const QR_LABELS: Record<string, string> = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right', below: 'Below text' };
const QR_KIND_LABELS: Record<string, string> = { url: 'Link', wifi: 'Wi-Fi network', tel: 'Phone call', sms: 'Text/SMS', email: 'Email', geo: 'Location', text: 'Plain text' };
const QR_HINTS: Record<QrKind, string> = {
  url: 'Opens the link on the phone that scans it.',
  wifi: 'Phones that scan it offer to join the network. The password is in the link, so anyone with the link or a view of the screen can read it.',
  tel: 'Offers to call the number.',
  sms: 'Opens a new text message (SMS) to the number, with the message filled in for the sender to edit.',
  email: 'Opens a new email to the address, with the subject and message filled in.',
  geo: 'Opens the location in a maps app on Android. iPhone cameras may show it as text; for those, use a link to a map instead.',
  text: 'Shows the text on the phone that scans it.',
};

/**
 * A QR code on the display. The `qr` parameter holds the raw text to encode.
 * The form builds it from fields for each kind, and reads it back when the
 * URL changes elsewhere.
 */
export function qrSection(ctx: EditorContext): HTMLElement {
  const { get, set, onSync } = ctx;
  const qrGroup = group(ctx, 'QR code', true, () => !!get('qr'));
  const qrKind = options(h('select', { id: uid('qrkind') }), QR_KINDS, QR_KIND_LABELS);
  const field = (attrs: Record<string, string>) => h('input', { class: 'grow', spellcheck: 'false', id: uid('qrf'), ...attrs });
  const qrUrl = field({ type: 'url', placeholder: 'https://…' });
  const qrSsid = field({ type: 'text', autocomplete: 'off' });
  const qrPass = field({ type: 'text', autocomplete: 'off' });
  const qrSec = options(h('select', { id: uid('qrsec') }), WIFI_SECURITY, { WPA: 'WPA/WPA2/WPA3', WEP: 'WEP', nopass: 'None (open)' });
  const qrHidden = h('input', { type: 'checkbox' });
  const qrPhone = field({ type: 'tel', placeholder: '+1 555 123 4567' });
  const qrBody = field({ type: 'text', spellcheck: 'true' });
  const qrEmail = field({ type: 'email', placeholder: 'name@example.com' });
  const qrSubject = field({ type: 'text', spellcheck: 'true' });
  const qrLat = field({ type: 'text', inputmode: 'decimal', placeholder: '40.6892' });
  const qrLng = field({ type: 'text', inputmode: 'decimal', placeholder: '-74.0445' });
  const qrText = field({ type: 'text', spellcheck: 'true' });
  const qrSize = h('input', { type: 'number', min: String(QR_SIZE_MIN), max: String(QR_SIZE_MAX), step: '5', id: uid('qrsize') });
  const qrpos = options(h('select', { id: uid('qrpos') }), QR_POSITIONS, QR_LABELS);
  const qrHint = h('p', { class: 'hint' });
  for (const el of [qrUrl, qrSsid, qrPass, qrPhone, qrEmail, qrLat, qrLng, qrText]) el.required = true;
  const bodyRow = row(optLabel('Message', qrBody.id), qrBody);
  const phoneRow = row(label('Phone', qrPhone.id), qrPhone);
  const passRow = row(label('Password', qrPass.id), qrPass);
  const qrRows: Record<QrKind, HTMLElement[]> = {
    url: [row(label('URL', qrUrl.id), qrUrl)],
    wifi: [
      row(label('Network', qrSsid.id), qrSsid),
      passRow,
      row(label('Security', qrSec.id), qrSec, h('label', { class: 'check' }, qrHidden, 'Hidden network', h('span', { class: 'opt' }, 'optional'))),
    ],
    tel: [phoneRow],
    sms: [phoneRow, bodyRow],
    email: [row(label('To', qrEmail.id), qrEmail), row(optLabel('Subject', qrSubject.id), qrSubject), bodyRow],
    geo: [row(label('Latitude', qrLat.id), qrLat), row(label('Longitude', qrLng.id), qrLng)],
    text: [row(label('Text', qrText.id), qrText)],
  };
  // Rows shared between kinds (phone, message) move to where each kind lists them.
  const qrFieldRows = h('div');
  const qrFieldEls = [qrUrl, qrSsid, qrPass, qrSec, qrHidden, qrPhone, qrBody, qrEmail, qrSubject, qrLat, qrLng, qrText];
  const readQrFields = (): QrFields => ({
    url: qrUrl.value,
    ssid: qrSsid.value,
    password: qrPass.value,
    security: qrSec.value as QrFields['security'],
    hidden: qrHidden.checked,
    phone: qrPhone.value,
    body: qrBody.value,
    email: qrEmail.value,
    subject: qrSubject.value,
    lat: qrLat.value,
    lng: qrLng.value,
    text: qrText.value,
  });
  const writeQrFields = (f: QrFields) => {
    qrUrl.value = f.url;
    qrSsid.value = f.ssid;
    qrPass.value = f.password;
    qrSec.value = f.security;
    qrHidden.checked = f.hidden;
    qrPhone.value = f.phone;
    qrBody.value = f.body;
    qrEmail.value = f.email;
    qrSubject.value = f.subject;
    qrLat.value = f.lat;
    qrLng.value = f.lng;
    qrText.value = f.text;
  };
  const showQrKind = () => {
    const kind = qrKind.value as QrKind;
    if (qrFieldRows.dataset.kind !== kind) {
      qrFieldRows.dataset.kind = kind;
      qrFieldRows.replaceChildren(...qrRows[kind]);
    }
    passRow.hidden = kind !== 'wifi' || qrSec.value === 'nopass';
    qrHint.textContent = QR_HINTS[kind];
  };
  // The payload this form last wrote. While the URL still holds it, the
  // fields are left alone, so a half-filled form isn't wiped when a required
  // field is empty and the code is cleared. Any other value came from the
  // address bar or a loaded link, and is read back into the form.
  let qrWritten: string | null = null;
  const writeQr = () => {
    qrWritten = buildQr(qrKind.value as QrKind, readQrFields());
    set('qr', qrWritten);
  };
  qrKind.addEventListener('change', () => {
    showQrKind();
    writeQr();
  });
  for (const el of qrFieldEls) el.addEventListener(el instanceof HTMLSelectElement || el.type === 'checkbox' ? 'change' : 'input', () => {
    showQrKind();
    writeQr();
  });
  qrSize.addEventListener('input', () => set('qrsize', /^\d+$/.test(qrSize.value) && +qrSize.value > 0 ? qrSize.value : ''));
  qrpos.addEventListener('change', () => set('qrpos', qrpos.value));
  onSync(() => {
    const payload = get('qr');
    if (payload !== qrWritten) {
      const parsed = parseQr(payload);
      if (payload) qrKind.value = parsed.kind;
      writeQrFields(parsed.fields);
      qrWritten = payload;
    }
    showQrKind();
    const s = ctx.settings();
    if (document.activeElement !== qrSize) qrSize.value = String(s.qrsize);
    qrpos.value = s.qrpos;
  });
  qrGroup.append(
    row(label('Type', qrKind.id), qrKind),
    qrFieldRows,
    row(label('Size', qrSize.id), qrSize, '% of the screen'),
    row(label('Position', qrpos.id), qrpos),
    qrHint,
    h('p', { class: 'hint' }, 'Fields marked optional can be left blank; the code appears once the others are filled in. Generated in the browser, black on white with a quiet zone so it scans on any colors.'),
  );
  return qrGroup;
}
