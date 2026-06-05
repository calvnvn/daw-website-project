/**
 * Shared types, interfaces, and constants for the Investment Manager module.
 * Extracted to keep all modules using the same type definitions.
 */

export interface LocalAffiliate {
  id: number | string;
  name: string;
  desc: string;
  category_id: number | null;
  websiteUrl?: string | null;
  logoUrl: string | null;
  newLogoFile?: File | null;
  removePhoto?: boolean;
  isNew?: boolean;
  is_locked?: boolean;
  lock_ticket?: string | null;
  has_rejected?: boolean;
  previous_notrans?: string | null;
  isDirty?: boolean;
  terjemahanDesc?: string;
  originalTerjemahanDesc?: string;
}

export interface LocalCategory {
  id: number | string;
  name: string;
  description: string;
  icon: string;
  isNew?: boolean;
  isDirty?: boolean;
  isCollapsed?: boolean;
}

/**
 * Curated list of Lucide icon names available for category selection.
 * These map directly to component names in the `lucide-react` library.
 */
export const CATEGORY_ICONS = [
  "Briefcase", "Building2", "Coffee", "Globe2", "GraduationCap", "Cpu", "Leaf", "HeartPulse",
  "Landmark", "ShoppingBag", "Utensils", "Wrench", "Monitor", "Smartphone", "Truck", "Plane",
  "Ship", "ShoppingCart", "Zap", "Shield", "LineChart", "PieChart", "Database", "Server",
  "Cloud", "Lightbulb", "Camera", "Film", "Music", "BookOpen", "Microscope", "Atom", "Stethoscope",
  "Activity", "Factory", "Wheat", "Droplets", "Wind", "Sun", "Gem", "Coins", "Banknote", "Wallet",
];
