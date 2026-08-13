"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-brand-peach-50 text-brand-brown-900 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-elegant border border-brand-peach-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Welcome Back</h1>
          <p className="text-brand-brown-500 mt-2">Log in to LogicBitsAI</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-brand-peach-50/50 border border-brand-peach-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-peach-500 outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-brand-peach-50/50 border border-brand-peach-200 rounded-xl p-3 focus:ring-2 focus:ring-brand-peach-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3 bg-brand-brown-900 text-brand-peach-50 rounded-xl font-semibold hover:bg-brand-brown-700 transition-all disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-brand-brown-500">
          Don't have an account? <Link href="/register" className="text-brand-peach-500 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
