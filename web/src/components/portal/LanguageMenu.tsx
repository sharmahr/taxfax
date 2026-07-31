import { Globe } from 'lucide-react';
import { isLocaleId, LOCALE_IDS, LOCALES } from '@taxfax/shared';
import { usePortalLocale } from './locale';

/**
 * The language switcher. For almost everyone it is a confirmation, not a control
 * — we already resolved their language from last year's return — so it stays a
 * small pill in the header rather than a splash-screen choice.
 *
 * It is a real, styled `<select>`: the native control is the lightest thing that
 * exists (no menu library on this bundle-sensitive route), it is keyboard- and
 * screen-reader-accessible for free, and on a phone it opens the OS language
 * picker a 58-year-old already knows. The visible pill is decorative; the
 * `<select>` carries the accessible name and the state.
 */
export function LanguageMenu() {
  const { locale, t, setLocale } = usePortalLocale();

  return (
    <label className="group relative inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1 text-2xs font-medium text-ink-muted transition-colors hover:text-ink focus-within:ring-2 focus-within:ring-stamp/40">
      <Globe className="size-3.5 shrink-0 text-ink-faint transition-colors group-hover:text-ink-muted" aria-hidden />
      <span aria-hidden className="max-w-[7.5rem] truncate">
        {LOCALES[locale].endonym}
      </span>
      <select
        aria-label={t('portal.language')}
        title={t('portal.languageHint')}
        value={locale}
        onChange={(e) => {
          if (isLocaleId(e.target.value)) setLocale(e.target.value);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LOCALE_IDS.map((id) => (
          <option key={id} value={id} lang={LOCALES[id].bcp47}>
            {LOCALES[id].endonym}
          </option>
        ))}
      </select>
    </label>
  );
}
