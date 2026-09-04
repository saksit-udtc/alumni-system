"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
}

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

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [content, setContent] = useState<LandingContent | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [activeCategory, setActiveCategory] = useState("ทั้งหมด");
  const [countdown, setCountdown] = useState({ d: "--", h: "--", m: "--", s: "--" });
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data.events || []));
  }, []);

  useEffect(() => {
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
      if (e.key === "Escape") setLightboxImage(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxImage]);

  const bookableEvent = events.find((e) => e.status === "open") || events[0];
  const bookHref = bookableEvent ? `/events/${bookableEvent.id}` : "#tickets";

  const categories = ["ทั้งหมด", ...Array.from(new Set(gallery.map((g) => g.category)))];
  const filteredGallery = activeCategory === "ทั้งหมด" ? gallery : gallery.filter((g) => g.category === activeCategory);

  if (!content) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400 text-sm">กำลังโหลด...</div>;
  }

  return (
    <div className="landingRoot">
      <header>
        <nav className="nav">
          <a href="#home" className="brand">
            <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="brand-logo" />
            <span className="brand-text">คืนสู่เหย้า วท.อุดรธานี</span>
          </a>
          <div className="nav-links">
            <a href="#schedule">กำหนดการ</a>
            <a href="#honor">คุณครู</a>
            <a href="#venue">สถานที่</a>
            <a href="#gallery">คลังภาพ</a>
            <a href="#faq">คำถาม</a>
            <Link href="/status">ตรวจสอบการจอง</Link>
            <Link href="/register">ลงทะเบียนศิษย์เก่า</Link>
            <Link href="/admin/login" style={{ opacity: 0.6, fontSize: 12 }}>เจ้าหน้าที่</Link>
          </div>
          <Link href={bookHref} className="nav-cta">จองโต๊ะ</Link>
          <button className="burger" onClick={() => setMobileOpen((v) => !v)} aria-label="เมนู">☰</button>
        </nav>
        <div className={`mobile-menu${mobileOpen ? " open" : ""}`}>
          {[
            ["#schedule", "กำหนดการ"],
            ["#honor", "คุณครู"],
            ["#venue", "สถานที่"],
            ["#gallery", "คลังภาพ"],
            ["#faq", "คำถาม"],
          ].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)}>{label}</a>
          ))}
          <Link href="/status" onClick={() => setMobileOpen(false)}>ตรวจสอบการจอง</Link>
          <Link href="/register" onClick={() => setMobileOpen(false)}>ลงทะเบียนศิษย์เก่า</Link>
          <Link href="/admin/login" onClick={() => setMobileOpen(false)}>เจ้าหน้าที่</Link>
          <Link href={bookHref} onClick={() => setMobileOpen(false)}>จองโต๊ะ →</Link>
        </div>
      </header>

      <div className="floating-menu">
        <Link href={bookHref} className="floating-btn floating-btn-primary">จองโต๊ะงานเลี้ยง</Link>
        <Link href="/merch" className="floating-btn floating-btn-secondary">สั่งซื้อของที่ระลึก</Link>
      </div>

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
              <Link href={bookHref} className="btn-primary">จองโต๊ะ / ลงทะเบียน</Link>
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
              <div className="mono" style={{ fontSize: 12, color: "var(--gold-bright)", letterSpacing: ".05em" }}>TABLE RESERVATION · 89th ANNIVERSARY</div>
              <div className="price">{content.pricePerTable.toLocaleString("th-TH")}<sup>บาท</sup></div>
              <div className="note">ต่อโต๊ะ · จองโต๊ะ 1 โต๊ะ 8 ที่นั่ง</div>
            </div>
            <div className="ticket-right">
              <ul>
                <li><span className="chk">✓</span> ร่วมงานคืนสู่เหย้าเต็มรูปแบบ</li>
                <li><span className="chk">✓</span> รับประทานอาหารโต๊ะจีน พร้อมบูธบริการอาหารตลอดงาน</li>
                <li><span className="chk">✓</span> ร่วมพิธีบวงสรวงพระวิษณุ พิธีคลาสสิกประจำงาน</li>
                <li><span className="chk">✓</span> ชมกิจกรรมและการแสดง</li>
                <li><span className="chk">✓</span> ร่วมประมูลของที่ระลึก</li>
              </ul>
              <Link href={bookHref} className="btn-primary" style={{ marginTop: 24, display: "inline-block", background: "var(--navy)", color: "var(--paper)" }}>จองโต๊ะการเลี้ยงเลย →</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="merch">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">ของที่ระลึก</div>
            <h2>ของที่ระลึกงานคืนสู่เหย้า</h2>
            <p>เลือกเสื้อที่ระลึก เหรียญที่ระลึกและแก้วเก็บความเย็น เปิดให้สั่งซื้อเพิ่มเติมได้</p>
          </div>
          <div className="merch-items-grid">
            {content.merchItems.map((item, i) => (
              <div className="merch-item" key={i}>
                <div className="merch-visual">
                  <div className="blueprint" />
                  <div className="merch-price-badge">{item.badge}</div>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="merch-photo merch-photo-clickable"
                      onClick={() => setLightboxImage(item.imageUrl)}
                    />
                  ) : (
                    <div className="shirt-mark"><MerchIcon icon={item.icon} /></div>
                  )}
                </div>
                <h4>{item.name}</h4>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
          <div className="merch-size-block">
            <div className="spec-label" style={{ color: "var(--gold)", marginBottom: 10 }}>ตารางไซซ์เสื้อ (นิ้ว) — ใช้ได้ทั้งคอปกและคอกลม</div>
            <table className="size-table">
              <tbody>
                <tr><th>ไซซ์</th><th>S</th><th>M</th><th>L</th><th>XL</th><th>2XL</th><th>3XL</th></tr>
                <tr><td>รอบอก</td><td>38</td><td>40</td><td>42</td><td>44</td><td>46</td><td>48</td></tr>
                <tr><td>ความยาว</td><td>26</td><td>27</td><td>28</td><td>29</td><td>30</td><td>31</td></tr>
              </tbody>
            </table>
            <p className="size-note">หน่วยเป็นนิ้ว วัดจากตัวเสื้อ อาจคลาดเคลื่อนได้เล็กน้อยตามการตัดเย็บ · เลือกแบบเสื้อและไซซ์ได้ตอนลงทะเบียน ส่วนเหรียญและแก้วสั่งซื้อเพิ่มเติมได้ในระบบเดียวกัน</p>
            <Link href={bookHref} className="btn-primary" style={{ background: "var(--navy)", color: "var(--paper)", display: "inline-block" }}>จองโต๊ะการเลี้ยงพร้อมเลือกของที่ระลึก</Link>
          </div>
        </div>
      </section>

      <section id="schedule" style={{ background: "var(--paper-dim)" }}>
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">กำหนดการ</div>
            <h2>หนึ่งค่ำคืน ชั่วโมงต่อชั่วโมง</h2>
            <p>กำหนดการอาจปรับเปลี่ยนเล็กน้อยหน้างาน</p>
          </div>
          <div className="timeline">
            <div className="tl-line" />
            {content.timeline.map((item, i) => (
              <div className="tl-item" key={i}>
                <div className="tl-dot" />
                <div className="tl-time">{item.time}</div>
                <div className="tl-body"><h4>{item.title}</h4><p>{item.description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="honor-band" id="honor">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker" style={{ color: "var(--gold-bright)" }}>แขกผู้มีเกียรติ</div>
            <h2 style={{ color: "var(--paper)" }}>แด่ครูผู้สร้างช่างฝีมือ</h2>
            <p style={{ color: "var(--paper-dim)" }}>แม้ออกจากรั้ววิทยาลัยไปนานเพียงใด บทเรียนของครูยังคงอยู่เสมอ</p>
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
              <a href={content.mapUrl} target="_blank" rel="noopener" className="btn-ghost" style={{ borderColor: "var(--navy)", color: "var(--navy)", display: "inline-block" }}>ดูแผนที่ →</a>
            ) : null}
          </div>
          <div className="venue-visual">
            <div className="blueprint" />
            <div className="corner tl" /><div className="corner br" />
            <div className="pin">◈<br />{content.venueName}<br />อ.เมือง จ.อุดรธานี</div>
          </div>
        </div>
      </section>

      <section id="gallery" style={{ background: "var(--paper-dim)" }}>
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">คลังภาพ</div>
            <h2>ความทรงจำที่เราสร้างด้วยกัน</h2>
            <p>กำลังรวบรวมภาพเก่าจากทุกรุ่น — ส่งภาพของคุณเข้ามาได้ อาจได้ขึ้นจอใหญ่ในคืนงาน</p>
          </div>
          {gallery.length > 0 && (
            <div className="gallery-tabs">
              {categories.map((c) => (
                <button key={c} className={`gtab${activeCategory === c ? " active" : ""}`} onClick={() => setActiveCategory(c)}>{c}</button>
              ))}
            </div>
          )}
          {gallery.length === 0 ? (
            <div className="gallery-grid">
              {["ปฐมนิเทศ", "ห้องปฏิบัติการ", "คุณครู", "กีฬาสี", "ฝึกงาน", "เพื่อนร่วมรุ่น", "พิธีจบการศึกษา", "คืนสู่เหย้าปีก่อน"].map((label) => (
                <div className="g-cell" key={label}>รอภาพถ่าย — {label}</div>
              ))}
            </div>
          ) : (
            <div className="gallery-grid">
              {filteredGallery.map((g) => (
                <div className="g-cell" key={g.id}>
                  <img src={g.imageUrl} alt={g.caption || ""} className="g-img" />
                  {g.caption && <span className="g-caption">{g.caption}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section id="sponsors">
        <div className="wrap">
          <div className="section-head">
            <div className="kicker">ร่วมเป็นส่วนหนึ่ง</div>
            <h2>เปิดรับผู้สนับสนุน</h2>
            <p>การสนับสนุนของท่านช่วยให้ค่ำคืนนี้เกิดขึ้นได้ และสมทบทุนการศึกษาแก่นักศึกษาปัจจุบัน</p>
          </div>
          <div className="sponsor-grid">
            {content.sponsors.map((s, i) => (
              <div className={`sponsor-card${i === 0 ? " gold" : ""}`} key={i}>
                {s.logoUrl && <img src={s.logoUrl} alt={s.label} className="sponsor-logo" />}
                <div className="sponsor-tier">{s.tier}</div>
                <h3>{s.label}</h3>
                <div className="sponsor-price">{s.price}</div>
                <ul>
                  {s.benefits.map((b, bi) => <li key={bi}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" style={{ background: "var(--paper-dim)" }}>
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

      <section className="final-cta">
        <div className="blueprint" style={{ opacity: 0.2 }} />
        <div className="wrap">
          <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" style={{ width: 110, height: 110, objectFit: "contain", margin: "0 auto 16px" }} />
          <div className="eyebrow-tech" style={{ justifyContent: "center" }}>89 ปี วิทยาลัยเทคนิคอุดรธานี</div>
          <h2>มาเจอกันนะ.</h2>
          <p>{content.eventDateShortLabel} · {content.venueName} · โต๊ะละ {content.pricePerTable.toLocaleString("th-TH")} บาท (8 ที่นั่ง)</p>
          <Link href={bookHref} className="btn-primary">จองโต๊ะการเลี้ยงตอนนี้</Link>
        </div>
      </section>

      <footer>
        <div className="wrap foot-row">
          <span>© 2569 ทีมผู้จัดงานคืนสู่เหย้า วิทยาลัยเทคนิคอุดรธานี</span>
          <span><Link href={bookHref}>ระบบจองโต๊ะออนไลน์ →</Link></span>
        </div>
      </footer>

      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxImage(null)}
            aria-label="ปิด"
          >
            ×
          </button>
          <img src={lightboxImage} alt="" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Trirong:ital,wght@0,500;0,600;0,700;1,600&family=Fraunces:ital,wght@0,500;0,600;1,500;1,600&family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Space+Mono&display=swap');
        body{ background: var(--paper, #F3EFE6); }
      `}</style>
      <style jsx>{`
        .landingRoot{
          --navy-deep:#0A1E33;
          --navy:#0E2A47;
          --navy-soft:#16385C;
          --gold:#C6A15B;
          --gold-bright:#DDBD7C;
          --paper:#F3EFE6;
          --paper-dim:#E7E1D2;
          --slate:#5B6B80;
          --ink:#132132;
          --line:rgba(198,161,91,0.28);
          background:var(--paper);
          color:var(--ink);
          font-family:'IBM Plex Sans Thai', sans-serif;
          line-height:1.7;
          overflow-x:hidden;
        }
        .landingRoot :global(h1),.landingRoot :global(h2),.landingRoot :global(h3),.landingRoot :global(h4){ font-family:'Trirong', serif; font-weight:600; line-height:1.3; }
        .accent-serif{ font-family:'Fraunces', serif; font-style:italic; font-weight:500; }
        .mono{ font-family:'Space Mono', monospace; }
        .landingRoot :global(a){ color:inherit; text-decoration:none; }
        .wrap{ max-width:1120px; margin:0 auto; padding:0 24px; }
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
          background:rgba(10,30,51,0.92);
          backdrop-filter:blur(8px);
          border-bottom:1px solid rgba(198,161,91,0.2);
        }
        .nav{ display:flex; align-items:center; justify-content:space-between; max-width:1120px; margin:0 auto; padding:16px 24px; gap:16px; }
        .brand{ display:flex; align-items:center; gap:10px; color:var(--paper); }
        .brand-logo{ width:44px; height:44px; object-fit:contain; }
        .brand-text{ font-family:'IBM Plex Sans Thai', sans-serif; font-weight:600; font-size:15px; letter-spacing:0.02em; color: var(--paper); }
        .nav-links{ display:flex; gap:22px; align-items:center; }
        .nav-links :global(a){ color:var(--paper-dim); font-size:14px; transition:color .2s; white-space:nowrap; }
        .nav-links :global(a:hover){ color:var(--gold-bright); }
        :global(.nav-cta){ background:var(--gold); color:var(--navy-deep); padding:10px 20px; border-radius:2px; font-weight:600; font-size:14px; transition:background .2s; white-space:nowrap; }
        :global(.nav-cta:hover){ background:var(--gold-bright); }

        .floating-menu{ position:fixed; right:18px; bottom:18px; z-index:150; display:flex; flex-direction:column; gap:10px; }
        .floating-menu :global(a){ padding:13px 22px; border-radius:999px; font-weight:700; font-size:14px; text-align:center; white-space:nowrap; box-shadow:0 8px 22px rgba(10,30,51,.35); transition:transform .15s, background .2s; }
        .floating-menu :global(a:hover){ transform:translateY(-2px); }
        .floating-menu :global(.floating-btn-primary){ background:var(--gold); color:var(--navy-deep); }
        .floating-menu :global(.floating-btn-primary:hover){ background:var(--gold-bright); }
        .floating-menu :global(.floating-btn-secondary){ background:var(--navy-deep); color:var(--paper); border:1px solid var(--gold); }
        .floating-menu :global(.floating-btn-secondary:hover){ background:var(--navy); }
        @media (max-width: 640px){
          .floating-menu{ right:14px; bottom:14px; }
          .floating-menu :global(a){ padding:11px 16px; font-size:13px; }
        }
        .burger{ display:none; color:var(--paper); font-size:22px; background:none; border:none; cursor:pointer; }
        .mobile-menu{ display:none; flex-direction:column; gap:0; background:var(--navy-deep); border-top:1px solid rgba(198,161,91,0.2); }
        .mobile-menu :global(a){ color:var(--paper-dim); padding:14px 24px; border-bottom:1px solid rgba(198,161,91,0.1); font-size:14px; display:block; }
        .mobile-menu.open{ display:flex; }

        @media(max-width:860px){
          .nav-links{ display:none; }
          .burger{ display:block; }
        }

        .hero{ background: radial-gradient(ellipse at top right, var(--navy-soft) 0%, var(--navy-deep) 55%); color:var(--paper); padding:190px 0 120px; overflow:hidden; }
        .hero-grid{ display:grid; grid-template-columns:1.1fr 0.9fr; gap:56px; align-items:center; }
        .eyebrow-tech{ font-family:'Space Mono', monospace; font-size:12px; color:var(--gold); letter-spacing:0.06em; margin-bottom:18px; display:flex; align-items:center; gap:10px; }
        .eyebrow-tech::before{ content:''; width:26px; height:1px; background:var(--gold); display:inline-block; }
        .hero-logo{ width:120px; height:120px; object-fit:contain; margin-bottom:22px; }
        .hero :global(h1){ font-size:clamp(34px,5vw,56px); color:var(--paper); margin-bottom:22px; }
        .hero :global(h1 .accent){ color:var(--gold-bright); font-weight:500; }
        .hero :global(p.lead){ font-size:17px; color:var(--paper-dim); max-width:480px; margin-bottom:34px; }
        .hero-actions{ display:flex; gap:14px; flex-wrap:wrap; }
        :global(.btn-primary){ background:var(--gold); color:var(--navy-deep); padding:15px 28px; font-weight:700; border-radius:2px; font-size:15px; transition:transform .15s, background .2s; display:inline-block; }
        :global(.btn-primary:hover){ background:var(--gold-bright); transform:translateY(-1px); }
        .btn-ghost{ border:1px solid rgba(243,239,230,0.35); color:var(--paper); padding:15px 28px; border-radius:2px; font-size:15px; }
        .btn-ghost:hover{ border-color:var(--gold); color:var(--gold-bright); }

        .spec-card{ background:rgba(243,239,230,0.04); border:1px solid rgba(198,161,91,0.35); padding:28px; position:relative; }
        .spec-label{ font-family:'Space Mono', monospace; font-size:11px; color:var(--gold); margin-bottom:16px; letter-spacing:0.05em; }
        .spec-row{ display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px dashed rgba(198,161,91,0.25); font-size:14px; }
        .spec-row:last-child{ border-bottom:none; }
        .spec-row span:first-child{ color:var(--paper-dim); }
        .spec-row span:last-child{ font-family:'Space Mono', monospace; color:var(--paper); }

        .countdown{ display:flex; gap:14px; margin-top:36px; }
        .cd-unit{ text-align:center; }
        .cd-num{ font-family:'Space Mono', monospace; font-size:30px; color:var(--gold-bright); border:1px solid rgba(198,161,91,0.3); padding:10px 14px; min-width:60px; }
        .cd-label{ font-size:11px; color:var(--paper-dim); margin-top:6px; letter-spacing:0.04em; }

        @media(max-width:860px){
          .hero-grid{ grid-template-columns:1fr; }
          .hero{ padding:150px 0 80px; }
        }

        .section-head{ margin-bottom:52px; max-width:600px; }
        .kicker{ font-family:'Space Mono', monospace; font-size:12px; color:var(--slate); display:flex; align-items:center; gap:10px; margin-bottom:14px; }
        .kicker::before{ content:''; width:22px; height:1px; background:var(--gold); display:inline-block; }
        .section-head :global(h2){ font-size:clamp(26px,3.4vw,38px); color:var(--navy); }
        .section-head :global(p){ color:var(--slate); margin-top:14px; font-size:15.5px; }

        .ticket-wrap{ display:grid; grid-template-columns:1fr 1fr; gap:0; border:1px solid var(--navy); background:var(--paper); }
        .ticket-left{ background:var(--navy); color:var(--paper); padding:44px; position:relative; }
        .ticket-left :global(.price){ font-family:'Space Mono', monospace; font-size:46px; color:var(--gold-bright); margin:10px 0; }
        .ticket-left :global(.price sup){ font-size:16px; }
        .ticket-left :global(.note){ color:var(--paper-dim); font-size:14px; }
        .perforation{ position:absolute; top:0; bottom:0; right:-1px; width:1px; background-image: linear-gradient(var(--paper) 50%, transparent 0%); background-size: 1px 14px; background-repeat:repeat-y; }
        .ticket-right{ padding:44px; }
        .ticket-right :global(ul){ list-style:none; }
        .ticket-right :global(li){ display:flex; gap:12px; padding:11px 0; border-bottom:1px solid var(--paper-dim); font-size:15px; }
        .ticket-right :global(li:last-child){ border-bottom:none; }
        .ticket-right :global(.chk){ color:var(--gold); font-family:'Space Mono',monospace; }
        @media(max-width:720px){ .ticket-wrap{ grid-template-columns:1fr; } }

        .merch-items-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:22px; margin-bottom:48px; }
        .merch-item :global(h4){ font-size:15.5px; color:var(--navy); margin:16px 0 6px; }
        .merch-item :global(p){ font-size:13px; color:var(--slate); }
        .merch-visual{ background:var(--navy); aspect-ratio:1/1; position:relative; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .merch-visual :global(.blueprint){ opacity:0.4; }
        .merch-visual :global(.shirt-mark){ z-index:1; color:var(--gold-bright); }
        .merch-visual :global(.merch-photo){ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
        .merch-visual :global(.merch-photo-clickable){ cursor:zoom-in; }
        .lightbox-overlay{ position:fixed; inset:0; background:rgba(10,14,20,0.92); z-index:500; display:flex; align-items:center; justify-content:center; padding:40px; cursor:zoom-out; }
        .lightbox-image{ max-width:100%; max-height:100%; object-fit:contain; box-shadow:0 20px 60px rgba(0,0,0,0.5); cursor:default; }
        .lightbox-close{ position:absolute; top:20px; right:24px; background:none; border:none; color:var(--paper); font-size:36px; line-height:1; cursor:pointer; padding:6px 12px; }
        .lightbox-close:hover{ color:var(--gold-bright); }
        @media(max-width:640px){ .lightbox-overlay{ padding:16px; } .lightbox-close{ top:10px; right:12px; font-size:30px; } }
        .merch-price-badge{ position:absolute; top:12px; right:12px; background:var(--gold); color:var(--navy-deep); font-family:'Space Mono',monospace; font-size:10.5px; padding:5px 10px; font-weight:700; z-index:2; }
        .merch-size-block{ max-width:640px; }
        .size-table{ width:100%; border-collapse:collapse; margin-bottom:10px; font-size:13px; }
        .size-table :global(th), .size-table :global(td){ border:1px solid var(--navy); padding:8px 6px; text-align:center; font-family:'Space Mono', monospace; color:var(--navy); }
        .size-table :global(th){ background:var(--navy); color:var(--paper); font-weight:400; }
        .size-note{ font-size:12.5px; color:var(--slate); margin-bottom:26px; }
        @media(max-width:860px){ .merch-items-grid{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:520px){ .merch-items-grid{ grid-template-columns:1fr; } }

        .timeline{ position:relative; padding-left:2px; }
        .tl-line{ position:absolute; left:64px; top:6px; bottom:6px; width:1px; background:var(--line); }
        .tl-item{ display:grid; grid-template-columns:64px 1fr; gap:28px; padding:22px 0; position:relative; }
        .tl-time{ font-family:'Space Mono', monospace; font-size:14px; color:var(--gold); text-align:right; padding-top:2px; }
        .tl-dot{ position:absolute; left:60px; top:8px; width:9px; height:9px; border-radius:50%; background:var(--gold); border:2px solid var(--paper); box-shadow:0 0 0 1px var(--gold); }
        .tl-body :global(h4){ font-size:16px; color:var(--navy); margin-bottom:4px; }
        .tl-body :global(p){ font-size:14px; color:var(--slate); }
        @media(max-width:600px){
          .tl-line{ left:44px; } .tl-dot{ left:40px; }
          .tl-item{ grid-template-columns:44px 1fr; gap:16px; }
          .tl-time{ font-size:11px; }
        }

        .honor-band{ background:var(--navy-deep); color:var(--paper); }
        .honor-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:1px; background:rgba(198,161,91,0.25); margin-top:10px; }
        .honor-card{ background:var(--navy-deep); padding:36px 28px; text-align:center; }
        .honor-avatar{ width:74px; height:74px; margin:0 auto 18px; border-radius:50%; border:1px solid var(--gold); display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Sans Thai',sans-serif; font-size:22px; color:var(--gold-bright); }
        .honor-avatar-photo{ object-fit:cover; }
        .honor-card :global(h4){ color:var(--paper); font-size:16px; margin-bottom:6px; }
        .honor-card :global(p){ color:var(--paper-dim); font-size:13px; }
        @media(max-width:720px){ .honor-grid{ grid-template-columns:1fr; } }

        .venue-grid{ display:grid; grid-template-columns:1fr 1fr; gap:48px; align-items:center; }
        .venue-visual{ background:var(--navy); aspect-ratio:4/3; position:relative; display:flex; align-items:center; justify-content:center; border:1px solid var(--navy); }
        .venue-visual :global(.blueprint){ opacity:0.35; }
        .venue-visual .pin{ font-family:'Space Mono',monospace; color:var(--gold-bright); font-size:13px; text-align:center; z-index:1; }
        .venue-detail{ margin-bottom:26px; }
        .venue-detail .label{ font-family:'Space Mono', monospace; font-size:11px; color:var(--gold); margin-bottom:6px; letter-spacing:0.05em; }
        .venue-detail :global(p){ color:var(--ink); font-size:15px; }
        @media(max-width:860px){ .venue-grid{ grid-template-columns:1fr; } }

        .gallery-tabs{ display:flex; gap:10px; flex-wrap:wrap; margin-bottom:30px; }
        .gtab{ font-size:13px; padding:8px 16px; border:1px solid var(--navy); color:var(--navy); cursor:pointer; background:transparent; font-family:'IBM Plex Sans Thai',sans-serif; }
        .gtab.active{ background:var(--navy); color:var(--paper); }
        .gallery-grid{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .g-cell{ aspect-ratio:1; background:var(--navy-soft); position:relative; overflow:hidden; display:flex; align-items:flex-end; padding:12px; color:var(--paper-dim); font-size:12px; }
        .g-cell:empty::before, .g-cell::before{ content:'◇'; position:absolute; top:50%; left:50%; transform:translate(-50%,-60%); font-size:22px; color:rgba(198,161,91,0.4); z-index:0; }
        .g-img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; }
        .g-caption{ position:relative; z-index:2; padding:6px 8px; background:linear-gradient(transparent, rgba(10,30,51,.85)); display:block; width:100%; }
        @media(max-width:720px){ .gallery-grid{ grid-template-columns:repeat(2,1fr); } }

        .sponsor-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
        .sponsor-card{ border:1px solid var(--navy); padding:32px; }
        .sponsor-logo{ display:block; max-width:120px; max-height:56px; object-fit:contain; margin-bottom:16px; }
        .sponsor-card.gold{ border-color:var(--gold); background:linear-gradient(180deg, rgba(198,161,91,0.06), transparent); }
        .sponsor-tier{ font-family:'Space Mono',monospace; font-size:11px; color:var(--gold); letter-spacing:0.05em; margin-bottom:10px; }
        .sponsor-card :global(h3){ font-size:22px; color:var(--navy); margin-bottom:6px; }
        .sponsor-price{ font-family:'Space Mono',monospace; font-size:15px; color:var(--slate); margin-bottom:20px; }
        .sponsor-card :global(ul){ list-style:none; font-size:14px; color:var(--slate); }
        .sponsor-card :global(li){ padding:6px 0; }
        .sponsor-card :global(li::before){ content:'— '; color:var(--gold); }
        @media(max-width:860px){ .sponsor-grid{ grid-template-columns:1fr; } }

        .faq-item{ border-bottom:1px solid var(--paper-dim); }
        .faq-q{ display:flex; justify-content:space-between; align-items:center; padding:22px 0; cursor:pointer; font-size:16px; color:var(--navy); font-weight:600; }
        .faq-q :global(.plus){ font-family:'Space Mono',monospace; color:var(--gold); transition:transform .2s; font-size:18px; display:inline-block; }
        .faq-item.open .faq-q :global(.plus){ transform:rotate(45deg); }
        .faq-a{ max-height:0; overflow:hidden; transition:max-height .25s ease; }
        .faq-item.open .faq-a{ max-height:200px; }
        .faq-a :global(p){ padding-bottom:22px; color:var(--slate); font-size:14.5px; max-width:640px; }

        .final-cta{ background:var(--navy-deep); color:var(--paper); text-align:center; padding:110px 0; }
        .final-cta :global(h2){ color:var(--paper); font-size:clamp(28px,4vw,42px); margin-bottom:18px; }
        .final-cta :global(p){ color:var(--paper-dim); margin-bottom:38px; }

        .landingRoot :global(footer){ background:var(--navy-deep); color:var(--paper-dim); border-top:1px solid rgba(198,161,91,0.15); padding:40px 0; }
        .foot-row{ display:flex; justify-content:space-between; flex-wrap:wrap; gap:14px; font-size:13px; }

      `}</style>
    </div>
  );
}
