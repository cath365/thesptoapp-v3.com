import { SpotColors } from "@/constants/Colors";
import { useArticles } from "@/hooks/useArticles";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { INFORMATION_CATEGORIES } from "../(tabs)/index";

// Map legacy category names (already in Firestore) to INFORMATION_CATEGORIES IDs
const CATEGORY_ALIASES: Record<string, string> = {
  'reproductive-health': 'menstrual-health',
  'sexual-health': 'hiv-stis',
  'srhr': 'srhr-laws',
  'maternal health': 'maternal-health',
};

function matchesCategory(articleCategory: string, categoryId: string): boolean {
  if (!articleCategory || !categoryId) return false;
  const artCat = articleCategory.toLowerCase();
  const catId = categoryId.toLowerCase();
  if (artCat === catId) return true;
  // Check if the article's category is a known alias for this category
  const aliasTarget = CATEGORY_ALIASES[artCat];
  return aliasTarget === catId;
}

export default function InformationCategoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { articles, loading, error } = useArticles();

  // Filter articles by category (supports legacy category names)
  const categoryArticles = articles.filter(
    (article) => matchesCategory(article.category, id || '')
  );

  // Get category info
  const category = INFORMATION_CATEGORIES.find((cat) => cat.id === id);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[SpotColors.background, SpotColors.background, SpotColors.surface] as any}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.header}>
          <LinearGradient
            colors={[SpotColors.border, SpotColors.background, "transparent"] as any}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <LinearGradient
                colors={[SpotColors.primary, SpotColors.primaryLight] as any}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={20} color={SpotColors.surface} />
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {category?.title || "Category"}
              </Text>
              <Text style={styles.headerSubtitle}>Loading articles ✨</Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={[SpotColors.primary, SpotColors.primaryLight] as any}
            style={styles.loadingIconGradient}
          >
            <MaterialIcons name="auto-stories" size={40} color={SpotColors.surface} />
          </LinearGradient>
          <ActivityIndicator size="large" color={SpotColors.primary} style={{ marginTop: 20 }} />
          <Text style={styles.loadingText}>
            Loading {category?.title} information...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[SpotColors.background, SpotColors.background, SpotColors.surface] as any}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.header}>
          <LinearGradient
            colors={[SpotColors.border, SpotColors.background, "transparent"] as any}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <LinearGradient
                colors={[SpotColors.primary, SpotColors.primaryLight] as any}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={20} color={SpotColors.surface} />
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {category?.title || "Category"}
              </Text>
              <Text style={styles.headerSubtitle}>Oops! Something went wrong</Text>
            </View>
          </View>
        </View>
        <View style={styles.errorContainer}>
          <LinearGradient
            colors={[SpotColors.primary, SpotColors.primaryLight] as any}
            style={styles.errorIconGradient}
          >
            <Ionicons name="alert-circle" size={40} color={SpotColors.surface} />
          </LinearGradient>
          <Text style={styles.errorTitle}>Unable to Load Articles</Text>
          <Text style={styles.errorText}>
            Please check your internet connection and try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (categoryArticles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={[SpotColors.background, SpotColors.background, SpotColors.surface] as any}
          style={styles.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.header}>
          <LinearGradient
            colors={[SpotColors.border, SpotColors.background, "transparent"] as any}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <LinearGradient
                colors={[SpotColors.primary, SpotColors.primaryLight] as any}
                style={styles.backButtonGradient}
              >
                <Ionicons name="arrow-back" size={20} color={SpotColors.surface} />
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>
                {category?.title || "Category"}
              </Text>
              <Text style={styles.headerSubtitle}>Coming soon ✨</Text>
            </View>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <LinearGradient
            colors={[SpotColors.primary, SpotColors.primaryLight] as any}
            style={styles.emptyIconGradient}
          >
            <MaterialIcons name="auto-stories" size={48} color={SpotColors.surface} />
          </LinearGradient>
          <Text style={styles.emptyText}>
            {category?.title} information is coming soon
          </Text>
          <Text style={styles.emptySubtext}>
            Check back in a few days for helpful content!
          </Text>
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={() => router.back()}
          >
            <LinearGradient
              colors={[SpotColors.primary, SpotColors.primaryLight] as any}
              style={styles.goBackButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.goBackButtonText}>Go Back</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const renderArticle = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.articleCard}
      onPress={() => router.push(`/information/article/${item.id}`)}
      activeOpacity={0.9}
    >
      {/* Background Gradient */}
      <LinearGradient
        colors={[SpotColors.surface, SpotColors.background, SpotColors.border] as any}
        style={styles.articleCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {/* Decorative Corner Element */}
      <View style={styles.decorativeCorner}>
        <LinearGradient
          colors={[SpotColors.primary, SpotColors.primaryLight] as any}
          style={styles.decorativeCornerGradient}
        >
          <MaterialIcons name="favorite" size={16} color={SpotColors.surface} style={{ opacity: 0.6 }} />
        </LinearGradient>
      </View>

      {/* Image Container with Decorative Border */}
      <View style={styles.articleImageWrapper}>
        <LinearGradient
          colors={[SpotColors.primary, SpotColors.primaryLight, SpotColors.background] as any}
          style={styles.imageBorderGradient}
        >
          <View style={styles.articleImageContainer}>
            <Image
              source={{ uri: item.featuredImage }}
              style={styles.articleImage}
              defaultSource={require("@/assets/images/avatar.png")}
            />
            <LinearGradient
              colors={["transparent", "rgba(255, 155, 181, 0.15)"]}
              style={styles.articleImageOverlay}
            />
          </View>
        </LinearGradient>
      </View>

      {/* Content Section */}
      <View style={styles.articleContent}>
        <View style={styles.titleRow}>
          <Text style={styles.articleTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.readIconContainer}>
            <LinearGradient
              colors={[SpotColors.primary, SpotColors.primaryLight] as any}
              style={styles.readIconGradient}
            >
              <MaterialIcons name="auto-stories" size={14} color={SpotColors.surface} />
            </LinearGradient>
          </View>
        </View>
        <Text style={styles.articleSummary} numberOfLines={2}>{item.summary}</Text>
        
        {/* Meta Badges and Chevron Row */}
        <View style={styles.bottomRow}>
          <View style={styles.metaRow}>
            <LinearGradient
              colors={[SpotColors.border, SpotColors.background] as any}
              style={styles.metaBadge}
            >
              <Ionicons name="time-outline" size={14} color={SpotColors.primary} />
              <Text style={styles.metaText}>{item.estimatedReadTime} min</Text>
            </LinearGradient>
            <LinearGradient
              colors={[SpotColors.primaryLight, SpotColors.background] as any}
              style={styles.metaBadge}
            >
              <MaterialIcons name="star" size={14} color={SpotColors.primary} />
              <Text style={[styles.metaText, styles.metaTextPurple]}>{item.difficulty}</Text>
            </LinearGradient>
          </View>
          
          {/* Chevron Button */}
          <View style={styles.chevronContainer}>
            <LinearGradient
              colors={[SpotColors.primary, SpotColors.primaryLight] as any}
              style={styles.chevronGradient}
            >
              <Ionicons name="chevron-forward" size={20} color={SpotColors.surface} />
            </LinearGradient>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[SpotColors.background, SpotColors.background, SpotColors.surface] as any}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.header}>
        <LinearGradient
          colors={[SpotColors.border, SpotColors.background, "transparent"] as any}
          style={styles.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <LinearGradient
              colors={[SpotColors.primary, SpotColors.primaryLight] as any}
              style={styles.backButtonGradient}
            >
              <Ionicons name="arrow-back" size={20} color={SpotColors.surface} />
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{category?.title || "Category"}</Text>
            <Text style={styles.headerSubtitle}>
              {categoryArticles.length} article{categoryArticles.length !== 1 ? 's' : ''} available ✨
            </Text>
          </View>
        </View>
        {/* Decorative element */}
        <View style={styles.decorativeElement}>
          <LinearGradient
            colors={[SpotColors.primary, SpotColors.primaryLight, SpotColors.background] as any}
            style={styles.decorativeCircle}
          >
            <MaterialIcons name="local-florist" size={30} color={SpotColors.surface} style={{ opacity: 0.4 }} />
          </LinearGradient>
        </View>
      </View>
      <FlatList
        data={categoryArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderArticle}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SpotColors.background,
  },
  backgroundGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 24,
    position: "relative",
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 1,
  },
  backButton: {
    marginRight: 12,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  backButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: SpotColors.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: SpotColors.primary,
    fontWeight: "500",
  },
  decorativeElement: {
    position: "absolute",
    right: -20,
    top: -10,
    width: 120,
    height: 120,
    opacity: 0.3,
    zIndex: 0,
  },
  decorativeCircle: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 16,
    color: SpotColors.primary,
    fontWeight: "500",
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: SpotColors.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: SpotColors.primary,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "700",
    color: SpotColors.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 15,
    color: SpotColors.primary,
    textAlign: "center",
    marginBottom: 32,
    fontWeight: "500",
    lineHeight: 22,
  },
  goBackButton: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  goBackButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  goBackButtonText: {
    color: SpotColors.surface,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  listContainer: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  articleCard: {
    flexDirection: "column",
    borderRadius: 28,
    marginHorizontal: 16,
    marginVertical: 10,
    padding: 18,
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    position: "relative",
    overflow: "hidden",
  },
  articleCardGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  decorativeCorner: {
    position: "absolute",
    top: -8,
    right: -8,
    zIndex: 2,
  },
  decorativeCornerGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  articleImageWrapper: {
    marginBottom: 16,
    alignSelf: "center",
    zIndex: 1,
  },
  imageBorderGradient: {
    width: 120,
    height: 120,
    borderRadius: 24,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  articleImageContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    overflow: "hidden",
    position: "relative",
    backgroundColor: SpotColors.background,
  },
  articleImage: {
    width: "100%",
    height: "100%",
  },
  articleImageOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  articleContent: {
    width: "100%",
    zIndex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  articleTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: SpotColors.primary,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  readIconContainer: {
    marginTop: 2,
  },
  readIconGradient: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  },
  articleSummary: {
    fontSize: 14,
    color: SpotColors.primary,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: "500",
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    flex: 1,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: SpotColors.border,
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 1,
  },
  metaText: {
    fontSize: 12,
    color: SpotColors.primary,
    fontWeight: "600",
  },
  metaTextPurple: {
    color: SpotColors.primary,
  },
  chevronContainer: {
    zIndex: 1,
    marginLeft: 8,
  },
  chevronGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
});
