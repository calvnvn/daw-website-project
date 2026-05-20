export default function SettingsPreview({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="p-2 space-y-4">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h4 className="font-black text-sm text-slate-900 mb-4 uppercase tracking-wider">
          Global Site Settings
        </h4>
        <div className="space-y-3">
          {Object.keys(data).map((key) => {
            // Sembunyikan field sistem
            if (["id", "is_locked", "lock_ticket", "status"].includes(key))
              return null;

            return (
              <div
                key={key}
                className="flex items-start gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                <span className="w-1/3 text-xs font-bold text-slate-400 uppercase tracking-widest break-words">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="flex-1 text-sm font-medium text-slate-800 break-words">
                  {String(data[key]) || "-"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-[9px] text-slate-400 text-center italic mt-4">
        * Preview konfigurasi global website
      </p>
    </div>
  );
}
