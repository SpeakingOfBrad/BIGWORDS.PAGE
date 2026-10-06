import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseFragment } from '../src/state/fragment';
import { buildQr, emptyQrFields, parseQr, qrCodeText, QR_KINDS, type QrFields, type QrKind } from '../src/state/qr-payload';

const fields = (f: Partial<QrFields>): QrFields => ({ ...emptyQrFields(), ...f });

describe('QR payloads', () => {
  it('builds the formats phone cameras act on', () => {
    expect(buildQr('url', fields({ url: ' https://example.com/a ' }))).toBe('https://example.com/a');
    expect(buildQr('wifi', fields({ ssid: 'Guest', password: 'sunshine' }))).toBe('WIFI:T:WPA;S:Guest;P:sunshine;;');
    expect(buildQr('wifi', fields({ ssid: 'Cafe', password: 'ignored', security: 'nopass', hidden: true }))).toBe('WIFI:T:nopass;S:Cafe;H:true;;');
    expect(buildQr('tel', fields({ phone: '+1 (555) 123-4567' }))).toBe('tel:+15551234567');
    expect(buildQr('sms', fields({ phone: '555 123 4567', body: 'Found your dog: at the park' }))).toBe('SMSTO:5551234567:Found your dog: at the park');
    expect(buildQr('sms', fields({ phone: '5551234567' }))).toBe('SMSTO:5551234567');
    expect(buildQr('email', fields({ email: 'a@example.com', subject: 'Hi & bye', body: 'Line 1\nLine 2' }))).toBe('mailto:a@example.com?subject=Hi%20%26%20bye&body=Line%201%0ALine%202');
    expect(buildQr('geo', fields({ lat: '40.6892', lng: '-74.0445' }))).toBe('geo:40.6892,-74.0445');
    expect(buildQr('text', fields({ text: 'Table 4' }))).toBe('Table 4');
  });

  it('escapes Wi-Fi syntax characters', () => {
    const payload = buildQr('wifi', fields({ ssid: 'a;b:c', password: 'p\\q,"r"' }));
    expect(payload).toBe('WIFI:T:WPA;S:a\\;b\\:c;P:p\\\\q\\,\\"r\\";;');
    expect(parseQr(payload).fields).toMatchObject({ ssid: 'a;b:c', password: 'p\\q,"r"' });
  });

  it('gives an empty payload when a required field is missing', () => {
    expect(buildQr('wifi', fields({ password: 'x' }))).toBe('');
    expect(buildQr('tel', fields({ phone: ' - ' }))).toBe('');
    expect(buildQr('sms', fields({ body: 'hi' }))).toBe('');
    expect(buildQr('email', fields({ subject: 'hi' }))).toBe('');
    expect(buildQr('geo', fields({ lat: '91', lng: '0' }))).toBe('');
    expect(buildQr('geo', fields({ lat: 'north', lng: '0' }))).toBe('');
    expect(buildQr('text', fields({ text: '  ' }))).toBe('');
  });

  it('round-trips every kind', () => {
    const samples: Record<QrKind, Partial<QrFields>> = {
      url: { url: 'https://example.com/?a=1&b=2' },
      wifi: { ssid: 'Home 5G', password: 'x;y', security: 'WEP', hidden: true },
      tel: { phone: '+15551234567' },
      sms: { phone: '+15551234567', body: 'Hello: there' },
      email: { email: 'a@example.com', subject: 'Lost cat', body: 'Seen at 5pm?' },
      geo: { lat: '-33.8568', lng: '151.2153' },
      text: { text: 'Hello there' },
    };
    for (const kind of QR_KINDS) {
      const f = fields(samples[kind]);
      const parsed = parseQr(buildQr(kind, f));
      expect(parsed.kind).toBe(kind);
      expect(parsed.fields).toEqual(f);
    }
  });

  it('reads other common spellings', () => {
    expect(parseQr('sms:+15551234567?body=Hi%20there')).toMatchObject({ kind: 'sms', fields: { phone: '+15551234567', body: 'Hi there' } });
    expect(parseQr('sms:+15551234567&body=Hi')).toMatchObject({ kind: 'sms', fields: { phone: '+15551234567&body=Hi' } });
    expect(parseQr('WIFI:S:Open;;')).toMatchObject({ kind: 'wifi', fields: { ssid: 'Open', security: 'nopass' } });
    expect(parseQr('WIFI:S:Net;T:WPA;P:pw;;')).toMatchObject({ kind: 'wifi', fields: { ssid: 'Net', password: 'pw', security: 'WPA' } });
    expect(parseQr('TEL:555')).toMatchObject({ kind: 'tel', fields: { phone: '555' } });
  });

  it('falls back to a link or plain text', () => {
    expect(parseQr('')).toMatchObject({ kind: 'url', fields: { url: '' } });
    expect(parseQr('geo:999,0').kind).toBe('url');
    expect(parseQr('example.com').kind).toBe('text');
    expect(parseQr('Call me maybe').kind).toBe('text');
  });

  it('tidies hand-typed calls, emails and locations for the code', () => {
    expect(qrCodeText('tel:+1 555 123 4567')).toBe('tel:+15551234567');
    expect(qrCodeText('mailto:a@example.com?subject=Lost cat&body=Seen her')).toBe('mailto:a@example.com?subject=Lost%20cat&body=Seen%20her');
    expect(qrCodeText('geo: 40.5, -74')).toBe('geo:40.5,-74');
    expect(qrCodeText('WIFI:S:My Net;P:a b;;')).toBe('WIFI:S:My Net;P:a b;;');
    expect(qrCodeText('SMSTO:555:hi there')).toBe('SMSTO:555:hi there');
    expect(qrCodeText('https://example.com/a b')).toBe('https://example.com/a b');
  });

  it('reads the examples in the reference as the type they document', () => {
    const md = readFileSync(resolve(import.meta.dirname, '../docs/REFERENCE.md'), 'utf8');
    const section = md.slice(md.indexOf('## QR code'), md.indexOf('## Image'));
    const links = [...section.matchAll(/\]\(\{origin\}\/(#[^)]+)\)/g)].map((m) => parseFragment(m[1].replaceAll('{origin}', 'https://example.com')).params.qr);
    expect(links.map((qr) => parseQr(qr).kind)).toEqual(['url', 'wifi', 'tel', 'sms', 'email', 'geo']);
    expect(parseQr(links[1]).fields).toMatchObject({ ssid: 'Cafe Guest', password: 'latte;art', security: 'WPA' });
    expect(parseQr(links[4]).fields).toMatchObject({ email: 'hello@example.com', subject: 'Question', body: 'Hi!' });
    const inline = [...section.matchAll(/`qr=([^`<]+)`/g)].map((m) => parseQr(parseFragment('#&qr=' + m[1]).params.qr));
    expect(inline.map((p) => p.kind)).toEqual(['wifi', 'wifi', 'wifi', 'text']);
    expect(inline[2].fields).toMatchObject({ ssid: 'Back Office', hidden: true });
  });
});
