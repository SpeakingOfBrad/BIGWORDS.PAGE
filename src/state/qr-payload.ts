/**
 * What a QR code holds. The `qr` parameter is the raw text that gets encoded;
 * these helpers build that text from form fields and read it back, using the
 * formats phone cameras act on: join a Wi-Fi network, call, text, email or
 * open a location.
 */
export const QR_KINDS = ['url', 'wifi', 'tel', 'sms', 'email', 'geo', 'text'] as const;
export type QrKind = (typeof QR_KINDS)[number];

export const WIFI_SECURITY = ['WPA', 'WEP', 'nopass'] as const;
export type WifiSecurity = (typeof WIFI_SECURITY)[number];

export interface QrFields {
  url: string;
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
  phone: string;
  body: string;
  email: string;
  subject: string;
  lat: string;
  lng: string;
  text: string;
}

export const emptyQrFields = (): QrFields => ({
  url: '',
  ssid: '',
  password: '',
  security: 'WPA',
  hidden: false,
  phone: '',
  body: '',
  email: '',
  subject: '',
  lat: '',
  lng: '',
  text: '',
});

/** Backslash-escape the characters the Wi-Fi format treats as syntax. */
const wifiEscape = (s: string) => s.replace(/[\\;,:"]/g, '\\$&');

/** Phone numbers without the spaces, dashes, dots and brackets people type. */
export const cleanPhone = (s: string) => s.replace(/[\s().-]/g, '');

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function coord(s: string, max: number): number | null {
  const t = s.trim();
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  const n = parseFloat(t);
  return Math.abs(n) <= max ? n : null;
}

/** The text to encode, or '' when a required field is missing. */
export function buildQr(kind: QrKind, f: QrFields): string {
  switch (kind) {
    case 'url':
      return f.url.trim();
    case 'text':
      return f.text.trim() ? f.text : '';
    case 'wifi': {
      if (!f.ssid) return '';
      let s = `WIFI:T:${f.security};S:${wifiEscape(f.ssid)};`;
      if (f.security !== 'nopass') s += `P:${wifiEscape(f.password)};`;
      if (f.hidden) s += 'H:true;';
      return s + ';';
    }
    case 'tel': {
      const n = cleanPhone(f.phone);
      return n ? `tel:${n}` : '';
    }
    case 'sms': {
      const n = cleanPhone(f.phone);
      if (!n) return '';
      return f.body ? `SMSTO:${n}:${f.body}` : `SMSTO:${n}`;
    }
    case 'email': {
      const to = f.email.trim();
      if (!to) return '';
      const q = [];
      if (f.subject) q.push(`subject=${encodeURIComponent(f.subject)}`);
      if (f.body) q.push(`body=${encodeURIComponent(f.body)}`);
      return `mailto:${to}${q.length ? '?' + q.join('&') : ''}`;
    }
    case 'geo': {
      const lat = coord(f.lat, 90);
      const lng = coord(f.lng, 180);
      return lat === null || lng === null ? '' : `geo:${lat},${lng}`;
    }
  }
}

/** Split a Wi-Fi payload's fields on unescaped `;` and unescape them. */
function wifiFields(body: string): Map<string, string> {
  const out = new Map<string, string>();
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      cur += body[++i];
      continue;
    }
    if (c === ';') {
      const colon = cur.indexOf(':');
      if (colon > 0) out.set(cur.slice(0, colon).toUpperCase(), cur.slice(colon + 1));
      cur = '';
      continue;
    }
    cur += c;
  }
  return out;
}

/** Work out which kind a payload is and fill the matching fields. */
export function parseQr(payload: string): { kind: QrKind; fields: QrFields } {
  const f = emptyQrFields();
  const s = payload.trim();
  let m: RegExpExecArray | null;
  if (/^WIFI:/i.test(s)) {
    const w = wifiFields(s.slice(5));
    const t = (w.get('T') ?? '').toUpperCase();
    f.security = t === 'WEP' ? 'WEP' : t === 'NOPASS' || (t === '' && !w.get('P')) ? 'nopass' : 'WPA';
    f.ssid = w.get('S') ?? '';
    f.password = w.get('P') ?? '';
    f.hidden = (w.get('H') ?? '').toLowerCase() === 'true';
    return { kind: 'wifi', fields: f };
  }
  if ((m = /^tel:(.*)$/i.exec(s))) {
    f.phone = decode(m[1]);
    return { kind: 'tel', fields: f };
  }
  if ((m = /^smsto:([^:]*)(?::([\s\S]*))?$/i.exec(s))) {
    f.phone = m[1];
    f.body = m[2] ?? '';
    return { kind: 'sms', fields: f };
  }
  if ((m = /^sms:([^?]*)(?:\?([\s\S]*))?$/i.exec(s))) {
    f.phone = decode(m[1]);
    for (const part of (m[2] ?? '').split('&')) {
      if (/^body=/i.test(part)) f.body = decode(part.slice(5));
    }
    return { kind: 'sms', fields: f };
  }
  if ((m = /^mailto:([^?]*)(?:\?([\s\S]*))?$/i.exec(s))) {
    f.email = decode(m[1]);
    for (const part of (m[2] ?? '').split('&')) {
      const eq = part.indexOf('=');
      const key = part.slice(0, eq).toLowerCase();
      if (key === 'subject') f.subject = decode(part.slice(eq + 1));
      else if (key === 'body') f.body = decode(part.slice(eq + 1));
    }
    return { kind: 'email', fields: f };
  }
  if ((m = /^geo:([^,;?]+),([^,;?]+)/i.exec(s)) && coord(m[1], 90) !== null && coord(m[2], 180) !== null) {
    f.lat = m[1].trim();
    f.lng = m[2].trim();
    return { kind: 'geo', fields: f };
  }
  // Anything with a scheme and no spaces is a link, as `qr` has always been.
  if (s === '' || /^[a-z][a-z0-9+.-]*:\S+$/i.test(s)) {
    f.url = s;
    return { kind: 'url', fields: f };
  }
  f.text = payload;
  return { kind: 'text', fields: f };
}

/**
 * The text to put in the code. A hand-typed `qr` value has its fragment
 * escapes decoded, so a call, email or location can arrive with spaces in it;
 * those are rebuilt into the form phones expect. Other values are used as is.
 */
export function qrCodeText(payload: string): string {
  const { kind, fields } = parseQr(payload);
  return kind === 'tel' || kind === 'email' || kind === 'geo' ? buildQr(kind, fields) || payload : payload;
}
