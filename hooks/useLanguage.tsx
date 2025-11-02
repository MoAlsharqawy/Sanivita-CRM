import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { translations } from '../services/translations';

type Language = 'ar' | 'en';
type Direction = 'rtl' | 'ltr';
export type TranslationFunction = (key: string, ...args: (string | number)[]) => string;


interface LanguageContextType {
  lang: Language;
  dir: Direction;
  toggleLang: () => void;
  t: TranslationFunction;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>('ar');

  useEffect(() => {
    // This effect synchronizes the document's attributes with the current language state
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const toggleLang = () => {
    setLang(prevLang => prevLang === 'ar' ? 'en' : 'ar');
  };
  
  const t: TranslationFunction = useCallback((key: string, ...args: (string | number)[]) => {
      let translation = translations[lang][key] || key;
      if (args.length > 0) {
        args.forEach((arg, index) => {
            const placeholder = new RegExp(`\\{${index}\\}`, 'g');
            translation = translation.replace(placeholder, String(arg));
        });
      }
      return translation;
  }, [lang]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, dir, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};