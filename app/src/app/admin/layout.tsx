"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
  box: (
    <>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </>
  ),
  log: (
    <>
      <path d="M4 5h16M4 12h16M4 19h10" />
      <circle cx="20" cy="19" r="1.5" fill="currentColor" stroke="none" />
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
const NAV_ITEMS: { href: string; label: string; icon: string; exact?: boolean; roles?: AdminRole[] }[] = [
  { href: "/admin", label: "แดชบอร์ด", icon: "dashboard", exact: true, roles: ["SUPER_ADMIN"] },
  { href: "/admin/events", label: "งานเลี้ยง", icon: "calendar", roles: ["SUPER_ADMIN", "RESERVATION_STAFF"] },
  { href: "/admin/reservations", label: "รายการจอง", icon: "checkin", roles: ["SUPER_ADMIN", "FINANCE_STAFF"] },
  { href: "/admin/checkin", label: "เช็คอิน", icon: "checkin", roles: ["SUPER_ADMIN", "CHECKIN_STAFF"] },
  { href: "/admin/alumni", label: "ทำเนียบศิษย์เก่า", icon: "users", roles: ["SUPER_ADMIN"] },
  { href: "/admin/merch/orders", label: "คำสั่งซื้อของที่ระลึก", icon: "bag", roles: ["SUPER_ADMIN", "MERCH_STAFF", "FINANCE_STAFF", "RESERVATION_STAFF"] },
  { href: "/admin/merch/products", label: "จัดการสินค้า/สต๊อก", icon: "box", roles: ["SUPER_ADMIN", "MERCH_STAFF"] },
  { href: "/admin/audit-log", label: "บันทึกการใช้งาน", icon: "log", roles: ["SUPER_ADMIN"] },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน", icon: "users", roles: ["SUPER_ADMIN"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Mirrors the server-side allow-list enforced per-route in src/lib/apiHelpers.ts —
  // this is just for a clean UX (no flash of a page the API will refuse); the API
  // calls are what actually protect the data.
  const ROLE_ALLOWED_PREFIXES: Record<string, string[]> = {
    CHECKIN_STAFF: ["/admin/checkin"],
    MERCH_STAFF: ["/admin/merch"],
    FINANCE_STAFF: ["/admin/reservations", "/admin/merch/orders"],
    RESERVATION_STAFF: ["/admin/events", "/admin/merch/orders"],
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

  if (pathname === "/admin/login") return <>{children}</>;

  const visibleNavItems = NAV_ITEMS.filter((item) => !item.roles || !role || item.roles.includes(role));

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

  const Brand = (
    <Link href="/admin" className="flex items-center gap-2.5 px-5 h-16 border-b border-cream-200 shrink-0">
      <img src="/logo.jpg" alt="ตราสัญลักษณ์" className="w-9 h-9 rounded-full object-cover shrink-0" />
      <span className="leading-tight">
        <span className="block font-display font-semibold text-stone-800 text-sm">งานคืนสู่เหย้า</span>
        <span className="block text-xs text-stone-400">ระบบแอดมิน</span>
      </span>
    </Link>
  );

  const NavList = (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
      {visibleNavItems.map((item) => (
        <Link key={item.href} href={item.href} className={itemClass(item.href, item.exact)} onClick={() => setMobileOpen(false)}>
          <NavIcon name={item.icon} />
          {item.label}
        </Link>
      ))}
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
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-cream-200 bg-white">
        {Brand}
        {NavList}
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
            {LogoutButton}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <div className="lg:hidden h-14 flex items-center justify-between px-4 border-b border-cream-200 bg-white/90 backdrop-blur sticky top-0 z-40">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="เปิดเมนู"
            className="p-2 -ml-2 text-stone-700 hover:text-maroon-700"
          >
            <MenuIcon />
          </button>
          <span className="font-display font-semibold text-stone-800 text-sm">งานคืนสู่เหย้า</span>
          <span className="w-10" aria-hidden="true" />
        </div>

        <main className="flex-1 p-4 sm:p-6 w-full max-w-5xl mx-auto">
          {checkingAccess ? <div className="text-sm text-stone-400 py-10 text-center">กำลังตรวจสอบสิทธิ์...</div> : children}
        </main>
      </div>
    </div>
  );
}
