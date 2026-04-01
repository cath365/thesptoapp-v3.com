import SignInRequired from "@/components/SignInRequired";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { SpotColors } from "@/constants/Colors";
import { deleteAccount, logOut, updateDisplayName, changePassword } from "@/lib/auth";
import { db } from "@/lib/firebase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { syncLocalNotifications } from "@/hooks/usePushNotifications";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ProfileSettings {
  notifications: {
    periodReminders: boolean;
    journalReminders: boolean;
    healthTips: boolean;
  };
  privacy: {
    dataSync: boolean;
    analytics: boolean;
  };
  security: {
    biometricAuth: boolean;
    pinEnabled: boolean;
  };
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { t, language, setLanguage, availableLanguages } = useLanguage();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  // Load cached avatar on mount
  useEffect(() => {
    if (user?.uid) {
      AsyncStorage.getItem(`avatar_${user.uid}`).then((cached) => {
        if (cached) setAvatarUri(cached);
      });
    }
  }, [user?.uid]);

  const [settings, setSettings] = useState<ProfileSettings>({
    notifications: {
      periodReminders: true,
      journalReminders: false,
      healthTips: true,
    },
    privacy: {
      dataSync: true,
      analytics: false,
    },
    security: {
      biometricAuth: false,
      pinEnabled: false,
    },
  });

  // Load persisted settings
  useEffect(() => {
    AsyncStorage.getItem("profile_settings").then((raw) => {
      if (raw) {
        try { setSettings(JSON.parse(raw)); } catch { /* ignore corrupted data */ }
      }
    });
  }, []);

  // Persist whenever settings change
  useEffect(() => {
    AsyncStorage.setItem("profile_settings", JSON.stringify(settings));
  }, [settings]);

  const handleSignOut = () => {
    Alert.alert(t('profile.signOut'), t('common.confirm') + '?', [
      { text: t('common.cancel'), style: "cancel" },
      {
        text: t('profile.signOut'),
        style: "destructive",
        onPress: async () => {
          const result = await logOut();
          if (result.error) {
            Alert.alert("Error", result.error);
          }
        },
      },
    ]);
  };

  const handleSetupPin = () => {
    Alert.alert("Setup PIN", "PIN setup will be available in the next update!");
  };

  const handleBiometricSetup = () => {
    Alert.alert(
      "Biometric Authentication",
      "Biometric setup will be available in the next update!"
    );
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      Alert.alert(t('common.error'), "All fields are required.");
      return;
    }
    if (newPw.length < 6) {
      Alert.alert(t('common.error'), "New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert(t('common.error'), "New passwords do not match.");
      return;
    }
    setIsChangingPw(true);
    const result = await changePassword(currentPw, newPw);
    setIsChangingPw(false);
    if (result.error) {
      Alert.alert(t('common.error'), result.error);
    } else {
      setShowChangePassword(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      Alert.alert(t('profile.changePassword'), "Password changed successfully.");
    }
  };

  const handleExportData = () => {
    Alert.alert(
      "Export Data",
      "Data export feature will be available in the next update!"
    );
  };

  const handleHelpFAQ = () => {
    Alert.alert("Help & FAQ", "Frequently Asked Questions and help topics will be available soon. For urgent help, please contact support.");
  };

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@thespotapp.com?subject=Support%20Request");
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://thesptoapp-v2.vercel.app/privacy");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: async () => {
            const result = await deleteAccount();
            if (result.error) {
              Alert.alert("Error", result.error);
            }
          },
        },
      ]
    );
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to change your profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setIsUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const uri = asset.uri;

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType =
        asset.mimeType ??
        (uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

      const dataUrl = `data:${mimeType};base64,${base64}`;

      // Save locally for instant display
      await AsyncStorage.setItem(`avatar_${user!.uid}`, dataUrl);
      setAvatarUri(dataUrl);

      // Persist to Firestore (user doc) for cross-device sync
      const userRef = doc(db, "users", user!.uid);
      try {
        await updateDoc(userRef, { avatarBase64: dataUrl });
      } catch {
        // Doc may not exist yet — create it with required role field
        await setDoc(userRef, {
          avatarBase64: dataUrl,
          email: user!.email,
          displayName: user!.displayName || user!.email?.split("@")[0] || "User",
          role: "user",
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error("[Profile] Photo upload failed:", err?.message ?? err);
      Alert.alert("Error", "Failed to save photo. Please try again.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleEditName = () => {
    setEditName(user?.displayName || "");
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    setIsSavingName(true);
    const result = await updateDisplayName(trimmed);
    setIsSavingName(false);
    if (result.error) {
      Alert.alert("Error", result.error);
    } else {
      setIsEditingName(false);
    }
  };

  const updateSetting = (
    category: keyof ProfileSettings,
    key: string,
    value: boolean
  ) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value,
        },
      };
      // Re-sync local notification schedules when notification prefs change
      if (category === "notifications") {
        AsyncStorage.setItem("profile_settings", JSON.stringify(next)).then(() => {
          syncLocalNotifications().catch(() => {});
        }).catch(() => {});
      }
      return next;
    });
  };

  if (!user) {
    return (
      <SignInRequired
        icon="person"
        message="Sign in to access your profile, settings, and personalize your experience."
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[SpotColors.gradientLight, SpotColors.gradientMid, SpotColors.surface] as any}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <ScrollView style={styles.scrollView}>
        {/* Minimal Profile Header */}
        <LinearGradient
          colors={[SpotColors.primary, SpotColors.primaryLight, SpotColors.background] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeaderGradient}
        >
          <View style={styles.profileHeaderContent}>
            <TouchableOpacity onPress={handlePickImage} activeOpacity={0.7} disabled={isUploadingPhoto}>
              <View style={styles.avatarLarge}>
                <LinearGradient
                  colors={[SpotColors.blush, SpotColors.rose] as any}
                  style={styles.avatarGradient}
                />
                {avatarUri || user.photoURL ? (
                  <Image
                    source={{ uri: avatarUri || user.photoURL! }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Image
                    source={require("@/assets/images/avatar.png")}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.avatarOverlay}>
                  {isUploadingPhoto ? (
                    <ActivityIndicator size="small" color={SpotColors.surface} />
                  ) : (
                    <Ionicons name="camera" size={20} color={SpotColors.surface} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>
                {user.displayName || user.email?.split("@")[0] || "User"}
              </Text>
              <TouchableOpacity onPress={handleEditName} style={styles.editNameButton}>
                <Ionicons name="pencil" size={16} color={SpotColors.textOnPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>
        </LinearGradient>

        {/* Notifications Settings */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.notifications')}</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.periodReminders')}</Text>
              <Text style={styles.settingDescription}>
                {t('profile.periodRemindersDesc')}
              </Text>
            </View>
            <Switch
              value={settings.notifications.periodReminders}
              onValueChange={(value) =>
                updateSetting("notifications", "periodReminders", value)
              }
              trackColor={{ false: SpotColors.border, true: SpotColors.rose + "80" }}
              thumbColor={
                settings.notifications.periodReminders
                  ? SpotColors.rose
                  : SpotColors.surface
              }
              ios_backgroundColor={SpotColors.border}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.journalReminders')}</Text>
              <Text style={styles.settingDescription}>
                {t('profile.journalRemindersDesc')}
              </Text>
            </View>
            <Switch
              value={settings.notifications.journalReminders}
              onValueChange={(value) =>
                updateSetting("notifications", "journalReminders", value)
              }
              trackColor={{ false: SpotColors.border, true: SpotColors.rose + "80" }}
              thumbColor={
                settings.notifications.journalReminders
                  ? SpotColors.rose
                  : SpotColors.surface
              }
              ios_backgroundColor={SpotColors.border}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.healthTips')}</Text>
              <Text style={styles.settingDescription}>
                {t('profile.healthTipsDesc')}
              </Text>
            </View>
            <Switch
              value={settings.notifications.healthTips}
              onValueChange={(value) =>
                updateSetting("notifications", "healthTips", value)
              }
              trackColor={{ false: SpotColors.border, true: SpotColors.rose + "80" }}
              thumbColor={
                settings.notifications.healthTips
                  ? SpotColors.rose
                  : SpotColors.surface
              }
              ios_backgroundColor={SpotColors.border}
            />
          </View>
        </View>

        {/* Security Settings */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.security')}</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleSetupPin}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.pinProtection')}</Text>
              <Text style={styles.settingDescription}>
                {settings.security.pinEnabled
                  ? "PIN is enabled"
                  : "Set up a PIN for extra security"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleBiometricSetup}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.biometricAuth')}</Text>
              <Text style={styles.settingDescription}>
                Use fingerprint or face ID
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowChangePassword(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.changePassword')}</Text>
              <Text style={styles.settingDescription}>
                Update your account password
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>
        </View>

        {/* Privacy Settings */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.privacy')}</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.dataSync')}</Text>
              <Text style={styles.settingDescription}>
                Sync data across your devices
              </Text>
            </View>
            <Switch
              value={settings.privacy.dataSync}
              onValueChange={(value) =>
                updateSetting("privacy", "dataSync", value)
              }
              trackColor={{ false: SpotColors.border, true: SpotColors.rose + "80" }}
              thumbColor={
                settings.privacy.dataSync ? SpotColors.rose : SpotColors.surface
              }
              ios_backgroundColor={SpotColors.border}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.analytics')}</Text>
              <Text style={styles.settingDescription}>
                Help improve the app with anonymous usage data
              </Text>
            </View>
            <Switch
              value={settings.privacy.analytics}
              onValueChange={(value) =>
                updateSetting("privacy", "analytics", value)
              }
              trackColor={{ false: SpotColors.border, true: SpotColors.rose + "80" }}
              thumbColor={
                settings.privacy.analytics ? SpotColors.rose : SpotColors.surface
              }
              ios_backgroundColor={SpotColors.border}
            />
          </View>
        </View>

        {/* Language */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.language')}</Text>
          <TouchableOpacity
            style={styles.settingButton}
            onPress={() => setShowLanguagePicker(true)}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.appLanguage')}</Text>
              <Text style={styles.settingDescription}>
                {availableLanguages.find((l) => l.code === language)?.label || "English"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>
        </View>

        {/* Language Picker Modal */}
        <Modal
          visible={showLanguagePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguagePicker(false)}
        >
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" }}
            activeOpacity={1}
            onPress={() => setShowLanguagePicker(false)}
          >
            <View style={{
              width: "80%",
              backgroundColor: SpotColors.surface,
              borderRadius: 24,
              padding: 24,
              borderTopWidth: 3,
              borderTopColor: SpotColors.lavender,
            }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: SpotColors.textPrimary, marginBottom: 16, textAlign: "center" }}>
                {t('profile.chooseLanguage')}
              </Text>
              {availableLanguages.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    marginBottom: 4,
                    ...(language === lang.code ? { backgroundColor: SpotColors.gradientLight, borderWidth: 1, borderColor: SpotColors.border } : {}),
                  }}
                  onPress={() => {
                    setLanguage(lang.code);
                    setShowLanguagePicker(false);
                  }}
                >
                  <Text style={{
                    fontSize: 16,
                    fontWeight: language === lang.code ? "700" : "500",
                    color: language === lang.code ? SpotColors.primary : SpotColors.textPrimary,
                  }}>
                    {lang.label}
                  </Text>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={20} color={SpotColors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Data Management */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.dataManagement')}</Text>

          <TouchableOpacity
            style={styles.settingButton}
            onPress={handleExportData}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.exportData')}</Text>
              <Text style={styles.settingDescription}>
                Download your data as CSV or JSON
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>
        </View>

        {/* Support */}
        <View style={styles.card}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.cardTitle}>{t('profile.support')}</Text>

          <TouchableOpacity style={styles.settingButton} onPress={handleHelpFAQ}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.helpFaq')}</Text>
              <Text style={styles.settingDescription}>
                Get help and find answers
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton} onPress={handleContactSupport}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.contactSupport')}</Text>
              <Text style={styles.settingDescription}>
                Reach out for assistance
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingButton} onPress={handlePrivacyPolicy}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>{t('profile.privacyPolicy')}</Text>
              <Text style={styles.settingDescription}>
                Read our privacy policy
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={SpotColors.rose} />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LinearGradient
              colors={[SpotColors.gradientLight, SpotColors.surface] as any}
              style={styles.signOutButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="log-out-outline" size={20} color={SpotColors.rose} style={{ marginRight: 8 }} />
              <Text style={styles.signOutButtonText}>{t('profile.signOut')}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={18} color={SpotColors.error} style={{ marginRight: 6 }} />
            <Text style={styles.deleteAccountText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal visible={isEditingName} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Display Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor={SpotColors.rose + "80"}
              autoFocus
              maxLength={50}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsEditingName(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isSavingName && { opacity: 0.6 }]}
                onPress={handleSaveName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color={SpotColors.surface} />
                ) : (
                  <Text style={styles.modalSaveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile.changePassword')}</Text>
            <TextInput
              style={styles.modalInput}
              value={currentPw}
              onChangeText={setCurrentPw}
              placeholder={t('profile.currentPassword')}
              placeholderTextColor={SpotColors.rose + "80"}
              secureTextEntry
              autoFocus
            />
            <TextInput
              style={styles.modalInput}
              value={newPw}
              onChangeText={setNewPw}
              placeholder={t('profile.newPassword')}
              placeholderTextColor={SpotColors.rose + "80"}
              secureTextEntry
            />
            <TextInput
              style={styles.modalInput}
              value={confirmPw}
              onChangeText={setConfirmPw}
              placeholder={t('profile.confirmNewPassword')}
              placeholderTextColor={SpotColors.rose + "80"}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowChangePassword(false);
                  setCurrentPw("");
                  setNewPw("");
                  setConfirmPw("");
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isChangingPw && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={isChangingPw}
              >
                {isChangingPw ? (
                  <ActivityIndicator size="small" color={SpotColors.surface} />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  scrollView: {
    flex: 1,
  },
  profileHeaderGradient: {
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  profileHeaderContent: {
    alignItems: "center",
    width: "100%",
    position: "relative",
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 4,
    borderColor: SpotColors.surface,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 50,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    zIndex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    color: SpotColors.textOnPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: SpotColors.textOnPrimary,
    opacity: 0.95,
    marginBottom: 0,
    letterSpacing: 0.1,
    fontWeight: "500",
  },
  card: {
    margin: 16,
    marginTop: 8,
    padding: 20,
    borderRadius: 24,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 24,
    pointerEvents: 'none',
  },
  cardTitle: {
    color: SpotColors.deepPink,
    marginBottom: 20,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    zIndex: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: SpotColors.border,
    zIndex: 1,
  },
  settingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: SpotColors.border,
    zIndex: 1,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: SpotColors.deepPink,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: SpotColors.rose,
    fontWeight: "500",
  },
  signOutContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  signOutButton: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  signOutButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  signOutButtonText: {
    color: SpotColors.rose,
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  deleteAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingVertical: 12,
  },
  deleteAccountText: {
    color: SpotColors.error,
    fontWeight: "600",
    fontSize: 15,
  },
  avatarOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editNameButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: SpotColors.surface,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: SpotColors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: SpotColors.deepPink,
    marginBottom: 16,
    textAlign: "center",
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    color: SpotColors.deepPink,
    backgroundColor: SpotColors.gradientLight,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    alignItems: "center",
  },
  modalCancelText: {
    color: SpotColors.rose,
    fontWeight: "600",
    fontSize: 16,
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: SpotColors.primary,
    alignItems: "center",
  },
  modalSaveText: {
    color: SpotColors.surface,
    fontWeight: "700",
    fontSize: 16,
  },
});
