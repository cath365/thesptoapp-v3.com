"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ContentAnalytics } from "@/types";

interface Props {
  analytics: ContentAnalytics;
}

const RADIAN = Math.PI / 180;

function CustomPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) {
  if (percent === 0) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function AnalyticsCharts({ analytics }: Props) {
  const { articlesOverTime, articlesByCategory, statusDistribution } = analytics;

  const hasArticleData = articlesOverTime.some(
    (m) => m.published > 0 || m.drafts > 0
  );
  const hasCategoryData = articlesByCategory.length > 0;
  const hasStatusData = statusDistribution.some((s) => s.value > 0);

  return (
    <div className="space-y-6">
      {/* Row 1: Area chart + Donut chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart - takes 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Content Published Over Time
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
          </div>
          {!hasArticleData ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">
              No article data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart
                data={articlesOverTime}
                margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="colorPublished"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#9B6DAE" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#9B6DAE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient
                    id="colorDrafts"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#FF9800" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF9800" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="published"
                  name="Published"
                  stroke="#9B6DAE"
                  strokeWidth={2.5}
                  fill="url(#colorPublished)"
                  dot={{ r: 3, fill: "#9B6DAE", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
                <Area
                  type="monotone"
                  dataKey="drafts"
                  name="Drafts"
                  stroke="#FF9800"
                  strokeWidth={2.5}
                  fill="url(#colorDrafts)"
                  dot={{ r: 3, fill: "#FF9800", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut chart - takes 1/3 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-900">
              Content Status
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Published vs Drafts</p>
          </div>
          {!hasStatusData ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">
              No content yet
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={CustomPieLabel}
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-1">
                {statusDistribution.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      {s.name}{" "}
                      <span className="font-bold text-gray-700">
                        {s.value}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Horizontal bar chart - Articles by Category */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            Articles by Category
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Total content per topic</p>
        </div>
        {!hasCategoryData ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400">
            No articles yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={articlesByCategory}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="barGradient"
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#C69FD5" />
                  <stop offset="100%" stopColor="#9B6DAE" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="category"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Articles"
                fill="url(#barGradient)"
                radius={[0, 6, 6, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
