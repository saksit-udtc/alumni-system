// ตารางไซซ์เสื้อ + รูปวิธีวัด — แสดงเมื่อสินค้าตั้งค่า "ต้องเลือกไซส์" (requiresSize)
// ปรับค่าตารางได้ที่ SIZES / CHEST / LENGTH (หน่วยนิ้ว)
const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const CHEST = [38, 40, 42, 44, 46, 48]; // รอบอก
const LENGTH = [26, 27, 28, 29, 30, 31]; // ความยาว

export default function SizeChart({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-cream-200 bg-cream-50 p-3 sm:p-4 ${className}`}>
      <h4 className="text-sm font-display font-semibold text-stone-800 mb-3">
        ตารางไซซ์เสื้อ (นิ้ว) — ใช้ได้ทั้งคอปกและคอกลม
      </h4>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* รูปวิธีวัด (SVG) */}
        <svg
          viewBox="0 0 175 125"
          className="w-32 sm:w-36 h-auto shrink-0 text-maroon-700"
          role="img"
          aria-label="ภาพวิธีวัดขนาดเสื้อ: รอบอก และ ความยาว"
        >
          {/* ตัวเสื้อ */}
          <path
            d="M48 16 L34 24 L16 42 L28 54 L44 46 L44 112 L96 112 L96 46 L112 54 L124 42 L106 24 L92 16 C84 26 76 30 70 30 C64 30 56 26 48 16 Z"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {/* เส้นวัด "รอบอก" (แนวนอน) */}
          <line x1="44" y1="60" x2="96" y2="60" stroke="#0d2f57" strokeWidth="1.5" />
          <polygon points="44,60 51,56 51,64" fill="#0d2f57" />
          <polygon points="96,60 89,56 89,64" fill="#0d2f57" />
          <text x="70" y="74" textAnchor="middle" fontSize="9" fill="#0d2f57">รอบอก</text>
          {/* เส้นวัด "ความยาว" (แนวตั้ง) */}
          <line x1="106" y1="30" x2="106" y2="112" stroke="#0d2f57" strokeWidth="1.5" />
          <polygon points="106,30 102,37 110,37" fill="#0d2f57" />
          <polygon points="106,112 102,105 110,105" fill="#0d2f57" />
          <text x="112" y="74" fontSize="9" fill="#0d2f57">ความยาว</text>
        </svg>

        {/* ตาราง */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-center text-sm border-collapse">
            <thead>
              <tr>
                <th className="border border-stone-300 bg-maroon-700 text-white font-medium px-2 py-1.5">ไซซ์</th>
                {SIZES.map((s) => (
                  <th key={s} className="border border-stone-300 bg-maroon-700 text-white font-medium px-2 py-1.5">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-stone-300 px-2 py-1.5 font-medium text-stone-700">รอบอก</td>
                {CHEST.map((c, i) => (
                  <td key={i} className="border border-stone-300 px-2 py-1.5">{c}</td>
                ))}
              </tr>
              <tr>
                <td className="border border-stone-300 px-2 py-1.5 font-medium text-stone-700">ความยาว</td>
                {LENGTH.map((c, i) => (
                  <td key={i} className="border border-stone-300 px-2 py-1.5">{c}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-stone-500 mt-2">
        หน่วยเป็นนิ้ว · วัดจากตัวเสื้อ อาจคลาดเคลื่อนได้เล็กน้อยตามการตัดเย็บ
      </p>
    </div>
  );
}
