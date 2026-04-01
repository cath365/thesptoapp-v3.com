import SignInRequired from "@/components/SignInRequired";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { SpotColors } from "@/constants/Colors";
import { useFirestoreCollection } from "@/hooks/useFirestore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function JournalScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [newEntry, setNewEntry] = useState("");
  const [search, setSearch] = useState("");
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Firestore integration - use user-specific collection
  const {
    data: entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
  } = useFirestoreCollection(
    user ? `users/${user.uid}/journal` : null,
    undefined,
    search
  );

  // Filter by selected date if calendar is used
  const filteredEntries = useMemo(() => {
    if (!entries) return entries || [];
    return entries;
  }, [entries]);

  // Limit displayed entries to 50
  const limitedEntries = filteredEntries.slice(0, 50);

  if (!user) {
    return (
      <SignInRequired
        icon="book"
        message="Sign in to access your personal journal and keep your thoughts private and secure."
      />
    );
  }

  function formatDate(date: Date) {
    return date.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      // year and second intentionally omitted
    });
  }

  function timeAgo(date: Date) {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return `Just now`;
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  }

  const handleAddEntry = async () => {
    if (!newEntry.trim() || !user) return;
    setIsAdding(true);
    try {
      await addEntry({
        notes: newEntry.trim(),
      });
    } catch {
      // Error is surfaced through the useFirestoreCollection error state
    }
    setNewEntry("");
    setIsAdding(false);
  };

  const handleDeleteEntry = async (id: string) => {
    Alert.alert(
      t('journal.deleteTitle'),
      t('journal.deleteMessage'),
      [
        { text: t('common.cancel'), style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteEntry(id);
            } catch {
              Alert.alert('Error', 'Could not delete entry. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditEntry = (id: string, currentText: string) => {
    setEditingId(id);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingText.trim()) return;
    setIsUpdating(true);
    try {
      await updateEntry(id, { notes: editingText.trim() });
      setEditingId(null);
      setEditingText("");
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[SpotColors.gradientLight, SpotColors.gradientMid, SpotColors.surface] as any}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      {/* Header */}
      <LinearGradient
        colors={[SpotColors.primary, SpotColors.primaryLight, SpotColors.background] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.journalTitle}>{t('journal.title')}</Text>
        <Text style={styles.journalSubtitle}>{t('journal.subtitle')} ✨</Text>
      </LinearGradient>

      {/* New Entry Input */}
      <View style={styles.newEntryCard}>
        <LinearGradient
          colors={[SpotColors.surface, SpotColors.gradientLight] as any}
          style={styles.newEntryCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <TextInput
          style={styles.textInput}
          placeholder={t('journal.newEntryPlaceholder')}
          placeholderTextColor={SpotColors.peach}
          value={newEntry}
          onChangeText={setNewEntry}
          multiline
          textAlignVertical="top"
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddEntry}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator color={SpotColors.rose} />
          ) : (
            <LinearGradient
              colors={[SpotColors.blush, SpotColors.rose] as any}
              style={styles.addButtonGradient}
            >
              <Ionicons name="add-circle" size={32} color={SpotColors.textOnPrimary} />
            </LinearGradient>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.searchBarGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Ionicons
            name="search"
            size={20}
            color={SpotColors.rose}
            style={{ marginRight: 8, zIndex: 1 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search entries..."
            placeholderTextColor={SpotColors.peach}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Entries List */}
      <View style={styles.entriesCard}>
        {error && (
          <View style={styles.errorState}>
            <Text style={styles.errorText}>Error: {error}</Text>
          </View>
        )}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              color={SpotColors.rose}
              size="large"
            />
            <Text style={styles.loadingText}>Loading your journal...</Text>
          </View>
        ) : limitedEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <LinearGradient
                colors={[SpotColors.blush, SpotColors.rose] as any}
                style={styles.emptyStateIconGradient}
              >
                <Ionicons
                  name="book-outline"
                  size={40}
                  color={SpotColors.textOnPrimary}
                />
              </LinearGradient>
            </View>
            <Text style={styles.emptyText}>No entries found</Text>
            <Text style={styles.emptySubtext}>
              Start writing your first journal entry!
            </Text>
          </View>
        ) : (
          <FlatList
            data={limitedEntries}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const ts = item.timestamp;
              const date = ts?.seconds
                ? new Date(ts.seconds * 1000)
                : ts instanceof Date
                  ? ts
                  : new Date(ts || Date.now());
              const isValidDate = !isNaN(date.getTime());
              const isLong = (item.notes?.length || 0) > 120;
              const isExpanded = expandedEntries.has(item.id);
              const isEditing = editingId === item.id;
              return (
                <View style={styles.entryCardModern}>
                  <LinearGradient
                    colors={[SpotColors.surface, SpotColors.gradientLight] as any}
                    style={styles.entryCardGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                  <View style={styles.entryHeaderModern}>
                    <View style={styles.entryDateTimeBox}>
                      <Text style={styles.entryDateModern}>
                        {isValidDate ? formatDate(date) : "Unknown date"}
                      </Text>
                      <Text style={styles.entryAgoModern}>{isValidDate ? timeAgo(date) : ""}</Text>
                    </View>
                    <View style={styles.entryActionsBox}>
                      <TouchableOpacity
                        onPress={() => handleDeleteEntry(item.id)}
                        style={styles.actionButton}
                      >
                        <Ionicons
                          name="trash"
                          size={20}
                          color={SpotColors.rose}
                        />
                      </TouchableOpacity>
                      {!isEditing && (
                        <TouchableOpacity
                          onPress={() =>
                            handleEditEntry(item.id, item.notes || "")
                          }
                          style={[styles.editButton, styles.actionButton]}
                        >
                          <Ionicons
                            name="pencil"
                            size={20}
                            color={SpotColors.rose}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={styles.editInput}
                        value={editingText}
                        onChangeText={setEditingText}
                        multiline
                        textAlignVertical="top"
                        editable={!isUpdating}
                      />
                      <View style={[styles.editActions, { zIndex: 1 }]}>
                        <TouchableOpacity
                          style={[
                            styles.saveButton,
                            isUpdating && { opacity: 0.6 },
                          ]}
                          onPress={() => handleSaveEdit(item.id)}
                          disabled={isUpdating}
                        >
                          {isUpdating ? (
                            <ActivityIndicator color={SpotColors.surface} />
                          ) : (
                            <Text style={styles.saveButtonText}>Save</Text>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          <Text style={styles.cancelButtonText}>cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text
                        style={styles.entryNotesModern}
                        numberOfLines={isLong && !isExpanded ? 4 : undefined}
                      >
                        {item.notes}
                      </Text>
                      {isLong && (
                        <TouchableOpacity
                          onPress={() => {
                            setExpandedEntries((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            });
                          }}
                          style={styles.readMoreButton}
                        >
                          <Text style={styles.readMoreText}>
                            {isExpanded ? "Show less" : "Read more"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            }}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotColors.background,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  newEntryCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 24,
    margin: 16,
    padding: 16,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  newEntryCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 24,
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: SpotColors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: SpotColors.deepPink,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    zIndex: 1,
  },
  addButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 1,
  },
  addButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginRight: 8,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  searchBarGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: SpotColors.deepPink,
    fontWeight: '500',
    zIndex: 1,
  },
  entriesCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 24,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  loadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: SpotColors.rose,
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyStateIcon: {
    marginBottom: 20,
  },
  emptyStateIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  emptyText: {
    fontSize: 20,
    color: SpotColors.deepPink,
    marginBottom: 8,
    fontWeight: "700",
  },
  emptySubtext: {
    fontSize: 15,
    color: SpotColors.rose,
    textAlign: "center",
    fontWeight: "500",
  },
  editButton: {
    marginLeft: 8,
  },
  editInput: {
    minHeight: 80,
    maxHeight: 150,
    borderRadius: 16,
    backgroundColor: SpotColors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: SpotColors.deepPink,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    textAlignVertical: 'top',
    zIndex: 1,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  saveButton: {
    backgroundColor: SpotColors.rose,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginRight: 8,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: SpotColors.surface,
    fontWeight: "700",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: SpotColors.background,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  cancelButtonText: {
    color: SpotColors.rose,
    fontWeight: "600",
    fontSize: 16,
  },
  readMoreButton: {
    marginTop: 8,
    zIndex: 1,
  },
  readMoreText: {
    color: SpotColors.rose,
    fontWeight: "600",
    fontSize: 14,
  },
  headerGradient: {
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: "center",
    marginBottom: 8,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  journalTitle: {
    color: SpotColors.surface,
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  journalSubtitle: {
    color: SpotColors.surface,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 0,
    letterSpacing: 0.2,
    opacity: 0.95,
  },
  entryCardModern: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  entryCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 24,
  },
  entryHeaderModern: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    zIndex: 1,
  },
  entryDateTimeBox: {
    flex: 1,
    flexDirection: "column",
    alignItems: "flex-start",
  },
  entryDateModern: {
    fontSize: 15,
    fontWeight: "700",
    color: SpotColors.primary,
    marginBottom: 4,
  },
  entryAgoModern: {
    fontSize: 13,
    color: SpotColors.primary,
    fontStyle: "italic",
    fontWeight: "500",
  },
  actionButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: SpotColors.background,
  },
  entryActionsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  entryNotesModern: {
    fontSize: 16,
    color: SpotColors.primary,
    lineHeight: 24,
    marginTop: 4,
    fontWeight: "400",
    zIndex: 1,
  },
  errorState: {
    backgroundColor: SpotColors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  errorText: {
    color: SpotColors.primary,
    fontSize: 15,
    fontWeight: "600",
  },
});
