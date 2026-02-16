import { NextRequest, NextResponse } from "next/server";
import { openrouter, MODEL } from "@/lib/openrouter";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  try {
    const completion = await openrouter.chat.completions.create({
      model: MODEL,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const text = completion.choices[0]?.message?.content || "";
    return NextResponse.json({ text });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
