import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en.json";
import id from "../locales/id.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: "en", // Bahasa default
  fallbackLng: "en", // Kalau ada teks ID yang kosong, otomatis pakai EN
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
