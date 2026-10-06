/**
 * The URL fragment is the entire display state:
 *   #<message>&key=value&key=value
 * The message is everything before the first unencoded `&`.
 */
export interface State {
  message: string;
  params: Record<string, string>;
}

/** decodeURIComponent that never throws: malformed sequences are kept literally. */
export function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s.replace(/(?:%[0-9a-fA-F]{2})+/g, (run) => {
      try {
        return decodeURIComponent(run);
      } catch {
        // Decode byte by byte, keeping only the sequences that are valid.
        return run.replace(/%[0-9a-fA-F]{2}/g, (b) => {
          const code = parseInt(b.slice(1), 16);
          return code < 0x80 ? String.fromCharCode(code) : b;
        });
      }
    });
  }
}

/**
 * Some apps percent-encode a link again before opening it (an iOS QR scan
 * handing the link to another browser has been seen doing it), so every %
 * arrives as %25 and the message would show its escapes. serializeFragment
 * always encodes spaces, so a fragment whose only escapes are %25XX was
 * encoded twice and is decoded once more. A real message only looks like
 * that if it is nothing but literal %XX text with no spaces.
 */
function undoDoubleEncoding(raw: string): string {
  return /%25[0-9a-f]{2}/i.test(raw) && !/%(?!25[0-9a-f]{2})/i.test(raw) ? safeDecode(raw) : raw;
}

/** Parse a fragment (with or without the leading `#`). */
export function parseFragment(hash: string): State {
  const raw = undoDoubleEncoding(hash.startsWith('#') ? hash.slice(1) : hash);
  const [first, ...rest] = raw.split('&');
  const params: Record<string, string> = {};
  for (const seg of rest) {
    if (!seg) continue;
    const eq = seg.indexOf('=');
    const key = safeDecode(eq === -1 ? seg : seg.slice(0, eq)).trim().toLowerCase();
    const value = eq === -1 ? '' : safeDecode(seg.slice(eq + 1));
    if (key) params[key] = value;
  }
  return { message: safeDecode(first ?? ''), params };
}

/**
 * Percent-encode for the fragment. Everything that could be ambiguous
 * (space, newline, &, #, %, |, {, }, \) is encoded; characters that are
 * harmless in a fragment (: / ? @ , ; = + $ !) stay readable.
 */
export function encodeComponent(s: string): string {
  return encodeURIComponent(s).replace(/%(3A|2F|3F|40|2C|3B|3D|2B|24|21)/gi, (m) =>
    decodeURIComponent(m),
  );
}

/** Serialize a state. Params are emitted in the given key order. */
export function serializeFragment(state: State, order: readonly string[]): string {
  const parts = [encodeComponent(state.message)];
  const keys = [...order.filter((k) => k in state.params), ...Object.keys(state.params).filter((k) => !order.includes(k))];
  for (const key of keys) {
    parts.push(`${key}=${encodeComponent(state.params[key])}`);
  }
  return parts.join('&');
}
