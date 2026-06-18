"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rawNextPath = searchParams.get("next") || "/dashboard/customs";
  const nextPath = rawNextPath.startsWith("/")
    ? rawNextPath
    : "/dashboard/customs";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setErrorMessage(body.error || "ログインに失敗しました");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setErrorMessage("ネットワークエラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">ESP3.0 ログイン</h1>
        <p className="mt-2 text-sm text-slate-600">
          メールアドレスとパスワードを入力してください。
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              メールアドレス
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              パスワード
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="8文字以上"
              autoComplete="current-password"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white font-medium hover:bg-slate-700 disabled:opacity-60"
          >
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </button>
        </form>
      </section>
    </main>
  );
}
