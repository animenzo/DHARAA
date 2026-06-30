// frontend/src/components/ImageUploader.jsx

import { useState, useRef } from "react";
import { FaCamera, FaTimes } from "react-icons/fa";

/**
 * @param {Function} onImageSelect   — called with (File, previewUrl) when image chosen
 * @param {Function} onClear         — called when user removes the image
 * @param {string}   previewUrl      — controlled: if set, shows this preview
 * @param {boolean}  disabled        — disable while uploading
 * @param {string}   language        — for UI labels
 */
const ImageUploader = ({
  onImageSelect,
  onClear,
  previewUrl,
  disabled = false,
  language = "en",
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const labels = {
    en: { hint: "Upload plant photo", drag: "Drop image here" },
    hi: { hint: "पौधे की फोटो अपलोड करें", drag: "यहाँ छवि छोड़ें" },
  };
  const t = labels[language] || labels.en;

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onImageSelect(file, url);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  // If a preview exists — show it with a remove button
  if (previewUrl) {
    return (
      <div className="relative inline-block">
        <img
          src={previewUrl}
          alt="plant preview"
          className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-300 shadow-sm"
        />
        <button
          onClick={onClear}
          disabled={disabled}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full
            flex items-center justify-center hover:bg-red-600 transition-colors shadow"
        >
          <FaTimes size={9} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        title={t.hint}
        className={`p-2.5 rounded-xl transition-all duration-200
          ${isDragging
            ? "bg-emerald-100 text-emerald-600 ring-2 ring-emerald-400"
            : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        <FaCamera size={18} />
      </button>
    </>
  );
};

export default ImageUploader;