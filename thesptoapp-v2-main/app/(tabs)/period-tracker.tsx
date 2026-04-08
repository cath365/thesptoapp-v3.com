import SignInRequired from '@/components/SignInRequired';
import { useAuth } from '@/hooks/useAuth';
import { SpotColors } from '@/constants/Colors';
import { Cycle, DailyLog, usePeriodTracker } from '@/hooks/usePeriodTracker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

const CYCLE_COLORS = {
  menstrual: SpotColors.rose,
  ovulation: SpotColors.peach,
  follicular: SpotColors.softPink,
  luteal: SpotColors.lavender,
};

const LEGEND = [
  { label: 'Menstrual', color: CYCLE_COLORS.menstrual, icon: '💧' },
  { label: 'Ovulation', color: CYCLE_COLORS.ovulation, icon: '☀️' },
  { label: 'Follicular', color: CYCLE_COLORS.follicular, icon: '🌀' },
  { label: 'Luteal', color: CYCLE_COLORS.luteal, icon: '⚡️' },
];

const SYMPTOMS = [
  'Cramps', 'Headache', 'Bloating', 'Mood Swings', 'Fatigue', 'Acne', 'Back Pain', 'Tender Breasts', 'Nausea', 'Insomnia'
];

const PHASE_ICONS: Record<string, string> = {
  Menstrual: '💧',
  Follicular: '🌀',
  Ovulation: '☀️',
  Luteal: '⚡️',
};

function getPhase(date: string, cycles: Cycle[]): keyof typeof CYCLE_COLORS | undefined {
  if (!cycles.length) return undefined;
  const latest = cycles[0];
  if (!latest.startDate || !isValidDate(new Date(latest.startDate))) return undefined;
  
  const start = new Date(latest.startDate);
  const avgCycle = latest.avgCycleLength && latest.avgCycleLength >= 15 ? latest.avgCycleLength : 28;
  const periodLen = latest.periodLength && latest.periodLength >= 1 ? latest.periodLength : 5;
  const d = new Date(date);
  
  if (!isValidDate(d) || !isValidDate(start) || d < start) return undefined;
  
  // Calculate which day of the repeating cycle this date falls on
  const totalDays = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const dayOfCycle = (totalDays % avgCycle) + 1;

  // Dynamic phase boundaries based on actual cycle length
  const ovulationStart = Math.max(periodLen + 2, Math.floor(avgCycle / 2) - 3);
  const ovulationEnd = Math.min(ovulationStart + 4, avgCycle - 2);

  if (dayOfCycle <= periodLen) return 'menstrual';
  if (dayOfCycle < ovulationStart) return 'follicular';
  if (dayOfCycle <= ovulationEnd) return 'ovulation';
  if (dayOfCycle <= avgCycle) return 'luteal';
  return undefined;
}

function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

export default function PeriodTrackerScreen() {
  const { user } = useAuth();
  const {
    cycles, logs, loading,
    addOrUpdateCycle, logDay, clearAll
  } = usePeriodTracker();
  const [selected, setSelected] = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [showCycleModal, setShowCycleModal] = useState(false);
  const [logSymptoms, setLogSymptoms] = useState<string[]>([]);
  const [logNotes, setLogNotes] = useState('');
  const [logDate, setLogDate] = useState('');
  const [cycleInfo, setCycleInfo] = useState({ avgCycleLength: 28, periodLength: 5 });
  const [cycleStart, setCycleStart] = useState('');
  const [saving, setSaving] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);

  // Map logs by date for quick lookup
  const logsByDate = useMemo(() => {
    const map: Record<string, DailyLog> = {};
    logs.forEach(l => { map[l.date] = l; });
    return map;
  }, [logs]);

  // Marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: any = {};
    // Color days by phase for 3 cycles forward from start date
    if (cycles.length && cycles[0].startDate && isValidDate(new Date(cycles[0].startDate))) {
      const latest = cycles[0];
      const start = new Date(latest.startDate);
      const avgCycle = latest.avgCycleLength && latest.avgCycleLength >= 15 ? latest.avgCycleLength : 28;
      const totalDays = avgCycle * 3; // Project 3 cycles ahead
      const d = new Date(start);
      for (let i = 0; i < totalDays; i++) {
        if (isValidDate(d)) {
          const ds = d.toISOString().slice(0, 10);
          const phase = getPhase(ds, cycles);
          if (phase) {
            marks[ds] = {
              marked: true,
              customStyles: {
                container: { backgroundColor: CYCLE_COLORS[phase] },
                text: { color: SpotColors.textOnPrimary },
              },
            };
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }
    // For custom markingType, encode log indicators and selection in customStyles
    Object.keys(logsByDate).forEach(date => {
      marks[date] = marks[date] || { customStyles: { container: {}, text: {} } };
      marks[date].customStyles = marks[date].customStyles || { container: {}, text: {} };
      marks[date].customStyles.container = {
        ...marks[date].customStyles.container,
        borderBottomWidth: 3,
        borderBottomColor: SpotColors.textPrimary,
      };
    });
    if (selected) {
      marks[selected] = marks[selected] || { customStyles: { container: {}, text: {} } };
      marks[selected].customStyles = marks[selected].customStyles || { container: {}, text: {} };
      marks[selected].customStyles.container = {
        ...marks[selected].customStyles.container,
        borderWidth: 2,
        borderColor: SpotColors.rose,
      };
      marks[selected].customStyles.text = {
        ...marks[selected].customStyles.text,
        fontWeight: 'bold',
      };
    }
    return marks;
  }, [cycles, logsByDate, selected]);

  // Stats
  const avgCycle = cycles[0]?.avgCycleLength || 28;
  const periodDays = cycles[0]?.periodLength || 5;
  // Calculate next ovulation and phase info
  const today = new Date();
  const latestCycle = cycles[0];
  let nextOvulationDate = '';
  let nextOvulationDateReadable = '';
  let currentPhase = '';
  let nextPhase = '';
  let nextPhaseDate = '';
  if (latestCycle && latestCycle.startDate && isValidDate(new Date(latestCycle.startDate))) {
    const start = new Date(latestCycle.startDate);
    const cycleLen = latestCycle.avgCycleLength && latestCycle.avgCycleLength >= 15 ? latestCycle.avgCycleLength : 28;
    const periodLen = latestCycle.periodLength && latestCycle.periodLength >= 1 ? latestCycle.periodLength : 5;
    // Use modular arithmetic to find position in cycle
    const totalDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
    const dayOfCycle = (totalDays % cycleLen) + 1;
    // Calculate current cycle start date
    const cyclesElapsed = Math.floor(totalDays / cycleLen);
    const cycleStartDate = new Date(start);
    cycleStartDate.setDate(cycleStartDate.getDate() + cyclesElapsed * cycleLen);
    // Ovulation estimate: midpoint of cycle
    const ovulationDay = Math.floor(cycleLen / 2);
    const ovulationDate = new Date(cycleStartDate);
    ovulationDate.setDate(cycleStartDate.getDate() + ovulationDay - 1);
    if (isValidDate(ovulationDate)) {
      nextOvulationDate = ovulationDate.toISOString().slice(0, 10);
      nextOvulationDateReadable = format(ovulationDate, 'MMMM d, yyyy');
    }
    // Determine current phase using same dynamic boundaries as getPhase
    const ovulationStart = Math.max(periodLen + 2, Math.floor(cycleLen / 2) - 3);
    const ovulationEnd = Math.min(ovulationStart + 4, cycleLen - 2);
    if (dayOfCycle <= periodLen) {
      currentPhase = 'Menstrual';
      nextPhase = 'Follicular';
      const d = new Date(cycleStartDate);
      d.setDate(cycleStartDate.getDate() + periodLen);
      if (isValidDate(d)) nextPhaseDate = d.toISOString().slice(0, 10);
    } else if (dayOfCycle < ovulationStart) {
      currentPhase = 'Follicular';
      nextPhase = 'Ovulation';
      const d = new Date(cycleStartDate);
      d.setDate(cycleStartDate.getDate() + ovulationStart - 1);
      if (isValidDate(d)) nextPhaseDate = d.toISOString().slice(0, 10);
    } else if (dayOfCycle >= ovulationStart && dayOfCycle <= ovulationEnd) {
      currentPhase = 'Ovulation';
      nextPhase = 'Luteal';
      const d = new Date(cycleStartDate);
      d.setDate(cycleStartDate.getDate() + ovulationEnd);
      if (isValidDate(d)) nextPhaseDate = d.toISOString().slice(0, 10);
    } else {
      currentPhase = 'Luteal';
      nextPhase = 'Menstrual';
      const d = new Date(cycleStartDate);
      d.setDate(cycleStartDate.getDate() + cycleLen);
      if (isValidDate(d)) nextPhaseDate = d.toISOString().slice(0, 10);
    }
  }

  // Calculate days to next ovulation
  let daysToNextOvulation = '';
  if (nextOvulationDate && isValidDate(new Date(nextOvulationDate))) {
    const todayDate = new Date(today.toISOString().slice(0, 10));
    const ovulationDateObj = new Date(nextOvulationDate);
    if (isValidDate(todayDate) && isValidDate(ovulationDateObj)) {
      const diff = Math.ceil((ovulationDateObj.getTime() - todayDate.getTime()) / 86400000);
      daysToNextOvulation = diff > 0 ? `${diff} day${diff === 1 ? '' : 's'} to go` : (diff === 0 ? 'Today!' : '');
    }
  }

  // Change ovulation date format to 'MMM d'
  let nextOvulationDateShort = '';
  if (nextOvulationDateReadable && nextOvulationDate && isValidDate(new Date(nextOvulationDate))) {
    nextOvulationDateShort = format(new Date(nextOvulationDate), 'MMM d');
  }

  // Handle tap on calendar day
  function handleDayPress(day: { dateString: string }) {
    setSelected(day.dateString);
    setLogDate(day.dateString);
    const log = logsByDate[day.dateString];
    setLogSymptoms(log?.symptoms || []);
    setLogNotes(log?.notes || '');
    setShowLogModal(true);
  }

  // Save log for a day
  async function handleSaveLog() {
    setSaving(true);
    try {
      await logDay({ date: logDate, symptoms: logSymptoms, notes: logNotes });
      setShowLogModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save log. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Save cycle info
  async function handleSaveCycle() {
    // Validate inputs
    const len = cycleInfo.avgCycleLength;
    const pLen = cycleInfo.periodLength;
    if (!cycleStart) {
      Alert.alert('Missing Date', 'Please select a period start date.');
      return;
    }
    if (!len || isNaN(len) || len < 15 || len > 60) {
      Alert.alert('Invalid Cycle Length', 'Average cycle length must be between 15 and 60 days.');
      return;
    }
    if (!pLen || isNaN(pLen) || pLen < 1 || pLen > 15) {
      Alert.alert('Invalid Period Length', 'Period length must be between 1 and 15 days.');
      return;
    }
    setSaving(true);
    try {
      const existingCycleId = cycles.length > 0 ? cycles[0].id : undefined;
      await addOrUpdateCycle({
        startDate: cycleStart,
        avgCycleLength: len,
        periodLength: pLen,
      }, existingCycleId);
      setShowCycleModal(false);
    } catch (err: any) {
      const msg = err?.message || 'Could not save cycle info. Please try again.';
      console.error('[PeriodTracker] Save cycle failed:', msg);
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  // Animation for phase card
  const phaseAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(phaseAnim, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [phaseAnim, currentPhase]);

  // UI
  if (!user) {
    return (
      <SignInRequired
        icon="calendar"
        message="Sign in to track your menstrual cycle, log symptoms, and get personalized insights."
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
      <LinearGradient
        colors={[SpotColors.blush, SpotColors.rose, SpotColors.background] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.title}>Period Tracker</Text>
        <Text style={styles.subtitle}>Track your cycle, symptoms, and more ✨</Text>
      </LinearGradient>
      <Animated.View style={[styles.phaseStatCard, { opacity: phaseAnim, transform: [{ translateY: phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
        <LinearGradient
          colors={[SpotColors.surface, SpotColors.gradientLight] as any}
          style={styles.phaseStatGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.phaseIconContainer}>
          <LinearGradient
            colors={currentPhase === 'Menstrual' ? [SpotColors.rose, SpotColors.peach] : 
                    currentPhase === 'Ovulation' ? [SpotColors.peach, SpotColors.primaryLight] :
                    currentPhase === 'Follicular' ? [SpotColors.softPink, SpotColors.primaryLight] :
                    [SpotColors.lavender, SpotColors.primaryLight]}
            style={styles.phaseIconGradient}
          >
            <Text style={styles.phaseIconEmoji}>{PHASE_ICONS[currentPhase] || '💫'}</Text>
          </LinearGradient>
        </View>
        <Text style={styles.phaseStatTitle}>
          {currentPhase ? `Current: ${currentPhase}` : 'No cycle data'}
        </Text>
        {nextPhase && nextPhaseDate && isValidDate(new Date(nextPhaseDate)) && (
          <Text style={styles.phaseStatSubtitle}>
            {`${PHASE_ICONS[nextPhase] || ''} Next: ${nextPhase} (${format(new Date(nextPhaseDate), 'MMM d')})`}
          </Text>
        )}
      </Animated.View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={SpotColors.rose} size="large" />
          <Text style={styles.loadingText}>Loading your cycle data...</Text>
        </View>
      ) : !latestCycle || !latestCycle.startDate ? (
        <View style={styles.centeredCard}>
          <LinearGradient
            colors={[SpotColors.surface, SpotColors.gradientLight] as any}
            style={styles.centeredCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.emptyStateIcon}>
            <LinearGradient
              colors={[SpotColors.blush, SpotColors.rose] as any}
              style={styles.emptyStateIconGradient}
            >
              <Ionicons name="calendar-outline" size={40} color={SpotColors.textOnPrimary} />
            </LinearGradient>
          </View>
          <Text style={styles.centeredCardTitle}>Get Started</Text>
          <Text style={styles.centeredCardText}>
            Add your cycle info to get started with tracking your menstrual cycle and symptoms.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => setShowCycleModal(true)}>
            <LinearGradient
              colors={[SpotColors.blush, SpotColors.rose] as any}
              style={styles.primaryButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add-circle" size={20} color={SpotColors.textOnPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Add Cycle Info</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={styles.calendarCard}>
            <LinearGradient
              colors={[SpotColors.surface, SpotColors.gradientLight] as any}
              style={styles.calendarCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Calendar
              markedDates={markedDates}
              markingType={'custom'}
              onDayPress={handleDayPress}
              theme={{
                backgroundColor: SpotColors.surface,
                calendarBackground: SpotColors.surface,
                textSectionTitleColor: SpotColors.deepPink,
                textDayFontWeight: '600',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 16,
                textMonthFontSize: 20,
                textDayHeaderFontSize: 14,
                selectedDayBackgroundColor: SpotColors.rose,
                selectedDayTextColor: SpotColors.textOnPrimary,
                todayTextColor: SpotColors.rose,
                arrowColor: SpotColors.rose,
                monthTextColor: SpotColors.deepPink,
                indicatorColor: SpotColors.rose,
              }}
              style={styles.calendar}
            />
          </View>
          <View style={styles.legendRow}>
            {LEGEND.map(l => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.gradientButton} onPress={() => {
            if (cycles.length > 0) {
              const c = cycles[0];
              setCycleStart(c.startDate || '');
              setCycleInfo({
                avgCycleLength: c.avgCycleLength || 28,
                periodLength: c.periodLength || 5,
              });
            }
            setShowCycleModal(true);
          }}>
            <LinearGradient
              colors={[SpotColors.blush, SpotColors.rose] as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButtonGradient}
            >
              <Ionicons name="create-outline" size={20} color={SpotColors.textOnPrimary} style={{ marginRight: 8 }} />
              <Text style={styles.gradientButtonText}>Edit Cycle Info</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={styles.statsRow}>
            <View style={styles.statCardUniform}>
              <LinearGradient
                colors={[SpotColors.surface, SpotColors.gradientLight] as any}
                style={styles.statCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.statValueUniform}>{avgCycle}</Text>
              <Text style={styles.statLabelUniform}>Avg Cycle</Text>
            </View>
            <View style={styles.statCardUniform}>
              <LinearGradient
                colors={[SpotColors.surface, SpotColors.gradientLight] as any}
                style={styles.statCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.statValueUniform}>{periodDays}</Text>
              <Text style={styles.statLabelUniform}>Period Days</Text>
            </View>
            <View style={styles.statCardUniform}>
              <LinearGradient
                colors={[SpotColors.surface, SpotColors.gradientLight] as any}
                style={styles.statCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Text style={styles.statValueUniform}>{nextOvulationDateShort}</Text>
              {daysToNextOvulation ? (
                <Text style={styles.statCaption}>{daysToNextOvulation}</Text>
              ) : null}
              <Text style={styles.statLabelUniform}>Ovulation</Text>
            </View>
          </View>
        </ScrollView>
      )}
      {/* Log Modal */}
      <Modal visible={showLogModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Log for {logDate}</Text>
            <Text style={styles.modalSubtitle}>Select symptoms:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {SYMPTOMS.map(sym => (
                <TouchableOpacity
                  key={sym}
                  style={[styles.symptomChip, logSymptoms.includes(sym) && styles.symptomChipSelected]}
                  onPress={() => setLogSymptoms(logSymptoms.includes(sym) ? logSymptoms.filter(s => s !== sym) : [...logSymptoms, sym])}
                >
                  <Text style={[styles.symptomChipText, logSymptoms.includes(sym) && { color: SpotColors.textOnPrimary }]}>{sym}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes (optional)"
              value={logNotes}
              onChangeText={setLogNotes}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowLogModal(false)} disabled={saving}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveLog} disabled={saving}>
                {saving ? <ActivityIndicator color={SpotColors.textOnPrimary} /> : <Text style={styles.saveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Cycle Info Modal */}
      <Modal visible={showCycleModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalOverlayInner}>
            <View style={styles.modalCard}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>Edit Cycle Info</Text>
                {Platform.OS === 'web' ? (
                  <TextInput
                    style={styles.compactInput}
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={cycleStart}
                    onChangeText={setCycleStart}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                ) : (
                  <>
                    <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.datePickerButton}>
                      <Text style={styles.datePickerText}>{cycleStart ? cycleStart : 'Start Date (YYYY-MM-DD)'}</Text>
                    </TouchableOpacity>
                    {showStartPicker && (
                      <DateTimePicker
                        value={cycleStart ? new Date(cycleStart) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(e, date) => {
                          setShowStartPicker(false);
                          if (date) setCycleStart(date.toISOString().slice(0, 10));
                        }}
                      />
                    )}
                  </>
                )}
                <TextInput
                  style={styles.compactInput}
                  placeholder="Avg Cycle Length (days)"
                  value={String(cycleInfo.avgCycleLength)}
                  onChangeText={v => {
                    const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                    setCycleInfo({ ...cycleInfo, avgCycleLength: isNaN(num) ? 0 : num });
                  }}
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.compactInput}
                  placeholder="Period Length (days)"
                  value={String(cycleInfo.periodLength)}
                  onChangeText={v => {
                    const num = parseInt(v.replace(/[^0-9]/g, ''), 10);
                    setCycleInfo({ ...cycleInfo, periodLength: isNaN(num) ? 0 : num });
                  }}
                  keyboardType="numeric"
                />
              </ScrollView>
              <View style={styles.cycleModalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowCycleModal(false)} disabled={saving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveCycle} disabled={saving}>
                  {saving ? <ActivityIndicator color={SpotColors.textOnPrimary} /> : <Text style={styles.saveButtonText}>Save</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearButton} onPress={() => Alert.alert('Clear All Data', 'This will permanently delete all your cycle and symptom data. This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear All', style: 'destructive', onPress: clearAll }])} disabled={saving}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  headerGradient: {
    paddingTop: 48,
    paddingBottom: 32,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  title: {
    color: SpotColors.textOnPrimary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: SpotColors.textOnPrimary,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 0,
    letterSpacing: 0.2,
    opacity: 0.95,
  },
  calendarCard: {
    margin: 16,
    borderRadius: 24,
    backgroundColor: SpotColors.surface,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 4,
    padding: 8,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  calendarCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 24,
  },
  calendar: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: SpotColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendLabel: {
    fontSize: 14,
    color: SpotColors.deepPink,
    fontWeight: '600',
  },
  editButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: SpotColors.secondary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 2,
  },
  editButtonIcon: {
    fontSize: 18,
    marginRight: 8,
    color: SpotColors.textOnPrimary,
  },
  editButtonText: {
    color: SpotColors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 22,
    gap: 12,
  },
  statCardUniform: {
    flex: 1,
    borderRadius: 20,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 22,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  statCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
  },
  statValueUniform: {
    color: SpotColors.deepPink,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.2,
    zIndex: 1,
  },
  statLabelUniform: {
    color: SpotColors.rose,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    zIndex: 1,
  },
  statCaption: {
    color: SpotColors.textPrimary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 2,
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: SpotColors.surface,
    borderRadius: 28,
    padding: 24,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  modalScrollContent: {
    flexGrow: 1,
  },
  datePickerButton: {
    backgroundColor: SpotColors.background,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  datePickerText: {
    fontSize: 16,
    color: SpotColors.deepPink,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SpotColors.deepPink,
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 15,
    color: SpotColors.rose,
    marginBottom: 16,
    fontWeight: '500',
  },
  symptomChip: {
    backgroundColor: SpotColors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  symptomChipSelected: {
    backgroundColor: SpotColors.rose,
    borderColor: SpotColors.rose,
  },
  symptomChipText: {
    color: SpotColors.deepPink,
    fontWeight: '600',
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: SpotColors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: SpotColors.deepPink,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  cycleModalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SpotColors.border,
  },
  compactInput: {
    backgroundColor: SpotColors.background,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: SpotColors.deepPink,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  saveButton: {
    backgroundColor: SpotColors.rose,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginLeft: 8,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: SpotColors.textOnPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: SpotColors.background,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: SpotColors.border,
  },
  cancelButtonText: {
    color: SpotColors.rose,
    fontWeight: '600',
    fontSize: 16,
  },
  clearButton: {
    backgroundColor: SpotColors.surface,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: SpotColors.peach,
  },
  clearButtonText: {
    color: SpotColors.rose,
    fontWeight: '600',
    fontSize: 16,
  },
  phaseStatCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    marginTop: -32,
    padding: 24,
    alignItems: 'center',
    borderRadius: 28,
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  phaseStatGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  phaseIconContainer: {
    marginBottom: 16,
    zIndex: 1,
  },
  phaseIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  phaseIconEmoji: {
    fontSize: 32,
  },
  phaseStatTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: SpotColors.deepPink,
    marginBottom: 8,
    letterSpacing: -0.3,
    zIndex: 1,
  },
  phaseStatSubtitle: {
    fontSize: 15,
    color: SpotColors.rose,
    fontWeight: '600',
    zIndex: 1,
  },
  gradientButton: {
    marginHorizontal: 16,
    marginBottom: 18,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  gradientButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  gradientButtonText: {
    color: SpotColors.textOnPrimary,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.3,
  },
  ovulationCard: {
    backgroundColor: SpotColors.gradientLight,
    borderWidth: 1,
    borderColor: SpotColors.border,
    shadowColor: SpotColors.primary,
  },
  ovulationValue: {
    color: SpotColors.deepPink,
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 2,
  },
  ovulationDate: {
    color: SpotColors.primary,
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: SpotColors.rose,
    fontWeight: '500',
  },
  centeredCard: {
    margin: 24,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: SpotColors.border,
  },
  centeredCardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 28,
  },
  emptyStateIcon: {
    marginBottom: 20,
    zIndex: 1,
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
  centeredCardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: SpotColors.deepPink,
    marginBottom: 12,
    letterSpacing: -0.3,
    zIndex: 1,
  },
  centeredCardText: {
    fontSize: 16,
    color: SpotColors.rose,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '500',
    lineHeight: 22,
    zIndex: 1,
  },
  primaryButton: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: SpotColors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 24,
  },
  primaryButtonText: {
    color: SpotColors.textOnPrimary,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.3,
  },
}); 