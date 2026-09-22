import nodemailer from "nodemailer";
import { Resend } from "resend";
import { generateQrPngBuffer, checkinUrl } from "./qrcode";
import { logEmail } from "./auditLog";
import { supportReward } from "./supportConfig";
import { trackingUrl } from "./shipping";

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

// ---------------------------------------------------------------------------
// Deliverability helpers — every outgoing mail goes through mailExtras():
//   * appends a footer (who sent it + how to reach us)
//   * adds a plain-text alternative (HTML-only mail scores worse with spam filters)
//   * sets Reply-To to a mailbox a person actually reads (MAIL_REPLY_TO)
// Configure via env: MAIL_REPLY_TO, MAIL_ORG_NAME, MAIL_CONTACT_PHONE,
// MAIL_CONTACT_EMAIL (falls back to MAIL_REPLY_TO), MAIL_ORG_ADDRESS.
// ---------------------------------------------------------------------------

function mailOrgName(): string {
  return process.env.MAIL_ORG_NAME || "วิทยาลัยเทคนิคอุดรธานี";
}

function mailReplyTo(): string | undefined {
  return process.env.MAIL_REPLY_TO || undefined;
}

function mailFooterLines(): string[] {
  const lines: string[] = [mailOrgName()];
  if (process.env.MAIL_ORG_ADDRESS) lines.push(process.env.MAIL_ORG_ADDRESS);
  const contact: string[] = [];
  const contactEmail = process.env.MAIL_CONTACT_EMAIL || process.env.MAIL_REPLY_TO;
  if (process.env.MAIL_CONTACT_PHONE) contact.push(`โทร ${process.env.MAIL_CONTACT_PHONE}`);
  if (contactEmail) contact.push(`อีเมล ${contactEmail}`);
  if (contact.length) lines.push(`ติดต่อสอบถาม: ${contact.join(" · ")}`);
  if (process.env.APP_BASE_URL) lines.push(`เว็บไซต์: ${process.env.APP_BASE_URL}`);
  return lines;
}

function withFooter(html: string): string {
  const [org, ...rest] = mailFooterLines();
  const restHtml = rest.map((l) => `${escapeHtml(l)}<br/>`).join("\n        ");
  return `${html}
    <div style="font-family: sans-serif; font-size: 12px; line-height: 1.6; color: #64748b; border-top: 1px solid #e2e8f0; margin-top: 24px; padding-top: 12px;">
      <strong>${escapeHtml(org)}</strong><br/>
        ${restHtml}
      อีเมลฉบับนี้ส่งโดยระบบอัตโนมัติเนื่องจากท่านทำรายการในระบบงานคืนสู่เหย้า หากท่านไม่ได้เป็นผู้ทำรายการ กรุณาแจ้งเจ้าหน้าที่หรือละเว้นอีเมลนี้
    </div>`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
      const text = String(label).replace(/<[^>]+>/g, "").trim();
      return text && text !== href ? `${text} (${href})` : href;
    })
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, "")
    .replace(/<\/(h1|h2|h3|p|div|ul|ol)>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \t]+/gm, "")
    .trim();
}

function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Spread into resend.emails.send() / transport.sendMail() in place of `html`. */
function mailExtras(html: string): { html: string; text: string; replyTo: string | undefined } {
  const full = withFooter(html);
  return { html: full, text: htmlToText(full), replyTo: mailReplyTo() };
}

interface ConfirmationEmailArgs {
  to: string;
  bookerName: string;
  eventName: string;
  tableNumber: number;
  bookingCode: string;
  qrCodeToken: string;
}

function buildHtml(args: ConfirmationEmailArgs) {
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ยืนยันการจองโต๊ะสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>การจองของท่านสำหรับงาน <strong>${args.eventName}</strong> ได้รับการยืนยันแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
        <li>โต๊ะหมายเลข: <strong>${args.tableNumber}</strong></li>
      </ul>
      <p>กรุณาแสดง QR Code นี้ที่จุดลงทะเบียนหน้างาน</p>
      <img src="cid:qrcode-checkin" alt="QR Code" width="250" height="250" />
    </div>
  `;
}

/**
 * Resend path. Tried first if RESEND_API_KEY is set (matches the old
 * Supabase app's implementation) — the user has a working Resend key from
 * that system and would rather reuse it than stand up SMTP from scratch.
 * Resend's attachment API takes a base64 string + `contentId`, unlike
 * nodemailer's Buffer + `cid`, so the QR buffer is base64-encoded here.
 */
async function sendViaResend(args: ConfirmationEmailArgs): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const qrBuffer = await generateQrPngBuffer(checkinUrl(args.qrCodeToken));

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: args.to,
    subject: `ยืนยันการจองโต๊ะ - ${args.eventName}`,
    ...mailExtras(buildHtml(args)),
    attachments: [
      {
        filename: "checkin-qr.png",
        content: qrBuffer.toString("base64"),
        contentId: "qrcode-checkin",
      },
    ],
  });

  if (error) {
    throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  }
}

/**
 * SMTP path (nodemailer), unchanged from the original scaffold — used as a
 * fallback when RESEND_API_KEY is not set but SMTP_HOST is.
 */
async function sendViaSmtp(args: ConfirmationEmailArgs): Promise<void> {
  const qrBuffer = await generateQrPngBuffer(checkinUrl(args.qrCodeToken));
  const transport = getTransport();

  await transport.sendMail({
    from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
    to: args.to,
    subject: `ยืนยันการจองโต๊ะ - ${args.eventName}`,
    ...mailExtras(buildHtml(args)),
    attachments: [
      {
        filename: "checkin-qr.png",
        content: qrBuffer,
        cid: "qrcode-checkin",
      },
    ],
  });
}

/**
 * Sends the confirmation email with an inline QR code (CID attachment, not a
 * data-URI) pointing at the admin check-in URL. Per business rule #4, this
 * function MUST NEVER throw out to its caller — any failure (bad env,
 * network issue) is caught and logged so it never blocks slip approval.
 *
 * Provider selection: Resend first (if RESEND_API_KEY is set), else SMTP
 * (if SMTP_HOST is set), else skip with a warning. This lets the user reuse
 * their existing Resend API key from the old system without needing to also
 * configure SMTP.
 */
export async function sendConfirmationEmail(args: ConfirmationEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend(args);
      await logEmail({ type: "CONFIRMATION", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      await sendViaSmtp(args);
      await logEmail({ type: "CONFIRMATION", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping confirmation email"
    );
  } catch (err) {
    console.error("[mailer] failed to send confirmation email (non-fatal):", err);
    await logEmail({ type: "CONFIRMATION", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface BookingReceivedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  eventName: string;
  tableNumber: number | null;
  zone: string | null;
  bookingType: "full_table" | "seats";
  seatCount: number;
  totalAmount: number;
  bookingCode: string;
}

// Same URL shape the booking form itself navigates to after a successful
// booking (see reserve-form.tsx) — the phone number is required there as
// the shared-secret pairing with the booking code (anti-IDOR: neither alone
// is enough to look up someone else's reservation).
function uploadSlipUrl(bookingCode: string, bookerPhone: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/reservations/${bookingCode}/upload-slip?phone=${encodeURIComponent(bookerPhone)}`;
}

function buildBookingReceivedHtml(args: BookingReceivedEmailArgs) {
  const slipUrl = uploadSlipUrl(args.bookingCode, args.bookerPhone);
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>จองโต๊ะสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับการจองพร้อมสลิปการโอนเงินของท่านสำหรับงาน <strong>${args.eventName}</strong> เรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
        ${args.tableNumber ? `<li>โต๊ะหมายเลข: <strong>${args.tableNumber}${args.zone ? ` (โซน ${args.zone})` : ""}</strong></li>` : ""}
        <li>${args.bookingType === "full_table" ? "เหมาโต๊ะ" : "จองที่นั่ง"} · ${args.seatCount} ที่นั่ง</li>
        <li>ยอดชำระ: <strong>${args.totalAmount.toLocaleString("th-TH")} บาท</strong></li>
      </ul>
      <p>เจ้าหน้าที่กำลังตรวจสอบสลิปการโอนเงินของท่าน เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันพร้อม QR Code สำหรับเช็คอินหน้างานให้อีกครั้ง</p>
      <p style="color:#64748b; font-size:12px;">หากยังไม่ได้แนบสลิป หรือต้องการแนบสลิปใหม่ สามารถอัปโหลดได้ที่ลิงก์นี้: ${slipUrl}</p>
    </div>
  `;
}

/**
 * Sent right after a booking is created (no QR yet — that only goes out once
 * an admin approves the payment slip via sendConfirmationEmail above). Same
 * fail-soft contract: never throws, so a bad/missing RESEND_API_KEY or SMTP
 * config can never block the booking itself. Ported from the old Supabase
 * app's sendBookingReceivedEmail.
 */
export async function sendBookingReceivedEmail(args: BookingReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `จองโต๊ะสำเร็จ - ${args.eventName}`,
        ...mailExtras(buildBookingReceivedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "BOOKING_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `จองโต๊ะสำเร็จ - ${args.eventName}`,
        ...mailExtras(buildBookingReceivedHtml(args)),
      });
      await logEmail({ type: "BOOKING_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping booking-received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send booking-received email (non-fatal):", err);
    await logEmail({ type: "BOOKING_RECEIVED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface MerchOrderConfirmedEmailArgs {
  to: string;
  bookerName: string;
  orderCode: string;
  shippingAddress: string;
  shippingFee: number;
  totalAmount: number;
  items: { productName: string; size: string | null; quantity: number }[];
}

function buildMerchOrderConfirmedHtml(args: MerchOrderConfirmedEmailArgs) {
  const rows = args.items
    .map(
      (it) =>
        `<li>${it.productName}${it.size ? ` (ไซส์ ${it.size})` : ""} × ${it.quantity}</li>`
    )
    .join("");
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ยืนยันการสั่งซื้อของที่ระลึกสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>การสั่งซื้อของที่ระลึกของท่านได้รับการตรวจสอบและยืนยันเรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการสั่งซื้อ: <strong>${args.orderCode}</strong></li>
        <li>ค่าจัดส่ง: <strong>${args.shippingFee.toLocaleString("th-TH")} บาท</strong></li>
        <li>ยอดชำระรวม: <strong>${args.totalAmount.toLocaleString("th-TH")} บาท</strong></li>
      </ul>
      <p><strong>รายการสินค้า:</strong></p>
      <ul>${rows}</ul>
      <p><strong>จัดส่งไปที่:</strong><br/>${args.shippingAddress.replace(/\n/g, "<br/>")}</p>
      <p>ทางวิทยาลัยจะดำเนินการจัดส่งสินค้าตามที่อยู่ที่ท่านแจ้งไว้ ขอบคุณที่อุดหนุนของที่ระลึกงานคืนสู่เหย้าครับ/ค่ะ</p>
    </div>
  `;
}

/**
 * Sent once an admin approves a merch order's payment slip (paymentStatus ->
 * confirmed) — the merch equivalent of sendConfirmationEmail above, minus
 * the check-in QR (merch orders aren't checked in at the event). Same
 * fail-soft contract: never throws, so a bad/missing mail config can never
 * block slip approval.
 */
export async function sendMerchOrderConfirmedEmail(args: MerchOrderConfirmedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `ยืนยันการสั่งซื้อของที่ระลึก - ${args.orderCode}`,
        ...mailExtras(buildMerchOrderConfirmedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "MERCH_ORDER_CONFIRMED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `ยืนยันการสั่งซื้อของที่ระลึก - ${args.orderCode}`,
        ...mailExtras(buildMerchOrderConfirmedHtml(args)),
      });
      await logEmail({ type: "MERCH_ORDER_CONFIRMED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch order confirmed email"
    );
  } catch (err) {
    console.error("[mailer] failed to send merch order confirmed email (non-fatal):", err);
    await logEmail({ type: "MERCH_ORDER_CONFIRMED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface MerchOrderReceivedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  orderCode: string;
  shippingAddress: string;
  shippingFee: number;
  totalAmount: number;
  items: { productName: string; size: string | null; quantity: number }[];
}

function uploadMerchSlipUrl(orderCode: string, bookerPhone: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/merch/orders/${orderCode}/upload-slip?phone=${encodeURIComponent(bookerPhone)}`;
}

function buildMerchOrderReceivedHtml(args: MerchOrderReceivedEmailArgs) {
  const slipUrl = uploadMerchSlipUrl(args.orderCode, args.bookerPhone);
  const rows = args.items
    .map(
      (it) =>
        `<li>${it.productName}${it.size ? ` (ไซส์ ${it.size})` : ""} × ${it.quantity}</li>`
    )
    .join("");
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>สั่งซื้อของที่ระลึกสำเร็จ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับคำสั่งซื้อของที่ระลึกพร้อมสลิปการโอนเงินของท่านเรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการสั่งซื้อ: <strong>${args.orderCode}</strong></li>
        <li>ค่าจัดส่ง: <strong>${args.shippingFee.toLocaleString("th-TH")} บาท</strong></li>
        <li>ยอดชำระรวม: <strong>${args.totalAmount.toLocaleString("th-TH")} บาท</strong></li>
      </ul>
      <p><strong>รายการสินค้า:</strong></p>
      <ul>${rows}</ul>
      <p><strong>จัดส่งไปที่:</strong><br/>${args.shippingAddress.replace(/\n/g, "<br/>")}</p>
      <p>เราได้รับสลิปการโอนเงินของท่านแล้ว เจ้าหน้าที่กำลังตรวจสอบ เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันการสั่งซื้อให้อีกครั้ง</p>
      <p style="color:#64748b; font-size:12px;">หากยังไม่ได้แนบสลิป หรือต้องการแนบสลิปใหม่ สามารถอัปโหลดได้ที่ลิงก์นี้: ${slipUrl}</p>
    </div>
  `;
}

/**
 * Sent right after a merch order is created — the merch equivalent of
 * sendBookingReceivedEmail above. Same fail-soft contract: never throws, so
 * a bad/missing mail config can never block order creation.
 */
export async function sendMerchOrderReceivedEmail(args: MerchOrderReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `สั่งซื้อของที่ระลึกสำเร็จ - ${args.orderCode}`,
        ...mailExtras(buildMerchOrderReceivedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "MERCH_ORDER_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `สั่งซื้อของที่ระลึกสำเร็จ - ${args.orderCode}`,
        ...mailExtras(buildMerchOrderReceivedHtml(args)),
      });
      await logEmail({ type: "MERCH_ORDER_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch order received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send merch order received email (non-fatal):", err);
    await logEmail({ type: "MERCH_ORDER_RECEIVED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface MerchSlipReceivedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  orderCode: string;
}

// Same status-check page the shop's own nav links to — orderCode + phone as
// the shared-secret pairing (anti-IDOR), mirroring uploadMerchSlipUrl above.
function merchOrderStatusUrl(orderCode: string, bookerPhone: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/merch/status?orderCode=${encodeURIComponent(orderCode)}&phone=${encodeURIComponent(bookerPhone)}`;
}

function buildMerchSlipReceivedHtml(args: MerchSlipReceivedEmailArgs) {
  const statusUrl = merchOrderStatusUrl(args.orderCode, args.bookerPhone);
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ได้รับสลิปแล้ว รอตรวจสอบ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับสลิปการโอนเงินสำหรับการสั่งซื้อของที่ระลึกของท่านเรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการสั่งซื้อ: <strong>${args.orderCode}</strong></li>
      </ul>
      <p>เจ้าหน้าที่กำลังตรวจสอบสลิปของท่าน เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันการสั่งซื้อให้อีกครั้ง</p>
      <p style="margin: 20px 0;">
        <a href="${statusUrl}" style="display:inline-block; background:#1e3a8a; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px;">ตรวจสอบสถานะการสั่งซื้อ</a>
      </p>
      <p style="color:#64748b; font-size:12px;">หรือคัดลอกลิงก์นี้: ${statusUrl}</p>
    </div>
  `;
}

/**
 * Sent right after a merch order's slip is uploaded (paymentStatus ->
 * awaiting_verify), before an admin has reviewed it — the merch equivalent
 * of sendSlipReceivedEmail above. Same fail-soft contract: never throws, so
 * a bad/missing mail config can never block the slip upload itself.
 */
export async function sendMerchSlipReceivedEmail(args: MerchSlipReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.orderCode}`,
        ...mailExtras(buildMerchSlipReceivedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "MERCH_SLIP_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.orderCode}`,
        ...mailExtras(buildMerchSlipReceivedHtml(args)),
      });
      await logEmail({ type: "MERCH_SLIP_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch slip received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send merch slip received email (non-fatal):", err);
    await logEmail({ type: "MERCH_SLIP_RECEIVED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface SlipReceivedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  eventName: string;
  bookingCode: string;
}

// Same status-check page the site's own nav links to — bookingCode + phone
// as the shared-secret pairing (anti-IDOR), mirroring uploadSlipUrl above.
function reservationStatusUrl(bookingCode: string, bookerPhone: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base}/status?bookingCode=${encodeURIComponent(bookingCode)}&phone=${encodeURIComponent(bookerPhone)}`;
}

function buildSlipReceivedHtml(args: SlipReceivedEmailArgs) {
  const statusUrl = reservationStatusUrl(args.bookingCode, args.bookerPhone);
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ได้รับสลิปแล้ว รอตรวจสอบ</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เราได้รับสลิปการโอนเงินสำหรับการจองของท่านในงาน <strong>${args.eventName}</strong> เรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสการจอง: <strong>${args.bookingCode}</strong></li>
      </ul>
      <p>เจ้าหน้าที่กำลังตรวจสอบสลิปของท่าน เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันพร้อม QR Code สำหรับเช็คอินหน้างานให้อีกครั้ง</p>
      <p style="margin: 20px 0;">
        <a href="${statusUrl}" style="display:inline-block; background:#1e3a8a; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px;">ตรวจสอบสถานะการจอง</a>
      </p>
      <p style="color:#64748b; font-size:12px;">หรือคัดลอกลิงก์นี้: ${statusUrl}</p>
    </div>
  `;
}

/**
 * Sent right after a payment slip is uploaded (paymentStatus -> awaiting_
 * verify), before an admin has reviewed it — sets the booker's expectation
 * that the slip arrived and what happens next, distinct from both the
 * earlier "booking received" email (no slip yet) and the later "confirmed"
 * email with the check-in QR (only sent once an admin approves). Same
 * fail-soft contract as the other mailer functions: never throws, so a bad/
 * missing RESEND_API_KEY or SMTP config can never block the slip upload
 * itself.
 */
export async function sendSlipReceivedEmail(args: SlipReceivedEmailArgs): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.eventName}`,
        ...mailExtras(buildSlipReceivedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "SLIP_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject: `ได้รับสลิปแล้ว รอตรวจสอบ - ${args.eventName}`,
        ...mailExtras(buildSlipReceivedHtml(args)),
      });
      await logEmail({ type: "SLIP_RECEIVED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn(
      "[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping slip-received email"
    );
  } catch (err) {
    console.error("[mailer] failed to send slip-received email (non-fatal):", err);
    await logEmail({ type: "SLIP_RECEIVED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

// ---------------------------------------------------------------------------
// ลงทะเบียนศิษย์เก่าดีเด่น / ผู้สนับสนุนงาน — อีเมล 2 ฉบับ (ได้รับสลิป, ยืนยันแล้ว)
// Same fail-soft contract as every sender above: never throws.
// ---------------------------------------------------------------------------

interface SupportEmailArgs {
  to: string;
  name: string;
  type: "distinguished_alumni" | "sponsor";
  code: string;
  amount: number;
}

const SUPPORT_LABEL = { distinguished_alumni: "ศิษย์เก่าดีเด่น", sponsor: "ผู้สนับสนุนงาน" } as const;

// บรรทัด "สิ่งที่จะได้รับ" (เกียรติบัตร/โล่) ตามประเภทและยอดเงิน
function rewardLi(args: SupportEmailArgs): string {
  const reward = supportReward(args.type, args.amount);
  return reward ? `\n        <li>สิ่งที่จะได้รับ: <strong>${reward}</strong></li>` : "";
}

async function sendSupportEmail(logType: string, to: string, subject: string, html: string): Promise<void> {
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to,
        subject,
        ...mailExtras(html),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: logType, recipient: to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to,
        subject,
        ...mailExtras(html),
      });
      await logEmail({ type: logType, recipient: to, status: "SUCCESS" });
      return;
    }
    console.warn(`[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping ${logType} email`);
  } catch (err) {
    console.error(`[mailer] failed to send ${logType} email (non-fatal):`, err);
    await logEmail({ type: logType, recipient: to, status: "FAILED", error: String(err) });
  }
}

export async function sendSupportRegistrationReceivedEmail(args: SupportEmailArgs): Promise<void> {
  const label = SUPPORT_LABEL[args.type];
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ได้รับการลงทะเบียน${label}แล้ว</h2>
      <p>เรียน คุณ${escapeHtml(args.name)}</p>
      <p>เราได้รับข้อมูลการลงทะเบียน${label} พร้อมสลิปการโอนเงินของท่านเรียบร้อยแล้ว</p>
      <ul>
        <li>รหัสลงทะเบียน: <strong>${args.code}</strong></li>
        <li>ยอดชำระ: <strong>${args.amount.toLocaleString("th-TH")} บาท</strong></li>${rewardLi(args)}
      </ul>
      <p>เจ้าหน้าที่กำลังตรวจสอบสลิป เมื่อตรวจสอบเรียบร้อยแล้ว ระบบจะส่งอีเมลยืนยันให้ท่านอีกครั้ง</p>
    </div>
  `;
  await sendSupportEmail("SUPPORT_REG_RECEIVED", args.to, `ได้รับการลงทะเบียน${label} - ${args.code}`, html);
}

export async function sendSupportRegistrationConfirmedEmail(args: SupportEmailArgs): Promise<void> {
  const label = SUPPORT_LABEL[args.type];
  const thanks =
    args.type === "sponsor"
      ? "ขอบพระคุณที่ร่วมสนับสนุนงานคืนสู่เหย้า วิทยาลัยเทคนิคอุดรธานี"
      : "ขอบคุณที่ร่วมลงทะเบียนศิษย์เก่าดีเด่นในงานคืนสู่เหย้า วิทยาลัยเทคนิคอุดรธานี";
  const html = `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ยืนยันการลงทะเบียน${label}สำเร็จ</h2>
      <p>เรียน คุณ${escapeHtml(args.name)}</p>
      <p>เจ้าหน้าที่ตรวจสอบการชำระเงินของท่านเรียบร้อยแล้ว การลงทะเบียน${label}ได้รับการยืนยัน</p>
      <ul>
        <li>รหัสลงทะเบียน: <strong>${args.code}</strong></li>
        <li>ยอดชำระ: <strong>${args.amount.toLocaleString("th-TH")} บาท</strong></li>${rewardLi(args)}
      </ul>
      <p>${thanks}</p>
    </div>
  `;
  await sendSupportEmail("SUPPORT_REG_CONFIRMED", args.to, `ยืนยันการลงทะเบียน${label} - ${args.code}`, html);
}

// ---------------------------------------------------------------------------
// Merch order shipped notification (EMS tracking number)
// ---------------------------------------------------------------------------

interface MerchOrderShippedEmailArgs {
  to: string;
  bookerName: string;
  bookerPhone: string;
  orderCode: string;
  shippingAddress: string;
  carrier: string;
  trackingNumber: string;
  shippedAt: Date;
  items: { productName: string; size: string | null; quantity: number }[];
}

function buildMerchOrderShippedHtml(args: MerchOrderShippedEmailArgs) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const track = trackingUrl(args.carrier, args.trackingNumber);
  const statusUrl = `${base}/merch/status?orderCode=${encodeURIComponent(args.orderCode)}&phone=${encodeURIComponent(args.bookerPhone)}`;
  const shippedDate = args.shippedAt.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
  const rows = args.items
    .map(
      (it) =>
        `<li>${escapeHtml(it.productName)}${it.size ? ` (ไซส์ ${escapeHtml(it.size)})` : ""} × ${it.quantity}</li>`
    )
    .join("");
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>จัดส่งของที่ระลึกแล้ว</h2>
      <p>เรียน คุณ${escapeHtml(args.bookerName)}</p>
      <p>วิทยาลัยเทคนิคอุดรธานีได้นำส่งของที่ระลึกตามคำสั่งซื้อของท่านกับผู้ให้บริการขนส่งเรียบร้อยแล้ว เมื่อวันที่ ${shippedDate}</p>
      <ul>
        <li>รหัสการสั่งซื้อ: <strong>${escapeHtml(args.orderCode)}</strong></li>
        <li>ขนส่ง: <strong>${escapeHtml(args.carrier)}</strong></li>
        <li>เลขพัสดุ: <strong style="font-size:18px; letter-spacing:1px;">${escapeHtml(args.trackingNumber)}</strong></li>
      </ul>
      <p style="margin:20px 0;">
        <a href="${track}" style="background:#7f1d1d; color:#ffffff; padding:10px 20px; border-radius:8px; text-decoration:none; display:inline-block;">ติดตามพัสดุ</a>
      </p>
      <p><strong>รายการสินค้า:</strong></p>
      <ul>${rows}</ul>
      <p><strong>จัดส่งไปที่:</strong><br/>${escapeHtml(args.shippingAddress).replace(/\n/g, "<br/>")}</p>
      <p style="color:#64748b; font-size:12px;">
        เลขพัสดุอาจใช้เวลาสักครู่กว่าจะแสดงข้อมูลบนระบบของผู้ให้บริการขนส่ง<br/>
        ท่านสามารถดูเลขพัสดุได้อีกครั้งที่หน้าเช็คสถานะการสั่งซื้อ: ${statusUrl}
      </p>
    </div>
  `;
}

/**
 * Sent when staff record an EMS tracking number on a merch order. Same
 * fail-soft contract as the other mail functions (never throws), but unlike
 * them it returns whether the mail was actually sent, so the caller can
 * store shipmentEmailSentAt and tell the admin to resend on failure.
 */
export async function sendMerchOrderShippedEmail(args: MerchOrderShippedEmailArgs): Promise<boolean> {
  const subject = `จัดส่งของที่ระลึกแล้ว - ${args.orderCode}`;
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject,
        ...mailExtras(buildMerchOrderShippedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "MERCH_ORDER_SHIPPED", recipient: args.to, status: "SUCCESS" });
      return true;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject,
        ...mailExtras(buildMerchOrderShippedHtml(args)),
      });
      await logEmail({ type: "MERCH_ORDER_SHIPPED", recipient: args.to, status: "SUCCESS" });
      return true;
    }
    console.warn("[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch order shipped email");
    return false;
  } catch (err) {
    console.error("[mailer] failed to send merch order shipped email (non-fatal):", err);
    await logEmail({ type: "MERCH_ORDER_SHIPPED", recipient: args.to, status: "FAILED", error: String(err) });
    return false;
  }
}

interface ReservationRejectedEmailArgs {
  to: string;
  bookerName: string;
  eventName: string;
  bookingCode: string;
  note?: string;
}

function buildReservationRejectedHtml(args: ReservationRejectedEmailArgs) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ไม่สามารถยืนยันการจองโต๊ะได้</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เจ้าหน้าที่ตรวจสอบสลิปการโอนเงินสำหรับการจองรหัส <strong>${args.bookingCode}</strong> งาน <strong>${args.eventName}</strong> ของท่านแล้ว แต่ไม่สามารถยืนยันรายการนี้ได้ โต๊ะ/ที่นั่งของท่านจึงถูกปล่อยคืนเข้าระบบเพื่อให้ผู้อื่นจองต่อได้ครับ/ค่ะ</p>
      ${args.note ? `<p><strong>เหตุผลที่ปฏิเสธ:</strong> ${escapeHtml(args.note).replace(/\n/g, "<br/>")}</p>` : ""}
      <p>หากเป็นเพราะสลิปไม่ชัดเจน โอนผิดยอด หรือเหตุผลอื่นที่แก้ไขได้ กรุณาทำรายการจองโต๊ะใหม่อีกครั้งที่ <a href="${base}">${base}</a> แล้วแนบสลิปที่ถูกต้อง</p>
    </div>
  `;
}

/**
 * Sent when an admin rejects a reservation's payment slip (paymentStatus ->
 * rejected via releaseReservation). Explains why (admin's note, if any) and
 * points the customer at a fresh booking, since the table/seats were already
 * released back to the pool by releaseReservation and re-uploading a new
 * slip to this same reservation isn't offered — see /status page, which
 * only shows the upload-slip button for pending/awaiting_verify. Same
 * fail-soft contract as every other mailer function: never throws.
 */
export async function sendReservationRejectedEmail(args: ReservationRejectedEmailArgs): Promise<void> {
  try {
    const subject = `การจองโต๊ะไม่ผ่านการตรวจสอบ - ${args.eventName}`;
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject,
        ...mailExtras(buildReservationRejectedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "RESERVATION_REJECTED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject,
        ...mailExtras(buildReservationRejectedHtml(args)),
      });
      await logEmail({ type: "RESERVATION_REJECTED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn("[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping reservation-rejected email");
  } catch (err) {
    console.error("[mailer] failed to send reservation-rejected email (non-fatal):", err);
    await logEmail({ type: "RESERVATION_REJECTED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}

interface MerchOrderRejectedEmailArgs {
  to: string;
  bookerName: string;
  orderCode: string;
  note?: string;
}

function buildMerchOrderRejectedHtml(args: MerchOrderRejectedEmailArgs) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `
    <div style="font-family: sans-serif; line-height: 1.6;">
      <h2>ไม่สามารถยืนยันการสั่งซื้อของที่ระลึกได้</h2>
      <p>เรียน คุณ${args.bookerName}</p>
      <p>เจ้าหน้าที่ตรวจสอบสลิปการโอนเงินสำหรับคำสั่งซื้อรหัส <strong>${args.orderCode}</strong> ของท่านแล้ว แต่ไม่สามารถยืนยันรายการนี้ได้ สินค้าในคำสั่งซื้อนี้จึงถูกคืนเข้าสต๊อกเพื่อให้ลูกค้าท่านอื่นสั่งซื้อต่อได้ครับ/ค่ะ</p>
      ${args.note ? `<p><strong>เหตุผลที่ปฏิเสธ:</strong> ${escapeHtml(args.note).replace(/\n/g, "<br/>")}</p>` : ""}
      <p>หากเป็นเพราะสลิปไม่ชัดเจน โอนผิดยอด หรือเหตุผลอื่นที่แก้ไขได้ กรุณาทำรายการสั่งซื้อใหม่อีกครั้งที่ <a href="${base}/merch">${base}/merch</a> แล้วแนบสลิปที่ถูกต้อง</p>
    </div>
  `;
}

/**
 * Sent when an admin rejects a merch order's payment slip (paymentStatus ->
 * rejected). Explains why (admin's note, if any) and points the customer at
 * a fresh order, since the stock was already returned to the pool by the
 * reject route and re-uploading a new slip to this same order isn't offered
 * — see /merch/status, which only shows the upload-slip button for
 * pending/awaiting_verify. Same fail-soft contract: never throws.
 */
export async function sendMerchOrderRejectedEmail(args: MerchOrderRejectedEmailArgs): Promise<void> {
  try {
    const subject = `คำสั่งซื้อของที่ระลึกไม่ผ่านการตรวจสอบ - ${args.orderCode}`;
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        to: args.to,
        subject,
        ...mailExtras(buildMerchOrderRejectedHtml(args)),
      });
      if (error) throw new Error(typeof error === "string" ? error : JSON.stringify(error));
      await logEmail({ type: "MERCH_ORDER_REJECTED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    if (process.env.SMTP_HOST) {
      const transport = getTransport();
      await transport.sendMail({
        from: process.env.SMTP_FROM || "noreply@alumni-homecoming.local",
        to: args.to,
        subject,
        ...mailExtras(buildMerchOrderRejectedHtml(args)),
      });
      await logEmail({ type: "MERCH_ORDER_REJECTED", recipient: args.to, status: "SUCCESS" });
      return;
    }
    console.warn("[mailer] neither RESEND_API_KEY nor SMTP_HOST configured, skipping merch-order-rejected email");
  } catch (err) {
    console.error("[mailer] failed to send merch-order-rejected email (non-fatal):", err);
    await logEmail({ type: "MERCH_ORDER_REJECTED", recipient: args.to, status: "FAILED", error: String(err) });
  }
}
