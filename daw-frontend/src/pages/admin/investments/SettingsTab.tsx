/**
 * SettingsTab — Tab 1 of InvestmentsManager
 * Handles the page content text editing (teaser headline, body, section intro).
 */
import { Lock, ShieldAlert } from "lucide-react";

interface SettingsTabProps {
  pageContent: {
    teaserHeadline: string;
    teaserBody: string;
    sectionIntro: string;
  };
  setPageContent: React.Dispatch<React.SetStateAction<{
    teaserHeadline: string;
    teaserBody: string;
    sectionIntro: string;
  }>>;
  isEditing: boolean;
  isSuperadmin: boolean;
  currentLockState: boolean;
  lockStyles: string;
  settingsIsLocked?: boolean;
}

export default function SettingsTab({
  pageContent,
  setPageContent,
  isEditing,
  isSuperadmin,
  currentLockState,
  lockStyles,
  settingsIsLocked,
}: SettingsTabProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div
        className={`bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-500 ${lockStyles}`}>
        {settingsIsLocked && !isSuperadmin && (
          <div className="absolute top-0 right-0 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm z-10">
            <Lock className="w-3 h-3" /> Locked
          </div>
        )}
        {settingsIsLocked && isSuperadmin && isEditing && (
          <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1.5 rounded-bl-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm z-10">
            <ShieldAlert className="w-3 h-3" /> Override Active
          </div>
        )}

        <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
          Home Page Teaser Content
        </h3>
        <div className="space-y-4 relative z-0">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Teaser Headline
            </label>
            <input
              type="text"
              value={pageContent.teaserHeadline}
              onChange={(e) =>
                setPageContent({
                  ...pageContent,
                  teaserHeadline: e.target.value,
                })
              }
              disabled={!isEditing || currentLockState}
              className={`w-full px-3 py-2 rounded-lg font-serif text-lg transition-all duration-300 ${
                isEditing && !currentLockState
                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Teaser Body Text
            </label>
            <textarea
              rows={3}
              value={pageContent.teaserBody}
              onChange={(e) =>
                setPageContent({
                  ...pageContent,
                  teaserBody: e.target.value,
                })
              }
              disabled={!isEditing || currentLockState}
              className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
                isEditing && !currentLockState
                  ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                  : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
              }`}
            />
          </div>
        </div>
      </div>

      <div
        className={`bg-slate-50 p-6 rounded-xl border border-slate-200 relative overflow-hidden transition-all duration-500 ${lockStyles}`}>
        <h3 className="text-base font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2">
          Main Investments Page
        </h3>
        <div className="relative z-0">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Ecosystem Intro Text
          </label>
          <textarea
            rows={2}
            value={pageContent.sectionIntro}
            onChange={(e) =>
              setPageContent({
                ...pageContent,
                sectionIntro: e.target.value,
              })
            }
            disabled={!isEditing || currentLockState}
            className={`w-full px-3 py-2 rounded-lg resize-none transition-all duration-300 ${
              isEditing && !currentLockState
                ? "bg-white border border-slate-300 text-slate-900 focus:ring-2 focus:ring-daw-green/20 shadow-inner"
                : "bg-slate-100/50 border-transparent text-slate-500 cursor-not-allowed"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
