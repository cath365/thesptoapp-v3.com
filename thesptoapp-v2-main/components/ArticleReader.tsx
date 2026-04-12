import { SpotColors } from '@/constants/Colors';
import { Article, ArticleSection } from '@/types/Article';
import { useBookmarks } from '@/hooks/useBookmarks';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import { useAuth } from '@/hooks/useAuth';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { trackArticleView, trackReadTime } from '@/lib/analytics';

interface ArticleReaderProps {
  article: Article;
}

export default function ArticleReader({ article: rawArticle }: ArticleReaderProps) {
  // Guard against missing/incomplete data from Firestore
  // Some older articles use a flat "content" markdown string instead of structured "sections"
  const rawSections = rawArticle.sections ?? [];
  const sections: ArticleSection[] = rawSections.length > 0
    ? rawSections
    : (rawArticle as any).content
      ? [{ id: 'main', title: rawArticle.title || 'Article', content: (rawArticle as any).content, order: 0 }]
      : [];

  const article = {
    ...rawArticle,
    sections,
    sources: rawArticle.sources ?? [],
    tags: rawArticle.tags ?? [],
    category: rawArticle.category || 'general',
    difficulty: rawArticle.difficulty || 'beginner',
    estimatedReadTime: rawArticle.estimatedReadTime || 5,
    summary: rawArticle.summary || '',
    featuredImage: rawArticle.featuredImage || '',
  };

  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<{ [key: string]: number }>({});
  const [currentSection, setCurrentSection] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showTableOfContents, setShowTableOfContents] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Use the unified bookmark system (Firestore for auth users, AsyncStorage for guests)
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const saved = isBookmarked(article.id);

  // Reading history
  const { recordReading } = useReadingHistory();
  const { user } = useAuth();

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: readingProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progressAnim, readingProgress]);

  // Track article view
  useEffect(() => {
    trackArticleView(article.id, user?.uid);
  }, [article.id, user?.uid]);

  // Track reading time and record reading history on unmount
  const readStartRef = useRef(Date.now());
  const progressRef = useRef(0);
  useEffect(() => {
    readStartRef.current = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - readStartRef.current) / 1000);
      if (seconds > 5) {
        trackReadTime(article.id, seconds, user?.uid);
        recordReading(article.id, seconds, progressRef.current, {
          title: article.title,
          category: article.category,
          featuredImage: article.featuredImage,
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${article.title}\n\n${article.summary}\n\nRead more on The Spot App`,
        title: article.title,
      });
    } catch {
      Alert.alert('Error', 'Could not share the article.');
    }
  };

  const handleSave = async () => {
    try {
      await toggleBookmark(article.id, {
        title: article.title,
        summary: article.summary,
        category: article.category,
        featuredImage: article.featuredImage,
        estimatedReadTime: article.estimatedReadTime,
      });
    } catch { /* ignore */ }
  };

  const handleReadAloud = () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      const fullContent = `${article.title}. ${article.summary}. ${article.sections
        .map(section => `${section.title}. ${section.content}`)
        .join(' ')}`;
      
      Speech.speak(fullContent, {
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        rate: 0.8,
      });
    }
  };

  const jumpToSection = (sectionIndex: number) => {
    const sectionId = article.sections[sectionIndex]?.id;
    if (sectionId && sectionRefs.current[sectionId] !== undefined) {
      setCurrentSection(sectionIndex);
      setShowTableOfContents(false);
      
      scrollViewRef.current?.scrollTo({
        y: sectionRefs.current[sectionId],
        animated: true,
      });
    }
  };

  const handleSectionLayout = (sectionId: string, event: any) => {
    const { y } = event.nativeEvent.layout;
    sectionRefs.current[sectionId] = y - 100; // Offset for header
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const progress = contentOffset.y / (contentSize.height - layoutMeasurement.height);
    const clampedProgress = Math.max(0, Math.min(1, progress));
    setReadingProgress(clampedProgress);
    progressRef.current = clampedProgress;

    // Update current section based on scroll position
    const scrollY = contentOffset.y + 150; // Offset for better section detection
    let newCurrentSection = 0;
    
    article.sections.forEach((section, index) => {
      if (sectionRefs.current[section.id] !== undefined && scrollY >= sectionRefs.current[section.id]) {
        newCurrentSection = index;
      }
    });
    
    setCurrentSection(newCurrentSection);
  };

  const formatReadTime = (minutes: number) => {
    if (minutes < 1) return 'Less than 1 min read';
    return `${minutes} min read`;
  };

  const renderSection = (section: ArticleSection, index: number) => (
    <View 
      key={section.id} 
      style={styles.sectionContainer}
      onLayout={(event) => handleSectionLayout(section.id, event)}
    >
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionContent}>{section.content}</Text>
      
      {section.subsections && section.subsections.map((subsection, subIndex) => (
        <View key={subsection.id} style={styles.subsectionContainer}>
          <Text style={styles.subsectionTitle}>{subsection.title}</Text>
          <Text style={styles.subsectionContent}>{subsection.content}</Text>
        </View>
      ))}
    </View>
  );

  const TableOfContents = () => (
    <View style={styles.tocContainer}>
      <Text style={styles.tocTitle}>Table of Contents</Text>
      <ScrollView style={styles.tocScrollView} showsVerticalScrollIndicator={false}>
        {article.sections.map((section, index) => (
          <TouchableOpacity
            key={section.id}
            style={[styles.tocItem, currentSection === index && styles.tocItemActive]}
            onPress={() => jumpToSection(index)}
          >
            <View style={styles.tocItemContent}>
              <Text style={[styles.tocItemNumber, currentSection === index && styles.tocItemNumberActive]}>
                {index + 1}
              </Text>
              <Text style={[styles.tocItemText, currentSection === index && styles.tocItemTextActive]}>
                {section.title}
              </Text>
            </View>
            {currentSection === index && (
              <Ionicons name="chevron-forward" size={16} color={SpotColors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={SpotColors.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerProgress}>
            Section {currentSection + 1} of {article.sections.length}
          </Text>
        </View>
        <TouchableOpacity 
          onPress={() => setShowTableOfContents(!showTableOfContents)}
          style={[styles.tocButton, showTableOfContents && styles.tocButtonActive]}
        >
          <Ionicons name="list" size={24} color={showTableOfContents ? SpotColors.surface : SpotColors.primary} />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Animated.View 
          style={[
            styles.progressBar, 
            { width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
              extrapolate: 'clamp'
            })}
          ]} 
        />
      </View>

      {/* Table of Contents Overlay */}
      {showTableOfContents && (
        <View style={styles.tocOverlay}>
          <TouchableOpacity 
            style={styles.tocBackdrop} 
            onPress={() => setShowTableOfContents(false)}
          />
          <TableOfContents />
        </View>
      )}

      {/* Main Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Article Header */}
        <View style={styles.articleHeader}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{article.category.replace('-', ' ').toUpperCase()}</Text>
          </View>
          <Text style={styles.articleTitle}>{article.title}</Text>
          <Text style={styles.articleSummary}>{article.summary}</Text>
          
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{formatReadTime(article.estimatedReadTime)}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>{article.difficulty}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>
              {new Date(article.publishedDate).toLocaleDateString()}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={SpotColors.surface} />
              <Text style={styles.actionButtonText}>Share</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Ionicons 
                name={saved ? "bookmark" : "bookmark-outline"} 
                size={20} 
                color={SpotColors.surface} 
              />
              <Text style={styles.actionButtonText}>
                {saved ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleReadAloud}>
              <Ionicons 
                name={isSpeaking ? "stop" : "volume-high-outline"} 
                size={20} 
                color={SpotColors.surface} 
              />
              <Text style={styles.actionButtonText}>
                {isSpeaking ? 'Stop' : 'Listen'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Article Sections */}
        <View style={styles.contentContainer}>
          {article.sections
            .sort((a, b) => a.order - b.order)
            .map((section, index) => renderSection(section, index))}
        </View>

        {/* Footer with Sources */}
        {article.sources && article.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesTitle}>Additional Resources</Text>
            {article.sources.map((source, index) => (
              <TouchableOpacity
                key={index}
                style={styles.sourceItem}
                onPress={() => {
                  if (source.startsWith('http')) {
                    Linking.openURL(source).catch(() => {});
                  }
                }}
              >
                <Ionicons name="link-outline" size={16} color={SpotColors.secondary} />
                <Text style={styles.sourceText}>
                  {source}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Stay informed with The Spot - Your trusted source for reproductive health information
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: SpotColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: SpotColors.border,
  },
  backButton: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerProgress: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    fontWeight: '500',
  },
  tocButton: {
    padding: 8,
    borderRadius: 8,
  },
  tocButtonActive: {
    backgroundColor: SpotColors.primary,
  },
  progressContainer: {
    height: 3,
    backgroundColor: SpotColors.border,
  },
  progressBar: {
    height: '100%',
    backgroundColor: SpotColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  articleHeader: {
    backgroundColor: SpotColors.surface,
    padding: 20,
    marginBottom: 8,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: SpotColors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: SpotColors.primary,
    letterSpacing: 0.5,
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SpotColors.primary,
    lineHeight: 32,
    marginBottom: 12,
  },
  articleSummary: {
    fontSize: 16,
    color: SpotColors.textSecondary,
    lineHeight: 24,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  metaText: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    marginHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SpotColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  actionButtonText: {
    color: SpotColors.surface,
    fontWeight: '600',
    fontSize: 14,
  },
  contentContainer: {
    backgroundColor: SpotColors.surface,
    marginHorizontal: 8,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: SpotColors.primary,
    marginBottom: 12,
    lineHeight: 28,
  },
  sectionContent: {
    fontSize: 16,
    color: SpotColors.textPrimary,
    lineHeight: 24,
    marginBottom: 16,
  },
  subsectionContainer: {
    marginLeft: 16,
    marginTop: 16,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: SpotColors.primary + '20',
  },
  subsectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SpotColors.primary,
    marginBottom: 8,
    lineHeight: 24,
  },
  subsectionContent: {
    fontSize: 15,
    color: SpotColors.textPrimary,
    lineHeight: 22,
  },
  sourcesContainer: {
    backgroundColor: SpotColors.surface,
    marginHorizontal: 8,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sourcesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SpotColors.primary,
    marginBottom: 12,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  sourceText: {
    fontSize: 14,
    color: SpotColors.secondary,
    textDecorationLine: 'underline',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tocOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  tocBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  tocContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    left: 16,
    backgroundColor: SpotColors.surface,
    borderRadius: 16,
    padding: 20,
    maxHeight: '70%',
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  tocScrollView: {
    maxHeight: 400,
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SpotColors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  tocItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  tocItemActive: {
    backgroundColor: SpotColors.primary + '10',
  },
  tocItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  tocItemNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: SpotColors.textSecondary,
    marginRight: 12,
    minWidth: 24,
  },
  tocItemNumberActive: {
    color: SpotColors.primary,
  },
  tocItemText: {
    fontSize: 14,
    color: SpotColors.textPrimary,
    lineHeight: 20,
    flex: 1,
  },
  tocItemTextActive: {
    color: SpotColors.primary,
    fontWeight: '600',
  },
}); 