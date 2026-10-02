// ชื่อหน้าแบบเล็ก แทนแบนเนอร์ใหญ่ ใต้เมนูบนสุดของหน้าสาธารณะ (ไม่ใช่หน้าแรก)
// banner = true: แถบใหญ่ พื้นสีหลักของธีม (maroon = น้ำเงินในธีมน้ำเงิน) ตัวอักษรขาว
export default function PageTitle({ title, banner = false, subtitle }: { title: string; banner?: boolean; subtitle?: React.ReactNode }) {
  if (banner) {
    return (
      <div className="bg-maroon-700 border-b border-maroon-800">
        <div className="max-w-6xl mx-auto px-4 py-5 sm:py-7 text-center">
          <h1 className="font-display font-semibold text-white text-xl sm:text-3xl leading-snug">{title}</h1>
          {subtitle && <p className="mt-2 text-sm sm:text-lg text-white/90">{subtitle}</p>}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-cream-50 border-b border-cream-200">
      <div className="max-w-6xl mx-auto px-4 py-2 text-center">
        <h1 className="font-display font-semibold text-maroon-800 text-base sm:text-lg leading-snug">{title}</h1>
      </div>
    </div>
  );
}
