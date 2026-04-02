"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers } from "@/lib/firestore";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Spinner from "@/components/ui/Spinner";

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function DevicePhoneIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18h3" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(val: string | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatRelative(val: string | undefined): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(val);
}

function getInitials(name: string | undefined, email: string | undefined): string {
  if (name && name.trim().length >= 2) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "??";
}

function isRecentlyActive(lastLogin: string | undefined): boolean {
  if (!lastLogin) return false;
  const d = new Date(lastLogin);
  if (isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
}

function getPlatformLabel(platform: unknown): string {
  if (platform === "android") return "Android";
  if (platform === "ios") return "iOS";
  return "—";
}

type RoleFilter = "all" | "admin" | "user";

// ── CSV export ────────────────────────────────────────────────────────────────

function exportUsersCSV(users: ReturnType<typeof buildFilteredUsers>) {
  const headers = ["Name", "Email", "Role", "Status", "Joined", "Last Login", "Platform", "Installed"];
  const rows = users.map((u) => [
    u.displayName || u.email?.split("@")[0] || "Unknown",
    u.email || "",
    u.role === "admin" ? "Admin" : "User",
    u.deactivated ? "Deactivated" : "Active",
    formatDate(u.createdAt),
    formatDate(u.lastLogin),
    getPlatformLabel(u.platform),
    u.installedAt ? formatDate(u.installedAt as string) : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Typed helper so exportUsersCSV gets correct parameter type
function buildFilteredUsers<T extends { id: string; email?: string; displayName?: string; role?: string; createdAt?: string; lastLogin?: string; deactivated?: boolean; platform?: unknown; installedAt?: unknown }>(users: T[], search: string, roleFilter: RoleFilter): T[] {
  return users.filter((u) => {
    const matchesRole =
      roleFilter === "all" ||
      (roleFilter === "admin" ? u.role === "admin" : u.role !== "admin");
    if (!matchesRole) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
  });

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = buildFilteredUsers(users, search, roleFilter);

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const regularCount = users.filter((u) => u.role !== "admin").length;
  const activeCount = users.filter((u) => isRecentlyActive(u.lastLogin)).length;
  const installCount = users.filter((u) => !!u.installedAt).length;

  // ── Action handlers ─────────────────────────────────────────────────────────

  const handleRoleChange = async (userId: string, newRole: "admin" | "user") => {
    setActionLoading(userId + ":role");
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivateToggle = async (userId: string, currentlyDeactivated: boolean) => {
    setActionLoading(userId + ":deactivate");
    try {
      await updateDoc(doc(db, "users", userId), { deactivated: !currentlyDeactivated });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } finally {
      setActionLoading(null);
    }
  };

  // ── Stat cards ──────────────────────────────────────────────────────────────

  const statCards = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: <UsersIcon />,
      bg: "linear-gradient(135deg, #C69FD5, #9B6DAE)",
      text: "#fff",
      sub: "All registered accounts",
    },
    {
      label: "Admins",
      value: adminCount,
      icon: <ShieldIcon />,
      bg: "linear-gradient(135deg, #E8879C, #C06080)",
      text: "#fff",
      sub: "Dashboard access",
    },
    {
      label: "App Users",
      value: regularCount,
      icon: <UsersIcon />,
      bg: "linear-gradient(135deg, #9B6DAE, #6D3F82)",
      text: "#fff",
      sub: "Mobile app accounts",
    },
    {
      label: "Active (7d)",
      value: activeCount,
      icon: <ClockIcon />,
      bg: "#fff",
      text: "#9B6DAE",
      sub: "Logged in recently",
      border: "1.5px solid #E8D5F0",
    },
    {
      label: "Installs",
      value: installCount,
      icon: <DevicePhoneIcon />,
      bg: "#fff",
      text: "#9B6DAE",
      sub: "App installed",
      border: "1.5px solid #E8D5F0",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#2E2E2E" }}>Users</h1>
          <p className="text-sm mt-1" style={{ color: "#B8A9D1" }}>
            All registered accounts across the mobile app and admin dashboard
          </p>
        </div>
        <button
          onClick={() => exportUsersCSV(filtered)}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{ backgroundColor: "#9B6DAE", color: "#fff" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#7D559A")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#9B6DAE")}
        >
          <DownloadIcon />
          Export CSV
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{
              background: card.bg,
              border: card.border ?? "none",
              boxShadow: "0 2px 12px rgba(155,109,174,0.10)",
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: card.text, opacity: 0.8 }}>{card.icon}</span>
              <span className="text-2xl font-bold" style={{ color: card.text }}>
                {card.value}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: card.text }}>
                {card.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: card.text, opacity: 0.65 }}>
                {card.sub}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#C69FD5" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search by name, email or UID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
            style={{
              backgroundColor: "#F5EEF8",
              border: "1.5px solid #E8D5F0",
              color: "#2E2E2E",
            }}
          />
        </div>

        {/* Role filter tabs */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: "1.5px solid #E8D5F0" }}
        >
          {(["all", "admin", "user"] as RoleFilter[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: roleFilter === tab ? "#9B6DAE" : "#F5EEF8",
                color: roleFilter === tab ? "#fff" : "#9B6DAE",
              }}
            >
              {tab === "all" ? "All" : tab === "admin" ? "Admins" : "App Users"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div
          className="rounded-2xl p-8 text-center text-sm"
          style={{ backgroundColor: "#FFF0F3", color: "#E8879C", border: "1px solid #F2C4CE" }}
        >
          Failed to load users. Please refresh the page.
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ backgroundColor: "#F5EEF8", border: "1.5px dashed #C69FD5" }}
        >
          <p className="text-sm font-medium" style={{ color: "#9B6DAE" }}>
            {search || roleFilter !== "all" ? "No users match your search." : "No users yet."}
          </p>
          <p className="text-xs mt-1" style={{ color: "#B8A9D1" }}>
            Users will appear here once they register on the mobile app.
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map((user) => {
              const initials = getInitials(user.displayName, user.email);
              const isAdmin = user.role === "admin";
              const active = isRecentlyActive(user.lastLogin);
              const isDeactivated = !!user.deactivated;
              const roleKey = user.id + ":role";
              const deactivateKey = user.id + ":deactivate";

              return (
                <div
                  key={user.id}
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: "#fff",
                    border: "1.5px solid #E8D5F0",
                    opacity: isDeactivated ? 0.6 : 1,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{
                        background: isDeactivated
                          ? "#9CA3AF"
                          : isAdmin
                          ? "linear-gradient(135deg, #E8879C, #C06080)"
                          : "linear-gradient(135deg, #C69FD5, #9B6DAE)",
                      }}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>
                          {user.displayName || user.email?.split("@")[0] || "Unknown"}
                        </p>
                        <span
                          className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={
                            isDeactivated
                              ? { backgroundColor: "#F3F4F6", color: "#6B7280" }
                              : isAdmin
                              ? { backgroundColor: "#FFF0F3", color: "#E8879C" }
                              : { backgroundColor: "#F5EEF8", color: "#9B6DAE" }
                          }
                        >
                          {isDeactivated ? "Deactivated" : isAdmin ? "Admin" : "User"}
                        </span>
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#B8A9D1" }}>
                        {user.email || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #F5EEF8" }}>
                    <div>
                      <span className="text-xs" style={{ color: "#B8A9D1" }}>
                        Joined {formatDate(user.createdAt)}
                      </span>
                      {typeof user.installedAt === "string" && (
                        <p className="text-xs mt-0.5" style={{ color: "#C69FD5" }}>
                          Installed {formatDate(user.installedAt)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {active && !isDeactivated && (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#4CAF50" }} />
                      )}
                      <span className="text-xs" style={{ color: active && !isDeactivated ? "#4CAF50" : "#B8A9D1" }}>
                        {formatRelative(user.lastLogin)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 flex-wrap" style={{ borderTop: "1px solid #F5EEF8" }}>
                    {!isDeactivated && (
                      isAdmin ? (
                        <button
                          onClick={() => handleRoleChange(user.id, "user")}
                          disabled={actionLoading === roleKey}
                          className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                          style={{ backgroundColor: "#FFF0F3", color: "#E8879C", opacity: actionLoading === roleKey ? 0.6 : 1 }}
                        >
                          {actionLoading === roleKey ? "Saving…" : "Remove Admin"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRoleChange(user.id, "admin")}
                          disabled={actionLoading === roleKey}
                          className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                          style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE", opacity: actionLoading === roleKey ? 0.6 : 1 }}
                        >
                          {actionLoading === roleKey ? "Saving…" : "Make Admin"}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleDeactivateToggle(user.id, isDeactivated)}
                      disabled={actionLoading === deactivateKey}
                      className="flex-1 px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{
                        backgroundColor: isDeactivated ? "#E8F5E9" : "#F3F4F6",
                        color: isDeactivated ? "#4CAF50" : "#6B7280",
                        opacity: actionLoading === deactivateKey ? 0.6 : 1,
                      }}
                    >
                      {actionLoading === deactivateKey
                        ? "Saving…"
                        : isDeactivated
                        ? "Activate"
                        : "Deactivate"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div
            className="hidden sm:block rounded-2xl overflow-hidden"
            style={{ border: "1.5px solid #E8D5F0", backgroundColor: "#fff" }}
          >
            {/* Header row */}
            <div
              className="grid gap-3 px-5 py-3 text-xs font-bold uppercase tracking-wider"
              style={{
                gridTemplateColumns: "2.5rem 1fr 1fr 6rem 5rem 7rem 7rem 14rem",
                backgroundColor: "#F5EEF8",
                color: "#9B6DAE",
                borderBottom: "1px solid #E8D5F0",
              }}
            >
              <div />
              <div>User</div>
              <div>Email</div>
              <div>Role</div>
              <div>Platform</div>
              <div>Joined</div>
              <div>Last Login</div>
              <div>Actions</div>
            </div>

            <div className="divide-y" style={{ borderColor: "#F5EEF8" }}>
              {filtered.map((user) => {
                const initials = getInitials(user.displayName, user.email);
                const isAdmin = user.role === "admin";
                const active = isRecentlyActive(user.lastLogin);
                const isDeactivated = !!user.deactivated;
                const roleKey = user.id + ":role";
                const deactivateKey = user.id + ":deactivate";

                return (
                  <div
                    key={user.id}
                    className="grid gap-3 px-5 py-3.5 items-center transition-colors"
                    style={{
                      gridTemplateColumns: "2.5rem 1fr 1fr 6rem 5rem 7rem 7rem 14rem",
                      opacity: isDeactivated ? 0.65 : 1,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = isDeactivated ? "#F9F9F9" : "#FDFDC9")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                  >
                    {/* Avatar */}
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{
                        background: isDeactivated
                          ? "#9CA3AF"
                          : isAdmin
                          ? "linear-gradient(135deg, #E8879C, #C06080)"
                          : "linear-gradient(135deg, #C69FD5, #9B6DAE)",
                      }}
                    >
                      {initials}
                    </div>

                    {/* Name + UID */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>
                        {user.displayName || user.email?.split("@")[0] || "Unknown"}
                      </p>
                      <p className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "#B8A9D1" }}>
                        {user.id.slice(0, 16)}…
                      </p>
                    </div>

                    {/* Email */}
                    <div className="min-w-0">
                      <p className="text-sm truncate" style={{ color: "#4A4A4A" }}>
                        {user.email || "—"}
                      </p>
                    </div>

                    {/* Role badge */}
                    <div>
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={
                          isDeactivated
                            ? { backgroundColor: "#F3F4F6", color: "#6B7280" }
                            : isAdmin
                            ? { backgroundColor: "#FFF0F3", color: "#E8879C" }
                            : { backgroundColor: "#F5EEF8", color: "#9B6DAE" }
                        }
                      >
                        {isDeactivated ? "Deactivated" : isAdmin ? "Admin" : "User"}
                      </span>
                    </div>

                    {/* Platform */}
                    <div className="text-xs" style={{ color: "#B8A9D1" }}>
                      {getPlatformLabel(user.platform)}
                    </div>

                    {/* Joined */}
                    <div className="text-xs" style={{ color: "#B8A9D1" }}>
                      {formatDate(user.createdAt)}
                    </div>

                    {/* Last login */}
                    <div className="flex items-center gap-1.5">
                      {active && !isDeactivated && (
                        <span
                          className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: "#4CAF50" }}
                        />
                      )}
                      <span className="text-xs" style={{ color: active && !isDeactivated ? "#4CAF50" : "#B8A9D1" }}>
                        {formatRelative(user.lastLogin)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!isDeactivated && (
                        isAdmin ? (
                          <button
                            onClick={() => handleRoleChange(user.id, "user")}
                            disabled={actionLoading === roleKey}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: "#FFF0F3",
                              color: "#E8879C",
                              opacity: actionLoading === roleKey ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => { if (actionLoading !== roleKey) e.currentTarget.style.backgroundColor = "#F2C4CE"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFF0F3"; }}
                          >
                            {actionLoading === roleKey ? "Saving…" : "Remove Admin"}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(user.id, "admin")}
                            disabled={actionLoading === roleKey}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: "#F5EEF8",
                              color: "#9B6DAE",
                              opacity: actionLoading === roleKey ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => { if (actionLoading !== roleKey) e.currentTarget.style.backgroundColor = "#E8D5F0"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#F5EEF8"; }}
                          >
                            {actionLoading === roleKey ? "Saving…" : "Make Admin"}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => handleDeactivateToggle(user.id, isDeactivated)}
                        disabled={actionLoading === deactivateKey}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: isDeactivated ? "#E8F5E9" : "#F3F4F6",
                          color: isDeactivated ? "#4CAF50" : "#6B7280",
                          opacity: actionLoading === deactivateKey ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (actionLoading !== deactivateKey)
                            e.currentTarget.style.backgroundColor = isDeactivated ? "#C8E6C9" : "#E5E7EB";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isDeactivated ? "#E8F5E9" : "#F3F4F6";
                        }}
                      >
                        {actionLoading === deactivateKey
                          ? "Saving…"
                          : isDeactivated
                          ? "Activate"
                          : "Deactivate"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 text-xs"
              style={{
                backgroundColor: "#F5EEF8",
                borderTop: "1px solid #E8D5F0",
                color: "#B8A9D1",
              }}
            >
              Showing {filtered.length} of {totalUsers} users
            </div>
          </div>
        </>
      )}
    </div>
  );
}
