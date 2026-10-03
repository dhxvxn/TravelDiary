import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type { TripOptions } from '@traveldiary/core';
import type { Theme } from '../theme';

type NumericOption = 'homeRadiusKm' | 'maxGapDays' | 'stopRadiusKm' | 'minPhotosPerTrip';

const FIELDS: { key: NumericOption; label: string; hint: string; unit: string; steps: number[] }[] = [
  { key: 'homeRadiusKm', label: 'Home radius', unit: 'km', hint: 'Photos closer to home than this don’t count as travel.', steps: [5, 10, 20, 30, 50, 75, 100, 150, 200, 300] },
  { key: 'maxGapDays', label: 'Split trips after', unit: 'days', hint: 'A gap this long without photos starts a new trip.', steps: [1, 2, 3, 4, 5, 7, 10, 14] },
  { key: 'stopRadiusKm', label: 'Stop size', unit: 'km', hint: 'Photos within this distance are grouped into one stop.', steps: [2, 5, 10, 15, 25, 40, 60, 100, 150] },
  { key: 'minPhotosPerTrip', label: 'Min photos per trip', unit: '', hint: 'Ignore trips with fewer photos.', steps: [1, 2, 3, 5, 10, 20] },
];

function step(steps: number[], value: number, dir: 1 | -1): number {
  if (dir > 0) return steps.find((s) => s > value) ?? value;
  return [...steps].reverse().find((s) => s < value) ?? value;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  options: TripOptions;
  onChange: (o: TripOptions) => void;
  geocode: boolean;
  onGeocodeChange: (on: boolean) => void;
  homeOverridden: boolean;
  onResetHome: () => void;
  onForgetScan: () => void;
  theme: Theme;
}

export function SettingsSheet(p: Props) {
  const s = makeStyles(p.theme);
  return (
    <Modal visible={p.visible} animationType="slide" transparent onRequestClose={p.onClose}>
      <Pressable style={s.backdrop} onPress={p.onClose} accessibilityLabel="Close settings" />
      <View style={s.sheet}>
        <View style={s.handle} />
        <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 24 }}>
          <Text style={s.heading}>Settings</Text>
          {FIELDS.map((f) => (
            <View key={f.key} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{f.label}</Text>
                <Text style={s.hint}>{f.hint}</Text>
              </View>
              <View style={s.stepper}>
                <Pressable style={s.stepBtn} onPress={() => p.onChange({ ...p.options, [f.key]: step(f.steps, p.options[f.key], -1) })} accessibilityLabel={`Decrease ${f.label}`}>
                  <Text style={s.stepTxt}>−</Text>
                </Pressable>
                <Text style={s.value}>
                  {p.options[f.key]}
                  {f.unit ? ` ${f.unit}` : ''}
                </Text>
                <Pressable style={s.stepBtn} onPress={() => p.onChange({ ...p.options, [f.key]: step(f.steps, p.options[f.key], 1) })} accessibilityLabel={`Increase ${f.label}`}>
                  <Text style={s.stepTxt}>+</Text>
                </Pressable>
              </View>
            </View>
          ))}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Look up place names</Text>
              <Text style={s.hint}>Sends each stop’s coordinates (never photos) to OpenStreetMap.</Text>
            </View>
            <Switch value={p.geocode} onValueChange={p.onGeocodeChange} trackColor={{ true: p.theme.accent }} />
          </View>
          {p.homeOverridden && (
            <Pressable onPress={p.onResetHome}>
              <Text style={s.link}>Detect home automatically again</Text>
            </Pressable>
          )}
          <Pressable onPress={p.onForgetScan}>
            <Text style={s.link}>Forget scan results and start over</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingTop: 10, maxHeight: '80%' },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.border, marginBottom: 12 },
    heading: { color: t.text, fontSize: 20, fontWeight: '700' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    label: { color: t.text, fontSize: 15, fontWeight: '600' },
    hint: { color: t.muted, fontSize: 12 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
    stepTxt: { color: t.text, fontSize: 20, lineHeight: 22 },
    value: { color: t.text, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
    link: { color: t.accent, fontWeight: '600' },
  });
