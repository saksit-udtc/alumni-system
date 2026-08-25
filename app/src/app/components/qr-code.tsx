"use client";
import { useEffect, useRef } from "react";
import QRCode from "qrcode";

// Renders a QR code onto a <canvas>, entirely client-side (no network
// calls to a third-party QR-generation API — some of those disappear or
// rate-limit, and a ticket QR code is exactly the kind of thing that
// shouldn't break silently at the door).
export default function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }).catch(() => {});
  }, [value, size]);

  return <canvas ref={canvasRef} width={size} height={size} />;
}
