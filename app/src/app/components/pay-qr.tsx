"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

/**
 * PromptPay QR สำหรับหน้าจ่ายเงิน (ใช้ทั้งจองโต๊ะและสั่งของที่ระลึก)
 * - บนจอ: แสดง QR + ข้อความเหมือนเดิม
 * - มือถือ: ปุ่ม "บันทึกรูป QR" / "แชร์รูป QR" + วิธีสแกนจากแกลเลอรี
 *   >> รูปที่บันทึก/แชร์ จะประกอบ "ชื่องาน + ยอดเงิน" ลงไปในรูปด้วย <<
 *
 * ปรับแต่ง:
 * - ชื่อไฟล์ที่บันทึก: FILE_NAME
 * - ชื่องานเริ่มต้น (ถ้าไม่ส่ง prop title): DEFAULT_TITLE
 * - ขนาด QR บนจอ: prop size ; ขนาด QR ในรูปดาวน์โหลด: DL_QR_PX
 */
const FILE_NAME = "promptpay-qr.png";
const DEFAULT_TITLE = "งานคืนสู่เหย้า วท.อุดรธานี";
const DL_QR_PX = 560; // ความละเอียด QR ในรูปที่ดาวน์โหลด (คมชัดพอสแกน)
// ฟอนต์วาดข้อความไทยลงบนรูป — ใช้ฟอนต์ระบบที่มีภาษาไทย
const CANVAS_FONT = "'Sarabun','Noto Sans Thai','Leelawadee UI','Tahoma',sans-serif";

export default function PayQr({
  value,
  amount,
  label,
  title = DEFAULT_TITLE,
  size = 200,
  boxClassName = "",
}: {
  value: string; // PromptPay payload (ยอด+บัญชี prefill อยู่ในตัว QR)
  amount: number; // ยอดชำระ (บาท)
  label?: string; // บรรทัด "รายการ: ..." (ไม่ใส่ก็ได้)
  title?: string; // ชื่องานที่จะประกอบลงในรูป
  size?: number;
  boxClassName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [canShareFile, setCanShareFile] = useState(false);
  const [note, setNote] = useState("");

  // โชว์ปุ่มบันทึก/แชร์เฉพาะบนมือถือ/จอสัมผัส
  useEffect(() => {
    const mobile =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(pointer: coarse)").matches ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    setIsMobile(!!mobile);
    try {
      const f = new File([new Blob()], FILE_NAME, { type: "image/png" });
      setCanShareFile(!!navigator.canShare?.({ files: [f] }));
    } catch {
      setCanShareFile(false);
    }
  }, []);

  // QR ที่แสดงบนหน้าจอ (เหมือนเดิม)
  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, { width: size, margin: 1 }).catch(() => {});
  }, [value, size]);

  // ตัดข้อความไทยให้พอดีความกว้าง (สูงสุด maxLines บรรทัด) — วนทีละตัวอักษร
  // เพราะไทยไม่มีช่องว่างให้ตัดคำ
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines: number,
  ): string[] {
    const lines: string[] = [];
    let cur = "";
    for (const ch of text) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = ch;
        if (lines.length === maxLines) break;
      } else {
        cur = test;
      }
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines;
  }

  // สร้างรูป PNG ที่มี ชื่องาน + QR + ยอดเงิน (+ รายการ) ประกอบกัน
  async function buildComposite(): Promise<string> {
    const PAD = 44;
    const W = DL_QR_PX + PAD * 2;

    // วาด QR ความละเอียดสูงลง canvas ชั่วคราวก่อน
    const off = document.createElement("canvas");
    await QRCode.toCanvas(off, value, { width: DL_QR_PX, margin: 1 });

    const c = document.createElement("canvas");
    c.width = W;
    const ctx = c.getContext("2d")!;

    // วัดจำนวนบรรทัดของชื่องานก่อน เพื่อคำนวณความสูงรูป
    ctx.font = `700 34px ${CANVAS_FONT}`;
    const titleLines = wrapText(ctx, title, W - PAD * 2, 2);
    const titleBlock = titleLines.length * 44;
    const amountBlock = 60;
    const labelBlock = label ? 40 : 0;
    const hintBlock = 42;
    const H =
      PAD + titleBlock + 18 + DL_QR_PX + 26 + amountBlock + labelBlock + hintBlock + PAD;
    c.height = H; // การตั้งค่านี้จะล้าง canvas — วาดทุกอย่างหลังบรรทัดนี้

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";

    let y = PAD;
    // ชื่องาน
    ctx.fillStyle = "#123f74"; // maroon-700
    ctx.font = `700 34px ${CANVAS_FONT}`;
    titleLines.forEach((ln, i) => ctx.fillText(ln, W / 2, y + 34 + i * 44));
    y += titleBlock + 18;
    // QR
    ctx.drawImage(off, (W - DL_QR_PX) / 2, y);
    y += DL_QR_PX + 26;
    // ยอดเงิน (เด่น)
    ctx.fillStyle = "#0d2f57"; // maroon-800
    ctx.font = `700 44px ${CANVAS_FONT}`;
    ctx.fillText(`ยอดชำระ ${amount.toLocaleString()} บาท`, W / 2, y + 44);
    y += amountBlock;
    // รายการ (ถ้ามี)
    if (label) {
      ctx.fillStyle = "#6b7280";
      ctx.font = `400 26px ${CANVAS_FONT}`;
      ctx.fillText(`รายการ: ${label}`, W / 2, y + 26);
      y += labelBlock;
    }
    // คำแนะนำ
    ctx.fillStyle = "#9ca3af";
    ctx.font = `400 22px ${CANVAS_FONT}`;
    ctx.fillText("สแกน QR นี้ในแอปธนาคารเพื่อชำระผ่าน PromptPay", W / 2, y + 22);

    return c.toDataURL("image/png");
  }

  // บันทึกรูป (ประกอบชื่องาน+ยอด) ลงเครื่อง
  async function saveImage() {
    try {
      const url = await buildComposite();
      const a = document.createElement("a");
      a.href = url;
      a.download = FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNote('บันทึกรูป QR แล้ว — เปิดแอปธนาคาร เลือก "สแกนจากรูป/แกลเลอรี"');
    } catch {
      setNote("บันทึกรูปไม่สำเร็จ ลองแคปหน้าจอแทนได้");
    }
  }

  // แชร์รูป (ประกอบชื่องาน+ยอด) ถ้าอุปกรณ์รองรับ
  async function shareImage() {
    try {
      const url = await buildComposite();
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], FILE_NAME, { type: "image/png" });
      await navigator.share({
        files: [file],
        title,
        text: `${title} — ยอดชำระ ${amount.toLocaleString()} บาท`,
      });
    } catch {
      /* ผู้ใช้ยกเลิก/ไม่รองรับ — ข้ามไป */
    }
  }

  return (
    <div
      className={`border border-cream-200 rounded-lg p-3 flex flex-col items-center text-center bg-cream-50 ${boxClassName}`}
    >
      <canvas ref={canvasRef} width={size} height={size} />
      <div className="text-xs text-stone-500 mt-2">
        สแกนด้วยแอปธนาคารเพื่อจ่ายยอด {amount.toLocaleString()} บาท แล้วแนบสลิปด้านล่าง
      </div>
      {label && <div className="text-xs text-stone-400 mt-1">รายการ: {label}</div>}

      {isMobile && (
        <div className="mt-3 w-full">
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={saveImage}
              className="bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg px-3 py-2 text-sm font-medium"
            >
              บันทึกรูป QR
            </button>
            {canShareFile && (
              <button
                type="button"
                onClick={shareImage}
                className="border border-maroon-700 text-maroon-700 hover:bg-maroon-50 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
              >
                แชร์รูป QR
              </button>
            )}
          </div>
          <p className="text-xs text-stone-500 mt-2 leading-relaxed">
            อยู่บนมือถือ? กด <b>บันทึกรูป QR</b> → เปิดแอปธนาคาร → เลือก{" "}
            <b>&ldquo;สแกนจากรูป/แกลเลอรี&rdquo;</b> → โอนตามยอด → กลับมาแนบสลิปด้านล่าง
          </p>
          {note && <p className="text-xs text-emerald-600 mt-1">{note}</p>}
        </div>
      )}
    </div>
  );
}
