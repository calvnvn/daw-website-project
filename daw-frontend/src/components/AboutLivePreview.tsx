import { useTranslation } from "react-i18next";
import { Calendar, Target, Trophy } from "lucide-react";
import * as Icons from "lucide-react";
import { getCleanImageUrl } from "@/lib/utils";

// --- Helpers ---
const ICON_MAP: Record<string, any> = {
  human: Icons.Heart,
  ethics: Icons.Briefcase,
  unity: Icons.Globe,
  speed: Icons.Zap,
  smart: Icons.Lightbulb,
  shield: Icons.Shield,
  star: Icons.Star,
  leaf: Icons.Leaf,
};

const getInitials = (name: string) => {
  if (!name) return "DW";
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

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

interface AboutLivePreviewProps {
  type: "info" | "history" | "philosophy" | "management" | "achievement";
  data: any;
  extraData?: any; // For philosophy, we need title AND pillars.
}

export default function AboutLivePreview({
  type,
  data,
  extraData,
}: AboutLivePreviewProps) {
  const { t } = useTranslation();

  if (type === "info") {
    // data is { spiritText, missionText, visionText }
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-12 animate-in fade-in duration-300">
        <div className="space-y-16">
          <div>
            <h3 className="text-[10px] font-sans font-bold text-daw-green uppercase tracking-[0.2em] mb-4">
              {t("about.company.spiritTitle", "Founders' Spirit")}
            </h3>
            <p className="font-serif italic text-2xl md:text-3xl text-slate-800 leading-[1.4]">
              {data?.spiritText || "Spirit text will appear here."}
            </p>
          </div>
          <div className="w-full h-[1px] bg-slate-200"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-3">
                {t("about.company.missionTitle", "Mission")}
              </h3>
              <p className="font-serif text-xl text-slate-900 leading-relaxed whitespace-pre-line">
                {data?.missionText
                  ? renderHighlightedText(data.missionText)
                  : "Mission text here."}
              </p>
            </div>
            <div>
              <h3 className="text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest mb-3">
                {t("about.company.visionTitle", "Vision")}
              </h3>
              <p className="font-serif text-xl text-slate-900 leading-relaxed whitespace-pre-line">
                {data?.visionText
                  ? renderHighlightedText(data.visionText)
                  : "Vision text here."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "history") {
    // data is array of { id, year, text }
    const companyHistory = data || [];
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-12 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-10">
          <h2 className="font-serif text-3xl md:text-4xl text-slate-900">
            {t("about.history.title", "History")}
          </h2>
        </div>
        <div className="relative pl-4 md:pl-8 space-y-10">
          {companyHistory.length > 0 && (
            <div className="absolute left-[19px] md:left-[35px] top-6 bottom-0 w-[2px] bg-gradient-to-b from-daw-green via-daw-green/40 to-transparent rounded-full"></div>
          )}
          {companyHistory.length > 0 ? (
            <div className="space-y-10">
              {companyHistory.map((item: any, i: number) => (
                <div
                  key={item.id || i}
                  className="relative pl-14 md:pl-20 group">
                  <div className="absolute left-0 md:left-4 top-2 md:top-4 w-10 h-10 rounded-full bg-white border-[3px] border-slate-100 flex items-center justify-center z-10 shadow-sm">
                    <div className="w-3 h-3 rounded-full bg-daw-green"></div>
                  </div>
                  <div className="relative bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="absolute -right-6 -bottom-10 text-[80px] md:text-[100px] font-serif font-bold text-slate-50 opacity-60 select-none pointer-events-none">
                      {item.year}
                    </div>
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-daw-green/5 text-daw-green font-bold text-[10px] tracking-widest mb-4 border border-daw-green/10">
                        <Calendar className="w-3 h-3" />
                        <span>{item.year || "YYYY"}</span>
                      </div>
                      <p className="font-sans text-slate-600 leading-relaxed text-[13px] md:text-[15px] whitespace-pre-line">
                        {item.text || "Timeline description goes here."}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pl-12 text-slate-500 italic bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200 text-center">
              No timeline data available yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "philosophy") {
    // data is string (title)
    // extraData is array of pillars { id, title, text, iconId, orderIndex }
    const title = data || "Our Philosophy";
    const pillars = extraData || [];

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-12 animate-in fade-in duration-300">
        <h2 className="font-serif text-3xl md:text-4xl text-slate-900 mb-8">
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pillars.map((pillar: any, i: number) => {
            const Icon =
              ICON_MAP[pillar.iconId?.toLowerCase()] || Icons.CheckCircle;
            return (
              <div
                key={pillar.id || i}
                className="p-6 border border-slate-100 bg-slate-50/50 rounded-2xl flex flex-col">
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-daw-green/10 text-daw-green mb-4 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-serif text-lg font-bold text-slate-900 mb-3">
                  {pillar.title || "Pillar Title"}
                </h3>
                <ul className="space-y-2 mt-auto">
                  {(pillar.text || "")
                    .split("\n")
                    .map((point: string, idx: number) => {
                      if (point.trim() === "") return null;
                      return (
                        <li key={idx} className="flex items-start gap-2 group">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-daw-green shrink-0"></span>
                          <span className="font-sans text-slate-600 leading-relaxed text-[13px]">
                            {point.trim()}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              </div>
            );
          })}
          {pillars.length === 0 && (
            <div className="col-span-full text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No philosophy pillars defined yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (type === "management") {
    // data is array of { id, name, role, level, description, photoUrl, previewUrl }
    const team = data || [];
    const chairman = team.find((p: any) => p.level === "chairman");
    const executiveDirectors = team
      .filter((p: any) => p.level === "director")
      .sort((a: any, b: any) => a.order - b.order);
    const divisionHeads = team
      .filter((p: any) => p.level === "division")
      .sort((a: any, b: any) => a.order - b.order);

    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-12 animate-in fade-in duration-300">
        {chairman && (
          <div className="mb-10">
            <h2 className="font-serif text-3xl text-slate-900 mb-8">
              Board of Directors
            </h2>
            <div
              className={`grid grid-cols-1 ${chairman.photoUrl || chairman.previewUrl ? "md:grid-cols-12" : ""} gap-8 items-center`}>
              {(chairman.photoUrl || chairman.previewUrl) && (
                <div className="md:col-span-5 lg:col-span-4">
                  <div className="aspect-[3/4] overflow-hidden rounded-xl border border-slate-100 shadow-sm">
                    <img
                      src={
                        chairman.previewUrl ||
                        getCleanImageUrl(chairman.photoUrl)
                      }
                      className="w-full h-full object-cover"
                      alt="Chairman"
                    />
                  </div>
                </div>
              )}
              <div
                className={`${chairman.photoUrl || chairman.previewUrl ? "md:col-span-7 lg:col-span-8" : "col-span-1"}`}>
                <h3 className="font-serif font-bold text-2xl text-slate-900 mb-2">
                  {chairman.name || "Name"}
                </h3>
                <p className="font-sans text-[11px] font-bold text-daw-green uppercase tracking-[0.2em] mb-4">
                  {chairman.role || "Role"}
                </p>
                <div className="w-8 h-1 bg-daw-green mb-6 rounded-full"></div>
                <p className="font-sans text-slate-600 text-[13px] leading-relaxed whitespace-pre-line">
                  {chairman.description || "Description"}
                </p>
              </div>
            </div>
          </div>
        )}

        {executiveDirectors.length > 0 && (
          <div className="mb-10 border-t border-slate-100 pt-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {executiveDirectors.map((person: any, i: number) => (
                <div
                  key={person.id || i}
                  className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                  <div className="w-16 h-16 mb-6 rounded-full overflow-hidden border-[2px] border-slate-50 shadow-sm bg-daw-green/5 flex items-center justify-center">
                    {person.photoUrl || person.previewUrl ? (
                      <img
                        src={
                          person.previewUrl || getCleanImageUrl(person.photoUrl)
                        }
                        className="w-full h-full object-cover"
                        alt="Director"
                      />
                    ) : (
                      <span className="font-serif font-bold text-lg text-daw-green/70 tracking-wider">
                        {getInitials(person.name)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-xl text-slate-900 mb-1">
                    {person.name || "Name"}
                  </h3>
                  <p className="font-sans text-[10px] font-bold text-daw-green uppercase tracking-[0.2em] mb-4">
                    {person.role || "Role"}
                  </p>
                  <p className="font-sans text-slate-600 text-[13px] leading-relaxed whitespace-pre-line">
                    {person.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {divisionHeads.length > 0 && (
          <div className="pt-10 border-t border-slate-100">
            <h2 className="font-serif text-2xl text-slate-900 mb-6">
              Division Heads
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {divisionHeads.map((person: any, i: number) => (
                <div
                  key={person.id || i}
                  className="bg-slate-50/50 p-6 rounded-2xl border border-transparent">
                  <div className="w-12 h-12 mb-4 rounded-xl overflow-hidden shadow-sm bg-white border border-slate-100 flex items-center justify-center">
                    {person.photoUrl || person.previewUrl ? (
                      <img
                        src={
                          person.previewUrl || getCleanImageUrl(person.photoUrl)
                        }
                        className="w-full h-full object-cover"
                        alt="Head"
                      />
                    ) : (
                      <span className="font-serif font-bold text-sm text-slate-400">
                        {getInitials(person.name)}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-lg text-slate-900 mb-1">
                    {person.name || "Name"}
                  </h3>
                  <p className="font-sans text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                    {person.role || "Role"}
                  </p>
                  <p className="font-sans text-slate-600 text-[12px] leading-relaxed whitespace-pre-line line-clamp-4">
                    {person.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {team.length === 0 && (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-slate-400 text-sm">
              No management team members available.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (type === "achievement") {
    // data is array of { id, title, category, year, date, description, iconId, imageUrl, previewUrl }
    const achievements = data || [];
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 lg:p-12 animate-in fade-in duration-300">
        <div className="flex items-start justify-between mb-8">
          <h2 className="font-serif text-3xl md:text-4xl text-slate-900">
            {t("about.achievement.title", "Achievements")}
          </h2>
          <div className="flex flex-col items-end">
            <span className="font-serif font-bold leading-none text-slate-900 text-3xl">
              {String(achievements.length).padStart(2, "0")}
            </span>
            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 mt-1">
              Total
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {achievements.length > 0 ? (
            achievements.map((item: any, i: number) => {
              const Icon = ICON_MAP[item.iconId || "star"] || Target;
              return (
                <div
                  key={item.id || i}
                  className="relative bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-5 items-center overflow-hidden">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-daw-green z-20"></div>
                  <div className="absolute -right-2 -bottom-6 text-[80px] font-serif font-bold text-slate-50 opacity-60 pointer-events-none z-0">
                    {item.year || "YYYY"}
                  </div>
                  <div className="w-full md:w-[35%] shrink-0 z-10">
                    {(item.previewUrl || item.imageUrl) && (
                      <div className="aspect-[16/10] rounded-xl overflow-hidden border border-slate-100">
                        <img
                          src={
                            item.previewUrl || getCleanImageUrl(item.imageUrl)
                          }
                          className="w-full h-full object-cover"
                          alt="Achievement"
                        />
                      </div>
                    )}
                  </div>
                  <div className="w-full md:w-[65%] flex flex-col justify-center py-2 z-10">
                    <div className="flex flex-wrap items-center gap-3 mb-3">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-daw-green/5 text-daw-green font-bold text-[9px] tracking-widest uppercase border border-daw-green/10">
                        <Icon className="w-3 h-3" />
                        <span>{item.category || "CATEGORY"}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-sans font-bold tracking-widest uppercase">
                        <Calendar className="w-3 h-3" />
                        <span>{item.date || "Date"}</span>
                      </div>
                    </div>
                    <h3 className="font-serif text-lg md:text-xl text-slate-900 leading-[1.3] mb-2">
                      {item.title || "Achievement Title"}
                    </h3>
                    <p className="font-sans text-slate-600 leading-relaxed text-[12px] whitespace-pre-line">
                      {item.description || "Description goes here."}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Trophy className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">
                No achievements available.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
