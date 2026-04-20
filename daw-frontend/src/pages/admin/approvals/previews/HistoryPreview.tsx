// src/pages/admin/approvals/previews/HistoryPreview.tsx
import { Calendar } from "lucide-react";

interface HistoryItem {
  year: string;
  text?: string;
  description?: string;
}

export default function HistoryPreview({
  data,
}: {
  data: { histories: HistoryItem[] };
}) {
  const items = data?.histories || [];

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 scale-90 origin-top">
      <div className="relative pl-8 space-y-8">
        {/* Garis Timeline Mini */}
        <div className="absolute left-[19px] top-4 bottom-0 w-[2px] bg-daw-green/30 rounded-full"></div>

        {items.map((item, idx) => (
          <div key={idx} className="relative pl-10">
            {/* Bulatan Node */}
            <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white border-2 border-daw-green flex items-center justify-center z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-daw-green"></div>
            </div>

            {/* Card Preview */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-daw-green/10 text-daw-green font-bold text-[10px] mb-2">
                <Calendar className="w-3 h-3" />
                <span>{item.year}</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {item.text || item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
