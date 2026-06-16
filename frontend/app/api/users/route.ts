import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await pool.query("SELECT * FROM users ORDER BY id ASC");
  return NextResponse.json(result.rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email } = body;

  if (!name || !email) {
    return NextResponse.json(
      { error: "name と email は必須です" },
      { status: 400 }
    );
  }

  const result = await pool.query(
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    [name, email]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}