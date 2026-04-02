"use client";

import { useRealtimeMetrics } from "@/hooks/useRealtimeMetrics";
import Spinner from "@/components/ui/Spinner";
import dynamic from "next/dynamic";

const RealtimeCharts = dynamic(() => import("./RealtimeCharts"), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center">
      <Spinner />
    </div>
  ),
});

export default function RealtimePage() {
  const { metrics, loading } = useRealtimeMetrics();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Users",
      value: metrics.totalUsers,
      bg: "linear-gradient(135deg, #C69FD5, #9B6DAE)",
      text: "#fff",
      sub: "All registered",
    },
    {
      label: "Active Today",
      value: metrics.activeToday,
      bg: "linear-gradient(135deg, #4CAF50, #388E3C)",
      text: "#fff",
      sub: "Logged in today",
    },
    {
      label: "Total Article Views",
      value: metrics.totalViews,
      bg: "linear-gradient(135deg, #E8879C, #C06080)",
      text: "#fff",
      sub: "All time",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "#2E2E2E" }}>
            Live Metrics
          </h1>
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ backgroundColor: "#4CAF50" }}
          />
        </div>
        <p className="text-sm mt-1" style={{ color: "#B8A9D1" }}>
          Real-time data from your app — updates automatically
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-5"
            style={{
              background: card.bg,
              boxShadow: "0 2px 12px rgba(155,109,174,0.15)",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: card.text, opacity: 0.7 }}
            >
              {card.label}
            </p>
            <p
              className="text-3xl font-bold mt-1"
              style={{ color: card.text }}
            >
              {card.value}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: card.text, opacity: 0.6 }}
            >
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <RealtimeCharts signupsOverTime={metrics.signupsOverTime} />
    </div>
  );
}
