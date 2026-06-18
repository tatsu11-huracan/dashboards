import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

type UserRow = {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
};

export async function POST(req: Request) {
  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "email と password は必須です" },
      { status: 400 }
    );
  }

  const result = await pool.query<UserRow>(
    "SELECT id, name, email, password_hash FROM users WHERE email = $1 LIMIT 1",
    [email]
  );

  const user = result.rows[0];

  if (!user?.password_hash) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const passwordOk = await verifyPassword(password, user.password_hash);

  if (!passwordOk) {
    return NextResponse.json(
      { error: "メールアドレスまたはパスワードが正しくありません" },
      { status: 401 }
    );
  }

  const token = await createSessionToken({
    id: user.id,
    name: user.name,
    email: user.email,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
