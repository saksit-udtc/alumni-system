import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

/**
 * "หลักฐานการชำระเงิน" (payment confirmation) PDF attached to the approval
 * emails. NOT an official receipt (ใบเสร็จรับเงิน) — the wording on the page
 * says so on purpose until the college's finance office confirms the format.
 *
 * Pure functions: plain data in -> PDF Buffer out, no DB/network, so they can
 * be tested standalone. mailer.ts loads the data and calls these.
 * The document number is derived from the booking/order code (stable across
 * re-sends, no extra DB column needed).
 */

const FONT_DIR = path.join(process.cwd(), "public", "fonts");
const FONT_REG = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo-89-pdf.png");
let logoCache: Buffer | null | undefined;
function logo(): Buffer | null {
  if (logoCache === undefined) {
    try {
      logoCache = fs.readFileSync(LOGO_PATH);
    } catch {
      logoCache = null; // missing logo must never break the PDF
    }
  }
  return logoCache;
}

const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#cbd5e1";
const ACCENT = "#1e3a8a";
const SOFT = "#eff6ff";

export interface ProofCommon {
  orgName: string;
  contactLines: string[];
  /** ผู้ติดต่อจองโต๊ะ + ผู้ประสานงาน (ตั้งที่ /admin/settings) */
  contacts?: { bookingContacts: { name: string; phone: string }[]; coordinators: { name: string; phone: string }[] };
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  paidAt: Date; // when the staff verified the slip
  slipRef?: string | null; // bank transaction reference from EasySlip, if any
}

export interface MerchProofData extends ProofCommon {
  orderCode: string;
  items: { name: string; size: string | null; quantity: number; unitPrice: number }[];
  shippingFee: number;
  totalAmount: number;
}

export interface ReservationProofData extends ProofCommon {
  bookingCode: string;
  eventName: string;
  eventDate?: Date | null;
  location?: string | null;
  tableNumber: number;
  zone?: string | null;
  seatCount: number;
  isFullTable: boolean;
  packageName?: string | null;
  packageItems: { name: string; size: string | null; quantity: number }[];
  totalAmount: number;
  checkinQrPng?: Buffer | null; // PNG of the check-in QR (same one as in the email)
}

const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function thDate(d: Date, withTime = false): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  let s = d.toLocaleDateString("th-TH-u-ca-buddhist", opts);
  if (withTime) {
    s += " เวลา " + d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" }) + " น.";
  }
  return s;
}

type Doc = InstanceType<typeof PDFDocument>;

function newDoc(): Doc {
  // `font` option: avoids pdfkit loading its built-in Helvetica .afm files.
  return new PDFDocument({ size: "A4", margins: { top: 40, left: 48, right: 48, bottom: 24 }, font: FONT_REG, info: { Title: "หลักฐานการชำระเงิน" } });
}

function toBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

function header(doc: Doc, docNo: string, common: ProofCommon) {
  const w = doc.page.width - 96;
  doc.rect(48, 48, w, 6).fill(ACCENT);
  const lg = logo();
  const textX = lg ? 48 + 84 : 48;
  if (lg) doc.image(lg, 48, 64, { fit: [74, 74] });
  doc.fillColor(INK).font(FONT_BOLD).fontSize(20).text(common.orgName, textX, lg ? 76 : 66, { width: w - (textX - 48) });
  doc.font(FONT_REG).fontSize(11).fillColor(MUTED).text("งานคืนสู่เหย้า 89 ปี", textX, doc.y, { width: w - (textX - 48) });
  if (lg && doc.y < 130) doc.y = 130;
  doc.moveDown(0.3);
  doc.fillColor(ACCENT).font(FONT_BOLD).fontSize(24).text("หลักฐานการชำระเงิน", 48, doc.y, { width: w });
  doc.moveDown(0.3);
  doc.font(FONT_REG).fontSize(10.5).fillColor(MUTED).text(
    "เอกสารนี้ออกโดยระบบเพื่อยืนยันว่าได้รับชำระเงินแล้ว ไม่ใช่ใบเสร็จรับเงินหรือใบกำกับภาษี",
    48, doc.y, { width: w }
  );
  doc.moveDown(0.5);
  kv(doc, "เลขที่เอกสาร", docNo);
  kv(doc, "วันที่ตรวจสอบการชำระ", thDate(common.paidAt, true));
  doc.moveDown(0.6);
  hr(doc);
}

function hr(doc: Doc) {
  const y = doc.y + 2;
  doc.moveTo(48, y).lineTo(doc.page.width - 48, y).strokeColor(LINE).lineWidth(0.7).stroke();
  doc.y = y + 8;
}

function kv(doc: Doc, k: string, v: string) {
  const y = doc.y;
  doc.font(FONT_REG).fontSize(12).fillColor(MUTED).text(k, 48, y, { width: 140 });
  doc.font(FONT_BOLD).fontSize(12).fillColor(INK).text(v, 190, y, { width: doc.page.width - 190 - 48 });
}

function payerBlock(doc: Doc, c: ProofCommon) {
  doc.font(FONT_BOLD).fontSize(13).fillColor(ACCENT).text("ผู้ชำระเงิน", 48, doc.y);
  doc.moveDown(0.2);
  kv(doc, "ชื่อ", c.payerName);
  if (c.payerPhone) kv(doc, "โทรศัพท์", c.payerPhone);
  if (c.payerEmail) kv(doc, "อีเมล", c.payerEmail);
  doc.moveDown(0.4);
}

/** Table with right-aligned numeric columns. cols: [label, width, align] */
function table(doc: Doc, cols: [string, number, "left" | "right"][], rows: string[][]) {
  const x0 = 48;
  const total = cols.reduce((s, c) => s + c[1], 0);
  let y = doc.y;
  doc.rect(x0, y, total, 24).fill(SOFT);
  let x = x0;
  doc.font(FONT_BOLD).fontSize(11.5).fillColor(ACCENT);
  for (const [label, w, align] of cols) {
    doc.text(label, x + 6, y + 4, { width: w - 12, align });
    x += w;
  }
  y += 26;
  doc.font(FONT_REG).fontSize(12).fillColor(INK);
  for (const r of rows) {
    // row height from the tallest cell
    let h = 0;
    cols.forEach(([, w], i) => {
      h = Math.max(h, doc.heightOfString(r[i] ?? "", { width: w - 12 }));
    });
    if (y + h + 10 > doc.page.height - 120) {
      doc.addPage();
      y = 48;
    }
    x = x0;
    cols.forEach(([, w, align], i) => {
      doc.text(r[i] ?? "", x + 6, y + 3, { width: w - 12, align });
      x += w;
    });
    y += h + 8;
    doc.moveTo(x0, y - 2).lineTo(x0 + total, y - 2).strokeColor(LINE).lineWidth(0.4).stroke();
  }
  doc.y = y + 4;
}

function totalBox(doc: Doc, amount: number) {
  const w = doc.page.width - 96;
  const y = doc.y + 4;
  doc.rect(48, y, w, 34).fill(ACCENT);
  doc.font(FONT_BOLD).fontSize(14).fillColor("#ffffff").text("ยอดชำระรวมทั้งสิ้น", 60, y + 7, { width: w / 2 });
  doc.text(`${baht(amount)} บาท`, 48 + w / 2, y + 7, { width: w / 2 - 12, align: "right" });
  doc.y = y + 46;
}

function contactsBlock(doc: Doc, c: ProofCommon) {
  const ct = c.contacts;
  if (!ct) return;
  const fullW = doc.page.width - 96;
  const fmt = (x: { name: string; phone: string }) => (x.phone ? `${x.name}  ${x.phone}` : x.name);
  if (ct.bookingContacts.length) {
    doc.moveDown(0.2);
    doc.font(FONT_BOLD).fontSize(10.5).fillColor(INK).text("ติดต่อจองโต๊ะ: ", 48, doc.y, { continued: true, width: fullW });
    doc.font(FONT_REG).fillColor(MUTED).text(ct.bookingContacts.map((x) => (x.phone ? `${x.name} โทร. ${x.phone}` : x.name)).join("   |   "), { width: fullW });
  }
  if (ct.coordinators.length) {
    doc.moveDown(0.2);
    doc.font(FONT_BOLD).fontSize(10.5).fillColor(INK).text("ผู้ประสานงาน", 48, doc.y, { width: fullW });
    doc.font(FONT_REG).fontSize(10).fillColor(MUTED);
    const colW = fullW / 2;
    const rows = Math.ceil(ct.coordinators.length / 2);
    const top = doc.y;
    const lineH = 13;
    ct.coordinators.forEach((x, i) => {
      // เรียงลงตามคอลัมน์ซ้ายก่อน แล้วค่อยคอลัมน์ขวา
      const col = Math.floor(i / rows);
      const row = i % rows;
      doc.text(fmt(x), 48 + col * colW, top + row * lineH, { width: colW - 6, lineBreak: false });
    });
    doc.x = 48;
    doc.y = top + rows * lineH;
  }
}

function footer(doc: Doc, c: ProofCommon) {
  if (c.slipRef) {
    doc.font(FONT_REG).fontSize(10.5).fillColor(MUTED).text(`เลขอ้างอิงรายการโอน: ${c.slipRef}`, 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.4);
  }
  hr(doc);
  doc.font(FONT_BOLD).fontSize(11).fillColor(INK).text(c.orgName, 48, doc.y);
  doc.font(FONT_REG).fontSize(10.5).fillColor(MUTED);
  for (const l of c.contactLines) doc.text(l, 48, doc.y, { width: doc.page.width - 96 });
  contactsBlock(doc, c);
  doc.moveDown(0.15);
  doc.text("เอกสารฉบับนี้สร้างโดยระบบอัตโนมัติ ไม่ต้องมีลายมือชื่อ", 48, doc.y, { width: doc.page.width - 96 });
}

const itemLabel = (name: string, size: string | null) => (size ? `${name} (ไซส์ ${size})` : name);

export async function buildMerchProofPdf(d: MerchProofData): Promise<Buffer> {
  const doc = newDoc();
  header(doc, `PP-${d.orderCode.replace(/^MO-/, "")}`, d);
  kv(doc, "ประเภทรายการ", "สั่งซื้อของที่ระลึก");
  kv(doc, "รหัสการสั่งซื้อ", d.orderCode);
  doc.moveDown(0.5);
  payerBlock(doc, d);
  const rows = d.items.map((it) => [
    itemLabel(it.name, it.size),
    String(it.quantity),
    baht(it.unitPrice),
    baht(it.unitPrice * it.quantity),
  ]);
  rows.push(["ค่าจัดส่ง", "", "", baht(d.shippingFee)]);
  table(doc, [["รายการ", 245, "left"], ["จำนวน", 60, "right"], ["ราคา/หน่วย", 95, "right"], ["จำนวนเงิน", 95, "right"]], rows);
  totalBox(doc, d.totalAmount);
  footer(doc, d);
  return toBuffer(doc);
}

export async function buildReservationProofPdf(d: ReservationProofData): Promise<Buffer> {
  const doc = newDoc();
  header(doc, `PP-${d.bookingCode.replace(/^BK-/, "")}`, d);
  kv(doc, "ประเภทรายการ", d.packageName ? `จองโต๊ะแบบแพ็กเกจ (${d.packageName})` : "จองโต๊ะงานเลี้ยง");
  kv(doc, "รหัสการจอง", d.bookingCode);
  doc.moveDown(0.5);
  payerBlock(doc, d);
  doc.font(FONT_BOLD).fontSize(13).fillColor(ACCENT).text("รายละเอียดการจอง", 48, doc.y);
  doc.moveDown(0.2);
  kv(doc, "งาน", d.eventName);
  if (d.eventDate) kv(doc, "วันที่จัดงาน", thDate(d.eventDate));
  if (d.location) kv(doc, "สถานที่", d.location);
  kv(doc, "โต๊ะหมายเลข", String(d.tableNumber) + (d.zone ? ` (โซน ${d.zone})` : ""));
  kv(doc, "จำนวนที่นั่ง", d.isFullTable ? `${d.seatCount} ที่นั่ง (จองยกโต๊ะ)` : `${d.seatCount} ที่นั่ง`);
  if (d.packageItems.length) {
    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(13).fillColor(ACCENT).text("ของที่ระลึกในแพ็กเกจ", 48, doc.y);
    doc.moveDown(0.2);
    table(doc, [["รายการ", 395, "left"], ["จำนวน", 100, "right"]], d.packageItems.map((it) => [itemLabel(it.name, it.size), String(it.quantity)]));
  }
  doc.moveDown(0.4);
  totalBox(doc, d.totalAmount);
  if (d.checkinQrPng) {
    const qy = doc.y + 6;
    doc.image(d.checkinQrPng, 48, qy, { fit: [80, 80] });
    doc.font(FONT_BOLD).fontSize(12.5).fillColor(INK).text("QR Code สำหรับเช็กอิน", 184, qy + 8, { width: doc.page.width - 184 - 48 });
    doc.font(FONT_REG).fontSize(11.5).fillColor(MUTED).text("แสดง QR นี้ที่จุดลงทะเบียนในวันงาน เพื่อรับที่นั่งและของที่ระลึก", 184, doc.y + 2, { width: doc.page.width - 184 - 48 });
    doc.text(`รหัสการจอง ${d.bookingCode}`, 184, doc.y + 2, { width: doc.page.width - 184 - 48 });
    doc.y = qy + 86;
  } else {
    doc.font(FONT_REG).fontSize(11).fillColor(MUTED).text("กรุณาแสดง QR Code ที่แนบในอีเมลยืนยันการจองที่จุดลงทะเบียนหน้างาน", 48, doc.y, { width: doc.page.width - 96 });
    doc.moveDown(0.6);
  }
  footer(doc, d);
  return toBuffer(doc);
}
