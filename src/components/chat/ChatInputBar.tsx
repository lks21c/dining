"use client";

import { useState, useRef, useCallback } from "react";

interface ChatInputBarProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInputBar({ onSend, disabled }: ChatInputBarProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="bg-white px-4 py-3">
      <div className="flex items-end gap-2 max-w-2xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="지역과 원하는 음식을 알려주세요..."
            rows={1}
            disabled={disabled}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-12
              text-sm text-gray-900 placeholder-gray-400 outline-none
              focus:border-[#FEE500] focus:ring-2 focus:ring-[#FEE500]/30
              disabled:opacity-50 transition-colors"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FEE500] text-gray-900
            flex items-center justify-center
            hover:bg-[#FDD835] active:bg-[#FBC02D]
            disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
            transition-colors"
          aria-label="전송"
        >
          {disabled ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
