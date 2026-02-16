"use client";

interface UserBubbleProps {
  text: string;
}

export default function UserBubble({ text }: UserBubbleProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-[#FEE500] text-gray-900 rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}
