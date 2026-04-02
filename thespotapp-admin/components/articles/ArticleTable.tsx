"use client";

import { useState } from "react";
import Link from "next/link";
import { useArticles, useDeleteArticle, useUpdateArticle } from "@/hooks/useArticles";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import type { Article, ArticleCategory } from "@/types";
import { ARTICLE_CATEGORIES } from "@/types";

// ── Icons ─────────────────────────────────────────────────────────────────────

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
function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const categoryLabel = (cat: ArticleCategory) =>
  ARTICLE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

function getStatusInfo(article: Article): { label: string; bg: string; color: string } {
  if (article.status === "scheduled") return { label: "Scheduled", bg: "#F5EEF8", color: "#9B6DAE" };
  if (article.isPublished) return { label: "Published", bg: "#E8F5E9", color: "#4CAF50" };
  return { label: "Draft", bg: "#FFF3E0", color: "#FF9800" };
}

function formatArticleDate(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exportArticlesCSV(articles: Article[]) {
  const headers = ["Title", "Category", "Author", "Status", "Date", "Summary"];
  const rows = articles.map((a) => [
    a.title,
    categoryLabel(a.category),
    a.author || "",
    a.isPublished ? "Published" : "Draft",
    formatArticleDate(a.publishedDate),
    a.summary || "",
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `articles-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArticleTable() {
  const { data: articles, isLoading } = useArticles();
  const deleteArticle = useDeleteArticle();
  const updateArticle = useUpdateArticle();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const filtered = (articles ?? []).filter((a) => {
    const matchesSearch =
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (a.author ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || a.category === categoryFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "published" && a.isPublished) ||
      (statusFilter === "draft" && !a.isPublished) ||
      (statusFilter === "scheduled" && a.status === "scheduled");
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // ── Selection helpers ───────────────────────────────────────────────────────

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  // ── Single article actions ──────────────────────────────────────────────────

  const handleTogglePublish = (article: Article) => {
    updateArticle.mutate({ id: article.id, data: { isPublished: !article.isPublished } });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteArticle.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  // ── Bulk actions ────────────────────────────────────────────────────────────

  const selectedArticles = filtered.filter((a) => selectedIds.has(a.id));

  const handleBulkPublish = async (publish: boolean) => {
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedArticles
          .filter((a) => a.isPublished !== publish)
          .map((a) =>
            updateArticle.mutateAsync({ id: a.id, data: { isPublished: publish } })
          )
      );
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkLoading(true);
    try {
      await Promise.all(
        selectedArticles.map((a) => deleteArticle.mutateAsync(a.id))
      );
      setSelectedIds(new Set());
      setBulkDeleteConfirm(false);
    } finally {
      setBulkLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>;
  }

  return (
    <div>
      {/* Filters + Export */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#C69FD5" }}>
            <SearchIcon />
          </span>
          <input
            type="text"
            placeholder="Search articles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
            style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0", color: "#2E2E2E" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0", color: "#9B6DAE" }}
          >
            <option value="all">All Categories</option>
            {ARTICLE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0", color: "#9B6DAE" }}
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </select>
          <button
            onClick={() => exportArticlesCSV(filtered)}
            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: "#9B6DAE", color: "#fff" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#7D559A")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#9B6DAE")}
          >
            <DownloadIcon />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 flex-wrap"
          style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0" }}
        >
          <span className="text-sm font-semibold" style={{ color: "#9B6DAE" }}>
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={() => handleBulkPublish(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "#E8F5E9", color: "#4CAF50", opacity: bulkLoading ? 0.6 : 1 }}
              onMouseEnter={(e) => { if (!bulkLoading) e.currentTarget.style.backgroundColor = "#C8E6C9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#E8F5E9"; }}
            >
              Publish All
            </button>
            <button
              onClick={() => handleBulkPublish(false)}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "#FFF3E0", color: "#FF9800", opacity: bulkLoading ? 0.6 : 1 }}
              onMouseEnter={(e) => { if (!bulkLoading) e.currentTarget.style.backgroundColor = "#FFE0B2"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFF3E0"; }}
            >
              Unpublish All
            </button>
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              disabled={bulkLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "#FFF0F3", color: "#E8879C", opacity: bulkLoading ? 0.6 : 1 }}
              onMouseEnter={(e) => { if (!bulkLoading) e.currentTarget.style.backgroundColor = "#F2C4CE"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#FFF0F3"; }}
            >
              Delete All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: "#F5EEF8", border: "1.5px dashed #C69FD5" }}>
          <p className="text-sm font-medium" style={{ color: "#9B6DAE" }}>
            {search || categoryFilter !== "all" || statusFilter !== "all"
              ? "No articles match your filters."
              : "No articles yet. Create your first one!"}
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile card list ── */}
          <div className="sm:hidden space-y-3">
            {filtered.map((article) => (
              <div
                key={article.id}
                className="rounded-2xl p-4 space-y-3"
                style={{
                  backgroundColor: "#fff",
                  border: selectedIds.has(article.id) ? "1.5px solid #9B6DAE" : "1.5px solid #E8D5F0",
                }}
              >
                {/* Checkbox + title row */}
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(article.id)}
                    onChange={() => toggleSelect(article.id)}
                    className="mt-1 h-4 w-4 rounded flex-shrink-0 cursor-pointer"
                    style={{ accentColor: "#9B6DAE" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>{article.title}</p>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#B8A9D1" }}>{article.summary}</p>
                      </div>
                      <span
                        className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: getStatusInfo(article).bg, color: getStatusInfo(article).color }}
                      >
                        {getStatusInfo(article).label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}>
                    {categoryLabel(article.category)}
                  </span>
                  <span className="text-xs" style={{ color: "#B8A9D1" }}>
                    {article.author} · {formatArticleDate(article.publishedDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid #F5EEF8" }}>
                  <Link href={`/dashboard/articles/${article.id}`} className="flex-1">
                    <button className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium" style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}>
                      <EditIcon /> Edit
                    </button>
                  </Link>
                  <button
                    onClick={() => handleTogglePublish(article)}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium"
                    style={article.isPublished
                      ? { backgroundColor: "#FFF3E0", color: "#FF9800" }
                      : { backgroundColor: "#E8F5E9", color: "#4CAF50" }}
                  >
                    {article.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(article)}
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: "#FFF0F3", color: "#E8879C" }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Desktop table ── */}
          <div className="hidden sm:block rounded-2xl overflow-hidden" style={{ border: "1.5px solid #E8D5F0" }}>
            {/* Header */}
            <div
              className="grid px-5 py-3 text-xs font-bold uppercase tracking-wider items-center"
              style={{
                gridTemplateColumns: "2rem 1fr 9rem 8rem 6rem 7rem 9rem",
                backgroundColor: "#F5EEF8",
                color: "#9B6DAE",
                borderBottom: "1px solid #E8D5F0",
              }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded cursor-pointer"
                  style={{ accentColor: "#9B6DAE" }}
                  title="Select all"
                />
              </div>
              <div>Title</div>
              <div>Category</div>
              <div>Author</div>
              <div>Status</div>
              <div>Date</div>
              <div>Actions</div>
            </div>

            <div className="divide-y bg-white" style={{ borderColor: "#F5EEF8" }}>
              {filtered.map((article) => (
                <div
                  key={article.id}
                  className="grid px-5 py-3.5 items-center transition-colors"
                  style={{
                    gridTemplateColumns: "2rem 1fr 9rem 8rem 6rem 7rem 9rem",
                    backgroundColor: selectedIds.has(article.id) ? "#F5EEF8" : "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!selectedIds.has(article.id))
                      e.currentTarget.style.backgroundColor = "#FDFDC9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = selectedIds.has(article.id) ? "#F5EEF8" : "transparent";
                  }}
                >
                  {/* Checkbox */}
                  <div>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(article.id)}
                      onChange={() => toggleSelect(article.id)}
                      className="h-4 w-4 rounded cursor-pointer"
                      style={{ accentColor: "#9B6DAE" }}
                    />
                  </div>

                  {/* Title */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm font-semibold truncate" style={{ color: "#2E2E2E" }}>{article.title}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#B8A9D1" }}>{article.summary}</p>
                  </div>

                  {/* Category */}
                  <div>
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}>
                      {categoryLabel(article.category)}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="text-sm truncate" style={{ color: "#4A4A4A" }}>{article.author || "—"}</div>

                  {/* Status */}
                  <div>
                    <span
                      className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: getStatusInfo(article).bg, color: getStatusInfo(article).color }}
                    >
                      {getStatusInfo(article).label}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="text-xs" style={{ color: "#B8A9D1" }}>
                    {formatArticleDate(article.publishedDate)}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <Link href={`/dashboard/articles/${article.id}`}>
                      <button
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: "#F5EEF8", color: "#9B6DAE" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E8D5F0")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#F5EEF8")}
                      >
                        <EditIcon /> Edit
                      </button>
                    </Link>
                    <button
                      onClick={() => handleTogglePublish(article)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                      style={article.isPublished ? { backgroundColor: "#FFF3E0", color: "#FF9800" } : { backgroundColor: "#E8F5E9", color: "#4CAF50" }}
                    >
                      {article.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(article)}
                      className="inline-flex items-center p-1.5 rounded-lg"
                      style={{ backgroundColor: "#FFF0F3", color: "#E8879C" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F2C4CE")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#FFF0F3")}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 text-xs" style={{ backgroundColor: "#F5EEF8", borderTop: "1px solid #E8D5F0", color: "#B8A9D1" }}>
              {someSelected
                ? `${selectedIds.size} selected · `
                : ""}
              {filtered.length} of {(articles ?? []).length} articles
            </div>
          </div>
        </>
      )}

      {/* Single-article delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Article"
        onConfirm={handleDelete}
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleteArticle.isPending}
      >
        <p className="text-sm" style={{ color: "#4A4A4A" }}>
          Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? This cannot be undone.
        </p>
      </Modal>

      {/* Bulk delete confirmation */}
      <Modal
        open={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        title="Delete Selected Articles"
        onConfirm={handleBulkDelete}
        confirmText="Delete All"
        confirmVariant="danger"
        loading={bulkLoading}
      >
        <p className="text-sm" style={{ color: "#4A4A4A" }}>
          Are you sure you want to delete <strong>{selectedIds.size}</strong> article
          {selectedIds.size === 1 ? "" : "s"}? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
