export default function AboutInfoPreview({ data }: { data: any }) {
  if (!data) return null;

  // Helper 1: Render Bold Text (Sama dengan Frontend)
  const renderHighlightedText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <span key={index} className="text-daw-green font-bold">
            {part.replace(/\*\*/g, "")}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="space-y-10 p-2">
      {/* --- SECTION 1: IDENTITY (Spirit, Mission, Vision) --- */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="text-[10px] font-black text-daw-green uppercase tracking-widest mb-2">
            Company Spirit
          </p>
          <p className="font-serif italic text-lg text-slate-800 leading-relaxed">
            "{data.spiritText || "Belum diisi"}"
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Mission
            </p>
            <p className="font-serif text-sm text-slate-700 leading-relaxed">
              {renderHighlightedText(data.missionText)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Vision
            </p>
            <p className="font-serif text-sm text-slate-700 leading-relaxed">
              {renderHighlightedText(data.visionText)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-slate-400 text-center italic">
        * Preview identitas dan nilai perusahaan (Visi, Misi, Spirit).
      </p>
    </div>
  );
}
