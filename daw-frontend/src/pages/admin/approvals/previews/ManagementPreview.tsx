import { getCleanImageUrl } from "@/lib/utils";

export default function ManagementPreview({ data }: { data: any }) {
  if (!data) return null;

  const getInitials = (name: string) => {
    if (!name) return "??";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const isChairman = data.level === "chairman";
  const isDirector = data.level === "director";

  return (
    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
      {/* 🛡️ Header Info Tingkat Jabatan */}
      <div className="mb-4 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-daw-green text-white text-[10px] font-black uppercase tracking-widest">
          {data.level || "Staff"}
        </span>
        <span className="text-[10px] text-slate-400 font-bold uppercase italic">
          Preview Render Mode
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col md:flex-row gap-6 p-6">
        {/* 📸 Bagian Foto */}
        <div
          className={`shrink-0 mx-auto md:mx-0 ${isChairman ? "w-32 h-40" : "w-24 h-24"} rounded-xl overflow-hidden bg-daw-green/5 border border-slate-100 flex items-center justify-center`}>
          {data.photoUrl ? (
            <img
              src={getCleanImageUrl(data.photoUrl)}
              alt={data.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-serif font-bold text-daw-green/30">
              {getInitials(data.name)}
            </span>
          )}
        </div>

        {/* 📝 Bagian Informasi */}
        <div className="flex-1 space-y-2 text-center md:text-left">
          <div>
            <h4 className="font-serif font-bold text-xl text-slate-900 leading-tight">
              {data.name || "Nama Belum Diisi"}
            </h4>
            <p className="text-[10px] font-bold text-daw-green uppercase tracking-widest mt-1">
              {data.role || "Jabatan Belum Diisi"}
            </p>
          </div>

          <div className="h-px w-10 bg-slate-200 mx-auto md:mx-0"></div>

          <p className="text-xs text-slate-500 leading-relaxed line-clamp-4 italic">
            "{data.description || "Tidak ada deskripsi profil."}"
          </p>

          {/* Metadata Kecil */}
          <div className="pt-2 flex items-center justify-center md:justify-start gap-3">
            <div className="text-[9px] text-slate-400">
              Order:{" "}
              <span className="font-bold text-slate-600">
                {data.order || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 💡 Info Tambahan untuk Approver */}
      <p className="mt-4 text-[10px] text-slate-400 text-center leading-relaxed">
        Tampilan di atas adalah simulasi profil individu dalam kontainer modul
        Management DAW Group.
      </p>
    </div>
  );
}
