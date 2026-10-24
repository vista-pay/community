import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

/**
 * Renders a QR code as SVG, on this server.
 *
 * Deliberately not a third-party QR image service: the thing being encoded is
 * a join link that grants membership of a savings group, and handing it to an
 * external host to render would put it in someone else's logs.
 *
 * SVG rather than PNG so it stays crisp when an officer projects it at a
 * meeting or prints it on a flyer.
 */
export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get('text');

  if (!text) {
    return NextResponse.json({ message: 'text is required' }, { status: 400 });
  }

  // A QR code tops out around 2,953 bytes; refusing early gives a clear
  // error rather than an encoder exception.
  if (text.length > 1000) {
    return NextResponse.json({ message: 'text is too long to encode' }, { status: 400 });
  }

  const size = Math.min(640, Math.max(96, Number(request.nextUrl.searchParams.get('size')) || 220));

  const svg = await QRCode.toString(text, {
    type: 'svg',
    width: size,
    margin: 1,
    // Medium recovery: readable through a thumbprint on a phone screen or a
    // crease in a printed flyer, without inflating the pattern density.
    errorCorrectionLevel: 'M',
    color: { dark: '#0F1F44', light: '#FFFFFF' },
  });

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      // Same input always produces the same image, and the token in it is
      // already known to this browser.
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
