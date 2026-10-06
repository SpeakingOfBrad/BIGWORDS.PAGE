import qrcode from 'qrcode-generator';

const QUIET_ZONE = 4;

/**
 * Build a QR code as an SVG element: black modules on white with the standard
 * four-module quiet zone, so it scans regardless of the display colors.
 */
export function createQrSvg(text: string): SVGSVGElement | null {
  try {
    const qr = qrcode(0, 'M');
    // The library maps each char code to one byte, so feed it UTF-8 bytes.
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    qr.addData(binary, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const size = n + QUIET_ZONE * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`;
      }
    }
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'QR code');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('width', String(size));
    bg.setAttribute('height', String(size));
    bg.setAttribute('fill', '#ffffff');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#000000');
    svg.append(bg, path);
    return svg;
  } catch {
    return null; // Data too long for a QR code: omit silently.
  }
}
