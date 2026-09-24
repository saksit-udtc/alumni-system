import LandingView from "@/app/components/landing-view";

// หน้าแรก: สไลด์ประชาสัมพันธ์ + ปุ่มเมนู + โปสเตอร์
// (เนื้อหา Landing 89 ปีเต็ม ย้ายไปที่ /homecoming-89 — คลิกสไลด์เพื่อไป)
export default function HomePage() {
  return <LandingView variant="home" />;
}
