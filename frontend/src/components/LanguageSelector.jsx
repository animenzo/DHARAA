// frontend/src/components/LanguageSelector.jsx

const LANGUAGES = [
  { code: "en", label: "EN", full: "English", flag: "🇬🇧" },
  { code: "hi", label: "हि", full: "हिंदी",  flag: "🇮🇳" },
];

/**
 * @param {string}   language        — current language code "en" | "hi"
 * @param {Function} onLanguageChange — called with new code on toggle
 */
const LanguageSelector = ({ language, onLanguageChange }) => {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1 gap-1">
      {LANGUAGES.map((lang) => {
        const isActive = language === lang.code;
        return (
          <button
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            title={lang.full}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold
              transition-all duration-200
              ${isActive
                ? "bg-white text-emerald-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSelector;