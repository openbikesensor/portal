import { useState, useEffect, useMemo } from "react";
import i18next, { TOptions } from "i18next";
import { BehaviorSubject, combineLatest } from "rxjs";
import { map, distinctUntilChanged } from "rxjs/operators";
import HttpBackend, {
  BackendOptions,
  RequestCallback,
} from "i18next-http-backend";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

export type AvailableLocales = "en" | "de" | "fr";

async function request(
  _options: BackendOptions,
  url: string,
  _payload: any,
  callback: RequestCallback
) {
  try {
    const [lng] = url.split("/");
    const locale = await import(`translations/${lng}.yaml`);
    callback(null, { status: 200, data: locale });
  } catch (e) {
    console.error(`Unable to load locale at ${url}\n`, e);
    callback(null, { status: 404, data: String(e) });
  }
}

export const AVAILABLE_LOCALES: AvailableLocales[] = ["en", "de", "fr"];

const i18n = i18next.createInstance();

const options: TOptions = {
  fallbackLng: "en",

  ns: ["common"],
  defaultNS: "common",
  whitelist: AVAILABLE_LOCALES,

  // loading via webpack
  backend: {
    loadPath: "{{lng}}/{{ns}}",
    parse: (data: any) => data,
    request,
  },

  load: "languageOnly",

  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
  },
};

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({ ...options });

const locale$ = new BehaviorSubject<AvailableLocales>("en");

export const translate = i18n.t.bind(i18n);

export const translate$ = (stringAndData$: [string, any]) =>
  combineLatest([stringAndData$, locale$.pipe(distinctUntilChanged())]).pipe(
    map(([stringAndData]) => {
      if (typeof stringAndData === "string") {
        return i18n.t(stringAndData);
      } else {
        const [string, data] = stringAndData;
        return i18n.t(string, { data });
      }
    })
  );

export const setLocale = (locale: AvailableLocales) => {
  i18n.changeLanguage(locale);
  locale$.next(locale);
};

export function useLocale() {
  const [, reload] = useState();

  useEffect(() => {
    i18n.on("languageChanged", reload);
    return () => {
      i18n.off("languageChanged", reload);
    };
  }, []);

  return i18n.language;
}

export default i18n;
