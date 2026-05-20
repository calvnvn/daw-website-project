import AboutInfoPreview from "./previews/AboutInfoPreview";
import HeroPreview from "./previews/HeroPreview";
import HistoryPreview from "./previews/HistoryPreview";
import ImpactStatPreview from "./previews/ImpactStatPreview";
import ManagementPreview from "./previews/ManagementPreview";
import TransformationIntroPreview from "./previews/TransformationIntroPreview";
import InvestmentSettingPreview from "./previews/InvestmentSettingPreview";
import AffiliatePreview from "./previews/AffiliatePreview";
import ProjectPreview from "./previews/ProjectPreview";
import BusinessSectionPreview from "./previews/BusinessSectionPreview";
import MapMarkerPreview from "./previews/MapMarkerPreview";
import PagePreview from "./previews/PagePreview";
import AchievementPreview from "./previews/AchievementPreview";
import PhilosophyPreview from "./previews/PhilosophyPreview";
import PhilosophyPillarPreview from "./previews/PhilosophyPillarPreview";
import MenuPreview from "./previews/MenuPreview";
import MapCategoryPreview from "./previews/MapCategoryPreview";
import SettingsPreview from "./previews/SettingsPreview";

const PREVIEW_REGISTRY: Record<string, any> = {
  History: HistoryPreview,
  Management: ManagementPreview,
  AboutInfo: AboutInfoPreview,
  HeroSlides: HeroPreview,
  ImpactStats: ImpactStatPreview,
  HomeSettings: TransformationIntroPreview,
  InvestmentSettings: InvestmentSettingPreview,
  Affiliate: AffiliatePreview,
  Project: ProjectPreview,
  BusinessSection: BusinessSectionPreview,
  BusinessMapMarker: MapMarkerPreview,
  Page: PagePreview,
  Achievement: AchievementPreview,
  Philosophy: PhilosophyPreview,
  PhilosophyPillar: PhilosophyPillarPreview,
  Menu: MenuPreview,
  MapCategory: MapCategoryPreview,
  Settings: SettingsPreview,
};

export default PREVIEW_REGISTRY;
