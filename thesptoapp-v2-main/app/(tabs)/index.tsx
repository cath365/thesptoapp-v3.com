import { useAuth } from "@/hooks/useAuth";
import { useDailyTip } from "@/hooks/useDailyTip";
import { useLanguage } from "@/hooks/useLanguage";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { LANGUAGE_LABELS, type SupportedLanguage } from "@/data/daily_health_tips";
import { SpotColors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useResponsiveLayout } from "@/hooks/useResponsiveLayout";

export const INFORMATION_CATEGORIES = [
  {
    id: "menstrual-health",
    title: "Menstrual Health",
    description: "Understanding your cycle, hygiene tips & more",
    icon: "flower-outline",
    color: "#D98BA0",
    iconBg: "#F5D5DF",
    gradient: ["#F5D5DF", "#D98BA0"],
  },
  {
    id: "hiv-stis",
    title: "HIV & STI's",
    description: "Prevention, testing, treatment & living well",
    icon: "shield-half-outline",
    color: "#9B6DAE",
    iconBg: "#F6EFF9",
    gradient: ["#E6D1F2", "#9B6DAE"],
  },
  {
    id: "maternal-health",
    title: "Maternal Health",
    description: "Pregnancy care, safe delivery & postpartum",
    icon: "heart-circle-outline",
    color: "#C9A4D8",
    iconBg: "#F2E0EA",
    gradient: ["#F2E0EA", "#C9A4D8"],
  },
  {
    id: "safe-abortion",
    title: "T.O.P (Safe Abortion)",
    description: "Your rights, safe options & aftercare",
    icon: "medkit-outline",
    color: "#7BBFB5",
    iconBg: "#E5F3F0",
    gradient: ["#D5ECE8", "#7BBFB5"],
  },
  {
    id: "contraceptives",
    title: "Contraceptives",
    description: "Methods, effectiveness & how to choose",
    icon: "fitness-outline",
    color: "#A0C4E8",
    iconBg: "#EBF3FB",
    gradient: ["#DDE9F5", "#A0C4E8"],
  },
  {
    id: "srhr-laws",
    title: "SRHR Laws",
    description: "Know your rights in South Africa",
    icon: "book-outline",
    color: "#E0A88A",
    iconBg: "#FFF0E8",
    gradient: ["#FDDECF", "#E0A88A"],
  },
  {
    id: "fact-check",
    title: "Fact Check",
    description: "Myths vs facts about sexual health",
    icon: "checkmark-done-circle-outline",
    color: "#8CC792",
    iconBg: "#EDF6EE",
    gradient: ["#D8EDD9", "#8CC792"],
  },
  {
    id: "find-services",
    title: "Find Services",
    description: "Clinics, helplines & support near you",
    icon: "location-outline",
    color: "#9B8EC8",
    iconBg: "#EDEBF6",
    gradient: ["#DED9EE", "#9B8EC8"],
  },
  {
    id: "safety",
    title: "Safety",
    description: "GBV resources, safety plans & support",
    icon: "shield-checkmark-outline",
    color: "#E09090",
    iconBg: "#FBEAEA",
    gradient: ["#F5D5D5", "#E09090"],
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const dailyTip = useDailyTip();
  const { isConnected } = useNetworkStatus();
  const { isTablet, contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  const [showLangPicker, setShowLangPicker] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");

  const quickActions = [
    {
      id: "period-tracker",
      title: t('home.periodTracker'),
      subtitle: t('home.trackCycle'),
      icon: "calendar",
      color: SpotColors.rose,
      iconBg: SpotColors.softPink,
      gradient: [SpotColors.softPink, SpotColors.blush],
      onPress: () => {
        if (!user) {
          Alert.alert(
            t('home.signInRequired'),
            t('home.signInToAccess'),
            [
              { text: t('common.cancel'), style: "cancel" },
              {
                text: t('auth.signIn'),
                onPress: () => router.push("/(auth)/sign-in"),
              },
            ]
          );
          return;
        }
        router.push("/(tabs)/period-tracker");
      },
    },
    {
      id: "journal",
      title: t('home.journal'),
      subtitle: t('home.recordThoughts'),
      icon: "book",
      color: SpotColors.primary,
      iconBg: SpotColors.gradientLight,
      gradient: [SpotColors.gradientLight, SpotColors.gradientMid],
      onPress: () => router.push("/(tabs)/journal"),
    },
    {
      id: "information",
      title: t('home.information'),
      subtitle: t('home.healthInfo'),
      icon: "library",
      color: SpotColors.lavender,
      iconBg: SpotColors.gradientCard,
      gradient: [SpotColors.gradientCard, SpotColors.gradientLight],
      onPress: () => router.push("/information"),
    },
    {
      id: "profile",
      title: t('home.profile'),
      subtitle: t('home.yourAccount'),
      icon: "person",
      color: SpotColors.secondary,
      iconBg: SpotColors.gradientLight,
      gradient: [SpotColors.gradientLight, SpotColors.primaryLight],
      onPress: () => router.push("/(tabs)/profile"),
    },
  ];

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/information?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleViewAllInformation = () => {
    router.push("/information");
  };

  const handleInformationPress = (categoryId: string) => {
    router.push(`/information/${categoryId}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Clean Background */}
      <View style={styles.backgroundGradient} />

      <AnnouncementBanner />

      {!isConnected && (
        <View style={{
          backgroundColor: SpotColors.warningLight,
          paddingVertical: 8,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Ionicons name="cloud-offline" size={16} color={SpotColors.warningDark} />
          <Text style={{ fontSize: 13, color: SpotColors.warningDark, fontWeight: '500' }}>
            {t('home.offline')}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.userInfo}>
              <Text style={styles.greeting}>{t('home.greeting')}</Text>
              <Text style={styles.userName}>
                {user?.displayName?.split(" ")[0] ||
                  user?.email?.split("@")[0] ||
                  t('home.greetingGuest')}
              </Text>
            </View>
            <TouchableOpacity style={styles.avatarContainer} onPress={() => router.push("/(tabs)/profile")}>
              <LinearGradient
                colors={[SpotColors.blush, SpotColors.rose] as any}
                style={styles.avatarGradient}
              >
                {user?.photoURL ? (
                  <Image
                    source={{ uri: user.photoURL }}
                    style={styles.avatar}
                  />
                ) : (
                  <Image
                    source={require("@/assets/images/avatar.png")}
                    style={styles.avatar}
                  />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.tagline}>Your wellness journey starts here ✨</Text>
        </View>

        {/* Search Bar */}
        <TouchableOpacity style={styles.searchContainer} onPress={handleSearch}>
          <Ionicons name="search" size={20} color={SpotColors.primary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.search')}
            placeholderTextColor={SpotColors.peach}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </TouchableOpacity>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.quickActionCard}
                onPress={action.onPress}
                activeOpacity={0.85}
              >
                <View style={styles.quickActionIconWrapper}>
                  <View
                    style={[styles.quickActionIconBg, { backgroundColor: action.iconBg }]}
                  >
                    <Ionicons
                      name={action.icon as any}
                      size={32}
                      color={action.color}
                    />
                  </View>
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionSubtitle}>
                  {action.subtitle}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Featured</Text>
              <Text style={styles.sectionSubtitle}>Health Topics</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/information")}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
              <Ionicons name="arrow-forward" size={16} color={SpotColors.rose} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScrollContent}
            style={styles.featuredScroll}
          >
            {INFORMATION_CATEGORIES.slice(0, 3).map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.featuredCard}
                onPress={() =>
                  router.push({
                    pathname: "/information/[id]",
                    params: { id: cat.id },
                  })
                }
                activeOpacity={0.9}
              >
                <View style={styles.featuredCardInner}>
                  <View style={styles.featuredTopRow}>
                    <View style={[styles.featuredIconPill, { backgroundColor: cat.iconBg }]}>
                      <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                    </View>
                    <View style={[styles.featuredBadge, { backgroundColor: cat.iconBg }]}>
                      <Ionicons name="star" size={10} color={cat.color} />
                      <Text style={[styles.featuredBadgeText, { color: cat.color }]}>Featured</Text>
                    </View>
                  </View>
                  <View style={styles.featuredContent}>
                    <Text style={styles.featuredTitle}>{cat.title}</Text>
                    {cat.description && (
                      <Text style={styles.featuredDescription} numberOfLines={2}>
                        {cat.description}
                      </Text>
                    )}
                  </View>
                  <View style={styles.featuredFooter}>
                    <Text style={[styles.featuredReadMore, { color: cat.color }]}>Read more</Text>
                    <View style={[styles.featuredArrowBtn, { backgroundColor: cat.color }]}>
                      <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Additional Resources */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Additional Resources</Text>
              <Text style={styles.sectionSubtitle}>Explore More Topics</Text>
            </View>
            <TouchableOpacity
              onPress={handleViewAllInformation}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>{t('home.viewAll')}</Text>
              <Ionicons name="arrow-forward" size={16} color={SpotColors.rose} />
            </TouchableOpacity>
          </View>
          <View style={styles.infoGrid}>
            {INFORMATION_CATEGORIES.slice(3).map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={styles.infoCard}
                onPress={() => handleInformationPress(cat.id)}
                activeOpacity={0.9}
              >
                <View style={styles.infoCardInner}>
                  <View style={[styles.infoIconCircle, { backgroundColor: cat.iconBg }]}>
                    <Ionicons name={cat.icon as any} size={22} color={cat.color} />
                  </View>
                  <Text style={styles.infoTitle} numberOfLines={2}>{cat.title}</Text>
                  <View style={[styles.infoAccent, { backgroundColor: cat.color }]} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Health Tips */}
        <View style={styles.section}>
          <View style={styles.tipHeader}>
            <Text style={styles.sectionTitle}>Daily Tip</Text>
            <TouchableOpacity
              onPress={() => setShowLangPicker(true)}
              style={styles.langChip}
            >
              <Ionicons name="language" size={14} color={SpotColors.primary} />
              <Text style={styles.langChipText}>
                {LANGUAGE_LABELS[dailyTip.language]}
              </Text>
              <Ionicons name="chevron-down" size={14} color={SpotColors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.tipCard}>
            <LinearGradient
              colors={[SpotColors.border, SpotColors.surface] as any}
              style={styles.tipGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.tipIcon}>
              <LinearGradient
                colors={[SpotColors.blush, SpotColors.rose] as any}
                style={styles.tipIconGradient}
              >
                <Text style={{ fontSize: 24 }}>{dailyTip.emoji}</Text>
              </LinearGradient>
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>{dailyTip.title}</Text>
              <Text style={styles.tipText}>{dailyTip.body}</Text>
            </View>
          </View>
        </View>

        {/* Language Picker Modal */}
        <Modal
          visible={showLangPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLangPicker(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowLangPicker(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Choose Language</Text>
              <ScrollView style={styles.langList} showsVerticalScrollIndicator={false}>
                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map((code) => (
                  <TouchableOpacity
                    key={code}
                    style={[
                      styles.langOption,
                      dailyTip.language === code && styles.langOptionActive,
                    ]}
                    onPress={() => {
                      dailyTip.setLanguage(code);
                      setShowLangPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.langOptionText,
                        dailyTip.language === code && styles.langOptionTextActive,
                      ]}
                    >
                      {LANGUAGE_LABELS[code]}
                    </Text>
                    {dailyTip.language === code && (
                      <Ionicons name="checkmark-circle" size={20} color={SpotColors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
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
    backgroundColor: SpotColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    position: "relative",
    overflow: "hidden",
  },
  headerGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 0,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    zIndex: 1,
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    color: SpotColors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  userName: {
    fontSize: 32,
    fontWeight: "700",
    color: SpotColors.textPrimary,
    letterSpacing: -0.5,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  avatarGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  tagline: {
    fontSize: 16,
    color: SpotColors.textSecondary,
    fontWeight: "500",
    lineHeight: 22,
    zIndex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SpotColors.surface,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginHorizontal: 24,
    marginBottom: 32,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: SpotColors.textPrimary,
    fontWeight: "500",
    marginLeft: 12,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    paddingLeft: 0,
    paddingBottom: 8,
    color: SpotColors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    paddingLeft: 0,
    color: SpotColors.textSecondary,
    marginBottom: 0,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingTop: 4,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: "600",
    color: SpotColors.primary,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 16,
  },
  quickActionCard: {
    flexBasis: '46%',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 8,
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  quickActionIconWrapper: {
    marginBottom: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: SpotColors.textPrimary,
    marginTop: 4,
    marginBottom: 6,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: SpotColors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    letterSpacing: 0.1,
  },
  articlesScroll: {
    paddingLeft: 24,
    paddingRight: 16,
  },
  articleCard: {
    width: '70%',
    maxWidth: 300,
    height: 200,
    borderRadius: 24,
    marginRight: 16,
    overflow: "hidden",
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  firstArticleCard: {
    width: '80%',
    maxWidth: 340,
    height: 220,
  },
  articleImage: {
    width: "100%",
    height: "100%",
    backgroundColor: SpotColors.background,
  },
  articleGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "70%",
    justifyContent: "flex-end",
  },
  articleContent: {
    padding: 20,
  },
  articleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  articleCategory: {
    fontSize: 11,
    fontWeight: "700",
    color: SpotColors.surface,
    opacity: 0.8,
    letterSpacing: 1,
  },
  articleReadTime: {
    fontSize: 11,
    fontWeight: "600",
    color: SpotColors.surface,
    opacity: 0.8,
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: SpotColors.surface,
    lineHeight: 24,
  },
  articlesLoading: {
    alignItems: "center",
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: SpotColors.textSecondary,
    fontWeight: "500",
  },
  noArticlesContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  noArticlesText: {
    fontSize: 16,
    fontWeight: "600",
    color: SpotColors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
  },
  noArticlesSubtext: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    textAlign: "center",
  },
  tipCard: {
    flexDirection: "row",
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  tipGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
    pointerEvents: "none",
  },
  tipIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    zIndex: 1,
  },
  tipIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  tipContent: {
    flex: 1,
    zIndex: 1,
  },
  tipTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: SpotColors.textPrimary,
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    color: SpotColors.textSecondary,
    lineHeight: 20,
    fontWeight: "500",
  },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  langChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SpotColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: SpotColors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "80%",
    maxHeight: "60%",
    backgroundColor: SpotColors.surface,
    borderRadius: 24,
    padding: 24,
    borderTopWidth: 3,
    borderTopColor: SpotColors.lavender,
    shadowColor: SpotColors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 28,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: SpotColors.textPrimary,
    marginBottom: 16,
    textAlign: "center",
  },
  langList: {
    maxHeight: 340,
  },
  langOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  langOptionActive: {
    backgroundColor: SpotColors.gradientLight,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  langOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: SpotColors.textPrimary,
  },
  langOptionTextActive: {
    fontWeight: "700",
    color: SpotColors.primary,
  },
  bottomSpacing: {
    height: 24,
  },
  featuredScroll: {
    marginLeft: 24,
  },
  featuredScrollContent: {
    paddingRight: 24,
    gap: 16,
  },
  featuredCard: {
    width: 260,
    minWidth: 240,
    borderRadius: 24,
    marginRight: 0,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  featuredCardInner: {
    padding: 20,
    flex: 1,
    justifyContent: "space-between",
  },
  featuredTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  featuredIconPill: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  featuredContent: {
    marginBottom: 16,
  },
  featuredTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: SpotColors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  featuredDescription: {
    fontSize: 13,
    fontWeight: "500",
    color: SpotColors.textSecondary,
    lineHeight: 19,
  },
  featuredFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredReadMore: {
    fontSize: 14,
    fontWeight: "700",
  },
  featuredArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    rowGap: 14,
  },
  infoCard: {
    flexBasis: "30%",
    borderRadius: 20,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  infoCardInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  infoIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: SpotColors.textPrimary,
    textAlign: "center",
    lineHeight: 16,
    marginBottom: 8,
  },
  infoAccent: {
    width: 24,
    height: 3,
    borderRadius: 2,
    opacity: 0.5,
  },
});
