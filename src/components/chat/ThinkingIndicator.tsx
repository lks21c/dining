"use client";

export default function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#A0D468] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
          <path d="M12 3C7.03 3 3 6.13 3 10c0 2.39 1.4 4.52 3.58 5.84L5.5 19.5l4.09-1.81C10.36 17.89 11.16 18 12 18c4.97 0 9-3.13 9-7s-4.03-7-9-7z" fill="currentColor"/>
        </svg>
      </div>
      <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1 shadow-sm">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}
