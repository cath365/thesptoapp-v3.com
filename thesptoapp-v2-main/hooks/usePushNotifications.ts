import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Configure how notifications are presented when the app is in the foreground
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Silently ignore if notifications API is unavailable (e.g. on beta OS versions)
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    return null;
  }

  // Check / request permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#ED9BB9",
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    return null;
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  return pushToken.data; // e.g. "ExponentPushToken[…]"
}

/** Read notification preferences from the profile settings in AsyncStorage */
async function getNotificationPrefs(): Promise<{
  periodReminders: boolean;
  journalReminders: boolean;
  healthTips: boolean;
}> {
  try {
    const raw = await AsyncStorage.getItem("profile_settings");
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        periodReminders: parsed?.notifications?.periodReminders ?? true,
        journalReminders: parsed?.notifications?.journalReminders ?? false,
        healthTips: parsed?.notifications?.healthTips ?? true,
      };
    }
  } catch { /* ignore */ }
  return { periodReminders: true, journalReminders: false, healthTips: true };
}

/** Schedule or cancel recurring local notifications based on user preferences */
async function syncLocalNotifications(): Promise<void> {
  const prefs = await getNotificationPrefs();

  // Cancel all existing scheduled notifications — we'll re-schedule the active ones
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (prefs.journalReminders) {
    // Every day at 20:00
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Journal Reminder 📝",
        body: "Take a moment to write in your journal today.",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      },
    });
  }

  if (prefs.healthTips) {
    // Every day at 9:00
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Health Tip 💡",
        body: "Check out today's health tip on The Spot App.",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
  }

  if (prefs.periodReminders) {
    // Every day at 8:00 — acts as a gentle daily check-in.
    // The user can turn it off in Profile > Notifications.
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Period Reminder 🌸",
        body: "Don't forget to log today in your period tracker.",
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 8,
        minute: 0,
      },
    });
  }
}

export function usePushNotifications(userId: string | null) {
  const tokenSaved = useRef(false);

  useEffect(() => {
    if (!userId) {
      tokenSaved.current = false;
      return;
    }

    registerForPushNotificationsAsync()
      .then((token) => {
        if (token && !tokenSaved.current) {
          tokenSaved.current = true;
          // Store the token in the user's Firestore document
          // The admin panel reads `expoPushToken` from here
          updateDoc(doc(db, "users", userId), { expoPushToken: token }).catch(
            () => {
              // Silently fail — token will be retried on next app launch
              tokenSaved.current = false;
            }
          );
        }
      })
      .catch((e) => {
        // Notifications may not be available on all devices/OS versions
        console.warn('[PushNotifications] Registration failed:', e);
      });

    // Sync local notification schedules based on user preferences
    syncLocalNotifications().catch((e) => {
      console.warn('[PushNotifications] syncLocalNotifications failed:', e);
    });
  }, [userId]);
}

export { syncLocalNotifications };
