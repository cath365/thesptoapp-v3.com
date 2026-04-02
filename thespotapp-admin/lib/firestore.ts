/*
 * Firestore CRUD helpers for the admin panel.
 *
 * IMPORTANT — Firestore security rules should restrict write access
 * to authenticated users whose document in the `users` collection
 * has `role == "admin"`. Example rule:
 *
 *   match /articles/{docId} {
 *     allow read: if true;
 *     allow write: if request.auth != null
 *       && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
 *   }
 *
 * Apply the same pattern to `health_tips` and any other admin-managed collections.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getCountFromServer,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Article,
  ArticleFormData,
  HealthTip,
  HealthTipFormData,
  AppUser,
  DashboardStats,
  ContentAnalytics,
  ActivityLog,
  MediaItem,
  ArticleAnalytics,
} from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert any Firestore Timestamp fields in a doc to ISO strings */
function normalizeTimestamps(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val instanceof Timestamp) {
      result[key] = val.toDate().toISOString();
    } else if (val && typeof val === "object" && "seconds" in val && "nanoseconds" in val) {
      result[key] = new Date((val as { seconds: number }).seconds * 1000).toISOString();
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

const articlesRef = collection(db, "articles");

export async function getArticles(): Promise<Article[]> {
  const q = query(articlesRef, orderBy("publishedDate", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...normalizeTimestamps(d.data()) } as Article));
}

export async function getArticle(id: string): Promise<Article | null> {
  const snap = await getDoc(doc(db, "articles", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...normalizeTimestamps(snap.data()) } as Article;
}

export async function createArticle(data: ArticleFormData): Promise<string> {
  const now = new Date().toISOString();
  const docRef = await addDoc(articlesRef, {
    ...data,
    publishedDate: data.publishedDate || now,
    lastUpdated: now,
  });
  return docRef.id;
}

export async function updateArticle(
  id: string,
  data: Partial<ArticleFormData>
): Promise<void> {
  const ref = doc(db, "articles", id);
  await updateDoc(ref, {
    ...data,
    lastUpdated: new Date().toISOString(),
  });
}

export async function deleteArticle(id: string): Promise<void> {
  await deleteDoc(doc(db, "articles", id));
}

// ---------------------------------------------------------------------------
// Health Tips
// ---------------------------------------------------------------------------

const healthTipsRef = collection(db, "health_tips");

export async function getHealthTips(): Promise<HealthTip[]> {
  const snapshot = await getDocs(healthTipsRef);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      numericId: data.id ?? 0,
      emoji: data.emoji ?? "",
      translations: data.translations ?? {},
    } as HealthTip;
  });
}

export async function getHealthTip(id: string): Promise<HealthTip | null> {
  const snap = await getDoc(doc(db, "health_tips", id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    numericId: data.id ?? 0,
    emoji: data.emoji ?? "",
    translations: data.translations ?? {},
  } as HealthTip;
}

export async function createHealthTip(
  data: HealthTipFormData
): Promise<string> {
  const docRef = await addDoc(healthTipsRef, {
    id: data.numericId,
    emoji: data.emoji,
    translations: data.translations,
  });
  return docRef.id;
}

export async function updateHealthTip(
  id: string,
  data: Partial<HealthTipFormData>
): Promise<void> {
  const ref = doc(db, "health_tips", id);
  const payload: Record<string, unknown> = {};
  if (data.numericId !== undefined) payload.id = data.numericId;
  if (data.emoji !== undefined) payload.emoji = data.emoji;
  if (data.translations !== undefined) payload.translations = data.translations;
  await updateDoc(ref, payload);
}

export async function deleteHealthTip(id: string): Promise<void> {
  await deleteDoc(doc(db, "health_tips", id));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const usersRef = collection(db, "users");

export async function updateUserRole(
  userId: string,
  role: "admin" | "user"
): Promise<void> {
  await updateDoc(doc(db, "users", userId), { role });
}

export async function deactivateUser(
  userId: string,
  active: boolean
): Promise<void> {
  await updateDoc(doc(db, "users", userId), { active });
}

export async function getUsers(): Promise<AppUser[]> {
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map((d) => {
    const data = d.data();
    // Convert Firestore Timestamps to ISO strings for display
    const createdAt =
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : data.createdAt ?? "";
    const lastLogin =
      data.lastLogin instanceof Timestamp
        ? data.lastLogin.toDate().toISOString()
        : data.lastLogin ?? "";
    return {
      id: d.id,
      ...data,
      createdAt,
      lastLogin,
    } as AppUser;
  });
}

// ---------------------------------------------------------------------------
// Dashboard Stats
// ---------------------------------------------------------------------------

export async function getDashboardStats(): Promise<DashboardStats> {
  const [articlesSnap, publishedSnap, tipsSnap, usersSnap] = await Promise.all(
    [
      getCountFromServer(articlesRef),
      getCountFromServer(
        query(articlesRef, where("isPublished", "==", true))
      ),
      getCountFromServer(healthTipsRef),
      getCountFromServer(usersRef),
    ]
  );

  const totalArticles = articlesSnap.data().count;
  const publishedArticles = publishedSnap.data().count;

  return {
    totalArticles,
    publishedArticles,
    draftArticles: totalArticles - publishedArticles,
    totalHealthTips: tipsSnap.data().count,
    totalUsers: usersSnap.data().count,
  };
}

// ---------------------------------------------------------------------------
// Content Analytics (for charts)
// ---------------------------------------------------------------------------

export async function getContentAnalytics(): Promise<ContentAnalytics> {
  const snapshot = await getDocs(articlesRef);
  const articles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Article));

  // Build last 6 months
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }

  const articlesOverTime = months.map((m) => {
    const inMonth = articles.filter((a) => {
      if (!a.publishedDate) return false;
      const date = new Date(a.publishedDate);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return key === m.key;
    });
    return {
      month: m.label,
      published: inMonth.filter((a) => a.isPublished).length,
      drafts: inMonth.filter((a) => !a.isPublished).length,
    };
  });

  const categoryLabels: Record<string, string> = {
    "menstrual-health": "Menstrual Health",
    "hiv-stis": "HIV & STIs",
    "maternal-health": "Maternal Health",
    "safe-abortion": "Safe Abortion",
    contraceptives: "Contraceptives",
    "srhr-laws": "SRHR Laws",
    "fact-check": "Fact Check",
    "find-services": "Find Services",
    safety: "Safety",
  };

  const categoryMap: Record<string, number> = {};
  articles.forEach((a) => {
    const cat = a.category || "other";
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });

  const articlesByCategory = Object.entries(categoryMap)
    .map(([cat, count]) => ({ category: categoryLabels[cat] || cat, count }))
    .sort((a, b) => b.count - a.count);

  const published = articles.filter((a) => a.isPublished).length;
  const drafts = articles.length - published;

  const statusDistribution = [
    { name: "Published", value: published, color: "#4CAF50" },
    { name: "Drafts", value: drafts, color: "#FF9800" },
  ];

  return { articlesOverTime, articlesByCategory, statusDistribution };
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

const activityLogRef = collection(db, "activity_log");

export async function logActivity(
  action: string,
  detail: string,
  adminEmail: string
): Promise<void> {
  await addDoc(activityLogRef, {
    action,
    detail,
    adminEmail,
    createdAt: new Date().toISOString(),
  });
}

export async function getActivityLog(): Promise<ActivityLog[]> {
  const q = query(activityLogRef, orderBy("createdAt", "desc"), limit(50));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ActivityLog)
  );
}

// ---------------------------------------------------------------------------
// Media Library
// ---------------------------------------------------------------------------

const mediaRef = collection(db, "media");

export async function getMediaItems(): Promise<MediaItem[]> {
  const q = query(mediaRef, orderBy("uploadedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MediaItem));
}

export async function createMediaItem(
  data: Omit<MediaItem, "id">
): Promise<MediaItem> {
  const docRef = await addDoc(mediaRef, data);
  return { id: docRef.id, ...data };
}

export async function deleteMediaItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "media", id));
}

// ---------------------------------------------------------------------------
// Article View Analytics
// ---------------------------------------------------------------------------

const articleViewsRef = collection(db, "article_views");

export async function getArticleViewStats(): Promise<ArticleAnalytics[]> {
  // Only fetch views from the last 90 days to avoid downloading entire collection
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const viewsQuery = query(
    articleViewsRef,
    where("timestamp", ">=", ninetyDaysAgo.toISOString())
  );
  const viewsSnapshot = await getDocs(viewsQuery);
  const views = viewsSnapshot.docs.map((d) => d.data());

  // Aggregate by articleId
  const statsMap: Record<
    string,
    { viewCount: number; totalReadTime: number; readCount: number }
  > = {};

  views.forEach((v) => {
    const aid = v.articleId;
    if (!aid) return;
    if (!statsMap[aid]) {
      statsMap[aid] = { viewCount: 0, totalReadTime: 0, readCount: 0 };
    }
    statsMap[aid].viewCount++;
    if (v.readDurationSeconds && v.readDurationSeconds > 0) {
      statsMap[aid].totalReadTime += v.readDurationSeconds;
      statsMap[aid].readCount++;
    }
  });

  // Get article titles
  const articlesSnapshot = await getDocs(articlesRef);
  const articleMap: Record<string, { title: string; category: string }> = {};
  articlesSnapshot.docs.forEach((d) => {
    const data = d.data();
    articleMap[d.id] = { title: data.title || "Untitled", category: data.category || "" };
  });

  return Object.entries(statsMap)
    .map(([articleId, stats]) => ({
      articleId,
      title: articleMap[articleId]?.title || "Unknown",
      category: articleMap[articleId]?.category || "",
      viewCount: stats.viewCount,
      avgReadTime:
        stats.readCount > 0
          ? Math.round(stats.totalReadTime / stats.readCount)
          : 0,
    }))
    .sort((a, b) => b.viewCount - a.viewCount);
}

export async function getViewsOverTime(
  days: number
): Promise<{ date: string; views: number }[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const viewsQuery = query(
    articleViewsRef,
    where("timestamp", ">=", cutoff.toISOString())
  );
  const snapshot = await getDocs(viewsQuery);
  const views = snapshot.docs.map((d) => d.data());

  const result: { date: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const count = views.filter((v) => {
      if (!v.timestamp) return false;
      return v.timestamp.startsWith(dateStr);
    }).length;
    result.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      views: count,
    });
  }
  return result;
}

export async function getSignupsOverTime(): Promise<
  { month: string; count: number }[]
> {
  // Only fetch users created in the last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const usersQuery = query(
    usersRef,
    where("createdAt", ">=", sixMonthsAgo.toISOString())
  );
  const snapshot = await getDocs(usersQuery);
  const users = snapshot.docs.map((d) => d.data());

  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }

  return months.map((m) => {
    const count = users.filter((u) => {
      const created =
        u.createdAt instanceof Timestamp
          ? u.createdAt.toDate().toISOString()
          : u.createdAt;
      if (!created) return false;
      const date = new Date(created);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return key === m.key;
    }).length;
    return { month: m.label, count };
  });
}

// ---------------------------------------------------------------------------
// Deployment / Version Management
// ---------------------------------------------------------------------------

import type { AppVersionConfig, DeploymentLog } from "@/types";

const deploymentLogsRef = collection(db, "deployment_logs");

export async function getAppVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const snap = await getDoc(doc(db, "app_config", "version"));
    if (!snap.exists()) return null;
    return snap.data() as AppVersionConfig;
  } catch {
    return null;
  }
}

export async function updateAppVersionConfig(
  data: Partial<AppVersionConfig>
): Promise<void> {
  const ref = doc(db, "app_config", "version");
  const snap = await getDoc(ref);
  const payload = { ...data, updatedAt: new Date().toISOString() };
  if (snap.exists()) {
    await updateDoc(ref, payload);
  } else {
    // First time — create with sensible defaults
    await setDoc(ref, {
      currentVersion: "2.1.0",
      minimumVersion: "1.0.0",
      forceUpdate: false,
      updateMessage: "",
      updatedAt: new Date().toISOString(),
      ...data,
    });
  }
}

export async function addDeploymentLog(
  log: Omit<DeploymentLog, "id">
): Promise<void> {
  await addDoc(deploymentLogsRef, log);
}

export async function getDeploymentLogs(): Promise<DeploymentLog[]> {
  const q = query(deploymentLogsRef, orderBy("createdAt", "desc"), limit(30));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as DeploymentLog));
}

// ---------------------------------------------------------------------------
// Rollout Config  (app_config/rollout)
// ---------------------------------------------------------------------------

import type { RolloutConfig, FeatureFlags } from "@/types";

export async function getRolloutConfig(): Promise<RolloutConfig> {
  try {
    const snap = await getDoc(doc(db, "app_config", "rollout"));
    if (!snap.exists()) return { rolloutPercentage: 100, disableUpdates: false };
    const data = snap.data();
    return {
      rolloutPercentage:
        typeof data.rolloutPercentage === "number" &&
        data.rolloutPercentage >= 0 &&
        data.rolloutPercentage <= 100
          ? data.rolloutPercentage
          : 100,
      disableUpdates:
        typeof data.disableUpdates === "boolean" ? data.disableUpdates : false,
    };
  } catch {
    return { rolloutPercentage: 100, disableUpdates: false };
  }
}

export async function updateRolloutConfig(
  data: Partial<RolloutConfig>
): Promise<void> {
  const ref = doc(db, "app_config", "rollout");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, data);
  } else {
    await setDoc(ref, {
      rolloutPercentage: 100,
      disableUpdates: false,
      ...data,
    });
  }
}

// ---------------------------------------------------------------------------
// Feature Flags  (app_config/features)
// ---------------------------------------------------------------------------

export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const snap = await getDoc(doc(db, "app_config", "features"));
    if (!snap.exists()) return {};
    const data = snap.data();
    const flags: FeatureFlags = {};
    for (const [key, val] of Object.entries(data)) {
      if (typeof val === "boolean") flags[key] = val;
    }
    return flags;
  } catch {
    return {};
  }
}

export async function updateFeatureFlags(
  flags: FeatureFlags
): Promise<void> {
  const ref = doc(db, "app_config", "features");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, flags);
  } else {
    await setDoc(ref, flags);
  }
}
