"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SiteNav from "./site-nav";
import PageTitle from "@/app/components/page-title";
import PayQr from "./pay-qr";
import { generatePromptPayPayload } from "@/lib/promptpay";
import {
  DISTINGUISHED_ALUMNI_DEFAULT_AMOUNT,
  DISTINGUISHED_ALUMNI_OPTIONS,
  SPONSOR_MAX_AMOUNT,
  SPONSOR_MIN_AMOUNT,
  SPONSOR_PLAQUE_LABEL,
  SPONSOR_PLAQUE_MIN_AMOUNT,
  supportReward,
} from "@/lib/supportConfig";
import { isValidEmailFormat, normalizeEmail, validateNamePart, validateThaiPhone } from "@/lib/formValidation";

type Kind = "distinguished_alumni" | "sponsor";

const COPY: Record<
  Kind,
  { badge: string; title: string; lead: string; nameLabel: string; detailLabel: string; detailPlaceholder: string; detailRequired: boolean; submit: string; qrLabel: string }
> = {
  distinguished_alumni: {
    badge: "ศิษย์เก่าดีเด่น งานคืนสู่เหย้า",
    title: "ลงทะเบียนศิษย์เก่าดีเด่น",
    lead: "ลงทะเบียนเข้าร่วมในฐานะศิษย์เก่าดีเด่น เลือกยอด 5,000 บาท (รับเกียรติบัตรศิษย์เก่าดีเด่น) หรือ 10,000 บาท (รับโล่ศิษย์เก่าดีเด่น) ชำระผ่าน QR PromptPay แล้วแนบสลิป",
    nameLabel: "ชื่อ-นามสกุล",
    detailLabel: "รุ่น/ปีที่จบ และแผนกวิชา",
    detailPlaceholder: "เช่น รุ่น 30 ปี 2535 แผนกช่างยนต์",
    detailRequired: true,
    submit: "ลงทะเบียนและส่งสลิป",
    qrLabel: "ค่าลงทะเบียนศิษย์เก่าดีเด่น",
  },
  sponsor: {
    badge: "ผู้สนับสนุนงาน คืนสู่เหย้า",
    title: "ลงทะเบียนผู้สนับสนุนงาน",
    lead: "ร่วมเป็นผู้สนับสนุนงานคืนสู่เหย้า กำหนดวงเงินที่ต้องการสนับสนุนได้เอง ระบบจะสร้าง QR PromptPay ตามยอดให้ทันที ผู้มีอุปการคุณที่บริจาค 10,000 บาทขึ้นไป จะได้รับโล่ประกาศเกียรติคุณ",
    nameLabel: "ชื่อ-นามสกุล ผู้ติดต่อ",
    detailLabel: "ชื่อบริษัท/หน่วยงาน (ถ้ามี)",
    detailPlaceholder: "เช่น บริษัท ตัวอย่าง จำกัด",
    detailRequired: false,
    submit: "ลงทะเบียนและส่งสลิป",
    qrLabel: "สนับสนุนงานคืนสู่เหย้า",
  },
};

const SPONSOR_PRESETS = [1000, 5000, 10000, 20000, 50000];

const inputCls = (err?: string) =>
  `border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 transition-shadow ${
    err ? "border-red-400 focus:ring-red-300 focus:border-red-500" : "border-stone-300 focus:ring-primary-400 focus:border-primary-500"
  }`;

export default function SupportRegisterForm({ kind }: { kind: Kind }) {
  const c = COPY[kind];
  const isSponsor = kind === "sponsor";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [detail, setDetail] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [amountInput, setAmountInput] = useState(""); // เฉพาะผู้สนับสนุน
  const [alumniAmount, setAlumniAmount] = useState<number>(DISTINGUISHED_ALUMNI_DEFAULT_AMOUNT); // เฉพาะศิษย์เก่าดีเด่น
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // เมื่อกดส่งครั้งแรกแล้ว จะตรวจซ้ำแบบสดทุกครั้งที่แก้ข้อมูล เพื่อให้ข้อความแดงหายทันทีเมื่อกรอกถูก
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [promptPayId, setPromptPayId] = useState("");
  const [promptPayLoaded, setPromptPayLoaded] = useState(false);
  const [done, setDone] = useState<{ code: string; amount: number } | null>(null);

  useEffect(() => {
    fetch("/api/settings/promptpay")
      .then((r) => r.json())
      .then((d) => setPromptPayId(d.promptPayId || ""))
      .catch(() => {})
      .finally(() => setPromptPayLoaded(true));
  }, []);

  const amount = useMemo(() => {
    if (!isSponsor) return alumniAmount;
    const n = Math.round(Number(amountInput.replace(/,/g, "")) * 100) / 100;
    return Number.isFinite(n) && n >= SPONSOR_MIN_AMOUNT && n <= SPONSOR_MAX_AMOUNT ? n : 0;
  }, [isSponsor, amountInput, alumniAmount]);

  const reward = supportReward(kind, amount);

  const payload = useMemo(() => {
    if (!promptPayId || amount <= 0) return "";
    try {
      return generatePromptPayPayload(promptPayId, amount);
    } catch {
      return "";
    }
  }, [promptPayId, amount]);

  function computeErrors() {
    const errs: Record<string, string> = {};
    const f = validateNamePart(firstName, "ชื่อ");
    if (f) errs.firstName = f;
    const l = validateNamePart(lastName, "นามสกุล");
    if (l) errs.lastName = l;
    if (c.detailRequired && !detail.trim()) errs.detail = `กรุณากรอก${c.detailLabel}`;
    const p = validateThaiPhone(phone);
    if (p) errs.phone = p;
    if (!email.trim() || !isValidEmailFormat(email)) errs.email = "รูปแบบอีเมลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
    if (isSponsor && amount <= 0) {
      errs.amount = `กรุณาระบุวงเงินระหว่าง ${SPONSOR_MIN_AMOUNT.toLocaleString("th-TH")} - ${SPONSOR_MAX_AMOUNT.toLocaleString("th-TH")} บาท`;
    }
    if (!slipFile) errs.slipFile = "กรุณาแนบไฟล์สลิปโอนเงิน";
    if (!consent) errs.consent = "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนลงทะเบียน";
    return errs;
  }

  function validate() {
    const errs = computeErrors();
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  useEffect(() => {
    if (submitted) setFieldErrors(computeErrors());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, firstName, lastName, detail, phone, email, amount, slipFile, consent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitted(true);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("type", kind);
      fd.append("name", `${firstName.trim()} ${lastName.trim()}`);
      fd.append("detail", detail.trim());
      fd.append("phone", phone);
      fd.append("email", normalizeEmail(email));
      fd.append("amount", String(amount));
      fd.append("file", slipFile as File);
      const res = await fetch("/api/support-registrations", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setDone({ code: data.code, amount: Number(data.amount) });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div>
        <SiteNav />
        <main className="max-w-md mx-auto p-6 text-center bg-white border border-cream-200 rounded-xl shadow-md space-y-3 mt-6">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-display font-semibold text-stone-800">ส่งข้อมูลเรียบร้อยแล้ว</h1>
          <p className="text-sm text-stone-600">
            รหัสลงทะเบียนของคุณ <span className="font-mono font-semibold text-maroon-700">{done.code}</span>
          </p>
          <p className="text-sm text-stone-600">ยอดชำระ {done.amount.toLocaleString("th-TH")} บาท — เจ้าหน้าที่จะตรวจสอบสลิปและติดต่อกลับตามเบอร์โทร/อีเมลที่ระบุ</p>
          <p className="text-xs text-stone-400">กรุณาจดรหัสนี้ไว้เพื่ออ้างอิง</p>
          <Link href="/" className="inline-block mt-2 bg-maroon-700 hover:bg-maroon-800 text-white rounded-lg px-5 py-2 text-sm font-semibold">
            กลับหน้าแรก
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div>
      <SiteNav />

      <PageTitle title={c.title} />

      <main className="max-w-xl mx-auto p-4 pb-16">
        <form onSubmit={submit} noValidate className="bg-white border border-cream-200 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">
                ชื่อ <span className="text-red-600">*</span>
              </span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className={inputCls(fieldErrors.firstName)} />
              {fieldErrors.firstName && <span className="text-xs text-red-600">{fieldErrors.firstName}</span>}
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-stone-700">
                นามสกุล <span className="text-red-600">*</span>
              </span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className={inputCls(fieldErrors.lastName)} />
              {fieldErrors.lastName && <span className="text-xs text-red-600">{fieldErrors.lastName}</span>}
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700">
              {c.detailLabel} {c.detailRequired && <span className="text-red-600">*</span>}
            </span>
            <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={c.detailPlaceholder} className={inputCls(fieldErrors.detail)} />
            {fieldErrors.detail && <span className="text-xs text-red-600">{fieldErrors.detail}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700">
              เบอร์โทรศัพท์ <span className="text-red-600">*</span>
            </span>
            <input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls(fieldErrors.phone)} />
            {fieldErrors.phone && <span className="text-xs text-red-600">{fieldErrors.phone}</span>}
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-stone-700">
              อีเมล <span className="text-red-600">*</span>
            </span>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => setEmail(normalizeEmail(e.target.value))}
              className={inputCls(fieldErrors.email)}
            />
            {fieldErrors.email && <span className="text-xs text-red-600">{fieldErrors.email}</span>}
          </label>

          {/* ยอดเงิน */}
          {isSponsor ? (
            <div className="flex flex-col gap-2 text-sm border-t border-cream-200 pt-4">
              <span className="font-medium text-stone-700">
                วงเงินที่ต้องการสนับสนุน (บาท) <span className="text-red-600">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {SPONSOR_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmountInput(String(v))}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                      amount === v ? "bg-maroon-700 border-maroon-700 text-white" : "bg-white border-stone-300 text-stone-700 hover:border-maroon-700"
                    }`}
                  >
                    {v.toLocaleString("th-TH")}
                  </button>
                ))}
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="หรือพิมพ์จำนวนเงินที่ต้องการ"
                className={inputCls(fieldErrors.amount)}
              />
              {fieldErrors.amount && <span className="text-xs text-red-600">{fieldErrors.amount}</span>}
              <span className="text-xs text-stone-400">
                ขั้นต่ำ {SPONSOR_MIN_AMOUNT.toLocaleString("th-TH")} บาท — QR จะแสดงเมื่อระบุวงเงินถูกต้อง
              </span>
              <p
                className={`text-sm rounded-lg border px-3 py-2 ${
                  reward ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-cream-100 border-cream-200 text-stone-600"
                }`}
              >
                {reward
                  ? `ยอดนี้ท่านจะได้รับ${reward}`
                  : `บริจาคตั้งแต่ ${SPONSOR_PLAQUE_MIN_AMOUNT.toLocaleString("th-TH")} บาทขึ้นไป ท่านจะได้รับ${SPONSOR_PLAQUE_LABEL}`}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 text-sm border-t border-cream-200 pt-4">
              <span className="font-medium text-stone-700">
                เลือกยอดลงทะเบียน <span className="text-red-600">*</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DISTINGUISHED_ALUMNI_OPTIONS.map((o) => {
                  const active = alumniAmount === o.amount;
                  return (
                    <button
                      key={o.amount}
                      type="button"
                      onClick={() => setAlumniAmount(o.amount)}
                      aria-pressed={active}
                      className={`text-left rounded-lg border-2 px-4 py-3 transition-colors ${
                        active ? "border-maroon-700 bg-cream-100" : "border-stone-200 bg-white hover:border-maroon-700"
                      }`}
                    >
                      <span className="block text-lg font-semibold text-maroon-700">{o.amount.toLocaleString("th-TH")} บาท</span>
                      <span className="block text-sm text-stone-600">รับ{o.reward}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* QR */}
          {payload ? (
            <PayQr value={payload} amount={amount} label={c.qrLabel} size={200} boxClassName="border-t-cream-200 mt-1" />
          ) : promptPayLoaded && !promptPayId ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ยังไม่ได้ตั้งค่าบัญชี PromptPay — กรุณาติดต่อเจ้าหน้าที่เพื่อขอเลขบัญชีโอนเงิน
            </p>
          ) : isSponsor ? (
            <p className="text-sm text-stone-400 border border-dashed border-stone-300 rounded-lg px-3 py-6 text-center">ระบุวงเงินเพื่อสร้าง QR Code</p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm border-t border-cream-200 pt-3">
            <span className="font-medium text-stone-700">
              ไฟล์สลิปโอนเงิน <span className="text-red-600">*</span>
            </span>
            <span className="text-xs text-stone-400">โอนเงินตามยอดด้านบนแล้วแนบรูปสลิปที่นี่ เจ้าหน้าที่จะตรวจสอบและยืนยันการลงทะเบียน</span>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setSlipFile(e.target.files?.[0] || null)} className={inputCls(fieldErrors.slipFile)} />
            {fieldErrors.slipFile && <span className="text-xs text-red-600">{fieldErrors.slipFile}</span>}
          </label>

          <div className="border-t border-cream-200 pt-3">
            <label className="flex items-start gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="accent-maroon-700 mt-0.5" />
              <span>
                ข้าพเจ้ายินยอมให้เก็บและใช้ข้อมูลตาม{" "}
                <Link href="/privacy" target="_blank" className="text-maroon-700 underline hover:text-maroon-800">
                  นโยบายความเป็นส่วนตัว
                </Link>{" "}
                <span className="text-red-600">*</span>
              </span>
            </label>
            {fieldErrors.consent && <p className="text-xs text-red-600 mt-1">{fieldErrors.consent}</p>}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={submitting} className="w-full bg-maroon-700 hover:bg-maroon-800 transition-colors text-white rounded-lg py-2.5 font-semibold disabled:opacity-50">
            {submitting ? "กำลังส่งข้อมูล..." : c.submit}
          </button>
        </form>
      </main>
    </div>
  );
}
