import { en, Translations } from './en';
import { id } from './id';

export type Language = 'en' | 'id';

let currentLang: Language = (localStorage.getItem('octo_lang') as Language) || 'en';

export function getLanguage(): Language {
  return currentLang;
}

export function setLanguage(lang: Language) {
  currentLang = lang;
  localStorage.setItem('octo_lang', lang);
  window.dispatchEvent(new Event('octo_lang_change'));
}

export function getTranslations(): Translations {
  return currentLang === 'id' ? id : en;
}

export const t = getTranslations();
export { en, id };
