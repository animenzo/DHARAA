// frontend/src/components/ChatWindow.jsx

import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import MessageBubble, { TypingIndicator } from "./MessageBubble";

/**
 * @param {Array}   messages   — array of message objects from createMessage()
 * @param {boolean} isTyping   — show the AI typing indicator
 * @param {string}  language   — "en" | "hi" for empty state label
 */
const ChatWindow = ({ messages, isTyping, language = "en" }) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages change or typing starts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const emptyLabel =
    language === "hi"
      ? "नमस्ते! मैं आपका AI कृषि सहायक हूँ। फसल, रोग, या सिंचाई के बारे में पूछें।"
      : "Hello! I'm your AI Crop Advisor. Ask me about crops, diseases, or irrigation.";

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth">
      {/* Empty state */}
      {messages.length === 0 && !isTyping && (
        <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-12">
          <div className="text-6xl">🌾</div>
          <div className="max-w-xs">
            <p className="text-gray-500 text-sm leading-relaxed">{emptyLabel}</p>
          </div>
          {/* Quick start chips */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {(language === "hi"
              ? ["फसल सुझाएं", "रोग पहचानें", "सिंचाई सलाह"]
              : ["Recommend a crop", "Detect plant disease", "Irrigation advice"]
            ).map((chip) => (
              <span
                key={chip}
                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs
                  rounded-full border border-emerald-200 font-medium"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Message list */}
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </AnimatePresence>

      {/* AI typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Invisible scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatWindow;