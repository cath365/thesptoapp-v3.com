"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Spinner from "@/components/ui/Spinner";

const TYPES = [
  { value: "info", label: "Info", color: "#9B6DAE", bg: "#F5EEF8" },
  { value: "warning", label: "Warning", color: "#E65100", bg: "#FFF3E0" },
  { value: "success", label: "Success", color: "#4CAF50", bg: "#E8F5E9" },
  { value: "urgent", label: "Urgent", color: "#E8879C", bg: "#F0D0D9" },
];

export default function AnnouncementPage() {
  const [message, setMessage] = useState("");
  const [type, setType] = useState("info");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, "announcements", "current"));
        if (snap.exists()) {
          const data = snap.data();
          setMessage(data.message ?? "");
          setType(data.type ?? "info");
          setActive(data.active ?? false);
        }
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await setDoc(doc(db, "announcements", "current"), {
        message,
        type,
        active,
        updatedAt: new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save. Check Firestore permissions.");
    } finally {
      setSaving(false);
    }
  };

  const selectedType = TYPES.find((t) => t.value === type) ?? TYPES[0];

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "#2E2E2E" }}>App Announcement</h1>
        <p className="text-sm mt-1" style={{ color: "#B8A9D1" }}>
          Send a live message that appears as a banner inside the mobile app.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: "#fff", border: "1.5px solid #E8D5F0" }}>

        {/* Active toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2E2E2E" }}>Show banner in app</p>
            <p className="text-xs mt-0.5" style={{ color: "#B8A9D1" }}>Toggle off to hide without deleting the message</p>
          </div>
          <button
            onClick={() => setActive(!active)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
            style={{ backgroundColor: active ? "#9B6DAE" : "#E8D5F0" }}
          >
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: active ? "translateX(22px)" : "translateX(2px)" }}
            />
          </button>
        </div>

        {/* Type selector */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#2E2E2E" }}>Banner Type</label>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  backgroundColor: type === t.value ? t.bg : "#F5EEF8",
                  color: type === t.value ? t.color : "#B8A9D1",
                  border: type === t.value ? `1.5px solid ${t.color}` : "1.5px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: "#2E2E2E" }}>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Type your announcement here…"
            className="w-full px-4 py-3 text-sm rounded-xl outline-none resize-none"
            style={{ backgroundColor: "#F5EEF8", border: "1.5px solid #E8D5F0", color: "#2E2E2E" }}
          />
          <p className="text-xs mt-1" style={{ color: "#B8A9D1" }}>{message.length} characters</p>
        </div>

        {/* Preview */}
        {message && (
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: "#B8A9D1" }}>
              Preview
            </label>
            <div
              className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ backgroundColor: selectedType.bg, border: `1.5px solid ${selectedType.color}30` }}
            >
              <span className="text-lg">
                {type === "info" ? "📢" : type === "warning" ? "⚠️" : type === "success" ? "✅" : "🚨"}
              </span>
              <p className="text-sm font-medium flex-1" style={{ color: selectedType.color }}>{message}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: "#FFF0F3", color: "#E8879C", border: "1.5px solid #F2C4CE" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving || !message.trim()}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all"
          style={{
            background: saving || !message.trim() ? "#E8D5F0" : "linear-gradient(135deg, #C69FD5 0%, #9B6DAE 100%)",
            color: saving || !message.trim() ? "#B8A9D1" : "#fff",
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved & Live!" : "Save Announcement"}
        </button>
      </div>

      {/* Info box */}
      <div className="rounded-2xl p-4 flex gap-3" style={{ backgroundColor: "#F5EEF8", border: "1.5px dashed #C69FD5" }}>
        <span className="text-xl">💡</span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#9B6DAE" }}>How it works</p>
          <p className="text-xs mt-1" style={{ color: "#B8A9D1" }}>
            When active, the banner appears at the top of the home screen in the mobile app in real-time.
            Toggle it off to hide it without losing the message.
          </p>
        </div>
      </div>
    </div>
  );
}
