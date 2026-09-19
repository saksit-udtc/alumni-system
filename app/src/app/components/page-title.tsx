// ชื่อหน้าแบบเล็ก แทนแบนเนอร์ใหญ่ ใต้เมนูบนสุดของหน้าสาธารณะ (ไม่ใช่หน้าแรก)
export default function PageTitle({ title }: { title: string }) {
  return (
    <div className="bg-cream-50 border-b border-cream-200">
      <div className="max-w-6xl mx-auto px-4 py-2 text-center">
        <h1 className="font-display font-semibold text-maroon-800 text-base sm:text-lg leading-snug">{title}</h1>
      </div>
    </div>
  );
}
