"use client";

import ReactMarkdown from "react-markdown";

interface AssistantBubbleProps {
  text: string;
  error?: string;
  onMapView?: () => void;
  mapLoading?: boolean;
}

export default function AssistantBubble({ text, error, onMapView, mapLoading }: AssistantBubbleProps) {
  if (error) {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
          <span className="text-white text-xs font-bold">!</span>
        </div>
        <div className="max-w-[85%] bg-red-50 border border-red-200 text-red-700 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[#A0D468] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
          <path d="M12 3C7.03 3 3 6.13 3 10c0 2.39 1.4 4.52 3.58 5.84L5.5 19.5l4.09-1.81C10.36 17.89 11.16 18 12 18c4.97 0 9-3.13 9-7s-4.03-7-9-7z" fill="currentColor"/>
        </svg>
      </div>
      <div className="max-w-[85%]">
        <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 text-sm text-gray-900 leading-relaxed shadow-sm prose prose-sm prose-gray
          prose-headings:text-gray-900 prose-headings:mt-4 prose-headings:mb-2 prose-headings:first:mt-0
          prose-h3:text-base prose-h3:font-bold
          prose-p:my-1.5
          prose-strong:text-gray-900 prose-strong:font-semibold
          prose-em:text-gray-600
          prose-ul:my-1.5 prose-ul:pl-4 prose-li:my-0.5
          prose-hr:my-3 prose-hr:border-gray-200
          prose-a:text-[#3B6FB6] prose-a:no-underline hover:prose-a:underline
          max-w-none"
        >
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
        {onMapView && (
          <button
            onClick={onMapView}
            disabled={mapLoading}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-[#3B6FB6] text-xs font-medium rounded-full shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mapLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-[#3B6FB6] border-t-transparent rounded-full animate-spin" />
                <span>장소 찾는 중...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                <span>지도에서 보기</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
