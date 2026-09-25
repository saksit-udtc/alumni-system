"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SIZES, CHEST, LENGTH } from "@/app/components/size-chart";

interface EventItem {
  id: string;
  name: string;
  eventDate: string;
  location: string | null;
  status: "draft" | "open" | "closed";
  pricePerTable: string;
  pricePerSeat: string;
}

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
  howToBooking?: { title: string; description: string }[];
  howToMerch?: { title: string; description: string }[];
  howToNotes?: string[];
  // เปิด/ปิดแต่ละบล็อก (ตั้งค่าที่ /admin/landing) — ไม่มีค่า = แสดง
  visibleSections?: Partial<Record<LandingBlock, boolean>>;
}

interface HomeBannerItem { id: string; title: string | null; linkUrl: string | null; imageUrl: string }

interface GalleryImage {
  id: string;
  imageUrl: string;
  caption: string | null;
  category: string;
}

function MerchIcon({ icon }: { icon: MerchItem["icon"] }) {
  const common = { width: 60, height: 60, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.2 };
  if (icon === "tshirt")
    return (
      <svg {...common}>
        <path d="M8 3l1.5 2.5L12 4l2.5 1.5L16 3l4 4-3 3v11H7V10L4 7z" />
      </svg>
    );
  if (icon === "coin")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="5.2" />
        <path d="M12 9v6M9.8 10.2l4.4 3.6M14.2 10.2l-4.4 3.6" strokeWidth={0.9} />
      </svg>
    );
  if (icon === "cup")
    return (
      <svg {...common}>
        <path d="M7 3h10l-1 5.5c1.8.4 3 1.9 3 3.8V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6.7c0-1.9 1.2-3.4 3-3.8L7 3z" />
        <path d="M6.6 9.5h10.8" strokeWidth={0.9} />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M8 3l4 2 4-2 4 4-3 3v11H7V10L4 7z" />
    </svg>
  );
}

// รูปสินค้าที่ระลึก ด้านหน้า/ด้านหลัง (public/souvenir — มาจากโฟลเดอร์ souvenir) จับคู่กับการ์ดตาม icon ของแต่ละรายการ
const SOUVENIR_IMAGES: Record<MerchItem["icon"], { front: string; back: string }> = {
  polo: { front: "/souvenir/staff-polo-front.webp", back: "/souvenir/staff-polo-back.webp" },
  tshirt: { front: "/souvenir/staff-crew-front.webp", back: "/souvenir/staff-crew-back.webp" },
  coin: { front: "/souvenir/prize-vishnu-front.webp", back: "/souvenir/prize-vishnu-back.webp" },
  cup: { front: "/souvenir/cup-front.webp", back: "/souvenir/cup-back.webp" },
};

type LandingBlock = "hero" | "tickets" | "merch" | "howTo" | "schedule" | "honorGuests" | "venue" | "sponsors" | "faq" | "finalCta";

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

// หน้าแรก (variant="home") = สไลด์ + ปุ่มเมนู + โปสเตอร์
// หน้ารายละเอียดงาน 89 ปี (variant="full", เส้นทาง /homecoming-89) = hero นับถอยหลัง, บัตร, ของที่ระลึก, กำหนดการ, สถานที่, FAQ
// คลิกสไลด์ที่หน้าแรกจะพาไปหน้า /homecoming-89 เสมอ
export const LANDING_HREF = "/homecoming-89";

export default function LandingView({ variant }: { variant: "home" | "full" }) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [content, setContent] = useState<LandingContent | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  // แท็บในบล็อก "วิธีจองและชำระเงิน"
  const [howToTab, setHowToTab] = useState<"booking" | "merch">("booking");
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [countdown, setCountdown] = useState({ d: "--", h: "--", m: "--", s: "--" });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  // รูปที่พลิกดูด้านหลังได้ (สินค้าที่ระลึก): กดรูปในหน้าต่างขยายเพื่อสลับหน้า/หลัง
  const [lightboxFlip, setLightboxFlip] = useState<{ front: string; back: string; alt: string } | null>(null);
  const [flipping, setFlipping] = useState(false);
  function closeLightbox() {
    setLightboxImage(null);
    setLightboxFlip(null);
  }
  function flipLightbox() {
    if (!lightboxFlip || flipping) return;
    setFlipping(true);
    setTimeout(() => {
      setLightboxImage((cur) => (cur === lightboxFlip.back ? lightboxFlip.front : lightboxFlip.back));
      setFlipping(false);
    }, 150);
  }
  const router = useRouter();
  const [banners, setBanners] = useState<HomeBannerItem[]>([]);
  const [bannerSeconds, setBannerSeconds] = useState(5);
  const [slide, setSlide] = useState(0);
  // โปสเตอร์งาน (จัดการที่ /admin/poster) — ค่าเริ่มต้น = ภาพที่มากับแอป
  const [poster, setPoster] = useState({ enabled: true, imageUrl: "/poster.jpg" });
  // ข้อความแจ้งเตือนลอย (เช่น "ยังไม่มีงานที่เปิดให้จอง") — หายเองใน 4 วินาที
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []));
  }, []);

  // สไลด์แบนเนอร์หน้าแรก (จัดการที่ /admin/home-banners)
  useEffect(() => {
    if (variant !== "home") return;
    fetch("/api/home-banners")
      .then((r) => r.json())
      .then((data) => {
        setBanners(data.banners || []);
        if (Number(data.intervalSeconds) >= 1) setBannerSeconds(Number(data.intervalSeconds));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (variant !== "home") return;
    fetch("/api/poster")
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.imageUrl === "string") setPoster({ enabled: data.enabled !== false, imageUrl: data.imageUrl });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setSlide((i) => (i + 1) % banners.length), bannerSeconds * 1000);
    return () => clearInterval(t);
  }, [banners.length, bannerSeconds, slide]);

  useEffect(() => {
    if (variant !== "full") return;
    fetch("/api/landing")
      .then((r) => r.json())
      .then((data) => {
        setContent(data.content || null);
        setGallery(data.gallery || []);
      });
  }, []);

  useEffect(() => {
    if (!content?.eventDateISO) return;
    const target = new Date(content.eventDateISO).getTime();
    if (!Number.isFinite(target)) return;
    function tick() {
      const diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setCountdown({ d: pad2(d), h: pad2(h), m: pad2(m), s: pad2(s) });
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [content?.eventDateISO]);

  useEffect(() => {
    if (!lightboxImage) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

  const bookableEvent = events.find((e) => e.status === "open") || events[0];
  const bookHref = bookableEvent ? `/events/${bookableEvent.id}` : "#tickets";

  // ลิงก์/ปุ่ม "จองโต๊ะ" ทุกจุดในหน้านี้: ไปหน้าจองของงานโดยตรงเสมอ
  // - ถ้ารู้งานแล้ว ลิงก์ปกติพาไป /events/[id] เอง
  // - ถ้ารายการงานยังโหลดไม่เสร็จ/ยังว่าง จะดึงรายการงานตอนกด แล้วพาไปหน้าจองทันที
  // - ถ้าไม่มีงานที่เปิดให้จองเลย แสดงข้อความแจ้ง แทนการเลื่อนหน้าเงียบๆ
  async function goBook(e: React.MouseEvent) {
    if (bookableEvent) return;
    e.preventDefault();
    try {
      const d = await fetch("/api/events").then((r) => r.json());
      const list: EventItem[] = d.events || [];
      const ev = list.find((x) => x.status === "open") || list[0];
      if (ev) {
        router.push(`/events/${ev.id}`);
        return;
      }
    } catch {
      setToast("โหลดข้อมูลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      return;
    }
    setToast("ยังไม่มีงานที่เปิดให้จอง");
  }

  // ลิงก์เมนูกำหนดการ/สถานที่/คำถาม: หน้าแรกพาไปหน้ารายละเอียดงาน, หน้ารายละเอียดงานเลื่อนในหน้าเดียวกัน
  const anchorBase = variant === "home" ? LANDING_HREF : "";
  // บล็อกที่แอดมินซ่อนไว้ (หน้าแรกไม่ได้โหลด content → ถือว่าแสดงทุกบล็อกสำหรับลิงก์เมนู)
  // honorGuests/sponsors ค่าเริ่มต้นซ่อน (ต้องเปิดเองในแอดมิน) ส่วนบล็อกอื่นค่าเริ่มต้นแสดง
  const show = (k: LandingBlock) => {
    const v = content?.visibleSections?.[k];
    return k === "honorGuests" || k === "sponsors" ? v === true : v !== false;
  };

  const categories = ["ทั้งหมด", ...Array.from(new Set(gallery.map((g) => g.category)))];
  const filteredGallery = activeCategory === "ทั้งหมด" ? gallery : gallery.filter((g) => g.category === activeCategory);

  if (variant === "full" && !content) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="landingRoot">
      <header>
        <nav className="nav">
          <Link href="/" className="brand">
            <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="brand-logo" />
            <span className="brand-text">คืนสู่เหย้า วท.อุดรธานี</span>
          </Link>
          <div className="nav-links">
            {variant === "home" && <Link href={LANDING_HREF}>รายละเอียดงาน 89 ปี</Link>}
            {show("howTo") && <a href={`${anchorBase}#howto`}>วิธีจอง</a>}
            {show("schedule") && <a href={`${anchorBase}#schedule`}>กำหนดการ</a>}
            {show("venue") && <a href={`${anchorBase}#venue`}>สถานที่</a>}
            {show("faq") && <a href={`${anchorBase}#faq`}>คำถาม</a>}
            <Link href="/status">ตรวจสอบการจอง</Link>
            <Link href="/admin/login" style={{ opacity: 0.6, fontSize: 12 }}>เจ้าหน้าที่</Link>
          </div>
          <button className="burger" onClick={() => setMobileOpen((v) => !v)} aria-label="เมนู">☰</button>
        </nav>
        <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
          {variant === "home" && (
            <Link href={LANDING_HREF} onClick={() => setMobileOpen(false)}>รายละเอียดงาน 89 ปี</Link>
          )}
          {(
            [
              ["howTo", `${anchorBase}#howto`, "วิธีจอง"],
              ["schedule", `${anchorBase}#schedule`, "กำหนดการ"],
              ["venue", `${anchorBase}#venue`, "สถานที่"],
              ["faq", `${anchorBase}#faq`, "คำถาม"],
            ] as const
          )
            .filter(([k]) => show(k))
            .map(([, ...rest]) => rest)
            .map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>
          ))}
          <Link href="/status" onClick={() => setMobileOpen(false)}>ตรวจสอบการจอง</Link>
          <Link href="/admin/login" onClick={() => setMobileOpen(false)}>เจ้าหน้าที่</Link>
        </div>
      </header>

      {variant === "home" && (<>
      {banners.length > 0 && (
        <section className="promo-slider with-menu" aria-label="ประชาสัมพันธ์">
          <div className="wrap promo-wrap">
          <div className="promo-track">
            {banners.map((b, i) => {
              const img = <img src={b.imageUrl} alt={b.title || "แบนเนอร์"} className="promo-img" draggable={false} />;
              return (
                <div key={b.id} className={`promo-slide${i === slide ? " active" : ""}`} aria-hidden={i !== slide}>
                  {/* ทุกสไลด์คลิกแล้วไปหน้ารายละเอียดงาน 89 ปี */}
                  <Link href={LANDING_HREF} tabIndex={i === slide ? 0 : -1} aria-label="ดูรายละเอียดงานคืนสู่เหย้า 89 ปี">{img}</Link>
                </div>
              );
            })}
          </div>
          {banners.length > 1 && (
            <>
              <button type="button" className="promo-arrow left" aria-label="ภาพก่อนหน้า" onClick={() => setSlide((i) => (i - 1 + banners.length) % banners.length)}>‹</button>
              <button type="button" className="promo-arrow right" aria-label="ภาพถัดไป" onClick={() => setSlide((i) => (i + 1) % banners.length)}>›</button>
              <div className="promo-dots">
                {banners.map((b, i) => (
                  <button key={b.id} type="button" aria-label={`ภาพที่ ${i + 1}`} className={i === slide ? "on" : ""} onClick={() => setSlide(i)} />
                ))}
              </div>
            </>
          )}
          </div>
        </section>
      )}

      <section className={`menu-cards${banners.length > 0 ? " after-slider" : ""}`} aria-label="เมนูหลัก">
        <div className="wrap menu-grid">
          {/* การ์ดเมนูแบบข้อความล้วน (ไม่มีไอคอน/ปุ่ม) — ทั้งการ์ดกดได้ */}
          {[
            { href: bookHref, onClick: goBook, title: "จองโต๊ะงานเลี้ยง", lines: ["จองโต๊ะ", "งานเลี้ยง"], big: true },
            { href: "/merch", title: "สั่งซื้อของที่ระลึก", lines: ["สั่งซื้อ", "ของที่ระลึก"], big: true },
            { href: "https://forms.gle/WVLrDEqJfT4k5zzGA", title: "รับโล่ศิษย์เก่าดีเด่น", lines: ["รับโล่", "ศิษย์เก่าดีเด่น"], note: "ใช้ลดหย่อนภาษีได้", external: true },
            { href: "https://forms.gle/DvPD8i5pMfMVsRLTA", title: "รับโล่ผู้มีอุปการคุณ", lines: ["รับโล่", "ผู้มีอุปการคุณ"], note: "ใช้ลดหย่อนภาษีได้", external: true },
          ].map((c) => {
            // แบ่ง 2 บรรทัดเอง (เบราว์เซอร์ตัดคำไทยกลางคำได้ เช่น "ดี/เด่น")
            const inner = (
              <span className="menu-body">
                <span className={`menu-title${"big" in c && c.big ? " big" : ""}`}>
                  {c.lines.map((l) => <span key={l} className="menu-line">{l}</span>)}
                </span>
                {"note" in c && c.note ? <span className="menu-note">{c.note}</span> : null}
              </span>
            );
            return c.external ? (
              <a key={c.title} href={c.href} target="_blank" rel="noreferrer" className="menu-card">{inner}</a>
            ) : (
              <Link key={c.title} href={c.href} onClick={c.onClick} className="menu-card">{inner}</Link>
            );
          })}
        </div>
      </section>

      {poster.enabled && (
        <section className="poster-section" id="poster" aria-label="โปสเตอร์งาน">
          <div className="wrap">
          <h2 className="poster-title">รายละเอียดงาน</h2>
          <button
            type="button"
            className="poster-frame"
            onClick={() => setLightboxImage(poster.imageUrl)}
            aria-label="แตะเพื่อขยายดูโปสเตอร์เต็มจอ"
          >
            <img src={poster.imageUrl} alt="โปสเตอร์ประเพณีคืนสู่เหย้า 89 ปี เทคนิคอุดร" loading="lazy" />
          </button>
          <p className="poster-hint">แตะที่รูปเพื่อขยายดูเต็มจอ</p>
          </div>
        </section>
      )}
      </>)}

      {variant === "full" && content && (<>
      {show("hero") && (
      <section
        className="hero"
        id="home"
        style={
          content.heroImageUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(10,30,51,0.88), rgba(10,30,51,0.94)), url(${content.heroImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="blueprint" />
        <div className="corner tl" /><div className="corner tr" />
        <div className="wrap hero-grid">
          <div>
            <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="hero-logo" />
            <div className="eyebrow-tech">89 ปี วิทยาลัยเทคนิคอุดรธานี</div>
            <h1>{content.heroTitleLine1}<br /><span className="accent accent-serif">{content.heroTitleLine2}</span></h1>
            <p className="lead">{content.heroLead}</p>
            <div className="hero-actions">
              <Link href={bookHref} onClick={goBook} className="btn-primary">จองโต๊ะ / ลงทะเบียน</Link>
              <a href="#tickets" className="btn-ghost">ดูรายละเอียดบัตร</a>
            </div>
            <div className="countdown">
              <div className="cd-unit"><div className="cd-num">{countdown.d}</div><div className="cd-label">วัน</div></div>
              <div className="cd-unit"><div className="cd-num">{countdown.h}</div><div className="cd-label">ชม.</div></div>
              <div className="cd-unit"><div className="cd-num">{countdown.m}</div><div className="cd-label">นาที</div></div>
              <div className="cd-unit"><div className="cd-num">{countdown.s}</div><div className="cd-label">วินาที</div></div>
            </div>
          </div>
          <div className="spec-card">
            <div className="spec-label">SPEC · รายละเอียดงาน</div>
            <div className="spec-row"><span>วันที่จัดงาน</span><span>{content.eventDateShortLabel}</span></div>
            <div className="spec-row"><span>เวลาเริ่มลงทะเบียน</span><span>{content.registrationTime}</span></div>
            <div className="spec-row"><span>สถานที่</span><span>{content.venueName}</span></div>
            <div className="spec-row"><span>โต๊ะ (8 ที่นั่ง)</span><span>{content.pricePerTable.toLocaleString("th-TH")} บาท</span></div>
          </div>
        </div>
      </section>
      )}

      {show("tickets") && (
      <section id="tickets">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">จองโต๊ะงานเลี้ยง</div>
            <h2>จองโต๊ะงานเลี้ยง ค่ำคืนแห่งความทรงจำ</h2>
            <p>รายได้หลังหักค่าใช้จ่าย จัดซื้อรถรับส่งนักเรียน (มินิบัส)</p>
          </div>
          <div className="ticket-wrap">
            <div className="ticket-left">
              <div className="perforation" />
              <div className="mono" style={{ fontSize: 12, color: "var(--gold-text)", letterSpacing: ".05em" }}>TABLE RESERVATION · 89th ANNIVERSARY</div>
              <div className="price">{content.pricePerTable.toLocaleString("th-TH")}<sup>บาท</sup></div>
              <div className="note">ต่อโต๊ะ · จองโต๊ะ 1 โต๊ะ 8 ที่นั่ง</div>
            </div>
            <div className="ticket-right">
              <ul>
                <li><span className="chk">✓</span> ร่วมงานคืนสู่เหย้าเต็มรูปแบบ</li>
                <li><span className="chk">✓</span> รับประทานอาหารโต๊ะจีน พร้อมเครื่องดื่มตลอดงาน</li>
                <li><span className="chk">✓</span> ร่วมพิธีบวงสรวงพระวิษณุ พิธีคลาสสิกประจำงาน</li>
                <li><span className="chk">✓</span> ชมกิจกรรมและการแสดง</li>
                <li><span className="chk">✓</span> ร่วมประมูลของที่ระลึก</li>
              </ul>
              <Link href={bookHref} onClick={goBook} className="btn-primary" style={{ marginTop: 24, display: "inline-block", background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)" }}>จองโต๊ะการเลี้ยงเลย →</Link>
            </div>
          </div>
        </div>
      </section>
      )}

      {show("merch") && (
      <section id="merch">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">ของที่ระลึก</div>
            <h2>ของที่ระลึกงานคืนสู่เหย้า</h2>
            <p>เสื้อคอโปโล เสื้อคอกลม แก้วที่ระลึก และเหรียญพระวิษณุกรรม เปิดให้สั่งซื้อเพิ่มเติมได้</p>
          </div>
          <div className="merch-items-grid">
            {content.merchItems.map((item, i) => {
              const pic = SOUVENIR_IMAGES[item.icon];
              return (
                <div className="merch-item" key={i}>
                  <button
                    type="button"
                    className="souvenir-visual"
                    onClick={() => {
                      setLightboxFlip({ front: pic.front, back: pic.back, alt: item.name });
                      setLightboxImage(pic.front);
                    }}
                    aria-label={`ขยายรูป ${item.name}`}
                  >
                    <div className="merch-price-badge">{item.badge}</div>
                    <img src={pic.front} alt={item.name} className="souvenir-photo" loading="lazy" />
                    <span className="flip-badge" aria-hidden="true">↻ ด้านหลัง</span>
                  </button>
                  <h4>{item.name}</h4>
                  <p>{item.description}</p>
                </div>
              );
            })}
          </div>
          <p className="souvenir-hint">กดที่รูปเพื่อขยาย แล้วกดที่รูปอีกครั้งเพื่อพลิกดูด้านหลัง</p>
          <div className="merch-size-block">
            <div className="spec-label" style={{ color: "var(--gold-ink)", marginBottom: 10 }}>ตารางไซซ์เสื้อ (นิ้ว) — ใช้ได้ทั้งคอปกและคอกลม</div>
            {/* ใช้ข้อมูลชุดเดียวกับตารางไซซ์ในหน้าสั่งซื้อของที่ระลึก (components/size-chart.tsx) — แก้ที่เดียวตรงกันทั้งสองหน้า */}
            <div className="size-table-wrap">
              <table className="size-table">
                <tbody>
                  <tr><th>ไซซ์</th>{SIZES.map((s) => <th key={s}>{s}</th>)}</tr>
                  <tr><td>รอบอก</td>{CHEST.map((v, i) => <td key={i}>{v}</td>)}</tr>
                  <tr><td>ความยาว</td>{LENGTH.map((v, i) => <td key={i}>{v}</td>)}</tr>
                </tbody>
              </table>
            </div>
            <p className="size-note">หน่วยเป็นนิ้ว วัดจากตัวเสื้อ อาจคลาดเคลื่อนได้เล็กน้อยตามการตัดเย็บ · เลือกแบบเสื้อและไซซ์ได้ตอนลงทะเบียน ส่วนเหรียญและแก้วสั่งซื้อเพิ่มเติมได้ในระบบเดียวกัน</p>
            <Link href={bookHref} onClick={goBook} className="btn-primary" style={{ background: "var(--btn-dark-bg)", color: "var(--btn-dark-fg)", display: "inline-block" }}>จองโต๊ะการเลี้ยงพร้อมเลือกของที่ระลึก</Link>
          </div>
        </div>
      </section>
      )}

      {show("howTo") && (
      <section id="howto" style={{ background: "var(--bg-alt)" }}>
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">วิธีจองและชำระเงิน</div>
            <h2>
              {howToTab === "booking" ? "จองโต๊ะ" : "สั่งซื้อ"}ง่ายใน{" "}
              {(howToTab === "booking" ? content.howToBooking : content.howToMerch)?.length ?? 0} ขั้นตอน
            </h2>
            <p>เตรียมโอนเงินและเก็บสลิปไว้ก่อน — ต้องแนบสลิปตอนกดยืนยันทุกครั้ง</p>
          </div>
          <div className="howto-tabs" role="tablist" aria-label="เลือกขั้นตอน">
            {(
              [
                ["booking", "จองโต๊ะงานเลี้ยง"],
                ["merch", "สั่งซื้อของที่ระลึก"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={howToTab === k}
                className={`howto-tab${howToTab === k ? " on" : ""}`}
                onClick={() => setHowToTab(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <ol className="howto-steps">
            {(howToTab === "booking" ? content.howToBooking : content.howToMerch)?.map((st, i) => (
              <li className="howto-step" key={i}>
                <span className="howto-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h4>{st.title}</h4>
                  {st.description && <p>{st.description}</p>}
                </div>
              </li>
            ))}
          </ol>
          {content.howToNotes && content.howToNotes.length > 0 && (
            <div className="howto-notes">
              <div className="howto-notes-title">ข้อควรรู้เรื่องการชำระเงิน</div>
              <ul>
                {content.howToNotes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
          <div className="howto-actions">
            {howToTab === "booking" ? (
              <>
                <Link href={bookHref} onClick={goBook} className="btn-primary">จองโต๊ะงานเลี้ยง</Link>
                <Link href="/status" className="howto-link">เช็คสถานะการจอง →</Link>
              </>
            ) : (
              <>
                <Link href="/merch" className="btn-primary">สั่งซื้อของที่ระลึก</Link>
                <Link href="/merch/status" className="howto-link">เช็คสถานะการสั่งซื้อ →</Link>
              </>
            )}
          </div>
        </div>
      </section>
      )}
      {show("schedule") && (
      <section id="schedule" style={{ background: "var(--bg-alt)" }}>
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">กำหนดการ</div>
            <h2>กำหนดการวันงาน</h2>
            <p>{content.eventDateLabel} · กำหนดการอาจปรับเปลี่ยนเล็กน้อยหน้างาน</p>
          </div>
          <div className="timeline">
            <div className="tl-line" />
            {content.timeline.map((item, i) => item.time.trim() === "" ? (
              <div className="tl-group" key={i}>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </div>
            ) : (
              <div className="tl-item" key={i}>
                <div className="tl-dot" />
                <div className="tl-time">{item.time}</div>
                <div className="tl-body"><h4>{item.title}</h4><p>{item.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {show("honorGuests") && (
      <section className="honor-band" id="honor">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker" style={{ color: "var(--gold-text)" }}>แขกผู้มีเกียรติ</div>
            <h2 style={{ color: "var(--on-surf)" }}>แด่ครูผู้สร้างช่างฝีมือ</h2>
            <p style={{ color: "var(--on-surf-dim)" }}>แม้ออกจากรั้ววิทยาลัยไปนานเพียงใด บทเรียนของครูยังคงอยู่เสมอ</p>
          </div>
          <div className="honor-grid">
            {content.honorGuests.map((g, i) => (
              <div className="honor-card" key={i}>
                {g.photoUrl ? (
                  <img src={g.photoUrl} alt={g.name} className="honor-avatar honor-avatar-photo" />
                ) : (
                  <div className="honor-avatar">{g.name.charAt(0)}</div>
                )}
                <h4>{g.name}</h4>
                <p>{g.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
      {show("venue") && (
      <section id="venue">
        <div className="wrap venue-grid">
          <div>
            <div className="kicker">สถานที่จัดงาน</div>
            <h2 style={{ fontSize: "clamp(24px,3vw,34px)", marginBottom: 28 }}>กลับสู่บ้านของพวกเรา</h2>
            <div className="venue-detail">
              <div className="label">ที่ตั้ง</div>
              <p>{content.venueAddress}</p>
            </div>
            <div className="venue-detail">
              <div className="label">วันจัดงาน</div>
              <p>{content.eventDateLabel} · ประตูเปิด {content.registrationTime}</p>
            </div>
            <div className="venue-detail">
              <div className="label">ที่จอดรถ</div>
              <p>{content.parkingNote}</p>
            </div>
            {content.mapUrl ? (
              <a href={content.mapUrl} target="_blank" rel="noopener" className="btn-ghost" style={{ borderColor: "var(--frame)", color: "var(--head)", display: "inline-block" }}>ดูแผนที่ →</a>
            ) : null}
          </div>
          <div className="venue-visual">
            <img src="/venue/venue-map.webp" alt={content.venueName} className="venue-map-img" />
          </div>
        </div>
      </section>
      )}

      {show("sponsors") && (
      <section id="sponsors">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">ร่วมเป็นส่วนหนึ่ง</div>
            <h2>เปิดรับผู้สนับสนุน</h2>
            <p>การสนับสนุนของท่านช่วยให้ค่ำคืนนี้เกิดขึ้นได้ และสมทบทุนจัดซื้อรถมินิบัสสำหรับนักเรียน-นักศึกษา</p>
          </div>
          <div className="sponsor-grid">
            {content.sponsors.map((sp, i) => (
              <div className={`sponsor-card${i === 0 ? " gold" : ""}`} key={i}>
                {sp.logoUrl && <img src={sp.logoUrl} alt={sp.label} className="sponsor-logo" />}
                <div className="sponsor-tier">{sp.tier}</div>
                <h3>{sp.label}</h3>
                <div className="sponsor-price">{sp.price}</div>
                <ul>
                  {sp.benefits.map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}
      {show("faq") && (
      <section id="faq" style={{ background: "var(--bg-alt)" }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="section-head">
            <div className="kicker">คำถามที่พบบ่อย</div>
            <h2>ทุกเรื่องที่อยากรู้</h2>
          </div>
          <div>
            {content.faq.map((item, i) => (
              <div className={`faq-item${openFaq === i ? " open" : ""}`} key={i}>
                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>
                  {item.question}<span className="plus">+</span>
                </div>
                <div className="faq-a"><p>{item.answer}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {show("finalCta") && (
      <section className="final-cta">
        <div className="blueprint" style={{ opacity: 0.2 }} />
        <div className="wrap">
          <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" style={{ width: 110, height: 110, objectFit: "contain", margin: "0 auto 16px" }} />
          <div className="eyebrow-tech" style={{ justifyContent: "center" }}>89 ปี วิทยาลัยเทคนิคอุดรธานี</div>
          <h2>มาเจอกันนะ.</h2>
          <p>{content.eventDateShortLabel} · {content.venueName} · โต๊ะละ {content.pricePerTable.toLocaleString("th-TH")} บาท (8 ที่นั่ง)</p>
          <Link href={bookHref} onClick={goBook} className="btn-primary">จองโต๊ะการเลี้ยงตอนนี้</Link>
        </div>
      </section>
      )}
      </>)}

      <footer>
        <div className="wrap foot-row">
          <span>© 2569 ทีมผู้จัดงานคืนสู่เหย้า วิทยาลัยเทคนิคอุดรธานี</span>
          <span><Link href={bookHref} onClick={goBook}>ระบบจองโต๊ะออนไลน์ →</Link></span>
        </div>
      </footer>

      {toast && (
        <div className="book-toast" role="status" aria-live="polite">{toast}</div>
      )}

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button
            type="button"
            className="lightbox-close"
            onClick={closeLightbox}
            aria-label="ปิด"
          >
            ×
          </button>
          {lightboxFlip ? (
            <div className="lightbox-flip" onClick={(e) => e.stopPropagation()}>
              <img
                src={lightboxImage}
                alt={`${lightboxFlip.alt}${lightboxImage === lightboxFlip.back ? " (ด้านหลัง)" : ""}`}
                className={`lightbox-image flip-frame${flipping ? " flipping" : ""}`}
                onClick={flipLightbox}
              />
              <p className="lightbox-caption">
                {lightboxFlip.alt}
                {lightboxImage === lightboxFlip.back ? " (ด้านหลัง)" : ""} · กดที่รูปเพื่อพลิกดูอีกด้าน
              </p>
            </div>
          ) : (
            <img src={lightboxImage} alt="" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Trirong:ital,wght@0,500;0,600;0,700;1,600&family=Fraunces:ital,wght@0,500;0,600;1,500;1,600&family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Space+Mono&display=swap');
        body{ background: rgb(var(--c-cream-100)); }
      `}</style>
      <style jsx>{`
        .landingRoot{
          /* ค่าคงที่ (ใช้เหมือนกันทุกธีม เช่นซ้อนบนรูปภาพ) */
          --navy-deep:#0A1E33;
          --navy:#0E2A47;
          --navy-soft:#16385C;
          --gold:#C6A15B;
          --gold-bright:#DDBD7C;
          --gold-rgb:198,161,91;  /* เท่ากับ --gold (ใช้ทำเส้น/กรอบโปร่งใส) */
          --paper:#F3EFE6;
          --paper-dim:#E7E1D2;
          /* ตัวแปรตามบทบาท — ธีม กรมท่า-ทอง (ค่าเริ่มต้น) */
          --bg-page:#F3EFE6;      /* พื้นหน้าเว็บ */
          --bg-alt:#E7E1D2;       /* พื้นส่วนสลับสี */
          --hairline:#E7E1D2;     /* เส้นคั่นบางๆ */
          --surf-deep:#0A1E33;    /* พื้นเข้ม: header/hero/footer/แถบ */
          --surf:#0E2A47;         /* พื้นเข้มรอง: บัตร/ภาพประกอบ */
          --surf-soft:#16385C;
          --on-surf:#F3EFE6;      /* ตัวอักษรบนพื้นเข้ม */
          --on-surf-dim:#E7E1D2;
          --head:#0E2A47;         /* หัวข้อบนพื้นสว่าง */
          --frame:#0E2A47;        /* เส้นกรอบ */
          --on-gold:#0A1E33;      /* ตัวอักษรบนปุ่มทอง */
          --gold-text:#DDBD7C;    /* ตัวอักษรสีทองบนพื้นเข้ม */
          --gold-ink:#C6A15B;     /* ตัวอักษรเล็กสีทองบนพื้นสว่าง */
          --btn-dark-bg:#0E2A47;
          --btn-dark-fg:#F3EFE6;
          --header-bg:rgba(10,30,51,0.92);
          --spec-bg:rgba(243,239,230,0.04);
          --ghost-border:rgba(243,239,230,0.35);
          --card-a:#16385C;
          --card-b:#0E2A47;
          --card-ink:#F3EFE6;
          --card-shadow:rgba(0,0,0,.4);
          --slate:#5B6B80;
          --ink:#132132;
          --line:rgba(var(--gold-rgb),0.28);
          background:var(--bg-page);
          color:var(--ink);
          font-family:'IBM Plex Sans Thai', sans-serif;
          line-height:1.7;
          overflow-x:hidden;
        }
        /* ธีม ขาว-ทอง */
        :global([data-theme="white-gold"]) .landingRoot{
          --bg-page:#FFFDF7;
          --bg-alt:#FBF4E0;
          --hairline:#EFE3C2;
          --surf-deep:#FFF8E5;
          --surf:#F6EBCB;
          --surf-soft:#FFFFFF;
          --on-surf:#2B2410;
          --on-surf-dim:#6B5A2E;
          --head:#2E2410;
          --frame:#C6A15B;
          --on-gold:#2B2005;
          --gold-text:#8A6B28;
          --gold-ink:#9A7628;
          --btn-dark-bg:#8F6C22;
          --btn-dark-fg:#FFFFFF;
          --header-bg:rgba(255,253,247,0.94);
          --spec-bg:rgba(255,255,255,0.75);
          --ghost-border:rgba(143,108,34,0.5);
          --card-a:#FFFFFF;
          --card-b:#FFF8E5;
          --card-ink:#33290F;
          --card-shadow:rgba(143,108,34,.25);
          --slate:#7A6A44;
          --ink:#2B2410;
          --line:rgba(var(--gold-rgb),0.45);
        }
        /* ธีม น้ำเงิน-ส้ม (อ้างอิงเว็บ FunRun) */
        :global([data-theme="blue-orange"]) .landingRoot{
          --gold:#D94F17;
          --gold-bright:#F15A22;
          --gold-rgb:29,99,196;   /* เส้น/กรอบบางๆ ใช้โทนน้ำเงิน */
          --bg-page:#FFFFFF;
          --bg-alt:#F4F6FA;
          --hairline:#E2E8F2;
          --surf-deep:#EEF4FB;
          --surf:#E9F1FC;
          --surf-soft:#FFFFFF;
          --on-surf:#1E293B;
          --on-surf-dim:#475569;
          --head:#164A94;
          --frame:#1D63C4;
          --on-gold:#FFFFFF;
          --gold-text:#C4460F;
          --gold-ink:#C4460F;
          --btn-dark-bg:#1D63C4;
          --btn-dark-fg:#FFFFFF;
          --header-bg:rgba(255,255,255,0.92);
          --spec-bg:rgba(255,255,255,0.85);
          --ghost-border:rgba(29,99,196,0.45);
          --card-a:#FFFFFF;
          --card-b:#EEF4FB;
          --card-ink:#1E293B;
          --card-shadow:rgba(29,99,196,.18);
          --slate:#64748B;
          --ink:#1E293B;
          --line:rgba(29,99,196,0.22);
        }
        .landingRoot :global(h1),.landingRoot :global(h2),.landingRoot :global(h3),.landingRoot :global(h4){ font-family:'Trirong', serif; font-weight:600; line-height:1.3; }
        .accent-serif{ font-family:'Fraunces', serif; font-style:italic; font-weight:500; }
        .mono{ font-family:'Space Mono', monospace; }
        .landingRoot :global(a){ color:inherit; text-decoration:none; }
        .wrap{ max-width:1120px; margin:0 auto; padding:0 24px; }
        /* ---- สไลด์แบนเนอร์ ---- */
        /* padding-top ต้องมากกว่าความสูงแถบเมนูด้านบน (header fixed สูง ~41px) ไม่งั้นแถบเมนูจะบังขอบบนของภาพสไลด์ */
        .landingRoot .promo-slider{ position:relative; background:var(--surf-deep); overflow:hidden; padding:50px 0 0; }
        .promo-wrap{ position:relative; }
        /* กรอบ 16:9 และแสดงรูปเต็มภาพ (contain) ไม่ครอปขอบ — จอกว้างมากจะมีขอบสีกรมท่าสองข้าง */
        .promo-track{ position:relative; width:100%; aspect-ratio:16/9; max-height:min(58vh,600px); margin:0 auto; }
        .promo-slide{ position:absolute; inset:0; opacity:0; transition:opacity .7s ease; pointer-events:none; }
        .promo-slide.active{ opacity:1; pointer-events:auto; }
        .promo-slide :global(a){ display:block; width:100%; height:100%; }
        .promo-slide :global(.promo-img){ width:100%; height:100%; object-fit:contain; display:block; }
        .promo-arrow{ position:absolute; top:50%; transform:translateY(-50%); width:40px; height:40px; border-radius:50%; border:0; background:rgba(10,30,51,.55); color:#fff; font-size:26px; line-height:1; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .promo-arrow:hover{ background:rgba(10,30,51,.8); }
        .promo-arrow.left{ left:12px; } .promo-arrow.right{ right:12px; }
        .promo-dots{ position:absolute; left:0; right:0; bottom:10px; display:flex; justify-content:center; gap:8px; }
        .promo-dots button{ width:9px; height:9px; border-radius:50%; border:0; padding:0; background:rgba(255,255,255,.5); cursor:pointer; }
        .promo-dots button.on{ background:var(--gold-bright); width:22px; border-radius:5px; }
        /* ---- การ์ดเมนู 4 ใบ (โทนกรมท่า-ทอง เหมือนส่วนอื่นของเว็บ) ---- */
        /* การ์ดอยู่ใต้สไลด์ (ไม่ซ้อนทับ) เว้นช่องว่างจากขอบล่างสไลด์ 8px (มือถือ 5px); ถ้าไม่มีสไลด์ให้เว้นที่ให้แถบเมนูบนสุด (fixed) */
        .landingRoot .menu-cards{ position:relative; padding:70px 0 8px; background:var(--surf-deep); }
        /* การ์ดเมนูซ้อนทับขอบล่างของสไลด์เล็กน้อย (--menu-overlap) — น้อยพอไม่บังบรรทัดล่างสุดของภาพ ("ณ วิทยาลัยเทคนิคอุดรธานี") */
        .landingRoot{ --menu-overlap:28px; }
        @media (max-width:860px){ .landingRoot{ --menu-overlap:14px; } }
        .landingRoot .menu-cards.after-slider{
          z-index:2; padding-top:0; margin-top:calc(-1 * var(--menu-overlap));
          background:linear-gradient(to bottom, transparent var(--menu-overlap), var(--surf-deep) var(--menu-overlap));
        }
        .landingRoot .menu-cards.after-slider .menu-grid{ max-width:calc((min(100vw, 1120px) - 48px) * 0.78125); gap:14px; }
        @media (max-width:860px){ .landingRoot .menu-cards.after-slider .menu-grid{ max-width:none; gap:10px; } }
        .landingRoot .promo-slider.with-menu .promo-dots{ bottom:calc(var(--menu-overlap) + 10px); }
        .landingRoot .poster-section{ padding:40px 0 8px; background:var(--surf-deep); text-align:center; }
        .poster-title{ font-size:clamp(20px,2.6vw,26px); font-weight:700; color:var(--on-surf); margin:0 0 18px; }
        /* กว้างเท่าภาพสไลด์ด้านบน: สไลด์ 16:9 สูงไม่เกิน min(58vh,600px) และไม่เกินกรอบ .wrap */
        .poster-frame{ display:block; width:100%; max-width:min(100%, calc(min(58vh, 600px) * 16 / 9)); margin:0 auto; padding:0; border:0; background:none; border-radius:18px; overflow:hidden; cursor:zoom-in; box-shadow:0 14px 34px var(--card-shadow); border-top:3px solid var(--gold); }
        .poster-frame img{ display:block; width:100%; height:auto; }
        .poster-hint{ margin:12px 0 0; font-size:13px; color:var(--on-surf-dim); }
        @media (max-width:860px){
          .landingRoot .poster-section{ padding:28px 0 4px; }
          /* มือถือ: กว้างเท่าสไลด์ (เว้นขอบ 24px เหมือน .wrap ของสไลด์) */
          .poster-frame{ border-radius:12px; }
        }
        .poster-section + .hero{ padding-top:80px; }
        @media (max-width:860px){ .poster-section + .hero{ padding-top:56px; } }
        .menu-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
        @media (max-width:860px){ .menu-grid{ grid-template-columns:repeat(2,1fr); gap:12px; } }
        .menu-cards :global(.menu-card){ display:flex; align-items:center; justify-content:center; text-align:center; min-height:96px; padding:18px 14px; background:linear-gradient(160deg,var(--card-a) 0%,var(--card-b) 100%); border:1px solid var(--line); border-top:3px solid var(--gold); border-radius:18px; color:var(--card-ink); box-shadow:0 12px 28px var(--card-shadow); transition:transform .15s, border-color .2s, box-shadow .2s; }
        /* เด้งขึ้นเมื่อชี้เมาส์ (ปรับแรงขึ้นทีละขั้น: -3px → -3.6px → -4.3px → -6.5px) */
        .menu-cards :global(.menu-card:hover){ transform:translateY(-6.5px); border-color:var(--gold-bright); box-shadow:0 20px 42px var(--card-shadow); }
        .menu-cards :global(.menu-card:hover) .menu-title{ color:var(--gold-text); }
        .menu-cards :global(.menu-card:focus-visible){ outline:3px solid var(--gold-bright); outline-offset:3px; }
        .menu-title{ font-weight:700; font-size:22px; line-height:1.35; color:var(--card-ink); transition:color .15s; }
        .menu-line{ display:block; white-space:nowrap; }
        .menu-body{ display:flex; flex-direction:column; align-items:center; gap:8px; }
        .menu-title.big{ font-size:28px; line-height:1.25; }
        /* ป้าย "ใช้ลดหย่อนภาษีได้" ใต้ชื่อเมนูรับโล่ */
        .menu-note{ display:inline-block; padding:3px 12px; border-radius:999px; background:var(--gold); color:var(--on-gold); font-size:13px; font-weight:700; white-space:nowrap; }
        @media (max-width:860px){
          .menu-cards :global(.menu-card){ min-height:72px; padding:12px 10px; border-radius:14px; }
          .menu-title{ font-size:18px; }
          .menu-title.big{ font-size:22px; }
          .menu-body{ gap:6px; }
          .menu-note{ font-size:12px; padding:2px 10px; }
        }
        .landingRoot :global(section){ position:relative; padding:96px 0; }
        .landingRoot :global(img){ max-width:100%; display:block; }

        .blueprint{
          position:absolute; inset:0;
          background-image:
            linear-gradient(var(--line) 1px, transparent 1px),
            linear-gradient(90deg, var(--line) 1px, transparent 1px);
          background-size: 42px 42px;
          opacity:0.5;
          pointer-events:none;
        }
        .corner{ position:absolute; width:22px; height:22px; border-color:var(--gold); opacity:0.8; }
        .corner.tl{ top:18px; left:18px; border-top:2px solid; border-left:2px solid; }
        .corner.tr{ top:18px; right:18px; border-top:2px solid; border-right:2px solid; }
        .corner.bl{ bottom:18px; left:18px; border-bottom:2px solid; border-left:2px solid; }
        .corner.br{ bottom:18px; right:18px; border-bottom:2px solid; border-right:2px solid; }

        .landingRoot :global(header){
          position:fixed; top:0; left:0; right:0; z-index:100;
          background:var(--header-bg);
          backdrop-filter:blur(8px);
          border-bottom:1px solid rgba(var(--gold-rgb),0.2);
        }
        .nav{ display:flex; align-items:center; justify-content:space-between; max-width:1120px; margin:0 auto; padding:5px 16px; gap:12px; }
        /* .brand เป็น <Link> (คอมโพเนนต์ลูก) — styled-jsx แบบ scoped ใช้กับมันไม่ได้ ต้องใช้ :global ไม่งั้นโลโก้กับชื่อจะซ้อนเป็น 2 บรรทัด แถบบนสูงเกิน */
        .nav :global(.brand){ display:flex; align-items:center; gap:8px; color:var(--on-surf); }
        .brand-logo{ width:30px; height:30px; object-fit:contain; }
        .brand-text{ font-family:'IBM Plex Sans Thai', sans-serif; font-weight:600; font-size:13px; letter-spacing:0.01em; color: var(--on-surf); }
        .nav-links{ display:flex; gap:16px; align-items:center; }
        .nav-links :global(a){ color:var(--on-surf-dim); font-size:13px; transition:color .2s; white-space:nowrap; }
        .nav-links :global(a:hover){ color:var(--gold-text); }
        :global(.nav-cta){ background:var(--gold); color:var(--on-gold); padding:10px 20px; border-radius:2px; font-weight:600; font-size:14px; transition:background .2s; white-space:nowrap; }
        :global(.nav-cta:hover){ background:var(--gold-bright); }

        .floating-menu{ position:fixed; right:18px; bottom:18px; z-index:150; display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
        .fab-actions{ display:flex; flex-direction:column; align-items:flex-end; gap:10px; }
        .fab-actions :global(a){ padding:13px 22px; border-radius:999px; font-weight:700; font-size:14px; text-align:center; white-space:nowrap; box-shadow:0 8px 22px rgba(10,30,51,.35); transition:opacity .2s ease, transform .2s ease, background .2s; }
        .fab-actions :global(a:hover){ transform:translateY(-2px); }
        .fab-actions :global(.floating-btn-primary){ background:var(--gold); color:var(--on-gold); }
        .fab-actions :global(.floating-btn-primary:hover){ background:var(--gold-bright); }
        .fab-actions :global(.floating-btn-secondary){ background:var(--navy-deep); color:var(--paper); border:1px solid var(--gold); }
        .fab-actions :global(.floating-btn-secondary:hover){ background:var(--navy); }
        /* เดสก์ท็อป: แสดง 3 ปุ่มตลอด ไม่มีปุ่มรวม */
        .fab-toggle{ display:none; }
        /* มือถือ (<=640px): ยุบเหลือปุ่มเดียว (•••/✕) แตะแล้ว 3 ปุ่มเด้งออก */
        @media (max-width: 640px){
          .floating-menu{ right:14px; bottom:14px; }
          .fab-actions :global(a){ padding:11px 16px; font-size:13px; opacity:0; transform:translateY(14px) scale(.92); pointer-events:none; }
          .fab-actions.open :global(a){ opacity:1; transform:none; pointer-events:auto; }
          .fab-actions.open :global(a:nth-child(1)){ transition-delay:.12s; }
          .fab-actions.open :global(a:nth-child(2)){ transition-delay:.07s; }
          .fab-actions.open :global(a:nth-child(3)){ transition-delay:.02s; }
          .fab-toggle{ display:flex; width:54px; height:54px; border-radius:999px; background:var(--gold); color:var(--on-gold); font-weight:800; font-size:18px; line-height:1; letter-spacing:1px; border:none; cursor:pointer; box-shadow:0 8px 22px rgba(10,30,51,.35); align-items:center; justify-content:center; transition:background .2s, transform .2s; }
          .fab-toggle:hover{ background:var(--gold-bright); }
          .fab-toggle:active{ transform:scale(.94); }
        }
        .burger{ display:none; color:var(--on-surf); font-size:20px; line-height:1; padding:0; background:none; border:none; cursor:pointer; }
        .mobile-menu{ display:none; flex-direction:column; gap:0; background:var(--surf-deep); border-top:1px solid rgba(var(--gold-rgb),0.2); }
        .mobile-menu :global(a){ color:var(--on-surf-dim); padding:11px 20px; border-bottom:1px solid rgba(var(--gold-rgb),0.1); font-size:14px; display:block; }
        .mobile-menu.open{ display:flex; }

        @media(max-width:860px){
          .nav-links{ display:none; }
          .burger{ display:block; }
        }

        .hero{ background: radial-gradient(ellipse at top right, var(--surf-soft) 0%, var(--surf-deep) 55%); color:var(--on-surf); padding:150px 0 120px; overflow:hidden; }
        .hero-grid{ display:grid; grid-template-columns:1.1fr 0.9fr; gap:56px; align-items:center; }
        .eyebrow-tech{ font-family:'Space Mono', monospace; font-size:12px; color:var(--gold-ink); letter-spacing:0.06em; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
        .eyebrow-tech::before{ content:''; width:26px; height:1px; background:var(--gold); display:inline-block; }
        .hero-logo{ width:120px; height:120px; object-fit:contain; margin-bottom:22px; }
        .hero :global(h1){ font-size:clamp(34px,5vw,56px); color:var(--on-surf); margin-bottom:22px; }
        .hero :global(h1 .accent){ color:var(--gold-text); font-weight:500; }
        .hero :global(p.lead){ font-size:17px; color:var(--on-surf-dim); max-width:480px; margin-bottom:34px; }
        .hero-actions{ display:flex; gap:14px; flex-wrap:wrap; }
        :global(.btn-primary){ background:var(--gold); color:var(--on-gold); padding:15px 28px; font-weight:700; border-radius:2px; font-size:15px; transition:transform .15s, background .2s; display:inline-block; }
        :global(.btn-primary:hover){ background:var(--gold-bright); transform:translateY(-1px); }
        .btn-ghost{ border:1px solid var(--ghost-border); color:var(--on-surf); padding:15px 28px; border-radius:2px; font-size:15px; }
        .btn-ghost:hover{ border-color:var(--gold); color:var(--gold-text); }

        .spec-card{ background:var(--spec-bg); border:1px solid rgba(var(--gold-rgb),0.35); padding:28px; position:relative; }
        .spec-label{ font-family:'Space Mono', monospace; font-size:11px; color:var(--gold-ink); margin-bottom:16px; letter-spacing:0.05em; }
        .spec-row{ display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px dashed rgba(var(--gold-rgb),0.25); font-size:14px; }
        .spec-row:last-child{ border-bottom:none; }
        .spec-row span:first-child{ color:var(--on-surf-dim); }
        .spec-row span:last-child{ font-family:'Space Mono', monospace; color:var(--on-surf); }

        .countdown{ display:flex; gap:14px; margin-top:36px; }
        .cd-unit{ text-align:center; }
        .cd-num{ font-family:'Space Mono', monospace; font-size:30px; color:var(--gold-text); border:1px solid rgba(var(--gold-rgb),0.3); padding:10px 14px; min-width:60px; }
        .cd-label{ font-size:11px; color:var(--on-surf-dim); margin-top:6px; letter-spacing:0.04em; }

        @media(max-width:860px){
          .hero-grid{ grid-template-columns:1fr; }
          .hero{ padding:110px 0 80px; }
        }

        .section-head{ margin-bottom:52px; max-width:600px; }
        /* บล็อก "วิธีจองและชำระเงิน" */
        .howto-tabs{ display:flex; flex-wrap:wrap; gap:8px; margin:-24px 0 28px; }
        .howto-tab{ border:1px solid var(--frame); background:transparent; color:var(--head); padding:10px 20px; border-radius:999px; font:inherit; font-size:15px; font-weight:600; cursor:pointer; transition:background .15s,color .15s; }
        .howto-tab.on{ background:var(--head); color:var(--bg-page); }
        .howto-steps{ list-style:none; padding:0; margin:0; display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:16px; counter-reset:none; }
        .howto-step{ display:flex; gap:14px; align-items:flex-start; background:var(--bg-page); border:1px solid var(--hairline); border-top:3px solid var(--gold); border-radius:14px; padding:18px 16px; }
        .howto-num{ flex:0 0 auto; width:36px; height:36px; border-radius:50%; background:var(--gold); color:var(--on-gold); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:17px; }
        .howto-step :global(h4){ font-size:16px; color:var(--head); margin:4px 0 6px; line-height:1.35; }
        .howto-step :global(p){ font-size:13.5px; color:var(--slate); line-height:1.6; margin:0; }
        .howto-notes{ margin-top:24px; padding:16px 20px; border-left:3px solid var(--gold); background:var(--bg-page); border-radius:0 12px 12px 0; }
        .howto-notes-title{ font-weight:700; color:var(--head); margin-bottom:8px; font-size:15px; }
        .howto-notes :global(ul){ margin:0; padding-left:20px; }
        .howto-notes :global(li){ font-size:14px; color:var(--slate); line-height:1.7; }
        .howto-actions{ margin-top:24px; display:flex; flex-wrap:wrap; align-items:center; gap:18px; }
        .howto-actions :global(.howto-link){ color:var(--head); font-weight:600; text-decoration:underline; text-underline-offset:3px; }
        @media(max-width:640px){ .howto-tabs{ margin-top:-32px; } .howto-tab{ flex:1 1 auto; text-align:center; padding:10px 12px; font-size:14px; } }
        .kicker{ font-family:'Space Mono', monospace; font-size:12px; color:var(--slate); display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .kicker::before{ content:''; width:22px; height:1px; background:var(--gold); display:inline-block; }
        .section-head :global(h2){ font-size:clamp(26px,3.4vw,38px); color:var(--head); }
        .section-head :global(p){ color:var(--slate); margin-top:14px; font-size:15.5px; }

        .ticket-wrap{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--frame); background:var(--bg-page); }
        .ticket-left{ background:var(--surf); color:var(--on-surf); padding:44px; position:relative; }
        .ticket-left :global(.price){ font-family:'Space Mono', monospace; font-size:46px; color:var(--gold-text); margin:10px 0; }
        .ticket-left :global(.price sup){ font-size:16px; }
        .ticket-left :global(.note){ color:var(--on-surf-dim); font-size:14px; }
        .perforation{ position:absolute; top:0; bottom:0; right:-1px; width:1px; background-image: linear-gradient(var(--bg-page) 50%, transparent 0%); background-size: 1px 14px; background-repeat:repeat-y; }
        .ticket-right{ padding:44px; }
        .ticket-right :global(ul){ list-style:none; }
        .ticket-right :global(li){ display:flex; gap:12px; padding:11px 0; border-bottom:1px solid var(--hairline); font-size:15px; }
        .ticket-right :global(li:last-child){ border-bottom:none; }
        .ticket-right :global(.chk){ color:var(--gold-ink); font-family:'Space Mono',monospace; }
        @media(max-width:720px){ .ticket-wrap{ grid-template-columns:1fr; } }

        .merch-items-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:22px; margin-bottom:48px; }
        .merch-item :global(h4){ font-size:15.5px; color:var(--head); margin:16px 0 6px; }
        .merch-item :global(p){ font-size:13px; color:var(--slate); }
        .merch-visual{ background:var(--surf); aspect-ratio:1/1; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .merch-visual :global(.blueprint){ opacity:0.4; }
        .merch-visual :global(.shirt-mark){ z-index:1; color:var(--gold-text); }
        .merch-visual :global(.merch-photo){ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
        .merch-visual :global(.merch-photo-clickable){ cursor:zoom-in; }
        /* การ์ดรูปสินค้าที่ระลึก (พื้นขาว รูปพื้นใส) — กดเพื่อขยาย + พลิกดูด้านหลัง */
        .souvenir-visual{ position:relative; display:block; width:100%; aspect-ratio:1/1; padding:0; border:1px solid var(--line); border-radius:16px; background:#fff; overflow:hidden; cursor:zoom-in; transition:transform .15s, box-shadow .2s; }
        .souvenir-visual:hover{ transform:scale(1.03); box-shadow:0 12px 26px var(--card-shadow); }
        .souvenir-visual:focus-visible{ outline:3px solid var(--gold-bright); outline-offset:3px; }
        .souvenir-photo{ width:100%; height:100%; object-fit:contain; padding:14px; display:block; }
        .flip-badge{ position:absolute; right:10px; bottom:10px; padding:3px 10px; border-radius:999px; background:rgba(14,42,71,.9); color:#fff; font-size:12px; z-index:2; }
        .souvenir-hint{ text-align:center; font-size:13px; color:var(--slate); margin:-28px 0 40px; }
        .lightbox-flip{ display:flex; flex-direction:column; align-items:center; max-width:min(90vw,640px); width:100%; }
        .lightbox-flip .flip-frame{ width:100%; aspect-ratio:1/1; background:#fff; border-radius:20px; padding:16px; cursor:pointer; transition:transform .15s ease; }
        .lightbox-flip .flip-frame.flipping{ transform:scaleX(0); }
        .lightbox-caption{ color:var(--paper); font-size:14px; margin-top:12px; text-align:center; }
        @media (prefers-reduced-motion: reduce){ .souvenir-visual, .lightbox-flip .flip-frame{ transition:none; } }
        .book-toast{ position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:600; max-width:calc(100vw - 32px); padding:14px 24px; border-radius:14px; background:var(--gold); color:var(--on-gold); font-weight:700; font-size:15px; text-align:center; box-shadow:0 12px 30px rgba(0,0,0,.35); animation:toastIn .2s ease; }
        @keyframes toastIn{ from{ opacity:0; transform:translate(-50%,10px); } to{ opacity:1; transform:translate(-50%,0); } }
        .lightbox-overlay{ position:fixed; inset:0; background:rgba(10,14,20,0.92); z-index:500; display:flex; align-items:center; justify-content:center; padding:40px; cursor:zoom-out; }
        .lightbox-image{ max-width:100%; max-height:100%; object-fit:contain; box-shadow:0 20px 60px rgba(0,0,0,0.5); cursor:default; }
        .lightbox-close{ position:absolute; top:20px; right:24px; background:none; border:none; color:var(--paper); font-size:36px; line-height:1; cursor:pointer; padding:6px 12px; }
        .lightbox-close:hover{ color:var(--gold-text); }
        @media(max-width:640px){ .lightbox-overlay{ padding:16px; } .lightbox-close{ top:10px; right:12px; font-size:30px; } }
        .merch-price-badge{ position:absolute; top:12px; right:12px; background:var(--gold); color:var(--on-gold); font-family:'Space Mono',monospace; font-size:10.5px; padding:5px 10px; font-weight:700; z-index:2; }
        .merch-size-block{ max-width:760px; }
        .size-table-wrap{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
        .size-table{ width:100%; min-width:520px; border-collapse:collapse; margin-bottom:10px; font-size:13px; }
        .size-table :global(th), .size-table :global(td){ border:1px solid var(--frame); padding:8px 6px; text-align:center; font-family:'Space Mono', monospace; color:var(--head); }
        .size-table :global(th){ background:var(--btn-dark-bg); color:var(--btn-dark-fg); font-weight:400; }
        .size-note{ font-size:12.5px; color:var(--slate); margin-bottom:26px; }
        @media(max-width:860px){ .merch-items-grid{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:520px){ .merch-items-grid{ grid-template-columns:1fr; } }

        .timeline{ position:relative; padding-left:2px; }
        .tl-line{ position:absolute; left:64px; top:6px; bottom:6px; width:1px; background:var(--line); }
        .tl-item{ display:grid; grid-template-columns:64px 1fr; gap:28px; padding:22px 0; position:relative; }
        .tl-time{ font-family:'Space Mono', monospace; font-size:14px; color:var(--gold-ink); text-align:right; padding-top:2px; }
        .tl-dot{ position:absolute; left:60px; top:8px; width:9px; height:9px; border-radius:50%; background:var(--gold); border:2px solid var(--bg-page); box-shadow:0 0 0 1px var(--gold); }
        .tl-body :global(h4){ font-size:16px; color:var(--head); margin-bottom:4px; }
        .tl-body :global(p){ font-size:14px; color:var(--slate); }
        .tl-group{ position:relative; margin:18px 0 4px calc(64px + 28px); padding:12px 16px; border-left:3px solid var(--gold); background:var(--bg-page); border-radius:0 10px 10px 0; }
        .tl-line + .tl-group{ margin-top:0; }
        .tl-group h3{ font-size:18px; font-weight:700; color:var(--head); line-height:1.4; }
        .tl-group p{ font-size:13px; color:var(--gold-ink); margin-top:2px; }
        @media(max-width:600px){
          .tl-line{ left:44px; } .tl-dot{ left:40px; }
          .tl-item{ grid-template-columns:44px 1fr; gap:16px; }
          .tl-time{ font-size:11px; }
          .tl-group{ margin-left:calc(44px + 16px); padding:10px 12px; }
          .tl-group h3{ font-size:16px; }
        }

        .honor-band{ background:var(--surf-deep); color:var(--on-surf); }
        .honor-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(var(--gold-rgb),0.25); margin-top:10px; }
        .honor-card{ background:var(--surf-deep); padding:36px 28px; text-align:center; }
        .honor-avatar{ width:74px; height:74px; margin:0 auto 18px; border-radius:50%; border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Sans Thai',sans-serif; font-size:22px; color:var(--gold-text); }
        .honor-avatar-photo{ object-fit:cover; }
        .honor-card :global(h4){ color:var(--on-surf); font-size:16px; margin-bottom:6px; }
        .honor-card :global(p){ color:var(--on-surf-dim); font-size:13px; }
        @media(max-width:720px){ .honor-grid{ grid-template-columns:1fr; } }

        .venue-grid{ display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:center; }
        .venue-visual{ background:var(--surf); aspect-ratio:4/3; position:relative; display:flex; align-items:center; justify-content:center; border:1px solid var(--frame); overflow:hidden; }
        .venue-map-img{ width:100%; height:100%; object-fit:cover; display:block; }
        .venue-detail{ margin-bottom:26px; }
        .venue-detail .label{ font-family:'Space Mono', monospace; font-size:11px; color:var(--gold-ink); margin-bottom:6px; letter-spacing:0.05em; }
        .venue-detail :global(p){ color:var(--ink); font-size:15px; }
        @media(max-width:860px){ .venue-grid{ grid-template-columns:1fr; } }

        .gallery-tabs{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:30px; }
        .gtab{ font-size:13px; padding:8px 16px; border:1px solid var(--frame); color:var(--head); cursor:pointer; background:transparent; font-family:'IBM Plex Sans Thai',sans-serif; }
        .gtab.active{ background:var(--btn-dark-bg); color:var(--btn-dark-fg); border-color:var(--btn-dark-bg); }
        .gallery-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .g-cell{ aspect-ratio:1; background:var(--surf-soft); position:relative; overflow:hidden; display:flex; align-items:flex-end; padding:12px; color:var(--paper-dim); font-size:12px; }
        .g-cell:empty::before, .g-cell::before{ content:'◇'; position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); font-size:22px; color:rgba(var(--gold-rgb),0.4); z-index:0; }
        .g-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
        .g-caption{ position:relative; z-index:2; padding:6px 8px; background:linear-gradient(transparent, rgba(10,30,51,.85)); display:block; width:100%; }
        @media(max-width:720px){ .gallery-grid{ grid-template-columns:repeat(2,1fr); } }

        .sponsor-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
        .sponsor-card{ border:1px solid var(--frame); padding:32px; }
        .sponsor-logo{ display:block; max-width:120px; max-height:56px; object-fit:contain; margin-bottom:16px; }
        .sponsor-card.gold{ border-color:var(--gold); background:linear-gradient(180deg, rgba(var(--gold-rgb),0.06), transparent); }
        .sponsor-tier{ font-family:'Space Mono',monospace; font-size:11px; color:var(--gold-ink); letter-spacing:0.05em; margin-bottom:10px; }
        .sponsor-card :global(h3){ font-size:22px; color:var(--head); margin-bottom:6px; }
        .sponsor-price{ font-family:'Space Mono',monospace; font-size:15px; color:var(--slate); margin-bottom:20px; }
        .sponsor-card :global(ul){ list-style:none; font-size:14px; color:var(--slate); }
        .sponsor-card :global(li){ padding:6px 0; }
        .sponsor-card :global(li::before){ content:'— '; color:var(--gold-ink); }
        @media(max-width:860px){ .sponsor-grid{ grid-template-columns:1fr; } }

        .faq-item{ border-bottom:1px solid var(--hairline); }
        .faq-q{ display:flex; justify-content:space-between; align-items:center; padding:22px 0; cursor:pointer; font-size:16px; color:var(--head); font-weight:600; }
        .faq-q :global(.plus){ font-family:'Space Mono',monospace; color:var(--gold-ink); transition:transform .2s; font-size:18px; display:inline-block; }
        .faq-item.open .faq-q :global(.plus){ transform:rotate(45deg); }
        .faq-a{ max-height:0; overflow:hidden; transition:max-height .25s ease; }
        .faq-item.open .faq-a{ max-height:200px; }
        .faq-a :global(p){ padding-bottom:22px; color:var(--slate); font-size:14.5px; max-width:640px; }

        .final-cta{ background:var(--surf-deep); color:var(--on-surf); text-align:center; padding:110px 0; }
        .final-cta :global(h2){ color:var(--on-surf); font-size:clamp(28px,4vw,42px); margin-bottom:18px; }
        .final-cta :global(p){ color:var(--on-surf-dim); margin-bottom:38px; }

        .landingRoot :global(footer){ background:var(--surf-deep); color:var(--on-surf-dim); border-top:1px solid rgba(var(--gold-rgb),0.15); padding:40px 0; }
        .foot-row{ display:flex; justify-content:space-between; flex-wrap:wrap; gap:14px; font-size:13px; }

      `}</style>
    </div>
  );
}
