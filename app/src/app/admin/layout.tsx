"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AdminGlobalSearch from "@/app/components/admin-global-search";
import AdminUserMenu from "@/app/components/admin-user-menu";
import { NotificationBell, useAdminNotifications } from "@/app/components/admin-notification-bell";

const ICONS: Record<string, JSX.Element> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="5" rx="1.5" />
      <rect x="13" y="10" width="8" height="11" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  checkin: (
    <>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14a5 5 0 0 1 5 6" />
    </>
  ),
  bag: (
    <>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  barcode: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M6 7v10M9 7v10M11.5 7v10M14 7v10M16.5 7v10M19 7v10" />
    </>
  ),
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="4" rx="1" />
      <rect x="5" y="13" width="14" height="8" rx="1" />
      <path d="M12 9v12" />
      <path d="M12 9c-1.5-4-6-4.5-6-1.5S9 9 12 9z" />
      <path d="M12 9c1.5-4 6-4.5 6-1.5S15 9 12 9z" />
    </>
  ),
  log: (
    <>
      <path d="M4 5h16M4 12h16M4 19h10" />
      <circle cx="20" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="9" r="1.75" />
      <path d="M21 16l-5.5-5.5L4 21" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
    </>
  ),
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      {ICONS[name]}
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function SearchIconSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-6 h-6">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="w-6 h-6">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type AdminRole = "SUPER_ADMIN" | "CHECKIN_STAFF" | "MERCH_STAFF" | "FINANCE_STAFF" | "RESERVATION_STAFF";

// roles: undefined = visible to every logged-in admin.
type NavChild = { href: string; label: string };
const NAV_ITEMS: { href: string; label: string; icon: string; exact?: boolean; roles?: AdminRole[]; section?: string; children?: NavChild[] }[] = [
  { href: "/admin", label: "แดชบอร์ด", icon: "dashboard", exact: true, roles: ["SUPER_ADMIN"] },
  { href: "/admin/events", label: "งานเลี้ยง", icon: "calendar", roles: ["SUPER_ADMIN", "RESERVATION_STAFF"], section: "งานเลี้ยงและการจอง" },
  { href: "/admin/reservations", label: "รายการจอง", icon: "checkin", roles: ["SUPER_ADMIN", "FINANCE_STAFF"], section: "งานเลี้ยงและการจอง" },
  { href: "/admin/support-registrations", label: "ศิษย์เก่าดีเด่น/ผู้สนับสนุน", icon: "users", roles: ["SUPER_ADMIN", "FINANCE_STAFF"], section: "งานเลี้ยงและการจอง" },
  { href: "/admin/checkin", label: "เช็คอิน", icon: "checkin", roles: ["SUPER_ADMIN", "CHECKIN_STAFF"], section: "งานเลี้ยงและการจอง" },
  { href: "/admin/alumni", label: "ทำเนียบศิษย์เก่า", icon: "users", roles: ["SUPER_ADMIN"], section: "งานเลี้ยงและการจอง" },
  { href: "/admin/merch/orders", label: "คำสั่งซื้อของที่ระลึก", icon: "bag", roles: ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"], section: "ของที่ระลึก" },
  { href: "/admin/merch/products", label: "จัดการสินค้า/สต๊อก", icon: "box", roles: ["SUPER_ADMIN", "MERCH_STAFF"], section: "ของที่ระลึก" },
  { href: "/admin/pos", label: "ขายหน้างาน (POS)", icon: "barcode", roles: ["SUPER_ADMIN", "MERCH_STAFF"], section: "ของที่ระลึก" },
  { href: "/admin/packages", label: "จัดการแพ็กเกจ", icon: "gift", roles: ["SUPER_ADMIN", "MERCH_STAFF", "RESERVATION_STAFF"], section: "ของที่ระลึก" },
  { href: "/admin/audit-log", label: "บันทึกการใช้งาน", icon: "log", roles: ["SUPER_ADMIN"], section: "ระบบ" },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน", icon: "users", roles: ["SUPER_ADMIN"], section: "ระบบ" },
  // เมนู "ตั้งค่า" เป็นกลุ่ม: รวมตั้งค่าระบบ + แบนเนอร์สไลด์ + โปสเตอร์ + จัดการหน้าแรก
  {
    href: "/admin/settings",
    label: "ตั้งค่า",
    icon: "gear",
    roles: ["SUPER_ADMIN"],
    section: "ระบบ",
    children: [
      { href: "/admin/settings", label: "ตั้งค่าระบบ" },
      { href: "/admin/home-banners", label: "แบนเนอร์สไลด์หน้าแรก" },
      { href: "/admin/poster", label: "โปสเตอร์งาน" },
      { href: "/admin/landing", label: "จัดการหน้าแรก (Landing)" },
    ],
  },
];

// ป้ายชื่อบทบาทภาษาไทย (ใช้ในตัวเลือก "มุมมองทดสอบ" และแบนเนอร์)
const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: "ผู้ดูแลระบบสูงสุด",
  RESERVATION_STAFF: "เจ้าหน้าที่จองโต๊ะ",
  FINANCE_STAFF: "เจ้าหน้าที่การเงิน",
  MERCH_STAFF: "เจ้าหน้าที่ของที่ระลึก",
  CHECKIN_STAFF: "เจ้าหน้าที่เช็คอิน",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [actualRole, setActualRole] = useState<AdminRole | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Mirrors the server-side allow-list enforced per-route in src/lib/apiHelpers.ts —
  // this is just for a clean UX (no flash of a page the API will refuse); the API
  // calls are what actually protect the data.
  const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
    CHECKIN_STAFF: ["/admin/checkin"],
    MERCH_STAFF: ["/admin/merch", "/admin/pos", "/admin/packages"],
    FINANCE_STAFF: ["/admin/reservations", "/admin/support-registrations", "/admin/merch/orders"],
    RESERVATION_STAFF: ["/admin/events", "/admin/merch/orders", "/admin/packages", "/admin/pos/package"],
  };
  const ROLE_HOME: Record<string, string> = {
    CHECKIN_STAFF: "/admin/checkin",
    MERCH_STAFF: "/admin/merch/orders",
    FINANCE_STAFF: "/admin/reservations",
    RESERVATION_STAFF: "/admin/events",
  };

  useEffect(() => {
    if (pathname === "/admin/login") return;
    setCheckingAccess(true);
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const r: AdminRole | null = data?.role ?? null;
        setRole(r);
        setActualRole(data?.actualRole ?? null);
        setUsername(data?.username ?? null);
        if (r && r !== "SUPER_ADMIN") {
          const allowed = ROLE_ALLOWED_PREFIXES[r] || [];
          const ok = allowed.some((prefix) => pathname?.startsWith(prefix));
          if (!ok) {
            router.replace(ROLE_HOME[r] || "/admin/login");
            return; // keep checkingAccess true — we're navigating away, never render this page's content
          }
        }
        setCheckingAccess(false);
      })
      .catch(() => setCheckingAccess(false));
  }, [pathname]);

  // งานค้างตามบทบาท → กระดิ่งบนแถบบน + ป้ายตัวเลขข้างเมนู (เจ้าหน้าที่เช็คอินไม่มีงานค้างให้แจ้ง)
  const notifEnabled = !!role && role !== "CHECKIN_STAFF" && pathname !== "/admin/login";
  const notif = useAdminNotifications(notifEnabled, pathname);

  if (pathname === "/admin/login") return <>{children}</>;

  // ยังไม่รู้บทบาท (กำลังโหลด /api/admin/me) = ยังไม่แสดงเมนู กันเมนูของบทบาทอื่นวาบขึ้นมาก่อน
  const visibleNavItems = NAV_ITEMS.filter((item) => role && (!item.roles || item.roles.includes(role)));

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  function itemClass(href: string, exact?: boolean) {
    const active = exact ? pathname === href : pathname?.startsWith(href);
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2 ${
      active
        ? "bg-primary-50 text-maroon-700 font-semibold border-maroon-700"
        : "text-stone-600 hover:bg-cream-50 hover:text-maroon-700 border-transparent"
    }`;
  }

  // มุมมองทดสอบ (View as): แสดงเฉพาะ "ตัวจริงเป็น super"
  const isSuper = (actualRole ?? role) === "SUPER_ADMIN";
  const impersonating = !!actualRole; // กำลังสวมบทบาทอื่นอยู่

  async function impersonate(nextRole: AdminRole) {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole }),
    });
    // reload ทั้งหน้าเพื่อให้ token/เมนู/ข้อมูล refresh ตามบทบาทใหม่
    window.location.href =
      nextRole === "SUPER_ADMIN" ? "/admin" : ROLE_HOME[nextRole] || "/admin";
  }

  const ViewAsBlock = isSuper ? (
    <div className="p-3 border-t border-cream-200 shrink-0">
      <label className="block text-xs font-medium text-stone-500 mb-1">🐞 มุมมองทดสอบ (View as)</label>
      <select
        value={role ?? "SUPER_ADMIN"}
        onChange={(e) => impersonate(e.target.value as AdminRole)}
        className="w-full border border-stone-300 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
            {r === "SUPER_ADMIN" ? " (ตัวเอง)" : ""}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const ImpersonationBanner = impersonating ? (
    <div className="bg-amber-50 border-b border-amber-300 text-amber-900 text-sm px-4 py-2 flex items-center justify-between gap-3">
      <span>
        🐞 โหมดทดสอบ: กำลังใช้งานในฐานะ <b>{ROLE_LABELS[(role ?? "SUPER_ADMIN") as AdminRole]}</b>
      </span>
      <button
        onClick={() => impersonate("SUPER_ADMIN")}
        className="shrink-0 underline font-medium hover:text-amber-700"
      >
        กลับเป็นผู้ดูแลสูงสุด
      </button>
    </div>
  ) : null;

  const Brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-5 h-16 border-b border-cream-200 shrink-0">
      <img src="/logo-89.png" alt="โลโก้ 89 ปี วิทยาลัยเทคนิคอุดรธานี" className="w-9 h-9 object-contain shrink-0" />
      <span className="leading-tight">
        <span className="block font-semibold text-stone-800 text-sm" style={{ fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>คืนสู่เหย้า วท.อุดรธานี</span>
        <span className="block text-xs text-stone-400">ระบบแอดมิน</span>
      </span>
    </Link>
  );

  const NavList = (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
      {visibleNavItems.map((item, i) => {
        // แสดงหัวข้อ section เมื่อเริ่ม section ใหม่ (เช่น "ระบบ")
        const prev = visibleNavItems[i - 1];
        const showHeader = item.section && item.section !== prev?.section;
        return (
          <div key={item.href}>
            {showHeader && (
              <div className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-stone-400">
                {item.section}
              </div>
            )}
            {item.children ? (
              (() => {
                const groupActive = item.children.some((c) => pathname?.startsWith(c.href));
                const open = settingsOpen || groupActive;
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen((v) => !v)}
                      aria-expanded={open}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors border-l-2 ${
                        groupActive ? "text-maroon-700 font-semibold border-maroon-700" : "text-stone-600 hover:bg-cream-50 hover:text-maroon-700 border-transparent"
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      <span className="flex-1 text-left">{item.label}</span>
                      <svg viewBox="0 0 24 24" className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className="mt-1 ml-4 pl-3 border-l border-cream-200 space-y-0.5">
                        {item.children.map((c) => {
                          const active = pathname === c.href || (c.href !== "/admin/settings" && pathname?.startsWith(c.href));
                          return (
                            <Link
                              key={c.href}
                              href={c.href}
                              onClick={() => setMobileOpen(false)}
                              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                                active ? "bg-primary-50 text-maroon-700 font-semibold" : "text-stone-600 hover:bg-cream-50 hover:text-maroon-700"
                              }`}
                            >
                              {c.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <Link href={item.href} className={itemClass(item.href, item.exact)} onClick={() => setMobileOpen(false)}>
                <NavIcon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {(notif.navBadges[item.href] || 0) > 0 && (
                  <span
                    className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] leading-5 font-semibold text-center"
                    aria-label={`${notif.navBadges[item.href]} รายการรอดำเนินการ`}
                  >
                    {notif.navBadges[item.href] > 99 ? "99+" : notif.navBadges[item.href]}
                  </span>
                )}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );

  const LogoutButton = (
    <div className="p-3 border-t border-cream-200 shrink-0">
      <button
        onClick={logout}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <LogoutIcon />
        ออกจากระบบ
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-50 flex">
      {/* ฟอนต์ชื่อแบรนด์เหมือนหน้าแรก */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&display=swap" />
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-cream-200 bg-white lg:sticky lg:top-0 lg:h-screen">
        {Brand}
        {NavList}
        {ViewAsBlock}
        {LogoutButton}
      </aside>

      {/* Mobile off-canvas sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between border-b border-cream-200 h-16 px-3 shrink-0">
              <div className="flex-1">{Brand}</div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="ปิดเมนู"
                className="p-2 mr-2 text-stone-500 hover:text-maroon-700"
              >
                <CloseIcon />
              </button>
            </div>
            {NavList}
            {ViewAsBlock}
            {LogoutButton}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {ImpersonationBanner}
        {/* แถบบน: ปุ่มเมนู (มือถือ) + ค้นหารวม + กระดิ่งงานค้าง + ชื่อผู้ใช้/บทบาท */}
        <header className="h-14 lg:h-16 flex items-center gap-2 sm:gap-3 px-3 sm:px-6 border-b border-cream-200 bg-white/90 backdrop-blur sticky top-0 z-40">
          {!mobileSearch && (
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="เปิดเมนู"
              className="lg:hidden p-2 -ml-2 text-stone-700 hover:text-maroon-700"
            >
              <MenuIcon />
            </button>
          )}
          {!mobileSearch && (
            <span className="md:hidden flex-1 min-w-0 font-display font-semibold text-stone-800 text-sm truncate">งานคืนสู่เหย้า</span>
          )}

          {/* ช่องค้นหา: เดสก์ท็อปแสดงตลอด, มือถือแสดงเมื่อกดไอคอนแว่นขยาย */}
          <AdminGlobalSearch
            autoFocus={mobileSearch}
            onDone={() => setMobileSearch(false)}
            className={mobileSearch ? "flex-1" : "hidden md:block flex-1 max-w-md"}
          />
          {mobileSearch && (
            <button onClick={() => setMobileSearch(false)} className="md:hidden shrink-0 text-sm text-stone-600 px-1">
              ยกเลิก
            </button>
          )}

          <div className={`${mobileSearch ? "hidden md:flex" : "flex"} items-center gap-1 ml-auto shrink-0`}>
            <button
              onClick={() => setMobileSearch(true)}
              aria-label="ค้นหา"
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg text-stone-600 hover:bg-cream-50 hover:text-maroon-700"
            >
              <SearchIconSmall />
            </button>
            {notifEnabled && (
              <NotificationBell data={notif.data} error={notif.error} updatedAt={notif.updatedAt} onReload={notif.reload} />
            )}
            {role && (
              <AdminUserMenu
                username={username}
                roleLabel={ROLE_LABELS[role]}
                impersonating={impersonating}
                onLogout={logout}
              />
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 w-full max-w-5xl mx-auto">
          {checkingAccess ? <div className="text-sm text-stone-400 py-10 text-center">กำลังตรวจสอบสิทธิ์...</div> : children}
        </main>
      </div>
    </div>
  );
}
