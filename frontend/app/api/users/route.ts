import { pool } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await pool.query(
    "SELECT id, name, email, created_at FROM users ORDER BY id ASC"
  );
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "name, email, password は必須です" },
      { status: 400 }
    );
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "password は8文字以上で指定してください" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const result = await pool.query(
    "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
    [name, email, passwordHash]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}