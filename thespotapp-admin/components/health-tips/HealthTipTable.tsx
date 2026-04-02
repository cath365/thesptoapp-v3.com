"use client";

import { useState } from "react";
import Link from "next/link";
import { useHealthTips, useDeleteHealthTip } from "@/hooks/useHealthTips";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import type { HealthTip } from "@/types";
import { SUPPORTED_LANGUAGES } from "@/types";

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
function EditIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}

function translatedCount(tip: HealthTip) {
  return SUPPORTED_LANGUAGES.filter(
    (lang) => tip.translations?.[lang]?.title || tip.translations?.[lang]?.body
  ).length;
}

export default function HealthTipTable() {
  const { data: tips, isLoading } = useHealthTips();
  const deleteTip = useDeleteHealthTip();
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<HealthTip | null>(null);

  const filtered = (tips ?? []).filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (t.translations?.en?.title ?? "").toLowerCase().includes(q) ||
      (t.translations?.en?.body ?? "").toLowerCase().includes(q) ||
      t.emoji.includes(q) ||
      String(t.numericId).includes(q)
    );
  });

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteTip.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      <div className="relative max-w-sm mb-5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#C69FD5" }}><SearchIcon /></span>
        <input
          type="text"
          placeholder="Search tips…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
          style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0", color: "#2E2E2E" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "#F5EEF8", border: "1.5px dashed #C69FD5" }}>
          <p className="text-sm font-medium" style={{ color: "#9B6DAE" }}>
            {search ? "No tips match your search." : "No health tips yet. Create your first one!"}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile cards ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map((tip) => {
              const count = translatedCount(tip);
              const pct = Math.round((count / SUPPORTED_LANGUAGES.length) * 100);
              return (
                <div key={tip.id} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "#fff", border: "1.5px solid #E8D5F0" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{tip.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>
                        {tip.translations?.en?.title || "(no English title)"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#B8A9D1" }}>#{tip.numericId}</p>
                    </div>
                  </div>
                  <p className="text-xs line-clamp-2" style={{ color: "#B8A9D1" }}>{tip.translations?.en?.body || ""}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#E8D5F0" }}>
                      <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#4CAF50" : "#9B6DAE" }} />
                    </div>
                    <span className="text-xs font-medium" style={{ color: "#9B6DAE" }}>{count}/{SUPPORTED_LANGUAGES.length} langs</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid #F5EEF8" }}>
                    <Link href={`/dashboard/health-tips/${tip.id}`} className="flex-1">
                      <button className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}>
                        <EditIcon /> Edit
                      </button>
                    </Link>
                    <button onClick={() => setDeleteTarget(tip)} className="p-2 rounded-xl" style={{ backgroundColor: "#FFF0F3", color: "#E8879C" }}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E8D5F0" }}>
            <div className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider"
              style={{ gridTemplateColumns: "4rem 3rem 1fr 8rem 8rem", backgroundColor: "#F5EEF8", color: "#9B6DAE", borderBottom: "1px solid #E8D5F0" }}>
              <div>ID</div><div>Icon</div><div>Title (English)</div><div>Languages</div><div>Actions</div>
            </div>
            <div className="divide-y bg-white" style={{ borderColor: "#F5EEF8" }}>
              {filtered.map((tip) => {
                const count = translatedCount(tip);
                const pct = Math.round((count / SUPPORTED_LANGUAGES.length) * 100);
                return (
                  <div key={tip.id} className="grid px-5 py-3.5 items-center transition-colors"
                    style={{ gridTemplateColumns: "4rem 3rem 1fr 8rem 8rem" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FDFDC9")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <div className="text-xs font-mono" style={{ color: "#B8A9D1" }}>#{tip.numericId}</div>
                    <div className="text-2xl">{tip.emoji}</div>
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>{tip.translations?.en?.title || "(no English title)"}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "#B8A9D1" }}>{tip.translations?.en?.body || ""}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: "#E8D5F0" }}>
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#4CAF50" : "#9B6DAE" }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: "#9B6DAE" }}>{count}/{SUPPORTED_LANGUAGES.length}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/dashboard/health-tips/${tip.id}`}>
                        <button className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8D5F0")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5EEF8")}>
                          <EditIcon /> Edit
                        </button>
                      </Link>
                      <button onClick={() => setDeleteTarget(tip)} className="inline-flex items-center p-1.5 rounded-lg" style={{ backgroundColor: "#FFF0F3", color: "#E8879C" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F2C4CE")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFF0F3")}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 text-xs" style={{ backgroundColor: "#F5EEF8", borderTop: "1px solid #E8D5F0", color: "#B8A9D1" }}>
              {filtered.length} of {(tips ?? []).length} health tips
            </div>
          </div>
        </>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Health Tip"
        onConfirm={handleDelete} confirmText="Delete" confirmVariant="danger" loading={deleteTip.isPending}>
        <p className="text-sm" style={{ color: "#4A4A4A" }}>Are you sure you want to delete this health tip? This cannot be undone.</p>
      </Modal>
    </div>
  );
}
