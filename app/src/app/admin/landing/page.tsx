"use client";

import { useEffect, useRef, useState } from "react";

interface TimelineItem { time: string; title: string; description: string }
interface HonorGuest { name: string; role: string; photoUrl: string }
interface MerchItem { name: string; description: string; badge: string; icon: "polo" | "tshirt" | "coin" | "cup"; imageUrl: string }
interface SponsorTier { tier: string; label: string; price: string; benefits: string[]; logoUrl: string }
interface FaqItem { question: string; answer: string }

interface LandingContent {
  eventDateISO: string;
  eventDateLabel: string;
  eventDateShortLabel: string;
  registrationTime: string;
  venueName: string;
  venueAddress: string;
  parkingNote: string;
  mapUrl: string;
  pricePerSeat: number;
  pricePerTable: number;
  seatCapacityLabel: string;
  heroTitleLine1: string;
  heroTitleLine2: string;
  heroLead: string;
  heroImageUrl: string;
  timeline: TimelineItem[];
  honorGuests: HonorGuest[];
  merchItems: MerchItem[];
  sponsors: SponsorTier[];
  faq: FaqItem[];
}

interface GalleryImage {
  id: string;
  caption: string | null;
  category: string;
  sortOrder: number;
  active: boolean;
  imageUrl: string;
}

const inputCls =
  "border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-500 transition-shadow px-3 py-2 w-full text-sm";
const labelCls = "flex flex-col gap-1 text-sm";
const cardCls = "bg-white rounded-xl border border-cream-200 shadow-md p-5 space-y-4";
const sectionTitleCls = "font-display font-semibold text-stone-800 text-lg";
const smallBtn = "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors";

function ArrayEditor<T>({
  title,
  hint,
  items,
  setItems,
  makeEmpty,
  renderRow,
}: {
  title: string;
  hint?: string;
  items: T[];
  setItems: (items: T[]) => void;
  makeEmpty: () => T;
  renderRow: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  function update(i: number, patch: Partial<T>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function remove(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const t = i + dir;
    if (t < 0 || t >= items.length) return;
    const next = [...items];
    [next[i], next[t]] = [next[t], next[i]];
    setItems(next);
  }
  return (
    <div className={cardCls}>
      <div>
        <h2 className={sectionTitleCls}>{title}</h2>
        {hint && <p className="text-sm text-stone-500 mt-0.5">{hint}</p>}
      </div>
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="border border-cream-200 rounded-lg p-3 flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[220px] grid gap-2">{renderRow(item, (patch) => update(i, patch))}</div>
            <div className="flex flex-col gap-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded border border-stone-300 text-stone-600 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="w-7 h-7 rounded border border-stone-300 text-stone-600 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => remove(i)} className="w-7 h-7 rounded border border-red-300 text-red-600 text-xs">ลบ</button>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setItems([...items, makeEmpty()])}
        className="bg-stone-100 hover:bg-stone-200 transition-colors text-stone-700 rounded-lg px-4 py-2 text-sm font-semibold"
      >
        + เพิ่มรายการ
      </button>
    </div>
  );
}

// Uploads a single image (hero background, honor-guest photo, sponsor
// logo) and returns its public URL. Stateless on the server side — the
// caller is responsible for storing the returned URL into the right
// LandingContent field and saving it via the normal "บันทึกทั้งหมด" PUT.
async function uploadLandingImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/landing/upload", { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "อัปโหลดไม่สำเร็จ");
  return data.imageUrl as string;
}

export default function AdminLandingPage() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galFile, setGalFile] = useState<File | null>(null);
  const [galCaption, setGalCaption] = useState("");
  const [galCategory, setGalCategory] = useState("ทั่วไป");
  const [galUploading, setGalUploading] = useState(false);
  const [galError, setGalError] = useState("");
  const galFileRef = useRef<HTMLInputElement>(null);

  const [heroImgUploading, setHeroImgUploading] = useState(false);
  const [heroImgError, setHeroImgError] = useState("");

  function load() {
    fetch("/api/admin/landing")
      .then((r) => r.json())
      .then((d) => {
        if (d.content) setContent(d.content);
        else setLoadError("โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => setLoadError("โหลดข้อมูลไม่สำเร็จ"));
  }
  useEffect(load, []);

  function loadGallery() {
    fetch("/api/admin/landing/gallery")
      .then((r) => r.json())
      .then((d) => setGallery(d.images || []));
  }
  useEffect(loadGallery, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!content) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/admin/landing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMsg(data.error || "บันทึกไม่สำเร็จ");
        return;
      }
      setContent(data.content);
      setSaveMsg("บันทึกเรียบร้อยแล้ว");
    } finally {
      setSaving(false);
    }
  }

  async function uploadGalleryImage(e: React.FormEvent) {
    e.preventDefault();
    setGalError("");
    if (!galFile) {
      setGalError("กรุณาเลือกไฟล์รูปภาพ");
      return;
    }
    setGalUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", galFile);
      if (galCaption.trim()) fd.append("caption", galCaption.trim());
      fd.append("category", galCategory.trim() || "ทั่วไป");
      const res = await fetch("/api/admin/landing/gallery", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setGalError(data.error || "อัปโหลดไม่สำเร็จ");
        return;
      }
      setGalFile(null);
      setGalCaption("");
      if (galFileRef.current) galFileRef.current.value = "";
      loadGallery();
    } finally {
      setGalUploading(false);
    }
  }

  async function toggleGalleryActive(img: GalleryImage) {
    await fetch(`/api/admin/landing/gallery/${img.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !img.active }),
    });
    loadGallery();
  }

  async function moveGallery(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= gallery.length) return;
    const a = gallery[index];
    const b = gallery[target];
    await Promise.all([
      fetch(`/api/admin/landing/gallery/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: b.sortOrder }),
      }),
      fetch(`/api/admin/landing/gallery/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: a.sortOrder }),
      }),
    ]);
    loadGallery();
  }

  async function deleteGalleryImage(id: string) {
    if (!confirm("ยืนยันลบรูปนี้?")) return;
    const res = await fetch(`/api/admin/landing/gallery/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) alert(data.error || "ลบไม่สำเร็จ");
    loadGallery();
  }

  if (loadError) return <p className="text-red-600 text-sm">{loadError}</p>;
  if (!content) return <p className="text-stone-500 text-sm">กำลังโหลด...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-semibold text-stone-800">จัดการหน้าแรก (Landing 89 ปี)</h1>
        <p className="text-sm text-stone-500 mt-0.5">
          แก้ไขข้อมูลที่แสดงบนหน้าแรกของเว็บไซต์ — บันทึกด้วยปุ่ม &quot;บันทึกทั้งหมด&quot; ด้านล่างสุด ยกเว้นคลังภาพซึ่งบันทึกทันทีที่อัปโหลด/ลบ
        </p>
      </div>

      <form onSubmit={save} className="space-y-4">
        <div className={cardCls}>
          <h2 className={sectionTitleCls}>ข้อมูลงานหลัก</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className="font-medium">หัวข้อหลัก บรรทัดที่ 1</span>
              <input className={inputCls} value={content.heroTitleLine1} onChange={(e) => setContent({ ...content, heroTitleLine1: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">หัวข้อหลัก บรรทัดที่ 2</span>
              <input className={inputCls} value={content.heroTitleLine2} onChange={(e) => setContent({ ...content, heroTitleLine2: e.target.value })} />
            </label>
          </div>
          <label className={labelCls}>
            <span className="font-medium">คำโปรย (ใต้หัวข้อหลัก)</span>
            <textarea className={inputCls} rows={2} value={content.heroLead} onChange={(e) => setContent({ ...content, heroLead: e.target.value })} />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className="font-medium">วันที่-เวลาจัดงาน (ISO, ใช้นับถอยหลัง)</span>
              <input className={inputCls} value={content.eventDateISO} onChange={(e) => setContent({ ...content, eventDateISO: e.target.value })} placeholder="2026-12-20T17:00:00+07:00" />
            </label>
            <label className={labelCls}>
              <span className="font-medium">เวลาเริ่มลงทะเบียน (ข้อความแสดงผล)</span>
              <input className={inputCls} value={content.registrationTime} onChange={(e) => setContent({ ...content, registrationTime: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">วันที่ (ข้อความยาว)</span>
              <input className={inputCls} value={content.eventDateLabel} onChange={(e) => setContent({ ...content, eventDateLabel: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">วันที่ (ข้อความสั้น)</span>
              <input className={inputCls} value={content.eventDateShortLabel} onChange={(e) => setContent({ ...content, eventDateShortLabel: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">ชื่อสถานที่ (สั้น)</span>
              <input className={inputCls} value={content.venueName} onChange={(e) => setContent({ ...content, venueName: e.target.value })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">จำนวนที่นั่ง (ข้อความ)</span>
              <input className={inputCls} value={content.seatCapacityLabel} onChange={(e) => setContent({ ...content, seatCapacityLabel: e.target.value })} />
            </label>
          </div>
          <label className={labelCls}>
            <span className="font-medium">ที่อยู่สถานที่จัดงาน (เต็ม)</span>
            <textarea className={inputCls} rows={2} value={content.venueAddress} onChange={(e) => setContent({ ...content, venueAddress: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className="font-medium">หมายเหตุที่จอดรถ</span>
            <input className={inputCls} value={content.parkingNote} onChange={(e) => setContent({ ...content, parkingNote: e.target.value })} />
          </label>
          <label className={labelCls}>
            <span className="font-medium">ลิงก์แผนที่ (Google Maps)</span>
            <input className={inputCls} value={content.mapUrl} onChange={(e) => setContent({ ...content, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className="font-medium">ราคาบัตร/ที่นั่ง (บาท)</span>
              <input type="number" className={inputCls} value={content.pricePerSeat} onChange={(e) => setContent({ ...content, pricePerSeat: Number(e.target.value) || 0 })} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">ราคาโต๊ะ (บาท)</span>
              <input type="number" className={inputCls} value={content.pricePerTable} onChange={(e) => setContent({ ...content, pricePerTable: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <label className={labelCls}>
            <span className="font-medium">รูปพื้นหลัง Hero (ไม่บังคับ)</span>
            <div className="flex items-center gap-3 flex-wrap">
              {content.heroImageUrl && (
                <img src={content.heroImageUrl} alt="พื้นหลัง Hero" className="w-28 h-16 object-cover rounded-lg border border-cream-200" />
              )}
              <input
                type="file"
                accept="image/*"
                className="text-sm"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setHeroImgError("");
                  setHeroImgUploading(true);
                  try {
                    const imageUrl = await uploadLandingImage(file);
                    setContent({ ...content, heroImageUrl: imageUrl });
                  } catch (err) {
                    setHeroImgError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
                  } finally {
                    setHeroImgUploading(false);
                  }
                }}
              />
              {heroImgUploading && <span className="text-xs text-stone-500">กำลังอัปโหลด...</span>}
              {content.heroImageUrl && (
                <button type="button" onClick={() => setContent({ ...content, heroImageUrl: "" })} className="text-xs text-red-600 hover:underline">ลบรูป</button>
              )}
            </div>
            {heroImgError && <span className="text-xs text-red-600">{heroImgError}</span>}
            <span className="text-xs text-stone-400">แนะนำรูปแนวนอนขนาดใหญ่ (1600×900px ขึ้นไป) จะแสดงเป็นพื้นหลังส่วน Hero บนสุดของหน้าแรก หากไม่อัปโหลด จะใช้พื้นหลังไล่สีเดิม</span>
          </label>
        </div>

        <ArrayEditor<TimelineItem>
          title="กำหนดการ (Timeline)"
          hint="เรียงตามลำดับเวลาในคืนงาน"
          items={content.timeline}
          setItems={(timeline) => setContent({ ...content, timeline })}
          makeEmpty={() => ({ time: "", title: "", description: "" })}
          renderRow={(item, update) => (
            <>
              <input className={inputCls} placeholder="เวลา เช่น 17:00" value={item.time} onChange={(e) => update({ time: e.target.value })} />
              <input className={inputCls} placeholder="หัวข้อ" value={item.title} onChange={(e) => update({ title: e.target.value })} />
              <input className={inputCls} placeholder="รายละเอียด" value={item.description} onChange={(e) => update({ description: e.target.value })} />
            </>
          )}
        />

        <ArrayEditor<HonorGuest>
          title="รายชื่อคุณครู / แขกผู้มีเกียรติ"
          items={content.honorGuests}
          setItems={(honorGuests) => setContent({ ...content, honorGuests })}
          makeEmpty={() => ({ name: "", role: "", photoUrl: "" })}
          renderRow={(item, update) => (
            <>
              <input className={inputCls} placeholder="ชื่อ / ตำแหน่ง" value={item.name} onChange={(e) => update({ name: e.target.value })} />
              <input className={inputCls} placeholder="คำอธิบาย" value={item.role} onChange={(e) => update({ role: e.target.value })} />
              <div className="flex items-center gap-2 flex-wrap">
                {item.photoUrl && (
                  <img src={item.photoUrl} alt={item.name} className="w-12 h-12 rounded-full object-cover border border-cream-200" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imageUrl = await uploadLandingImage(file);
                      update({ photoUrl: imageUrl });
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
                    }
                  }}
                />
                {item.photoUrl && (
                  <button type="button" onClick={() => update({ photoUrl: "" })} className="text-xs text-red-600 hover:underline">ลบรูป</button>
                )}
              </div>
            </>
          )}
        />

        <ArrayEditor<MerchItem>
          title="ของที่ระลึก"
          hint="อัปโหลดรูปจริงของสินค้าเพื่อแสดงแทนไอคอน — หากไม่อัปโหลด การ์ดจะแสดงไอคอนตามที่เลือกด้านล่างแทน"
          items={content.merchItems}
          setItems={(merchItems) => setContent({ ...content, merchItems })}
          makeEmpty={() => ({ name: "", description: "", badge: "สั่งซื้อเพิ่ม", icon: "polo", imageUrl: "" })}
          renderRow={(item, update) => (
            <>
              <input className={inputCls} placeholder="ชื่อสินค้า" value={item.name} onChange={(e) => update({ name: e.target.value })} />
              <input className={inputCls} placeholder="รายละเอียด" value={item.description} onChange={(e) => update({ description: e.target.value })} />
              <div className="flex gap-2">
                <input className={inputCls} placeholder="ป้าย เช่น รวมในบัตร / สั่งซื้อเพิ่ม" value={item.badge} onChange={(e) => update({ badge: e.target.value })} />
                <select className={inputCls} value={item.icon} onChange={(e) => update({ icon: e.target.value as MerchItem["icon"] })}>
                  <option value="polo">ไอคอนเสื้อโปโล</option>
                  <option value="tshirt">ไอคอนเสื้อยืด</option>
                  <option value="coin">ไอคอนเหรียญ</option>
                  <option value="cup">ไอคอนแก้ว</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.name} className="w-16 h-16 object-cover rounded-lg border border-cream-200" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imageUrl = await uploadLandingImage(file);
                      update({ imageUrl });
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
                    }
                  }}
                />
                {item.imageUrl && (
                  <button type="button" onClick={() => update({ imageUrl: "" })} className="text-xs text-red-600 hover:underline">ลบรูป</button>
                )}
              </div>
            </>
          )}
        />

        <ArrayEditor<SponsorTier>
          title="ระดับผู้สนับสนุน"
          items={content.sponsors}
          setItems={(sponsors) => setContent({ ...content, sponsors })}
          makeEmpty={() => ({ tier: "", label: "", price: "", benefits: [], logoUrl: "" })}
          renderRow={(item, update) => (
            <>
              <div className="flex gap-2">
                <input className={inputCls} placeholder="ระดับ เช่น ระดับสูงสุด" value={item.tier} onChange={(e) => update({ tier: e.target.value })} />
                <input className={inputCls} placeholder="ชื่อระดับ เช่น Gold Sponsor" value={item.label} onChange={(e) => update({ label: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="ราคา เช่น 20,000 บาท" value={item.price} onChange={(e) => update({ price: e.target.value })} />
              <textarea
                className={inputCls}
                rows={3}
                placeholder="สิทธิประโยชน์ (1 บรรทัดต่อ 1 ข้อ)"
                value={item.benefits.join("\n")}
                onChange={(e) => update({ benefits: e.target.value.split("\n") })}
              />
              <div className="flex items-center gap-2 flex-wrap">
                {item.logoUrl && (
                  <img src={item.logoUrl} alt={item.label} className="w-16 h-16 object-contain rounded-lg border border-cream-200 bg-stone-50" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="text-xs"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const imageUrl = await uploadLandingImage(file);
                      update({ logoUrl: imageUrl });
                    } catch (err) {
                      alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
                    }
                  }}
                />
                {item.logoUrl && (
                  <button type="button" onClick={() => update({ logoUrl: "" })} className="text-xs text-red-600 hover:underline">ลบรูป</button>
                )}
              </div>
            </>
          )}
        />

        <ArrayEditor<FaqItem>
          title="คำถามที่พบบ่อย (FAQ)"
          items={content.faq}
          setItems={(faq) => setContent({ ...content, faq })}
          makeEmpty={() => ({ question: "", answer: "" })}
          renderRow={(item, update) => (
            <>
              <input className={inputCls} placeholder="คำถาม" value={item.question} onChange={(e) => update({ question: e.target.value })} />
              <textarea className={inputCls} rows={2} placeholder="คำตอบ" value={item.answer} onChange={(e) => update({ answer: e.target.value })} />
            </>
          )}
        />

        <div className={cardCls}>
          {saveMsg && <p className={saveMsg.includes("เรียบร้อย") ? "text-emerald-700 text-sm" : "text-red-600 text-sm"}>{saveMsg}</p>}
          <button type="submit" disabled={saving} className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg px-6 py-2.5 font-semibold disabled:opacity-50">
            {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
          </button>
        </div>
      </form>

      <div className={cardCls}>
        <h2 className={sectionTitleCls}>คลังภาพ (Gallery)</h2>
        <p className="text-sm text-stone-500">รูปในหมวดนี้จะแสดงในส่วน &quot;คลังภาพ&quot; ของหน้าแรก ({gallery.length} รูป)</p>

        <form onSubmit={uploadGalleryImage} className="border border-cream-200 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className={labelCls}>
              <span className="font-medium">คำบรรยายภาพ (ไม่บังคับ)</span>
              <input className={inputCls} value={galCaption} onChange={(e) => setGalCaption(e.target.value)} />
            </label>
            <label className={labelCls}>
              <span className="font-medium">หมวดหมู่</span>
              <input className={inputCls} value={galCategory} onChange={(e) => setGalCategory(e.target.value)} placeholder="เช่น คุณครู, เพื่อน, กิจกรรม" />
            </label>
          </div>
          <label className={labelCls}>
            <span className="font-medium">ไฟล์รูปภาพ *</span>
            <input ref={galFileRef} type="file" accept="image/*" onChange={(e) => setGalFile(e.target.files?.[0] || null)} className="text-sm" />
          </label>
          {galError && <p className="text-red-600 text-sm">{galError}</p>}
          <button type="submit" disabled={galUploading} className="bg-primary-600 hover:bg-primary-700 transition-colors text-white rounded-lg py-2 px-4 font-semibold disabled:opacity-50">
            {galUploading ? "กำลังอัปโหลด..." : "+ เพิ่มรูปภาพ"}
          </button>
        </form>

        {gallery.length === 0 ? (
          <div className="rounded-xl border border-dashed border-cream-200 p-8 text-center text-stone-400 text-sm">ยังไม่มีรูปภาพ — เพิ่มรูปแรกได้จากแบบฟอร์มด้านบน</div>
        ) : (
          <div className="flex flex-col gap-3">
            {gallery.map((img, idx) => (
              <div key={img.id} className="border border-cream-200 rounded-lg p-3 flex flex-wrap items-center gap-3">
                <img src={img.imageUrl} alt={img.caption || ""} className="w-24 h-16 object-cover rounded-lg border border-cream-200 shrink-0" />
                <div className="flex-1 min-w-[160px] text-sm">
                  <div className="font-medium text-stone-800">{img.caption || <span className="text-stone-400 font-normal">(ไม่มีคำบรรยาย)</span>}</div>
                  <div className="text-xs text-stone-500">หมวด: {img.category}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  <button onClick={() => moveGallery(idx, -1)} disabled={idx === 0} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 disabled:opacity-30">↑</button>
                  <button onClick={() => moveGallery(idx, 1)} disabled={idx === gallery.length - 1} className="w-8 h-8 rounded-lg border border-stone-300 text-stone-600 disabled:opacity-30">↓</button>
                  <button onClick={() => toggleGalleryActive(img)} className={`${smallBtn} ${img.active ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                    {img.active ? "แสดงอยู่" : "ซ่อนอยู่"}
                  </button>
                  <button onClick={() => deleteGalleryImage(img.id)} className="text-red-600 hover:underline text-xs px-1">ลบ</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
