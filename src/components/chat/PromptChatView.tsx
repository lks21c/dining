"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ChatInputBar from "./ChatInputBar";
import UserBubble from "./UserBubble";
import AssistantBubble from "./AssistantBubble";
import ThinkingIndicator from "./ThinkingIndicator";
import EmptyState from "./EmptyState";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  error?: string;
  userQuery?: string;
}

let nextId = 0;
const CHAT_STORAGE_KEY = "chatMessages";

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (stored) {
      const msgs: ChatMessage[] = JSON.parse(stored);
      if (msgs.length > 0) {
        nextId = Math.max(...msgs.map((m) => m.id)) + 1;
      }
      return msgs;
    }
  } catch {}
  return [];
}

export default function PromptChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [sending, setSending] = useState(false);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Persist messages to sessionStorage (survives page reload + HMR)
  useEffect(() => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  useEffect(() => {
    if (resolveError) {
      const t = setTimeout(() => setResolveError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [resolveError]);

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: nextId++, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    const apiMessages = [...messagesRef.current, userMsg]
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const errText = await res.text();
        setMessages((p) => [...p, {
          id: nextId++, role: "assistant", text: "", error: errText || "응답 생성에 실패했습니다",
        }]);
        return;
      }

      const data = await res.json();
      setMessages((p) => [...p, {
        id: nextId++, role: "assistant", text: data.text, userQuery: text,
      }]);
    } catch {
      setMessages((p) => [...p, {
        id: nextId++, role: "assistant", text: "", error: "네트워크 오류가 발생했습니다",
      }]);
    } finally {
      setSending(false);
    }
  }, []);

  const handleSelectQuery = useCallback((query: string) => {
    handleSend(query);
  }, [handleSend]);

  const handleMapView = useCallback(async (msgId: number) => {
    const msg = messagesRef.current.find((m) => m.id === msgId);
    if (!msg || msg.role !== "assistant" || !msg.text) return;

    // Clear any stale data
    localStorage.removeItem("chatMapResult");
    localStorage.removeItem("chatMapError");

    // Open target URL directly & synchronously (before any await) to avoid popup blocker
    const targetUrl = `${window.location.origin}${window.location.pathname}#!/search?chatId=chat`;
    window.open(targetUrl, "_blank");

    setResolvingId(msgId);
    setResolveError(null);

    try {
      const res = await fetch("/api/chat/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userQuery: msg.userQuery || "",
          aiResponse: msg.text,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errMsg = data?.error || "장소 해석에 실패했습니다";
        setResolveError(errMsg);
        localStorage.setItem("chatMapError", errMsg);
        return;
      }

      const result = await res.json();
      localStorage.setItem("chatMapResult", JSON.stringify(result));
    } catch {
      setResolveError("네트워크 오류가 발생했습니다");
      localStorage.setItem("chatMapError", "네트워크 오류가 발생했습니다");
    } finally {
      setResolvingId(null);
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#B2C7D9]">
      {/* Header */}
      <div className="flex items-center px-4 pb-3 border-b border-[#A3B8CA] bg-[#B2C7D9]"
        style={{ paddingTop: "calc(var(--sai-top, 0px) + 0.75rem)" }}
      >
        <div className="flex items-center gap-2 h-11 ml-10">
          <div className="w-7 h-7 rounded-full bg-[#A0D468] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 3C7.03 3 3 6.13 3 10c0 2.39 1.4 4.52 3.58 5.84L5.5 19.5l4.09-1.81C10.36 17.89 11.16 18 12 18c4.97 0 9-3.13 9-7s-4.03-7-9-7z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-base font-semibold text-[#3C1E1E]">맛집 추천 채팅</h1>
        </div>
      </div>

      {/* Resolve error toast */}
      {resolveError && (
        <div className="absolute top-24 left-4 right-4 z-50">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg shadow-lg">
            {resolveError}
          </div>
        </div>
      )}

      {/* Messages area */}
      {messages.length === 0 && !sending ? (
        <EmptyState onSelectQuery={handleSelectQuery} />
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            msg.role === "user" ? (
              <UserBubble key={msg.id} text={msg.text} />
            ) : (
              <AssistantBubble
                key={msg.id}
                text={msg.text}
                error={msg.error}
                onMapView={!msg.error && msg.text ? () => handleMapView(msg.id) : undefined}
                mapLoading={resolvingId === msg.id}
              />
            )
          ))}
          {sending && <ThinkingIndicator />}
        </div>
      )}

      {/* Input bar */}
      <ChatInputBar onSend={handleSend} disabled={sending} />
    </div>
  );
}
