import { SpotColors } from '@/constants/Colors';
import { useBookmarks, BookmarkEntry } from '@/hooks/useBookmarks';
import { useReadingHistory, ReadingHistoryEntry } from '@/hooks/useReadingHistory';
import { useLanguage } from '@/hooks/useLanguage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

type Tab = 'bookmarks' | 'history';

export default function BookmarksScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>('bookmarks');
  const { bookmarks, loading: bookmarksLoading } = useBookmarks();
  const { history, loading: historyLoading } = useReadingHistory();
  const { contentMaxWidth } = useResponsiveLayout();
  const emptyFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    emptyFadeAnim.setValue(0);
    Animated.timing(emptyFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [activeTab, bookmarks.length, history.length, emptyFadeAnim]);

  const navigateToArticle = (articleId: string) => {
    router.push(`/information/article/${articleId}` as any);
  };

  const renderBookmarkItem = ({ item }: { item: BookmarkEntry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateToArticle(item.articleId)}
      activeOpacity={0.7}
    >
      {item.featuredImage ? (
        <Image source={{ uri: item.featuredImage }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="document-text" size={24} color={SpotColors.textSecondary} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title || 'Saved Article'}
        </Text>
        {item.category && (
          <Text style={styles.cardCategory}>{item.category}</Text>
        )}
        <Text style={styles.cardMeta}>
          Saved {new Date(item.savedAt).toLocaleDateString()}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={SpotColors.textSecondary} />
    </TouchableOpacity>
  );

  const renderHistoryItem = ({ item }: { item: ReadingHistoryEntry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigateToArticle(item.articleId)}
      activeOpacity={0.7}
    >
      {item.featuredImage ? (
        <Image source={{ uri: item.featuredImage }} style={styles.cardImage} />
      ) : (
        <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
          <Ionicons name="time" size={24} color={SpotColors.textSecondary} />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title || 'Article'}
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${Math.round((item.progress ?? 0) * 100)}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{Math.round((item.progress ?? 0) * 100)}%</Text>
        </View>
        <Text style={styles.cardMeta}>
          {new Date(item.readAt).toLocaleDateString()} · {Math.round((item.readDurationSeconds ?? 0) / 60)}min read
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = (message: string, icon: string) => {
    return (
      <Animated.View style={[styles.emptyContainer, { opacity: emptyFadeAnim }]}> 
        <LinearGradient
          colors={[SpotColors.primaryLight, SpotColors.lavender] as any}
          style={styles.emptyIconCircle}
        >
          <Ionicons name={icon as any} size={40} color={SpotColors.surface} />
        </LinearGradient>
        <Text style={styles.emptyTitle}>{message}</Text>
        <Text style={styles.emptySubtitle}>
          {activeTab === 'bookmarks'
            ? t('library.bookmarkHint')
            : t('library.historyHint')}
        </Text>
      </Animated.View>
    );
  };

  const loading = activeTab === 'bookmarks' ? bookmarksLoading : historyLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('library.title')}</Text>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookmarks' && styles.tabActive]}
          onPress={() => setActiveTab('bookmarks')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'bookmarks' }}
        >
          <Ionicons
            name="bookmark"
            size={16}
            color={activeTab === 'bookmarks' ? SpotColors.primary : SpotColors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'bookmarks' && styles.tabTextActive]}>
            {t('library.saved')} ({bookmarks.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
        >
          <Ionicons
            name="time"
            size={16}
            color={activeTab === 'history' ? SpotColors.primary : SpotColors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            {t('library.history')} ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>{t('common.loading')}</Text>
        </View>
      ) : activeTab === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          renderEmpty(t('library.noBookmarks'), 'bookmark-outline')
        ) : (
          <FlatList
            data={bookmarks}
            keyExtractor={(item) => item.articleId}
            renderItem={renderBookmarkItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : history.length === 0 ? (
        renderEmpty(t('library.noHistory'), 'time-outline')
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item, i) => `${item.articleId}-${i}`}
          renderItem={renderHistoryItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotColors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: SpotColors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: SpotColors.surface,
    padding: 4,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: SpotColors.gradientLight,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: SpotColors.textSecondary,
  },
  tabTextActive: {
    color: SpotColors.primary,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SpotColors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  cardImagePlaceholder: {
    backgroundColor: SpotColors.gradientLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SpotColors.textPrimary,
    lineHeight: 19,
  },
  cardCategory: {
    fontSize: 11,
    fontWeight: '500',
    color: SpotColors.primary,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  cardMeta: {
    fontSize: 11,
    color: SpotColors.textSecondary,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: SpotColors.border,
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: SpotColors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: SpotColors.primary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SpotColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
