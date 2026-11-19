import { en, Translations } from './en';
import { id } from './id';

export type Language = 'en' | 'id';

let currentLang: Language = (localStorage.getItem('anti_detect_lang') as Language) || 'en';

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language) {
  currentLang = lang;
  localStorage.setItem('anti_detect_lang', lang);
  window.dispatchEvent(new Event('anti_detect_lang_change'));
}

export function getTranslations(): Translations {
  return currentLang === 'id' ? id : en;
}

export const t = getTranslations();
export { en, id };

