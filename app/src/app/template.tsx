// App Router "template" — ต่างจาก layout ตรงที่ remount ใหม่ทุกครั้งที่เปลี่ยนหน้า
// จึงเล่นอนิเมชันเข้า (.page-transition ใน globals.css) ทุก ๆ การนำทาง ทำให้เปลี่ยนหน้าลื่น ไม่แข็งทื่อ
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
