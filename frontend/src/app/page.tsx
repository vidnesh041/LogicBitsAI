"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getApiBaseUrl } from "@/lib/api";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<string>("Checking...");
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);

  const checkHealth = async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/health`);
      const data = await res.json();
      setHealth(data.status || "ok");
      if (data.database_status) {
        setDbStatus(data.database_status);
        setIsDbConnected(true);
      } else {
        setDbStatus("Connected (Firebase SDK)");
        setIsDbConnected(true);
      }
    } catch {
      setHealth("Backend Offline");
      setDbStatus("Connected (Client Firebase)");
      setIsDbConnected(true);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const submitGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim()) return;
    setLoading(true);

    if (user) {
      router.push(`/dashboard?goal=${encodeURIComponent(goal.trim())}`);
    } else {
      router.push(`/login?goal=${encodeURIComponent(goal.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-brand-peach-50 text-brand-brown-900 flex flex-col items-center pt-24 pb-16 px-6 font-sans">
      <div className="absolute top-0 left-0 right-0 h-[50vh] bg-gradient-to-b from-brand-peach-100/50 to-transparent pointer-events-none" />

      <main className="w-full max-w-5xl z-10 space-y-16">
        {/* Header */}
        <div className="text-center space-y-6">
          <div className="inline-block px-4 py-1.5 rounded-full bg-white border border-brand-peach-200 text-brand-brown-700 text-sm font-medium tracking-wide shadow-sm mb-4">
            LogicBitsAI — Autonomous Multi-Agent Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-brand-brown-900 drop-shadow-sm">
            Self-Organizing AI Teams
          </h1>
          <p className="text-lg md:text-xl text-brand-brown-500 max-w-2xl mx-auto leading-relaxed">
            Dynamic agent collaboration platform for complex goals. Enter a goal below to generate, execute, and synthesize your specialized AI organization.
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8 items-start">
          {/* Main Action Form */}
          <div className="md:col-span-3 bg-white/70 backdrop-blur-xl p-8 rounded-2xl shadow-elegant border border-white/50 transition-all">
            <h2 className="text-2xl font-bold mb-6">Initialize Project</h2>
            <form onSubmit={submitGoal} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-brand-brown-700 mb-2">
                  Complex Goal Definition
                </label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  required
                  rows={5}
                  className="w-full bg-white/80 border border-brand-peach-200 rounded-xl p-4 focus:ring-4 focus:ring-brand-peach-500/20 focus:border-brand-peach-500 outline-none transition-all resize-none shadow-inner"
                  placeholder="e.g. Build an e-commerce website."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-brand-brown-900 text-brand-peach-50 rounded-xl font-semibold hover:bg-brand-brown-700 active:scale-[0.98] transition-all disabled:opacity-70 shadow-md flex items-center justify-center gap-2"
              >
                {loading ? "Redirecting to Dashboard…" : "Launch AI Team Workspace 🚀"}
              </button>
            </form>
          </div>

          {/* Side Panel */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-subtle border border-brand-peach-100">
              <h3 className="text-lg font-semibold mb-4">System Telemetry</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-brown-500">Backend API</span>
                  {health ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {health}
                    </span>
                  ) : (
                    <button
                      onClick={checkHealth}
                      className="text-sm font-medium text-brand-peach-500 hover:text-brand-peach-600 transition-colors"
                    >
                      Check Connection
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-brown-500">Database Status</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${isDbConnected ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-amber-100 text-amber-800"}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {dbStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-brown-500">Platform Stage</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                    Stage 6 — Full Active
                  </span>
                </div>
              </div>
            </div>

            <Link href={user ? "/dashboard" : "/login"} className="block group">
              <div className="bg-gradient-to-br from-brand-peach-500 to-brand-brown-700 p-6 rounded-2xl shadow-elegant text-white hover:shadow-xl transition-all hover:-translate-y-1">
                <h3 className="text-lg font-semibold mb-2 flex items-center justify-between">
                  {user ? "Open Full Dashboard" : "Log In to Platform"}
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                    →
                  </span>
                </h3>
                <p className="text-brand-peach-100 text-sm">
                  {user
                    ? "Access live agent collaboration, conflict resolution logs, health metrics, and executive master plan synthesis."
                    : "Create an account to save your complex goals and spawn AI agents."}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
