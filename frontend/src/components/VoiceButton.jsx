// frontend/src/components/VoiceButton.jsx

import { useState, useRef, useEffect } from "react";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

/**
 * @param {Function} onTranscript   — called with the recognised text string
 * @param {string}   language       — "en" | "hi"  (controls recognition language)
 * @param {boolean}  disabled       — disable while AI is responding
 */
const VoiceButton = ({ onTranscript, language = "en", disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);

  const langMap = { en: "en-IN", hi: "hi-IN" };

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, []); // only runs once on mount

  // Update recognition language when prop changes
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = langMap[language] || "en-IN";
    }
  }, [language]);

  const toggle = () => {
    if (!isSupported || disabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  if (!isSupported) {
    return (
      <button
        disabled
        title="Voice input not supported in this browser"
        className="p-2.5 rounded-xl bg-gray-100 text-gray-300 cursor-not-allowed"
      >
        <FaMicrophoneSlash size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      title={isListening ? "Stop recording" : "Voice input"}
      className={`p-2.5 rounded-xl transition-all duration-200
        ${isListening
          ? "bg-red-100 text-red-500 ring-2 ring-red-300 animate-pulse"
          : "bg-gray-100 text-gray-500 hover:bg-emerald-50 hover:text-emerald-600"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {isListening ? <FaMicrophoneSlash size={18} /> : <FaMicrophone size={18} />}
    </button>
  );
};

export default VoiceButton;