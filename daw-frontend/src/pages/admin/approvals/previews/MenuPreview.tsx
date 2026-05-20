import React from "react";

export default function MenuPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="p-2 space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Menu Label
            </p>
            <p className="font-bold text-sm text-slate-900">{data.label}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Target URL
            </p>
            <p className="font-mono text-xs text-blue-600">{data.url}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Parent ID
            </p>
            <p className="text-sm text-slate-600">{data.parentId || "Root"}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Order Index
            </p>
            <p className="text-sm text-slate-600">{data.orderIndex}</p>
          </div>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 text-center italic mt-4">
        * Preview struktur navigasi menu
      </p>
    </div>
  );
}
