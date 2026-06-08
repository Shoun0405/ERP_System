import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import uz from './locales/uz.json';
import { setFormatLocale } from '../lib/format';

export const LANGS = [
  { code: 'uz', label: "O'zbek",  flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'zh', label: '中文',     flag: '🇨🇳' },
];

i18n
  // uz boshlang'ich bundle bilan keladi (flash yo'q); ru/zh code-split + lazy
  .use(resourcesToBackend((lng) => import(`./locales/${lng}.json`)))
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { uz: { translation: uz } },
    partialBundledLanguages: true,
    fallbackLng: 'uz',
    supportedLngs: ['uz', 'ru', 'zh'],
    nonExplicitSupportedLngs: true,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'erp_lang',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

const TAG = { uz: 'uz-UZ', ru: 'ru-RU', zh: 'zh-CN' };
let zhFontLoaded = false;

const applyLocale = (lng) => {
  const base = (lng || 'uz').split('-')[0];
  setFormatLocale(TAG[base] || 'uz-UZ');
  if (typeof document !== 'undefined') document.documentElement.lang = base;
  // Noto Sans SC faqat zh tanlanganda yuklanadi (CJK font og'ir)
  if (base === 'zh' && !zhFontLoaded) {
    zhFontLoaded = true;
    import('@fontsource/noto-sans-sc/400.css').catch(() => {});
    import('@fontsource/noto-sans-sc/500.css').catch(() => {});
  }
};

applyLocale(i18n.language);
i18n.on('languageChanged', applyLocale);

export default i18n;
