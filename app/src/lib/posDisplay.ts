// ส่งสถานะจากหน้าขาย (POS) ไปยัง "จอลูกค้า" (/pos-display) ที่เปิดในเบราว์เซอร์เครื่องเดียวกัน
// ใช้ BroadcastChannel + localStorage (สำรอง/เก็บสถานะล่าสุดเมื่อเปิดจอลูกค้าทีหลัง) — ไม่ผ่านเซิร์ฟเวอร์

export interface DisplayLine {
  name: string;
  size: string | null;
  qty: number;
  unitPrice: number;
}

export type DisplayState =
  | { kind: "idle" }
  | { kind: "cart"; lines: DisplayLine[]; total: number }
  | {
      kind: "pay";
      saleId: string;
      saleCode: string;
      method: "cash" | "transfer";
      total: number;
      holdUntil: string | null;
      lines: DisplayLine[];
      qrPayload: string | null;
    }
  | { kind: "paid"; total: number; at: number };

const CHANNEL = "pos-customer-display";
const KEY = "pos-customer-display-state";

export function publishDisplay(state: DisplayState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage(state);
    ch.close();
  } catch {}
}

export function readDisplay(): DisplayState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DisplayState;
  } catch {}
  return { kind: "idle" };
}

export function subscribeDisplay(cb: (s: DisplayState) => void): () => void {
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e) => cb(e.data as DisplayState);
  } catch {}
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY && e.newValue) {
      try {
        cb(JSON.parse(e.newValue) as DisplayState);
      } catch {}
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    ch?.close();
    window.removeEventListener("storage", onStorage);
  };
}
