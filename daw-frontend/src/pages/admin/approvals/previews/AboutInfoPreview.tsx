import {
  Heart,
  Briefcase,
  Users,
  Zap,
  Lightbulb,
  CheckCircle,
} from "lucide-react";

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

  // Helper 2: Icon Mapping (Sama dengan Frontend)
  const getIconForPillar = (id: string) => {
    switch (id?.toLowerCase()) {
      case "human":
        return <Heart className="w-5 h-5" />;
      case "ethics":
        return <Briefcase className="w-5 h-5" />;
      case "unity":
        return <Users className="w-5 h-5" />;
      case "speed":
        return <Zap className="w-5 h-5" />;
      case "smart":
        return <Lightbulb className="w-5 h-5" />;
      default:
        return <CheckCircle className="w-5 h-5" />;
    }
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

      {/* --- SECTION 2: PHILOSOPHY PILLARS --- */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200"></div>
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {data.philosophyTitle || "Philosophy"}
          </h4>
          <div className="h-px flex-1 bg-slate-200"></div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {(data.philosophyPillars || []).map((pillar: any, idx: number) => (
            <div
              key={idx}
              className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex gap-4">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-daw-green/10 text-daw-green">
                {getIconForPillar(pillar.id)}
              </div>
              <div className="space-y-2">
                <h5 className="font-bold text-sm text-slate-900">
                  {pillar.title}
                </h5>
                <ul className="space-y-1">
                  {(pillar.text || "")
                    .split("\n")
                    .map((point: string, pIdx: number) => (
                      <li
                        key={pIdx}
                        className="flex items-start gap-2 text-[11px] text-slate-600">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-daw-green/40 shrink-0"></span>
                        <span>{point.trim()}</span>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[9px] text-slate-400 text-center italic">
        * Tampilan disederhanakan untuk kebutuhan komparasi data.
      </p>
    </div>
  );
}
