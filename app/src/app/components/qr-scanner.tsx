"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Opens the device camera and scans for a QR code using jsQR (pure-JS, no
 * native deps). Decodes frames from a hidden <canvas> drawn from the live
 * <video> stream via requestAnimationFrame. Calls onScan once with the raw
 * decoded text and stops the camera — the caller decides what to do with it
 * (parsing out a token, navigating, etc.) and is responsible for closing
 * this component afterwards.
 */
export default function QrScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scannedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์ หรือใช้การค้นหาด้วยข้อความแทน");
      }
    }

    function tick() {
      if (cancelled || scannedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code && code.data) {
            scannedRef.current = true;
            onScan(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200">
          <h2 className="font-semibold text-stone-800">สแกน QR Code เพื่อเช็คอิน</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 text-xl leading-none">
            &times;
          </button>
        </div>

        {error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <div className="relative bg-black aspect-square">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="pointer-events-none absolute inset-8 border-2 border-white/80 rounded-lg" />
          </div>
        )}

        <div className="p-3 text-center text-xs text-stone-500">
          จ่อกล้องไปที่ QR Code บนตั๋วหรือหน้าจอของศิษย์เก่า
        </div>
      </div>
    </div>
  );
}
