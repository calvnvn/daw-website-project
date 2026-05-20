import { Heart, Briefcase, Users, Zap, Lightbulb, Target } from "lucide-react";

export default function PhilosophyPillarPreview({ data }: { data: any }) {
  if (!data) return null;

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
        return <Target className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-2">
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex gap-4">
        <div className="w-12 h-12 shrink-0 flex items-center justify-center rounded-xl bg-daw-green/10 text-daw-green">
          {getIconForPillar(data.iconId)}
        </div>
        <div className="space-y-3">
          <h5 className="font-bold text-base text-slate-900">
            {data.title || "Tanpa Judul"}
          </h5>
          <ul className="space-y-1.5">
            {(data.text || "")
              .split("\n")
              .map((point: string, pIdx: number) => (
                <li
                  key={pIdx}
                  className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-daw-green/40 shrink-0"></span>
                  <span>{point.trim()}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>
      <p className="text-[9px] text-slate-400 text-center italic mt-4">
        * Preview nilai inti perusahaan
      </p>
    </div>
  );
}
