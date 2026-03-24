import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText, ThemedView } from '@/components/Themed';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';

type CategoryKey = 'length' | 'weight' | 'temperature' | 'volume' | 'currency';

type FavoriteItem = {
  id: string;
  category: CategoryKey;
  from: string;
  to: string;
};

type RecentItem = {
  id: string;
  category: CategoryKey;
  from: string;
  to: string;
  amount: number;
  result: number;
};

type UnitOption = {
  value: string;
  label: string;
};

const FAVORITES_KEY = '@Convertly_favorites';
const RECENT_KEY = '@Convertly_recent';
const ACCENT = '#007AFF';

const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: 'length', label: 'Length' },
  { key: 'weight', label: 'Weight' },
  { key: 'temperature', label: 'Temperature' },
  { key: 'volume', label: 'Volume' },
  { key: 'currency', label: 'Currency' },
];

// Base factors for linear conversions (base units: meter, kilogram, liter).
const LENGTH_FACTORS: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  um: 1e-6,
  nm: 1e-9,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
  nmi: 1852,
  fur: 201.168,
  chain: 20.1168,
  rod: 5.0292,
  mil: 0.0000254,
};

const WEIGHT_FACTORS: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 1e-6,
  ug: 1e-9,
  lb: 0.45359237,
  oz: 0.028349523125,
  st: 6.35029318,
  ton_metric: 1000,
  ton_us: 907.18474,
  ton_uk: 1016.0469088,
  ct: 0.0002,
  grain: 0.00006479891,
  dwt: 0.00155517384,
  slug: 14.59390294,
  q: 100,
};

const VOLUME_FACTORS: Record<string, number> = {
  l: 1,
  ml: 0.001,
  m3: 1000,
  cm3: 0.001,
  mm3: 1e-6,
  in3: 0.016387064,
  ft3: 28.316846592,
  yd3: 764.554857984,
  gal_us: 3.785411784,
  qt_us: 0.946352946,
  pt_us: 0.473176473,
  cup_us: 0.2365882365,
  floz_us: 0.0295735295625,
  tbsp_us: 0.01478676478125,
  tsp_us: 0.00492892159375,
};

// Affine conversion to/from Kelvin: K = a*x + b.
const TEMPERATURE_AFFINE_TO_K: Record<string, { a: number; b: number }> = {
  C: { a: 1, b: 273.15 },
  F: { a: 5 / 9, b: 255.3722222222 },
  K: { a: 1, b: 0 },
  R: { a: 5 / 9, b: 0 },
  Re: { a: 1.25, b: 273.15 },
  De: { a: -2 / 3, b: 373.15 },
  N: { a: 100 / 33, b: 273.15 },
  Ro: { a: 40 / 21, b: 258.8642857143 },
};

const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.78,
  JPY: 149.5,
  AUD: 1.52,
  CAD: 1.36,
  CHF: 0.89,
  CNY: 7.19,
  HKD: 7.82,
  NZD: 1.65,
  SEK: 10.46,
  NOK: 10.71,
  DKK: 6.88,
  SGD: 1.34,
  INR: 83.1,
  KRW: 1334,
  ZAR: 18.6,
  MXN: 17.0,
  BRL: 5,
  AED: 3.6725,
  SAR: 3.75,
  TRY: 32.1,
  PLN: 3.95,
  THB: 35.9,
  IDR: 15690,
};

const UNIT_OPTIONS: Record<CategoryKey, UnitOption[]> = {
  length: [
    { value: 'm', label: 'Meter (m)' },
    { value: 'km', label: 'Kilometer (km)' },
    { value: 'cm', label: 'Centimeter (cm)' },
    { value: 'mm', label: 'Millimeter (mm)' },
    { value: 'um', label: 'Micrometer (μm)' },
    { value: 'nm', label: 'Nanometer (nm)' },
    { value: 'in', label: 'Inch (in)' },
    { value: 'ft', label: 'Foot (ft)' },
    { value: 'yd', label: 'Yard (yd)' },
    { value: 'mi', label: 'Mile (mi)' },
    { value: 'nmi', label: 'Nautical Mile (nmi)' },
    { value: 'fur', label: 'Furlong' },
    { value: 'chain', label: 'Chain' },
    { value: 'rod', label: 'Rod' },
    { value: 'mil', label: 'Mil' },
  ],
  weight: [
    { value: 'kg', label: 'Kilogram (kg)' },
    { value: 'g', label: 'Gram (g)' },
    { value: 'mg', label: 'Milligram (mg)' },
    { value: 'ug', label: 'Microgram (μg)' },
    { value: 'lb', label: 'Pound (lb)' },
    { value: 'oz', label: 'Ounce (oz)' },
    { value: 'st', label: 'Stone' },
    { value: 'ton_metric', label: 'Metric Ton' },
    { value: 'ton_us', label: 'US Ton' },
    { value: 'ton_uk', label: 'UK Ton' },
    { value: 'ct', label: 'Carat (ct)' },
    { value: 'grain', label: 'Grain' },
    { value: 'dwt', label: 'Pennyweight (dwt)' },
    { value: 'slug', label: 'Slug' },
    { value: 'q', label: 'Quintal (q)' },
  ],
  temperature: [
    { value: 'C', label: 'Celsius (°C)' },
    { value: 'F', label: 'Fahrenheit (°F)' },
    { value: 'K', label: 'Kelvin (K)' },
    { value: 'R', label: 'Rankine (°R)' },
    { value: 'Re', label: 'Réaumur (°Re)' },
    { value: 'De', label: 'Delisle (°De)' },
    { value: 'N', label: 'Newton (°N)' },
    { value: 'Ro', label: 'Rømer (°Rø)' },
  ],
  volume: [
    { value: 'l', label: 'Liter (L)' },
    { value: 'ml', label: 'Milliliter (mL)' },
    { value: 'm3', label: 'Cubic Meter (m³)' },
    { value: 'cm3', label: 'Cubic Centimeter (cm³)' },
    { value: 'mm3', label: 'Cubic Millimeter (mm³)' },
    { value: 'in3', label: 'Cubic Inch (in³)' },
    { value: 'ft3', label: 'Cubic Foot (ft³)' },
    { value: 'yd3', label: 'Cubic Yard (yd³)' },
    { value: 'gal_us', label: 'US Gallon' },
    { value: 'qt_us', label: 'US Quart' },
    { value: 'pt_us', label: 'US Pint' },
    { value: 'cup_us', label: 'US Cup' },
    { value: 'floz_us', label: 'US Fluid Ounce' },
    { value: 'tbsp_us', label: 'US Tablespoon' },
    { value: 'tsp_us', label: 'US Teaspoon' },
  ],
  currency: Object.keys(CURRENCY_TO_USD).map((code) => ({ value: code, label: `${code} (${code})` })),
};

const DEFAULT_FROM: Record<CategoryKey, string> = {
  length: 'm',
  weight: 'kg',
  temperature: 'C',
  volume: 'l',
  currency: 'USD',
};

const DEFAULT_TO: Record<CategoryKey, string> = {
  length: 'ft',
  weight: 'lb',
  temperature: 'F',
  volume: 'gal_us',
  currency: 'EUR',
};

function convertValue(category: CategoryKey, amount: number, from: string, to: string): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;

  if (category === 'length') return (amount * LENGTH_FACTORS[from]) / LENGTH_FACTORS[to];
  if (category === 'weight') return (amount * WEIGHT_FACTORS[from]) / WEIGHT_FACTORS[to];
  if (category === 'volume') return (amount * VOLUME_FACTORS[from]) / VOLUME_FACTORS[to];

  if (category === 'temperature') {
    const source = TEMPERATURE_AFFINE_TO_K[from];
    const target = TEMPERATURE_AFFINE_TO_K[to];
    const kelvin = source.a * amount + source.b;
    return (kelvin - target.b) / target.a;
  }

  const usd = amount / CURRENCY_TO_USD[from];
  return usd * CURRENCY_TO_USD[to];
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value);
}

function makeFavoriteId(category: CategoryKey, from: string, to: string): string {
  return `${category}:${from}:${to}`;
}

function UnitPicker({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: UnitOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value)?.label ?? value;

  return (
    <>
      <ThemedText style={styles.fieldLabel} type="defaultSemiBold">
        {label}
      </ThemedText>
      <Pressable style={styles.selectButton} onPress={() => setOpen(true)}>
        <ThemedText numberOfLines={1} style={styles.selectText}>
          {selected}
        </ThemedText>
        <ThemedText style={styles.chevron}>▾</ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <ThemedView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Select {label}</ThemedText>
              <Pressable onPress={() => setOpen(false)}>
                <ThemedText style={styles.done}>Done</ThemedText>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((item) => {
                const active = item.value === value;
                return (
                  <Pressable
                    key={item.value}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      onSelect(item.value);
                      setOpen(false);
                    }}>
                    <ThemedText style={active ? styles.optionTextActive : undefined}>{item.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </>
  );
}

export default function ConvertlyScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const [category, setCategory] = useState<CategoryKey>('length');
  const [amount, setAmount] = useState('1');
  const [fromByCategory, setFromByCategory] = useState<Record<CategoryKey, string>>(DEFAULT_FROM);
  const [toByCategory, setToByCategory] = useState<Record<CategoryKey, string>>(DEFAULT_TO);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const fromUnit = fromByCategory[category];
  const toUnit = toByCategory[category];
  const options = UNIT_OPTIONS[category];
  const numericAmount = Number(amount) || 0;
  const converted = convertValue(category, numericAmount, fromUnit, toUnit);

  useEffect(() => {
    const loadPersisted = async () => {
      try {
        const [storedFavorites, storedRecent] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(RECENT_KEY),
        ]);

        if (storedFavorites) setFavorites(JSON.parse(storedFavorites));
        if (storedRecent) setRecent(JSON.parse(storedRecent));
      } catch {
        // Ignore malformed local data; app continues to work offline.
      }
    };

    void loadPersisted();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextEntry: RecentItem = {
        id: `${Date.now()}`,
        category,
        from: fromUnit,
        to: toUnit,
        amount: numericAmount,
        result: converted,
      };

      const deduped = [
        nextEntry,
        ...recent.filter(
          (item) =>
            !(
              item.category === nextEntry.category &&
              item.from === nextEntry.from &&
              item.to === nextEntry.to &&
              item.amount === nextEntry.amount
            ),
        ),
      ].slice(0, 30);

      setRecent(deduped);
      void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(deduped));
    }, 450);

    return () => clearTimeout(timer);
  }, [category, converted, fromUnit, numericAmount, recent, toUnit]);

  const favoriteId = makeFavoriteId(category, fromUnit, toUnit);
  const isFavorite = favorites.some((item) => item.id === favoriteId);

  const handleToggleFavorite = async () => {
    const next = isFavorite
      ? favorites.filter((item) => item.id !== favoriteId)
      : [{ id: favoriteId, category, from: fromUnit, to: toUnit }, ...favorites];

    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  const handleSwap = () => {
    setFromByCategory((prev) => ({ ...prev, [category]: toUnit }));
    setToByCategory((prev) => ({ ...prev, [category]: fromUnit }));
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: isDark ? '#0C0F14' : '#F1F4F8' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.title}>
          Convertly
        </ThemedText>
        <ThemedText style={styles.subtitle}>Fully offline unit & currency converter</ThemedText>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#131821' : '#FFFFFF' }]}>
          <ThemedText type="defaultSemiBold">Converter Type</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
            {CATEGORIES.map((item) => {
              const active = item.key === category;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => setCategory(item.key)}>
                  <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.inputWrap}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Amount
            </ThemedText>
            <TextInput
              style={[
                styles.amountInput,
                { backgroundColor: isDark ? '#1B2433' : '#F5F8FD', color: isDark ? '#F5F8FF' : '#111827' },
              ]}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
              placeholderTextColor={isDark ? '#6B7280' : '#9AA3B2'}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.grow}>
              <UnitPicker
                label="From"
                value={fromUnit}
                options={options}
                onSelect={(next) => setFromByCategory((prev) => ({ ...prev, [category]: next }))}
              />
            </View>

            <Pressable style={styles.swapButton} onPress={handleSwap}>
              <ThemedText style={styles.swapText}>⇄</ThemedText>
            </Pressable>

            <View style={styles.grow}>
              <UnitPicker
                label="To"
                value={toUnit}
                options={options}
                onSelect={(next) => setToByCategory((prev) => ({ ...prev, [category]: next }))}
              />
            </View>
          </View>

          <View style={[styles.resultCard, { backgroundColor: isDark ? '#1D2838' : '#E9F1FF' }]}>
            <ThemedText type="defaultSemiBold">Result</ThemedText>
            <ThemedText style={styles.resultText}>{formatNumber(converted)}</ThemedText>
          </View>

          <Pressable style={styles.favoriteButton} onPress={() => void handleToggleFavorite()}>
            <ThemedText style={styles.favoriteText}>
              {isFavorite ? '★ Remove from Favorites' : '☆ Add to Favorites'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#131821' : '#FFFFFF' }]}>
          <ThemedText type="subtitle">Favorites</ThemedText>
          {favorites.length === 0 ? (
            <ThemedText>No favorites yet.</ThemedText>
          ) : (
            favorites.slice(0, 8).map((item) => (
              <Pressable
                key={item.id}
                style={styles.listItem}
                onPress={() => {
                  setCategory(item.category);
                  setFromByCategory((prev) => ({ ...prev, [item.category]: item.from }));
                  setToByCategory((prev) => ({ ...prev, [item.category]: item.to }));
                }}>
                <ThemedText style={styles.listTitle}>
                  {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                </ThemedText>
                <ThemedText>
                  {item.from} → {item.to}
                </ThemedText>
              </Pressable>
            ))
          )}
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#131821' : '#FFFFFF' }]}>
          <ThemedText type="subtitle">Recent Conversions</ThemedText>
          {recent.length === 0 ? (
            <ThemedText>No recent conversions yet.</ThemedText>
          ) : (
            recent.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.listItem}>
                <ThemedText style={styles.listTitle}>
                  {CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category}
                </ThemedText>
                <ThemedText>
                  {formatNumber(item.amount)} {item.from} → {formatNumber(item.result)} {item.to}
                </ThemedText>
              </View>
            ))
          )}
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 56, paddingBottom: 30, paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 34, lineHeight: 38 },
  subtitle: { opacity: 0.72, marginTop: -4 },

  card: {
    borderRadius: 18,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },

  segmentRow: { gap: 8, paddingRight: 4 },
  segmentButton: {
    backgroundColor: '#DEE5F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  segmentButtonActive: { backgroundColor: ACCENT },
  segmentText: { fontSize: 13, color: '#263449' },
  segmentTextActive: { color: '#FFFFFF', fontWeight: '600' },

  inputWrap: { gap: 6 },
  fieldLabel: { fontSize: 14 },
  amountInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  grow: { flex: 1, gap: 6 },
  selectButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFCCDE',
    backgroundColor: '#F7FAFF',
    paddingVertical: 11,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { flex: 1, marginRight: 8 },
  chevron: { color: ACCENT, fontWeight: '700' },

  swapButton: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  swapText: { color: '#FFF', fontSize: 20, marginTop: -2 },

  resultCard: { borderRadius: 12, padding: 12, gap: 4 },
  resultText: { fontSize: 30, fontWeight: '700', color: ACCENT },

  favoriteButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  favoriteText: { color: '#FFF', fontWeight: '600' },

  listItem: {
    borderWidth: 1,
    borderColor: '#D7E0EE',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  listTitle: { fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 14,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  done: { color: ACCENT, fontWeight: '600' },
  optionRow: { paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  optionRowActive: { backgroundColor: '#EAF1FF' },
  optionTextActive: { color: ACCENT, fontWeight: '600' },
});
