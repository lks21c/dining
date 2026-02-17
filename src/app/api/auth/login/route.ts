import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const CREDENTIALS: Record<string, string> = {
  hydra01: "@dlrhkdtlr1",
};

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { id?: string; password?: string };
  const { id, password } = body;

  if (!id || !password || CREDENTIALS[id] !== password) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = `${id}:${sign(id)}`;
  const res = NextResponse.json({ ok: true });

  res.cookies.set("auth-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
