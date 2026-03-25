import { ThemedText, ThemedView } from '@/components/Themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

type CategoryKey = 'length' | 'weight' | 'temperature' | 'volume' | 'currency';

type LinearUnit = { toBase: number };
type TempUnit = { toKelvinA: number; toKelvinB: number };

type FavoriteItem = {
  id: string;
  category: CategoryKey;
  from: string;
  to: string;
};

type RecentItem = {
  id: string;
  category: CategoryKey;
  amount: number;
  from: string;
  to: string;
  result: number;
  createdAt: string;
};

const ACCENT = '#0A84FF';
const FAVORITES_KEY = '@Convertly_favorites';
const RECENT_KEY = '@Convertly_recent';

const CATEGORIES: CategoryKey[] = ['length', 'weight', 'temperature', 'volume', 'currency'];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  length: 'Length',
  weight: 'Weight',
  temperature: 'Temperature',
  volume: 'Volume',
  currency: 'Currency',
};

// 15 common length units (base: meter)
const LENGTH_UNITS: Record<string, LinearUnit> = {
  mm: { toBase: 0.001 },
  cm: { toBase: 0.01 },
  m: { toBase: 1 },
  km: { toBase: 1000 },
  in: { toBase: 0.0254 },
  ft: { toBase: 0.3048 },
  yd: { toBase: 0.9144 },
  mi: { toBase: 1609.344 },
  nmi: { toBase: 1852 },
  um: { toBase: 0.000001 },
  nm: { toBase: 0.000000001 },
  fur: { toBase: 201.168 },
  chain: { toBase: 20.1168 },
  rod: { toBase: 5.0292 },
  au: { toBase: 149_597_870_700 },
};

// 15 common weight/mass units (base: kilogram)
const WEIGHT_UNITS: Record<string, LinearUnit> = {
  mg: { toBase: 0.000001 },
  g: { toBase: 0.001 },
  kg: { toBase: 1 },
  tonne: { toBase: 1000 },
  oz: { toBase: 0.028349523125 },
  lb: { toBase: 0.45359237 },
  st: { toBase: 6.35029318 },
  ton_us: { toBase: 907.18474 },
  ton_uk: { toBase: 1016.0469088 },
  ct: { toBase: 0.0002 },
  grain: { toBase: 0.00006479891 },
  dwt: { toBase: 0.00155517384 },
  slug: { toBase: 14.59390294 },
  q: { toBase: 100 },
  amu: { toBase: 1.6605390666e-27 },
};

// 15 common volume units (base: liter)
const VOLUME_UNITS: Record<string, LinearUnit> = {
  ml: { toBase: 0.001 },
  l: { toBase: 1 },
  m3: { toBase: 1000 },
  tsp_us: { toBase: 0.00492892159375 },
  tbsp_us: { toBase: 0.01478676478125 },
  floz_us: { toBase: 0.0295735295625 },
  cup_us: { toBase: 0.2365882365 },
  pt_us: { toBase: 0.473176473 },
  qt_us: { toBase: 0.946352946 },
  gal_us: { toBase: 3.785411784 },
  in3: { toBase: 0.016387064 },
  ft3: { toBase: 28.316846592 },
  yd3: { toBase: 764.554857984 },
  bbl_us: { toBase: 158.987294928 },
  cm3: { toBase: 0.001 },
};

// 8 common temperature scales (via Kelvin linear transforms)
const TEMPERATURE_UNITS: Record<string, TempUnit> = {
  C: { toKelvinA: 1, toKelvinB: 273.15 },
  F: { toKelvinA: 5 / 9, toKelvinB: 255.3722222222222 },
  K: { toKelvinA: 1, toKelvinB: 0 },
  R: { toKelvinA: 5 / 9, toKelvinB: 0 },
  Re: { toKelvinA: 1.25, toKelvinB: 273.15 },
  De: { toKelvinA: -2 / 3, toKelvinB: 373.15 },
  N: { toKelvinA: 100 / 33, toKelvinB: 273.15 },
  Ro: { toKelvinA: 40 / 21, toKelvinB: 258.8642857142857 },
};

// ~25 hard-coded currency rates (relative to USD) for offline usage.
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
  MXN: 17,
  BRL: 5,
  AED: 3.6725,
  SAR: 3.75,
  TRY: 32.1,
  PLN: 3.95,
  THB: 35.9,
  IDR: 15690,
};

const UNIT_LABELS: Record<CategoryKey, Record<string, string>> = {
  length: {
    mm: 'Millimeter (mm)',
    cm: 'Centimeter (cm)',
    m: 'Meter (m)',
    km: 'Kilometer (km)',
    in: 'Inch (in)',
    ft: 'Foot (ft)',
    yd: 'Yard (yd)',
    mi: 'Mile (mi)',
    nmi: 'Nautical Mile (nmi)',
    um: 'Micrometer (μm)',
    nm: 'Nanometer (nm)',
    fur: 'Furlong (fur)',
    chain: 'Chain',
    rod: 'Rod',
    au: 'Astronomical Unit (AU)',
  },
  weight: {
    mg: 'Milligram (mg)',
    g: 'Gram (g)',
    kg: 'Kilogram (kg)',
    tonne: 'Metric Ton (t)',
    oz: 'Ounce (oz)',
    lb: 'Pound (lb)',
    st: 'Stone (st)',
    ton_us: 'US Ton',
    ton_uk: 'UK Ton',
    ct: 'Carat (ct)',
    grain: 'Grain',
    dwt: 'Pennyweight (dwt)',
    slug: 'Slug',
    q: 'Quintal (q)',
    amu: 'Atomic Mass Unit (amu)',
  },
  temperature: {
    C: 'Celsius (°C)',
    F: 'Fahrenheit (°F)',
    K: 'Kelvin (K)',
    R: 'Rankine (°R)',
    Re: 'Réaumur (°Re)',
    De: 'Delisle (°De)',
    N: 'Newton (°N)',
    Ro: 'Rømer (°Rø)',
  },
  volume: {
    ml: 'Milliliter (mL)',
    l: 'Liter (L)',
    m3: 'Cubic Meter (m³)',
    tsp_us: 'US Teaspoon',
    tbsp_us: 'US Tablespoon',
    floz_us: 'US Fluid Ounce',
    cup_us: 'US Cup',
    pt_us: 'US Pint',
    qt_us: 'US Quart',
    gal_us: 'US Gallon',
    in3: 'Cubic Inch (in³)',
    ft3: 'Cubic Foot (ft³)',
    yd3: 'Cubic Yard (yd³)',
    bbl_us: 'US Barrel',
    cm3: 'Cubic Centimeter (cm³)',
  },
  currency: Object.fromEntries(
    Object.keys(CURRENCY_TO_USD).map((code) => [code, `${code} (${code})`]),
  ),
};

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '-';

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(value) >= 1 ? 6 : 8,
  }).format(value);
}

function convertValue(category: CategoryKey, amount: number, from: string, to: string): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;

  if (category === 'temperature') {
    const source = TEMPERATURE_UNITS[from];
    const target = TEMPERATURE_UNITS[to];
    const kelvin = source.toKelvinA * amount + source.toKelvinB;
    return (kelvin - target.toKelvinB) / target.toKelvinA;
  }

  if (category === 'currency') {
    const sourceRate = CURRENCY_TO_USD[from];
    const targetRate = CURRENCY_TO_USD[to];
    const inUSD = amount / sourceRate;
    return inUSD * targetRate;
  }

  const table = category === 'length' ? LENGTH_UNITS : category === 'weight' ? WEIGHT_UNITS : VOLUME_UNITS;
  return (amount * table[from].toBase) / table[to].toBase;
}

function makeFavoriteId(category: CategoryKey, from: string, to: string): string {
  return `${category}:${from}:${to}`;
}

function UnitPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (next: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <>
      <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <Pressable style={styles.pickerButton} onPress={() => setVisible(true)}>
        <ThemedText style={styles.pickerButtonText} numberOfLines={1}>
          {selectedLabel}
        </ThemedText>
        <ThemedText style={styles.pickerChevron}>▾</ThemedText>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Select {label}</ThemedText>
              <Pressable onPress={() => setVisible(false)}>
                <ThemedText style={styles.doneText}>Done</ThemedText>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.optionItem, active && styles.optionItemActive]}
                    onPress={() => {
                      onChange(option.value);
                      setVisible(false);
                    }}>
                    <ThemedText style={active ? styles.optionTextActive : undefined}>{option.label}</ThemedText>
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [category, setCategory] = useState<CategoryKey>('length');
  const [amountInput, setAmountInput] = useState('1');

  const [fromUnits, setFromUnits] = useState<Record<CategoryKey, string>>({
    length: 'm',
    weight: 'kg',
    temperature: 'C',
    volume: 'l',
    currency: 'USD',
  });

  const [toUnits, setToUnits] = useState<Record<CategoryKey, string>>({
    length: 'ft',
    weight: 'lb',
    temperature: 'F',
    volume: 'gal_us',
    currency: 'EUR',
  });

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const options = Object.entries(UNIT_LABELS[category]).map(([value, label]) => ({ value, label }));
  const numericAmount = Number(amountInput);
  const result = convertValue(category, numericAmount, fromUnits[category], toUnits[category]);

  // Load local data once. App remains fully offline and permission-free.
  useEffect(() => {
    const loadRecent = async () => {
      try {
        const [storedFavorites, storedRecent] = await Promise.all([
          AsyncStorage.getItem(FAVORITES_KEY),
          AsyncStorage.getItem(RECENT_KEY),
        ]);

        if (storedFavorites) {
          setFavorites(JSON.parse(storedFavorites));
        }
        if (storedRecent) {
          setRecent(JSON.parse(storedRecent));
        }
      } catch {
        // Silently ignore malformed storage data for resilience.
      }
    };

    void loadStoredData();
  }, []);

  useEffect(() => {
    const units = UNITS_BY_CATEGORY[category];
    setFromUnit(units[0]);
    setToUnit(units[1] ?? units[0]);
  }, [category]);

  const numericAmount = Number(amount);
  const converted = amount.trim() === '' ? NaN : convertValue(category, numericAmount, fromUnit, toUnit);

  useEffect(() => {
    const saveRecent = async () => {
      if (!amountInput.trim()) return;
      if (!Number.isFinite(numericAmount)) return;

      const entry: RecentItem = {
        id: `${Date.now()}`,
        category,
        amount: numericAmount,
        from: fromUnits[category],
        to: toUnits[category],
        result,
        createdAt: new Date().toISOString(),
      };

      const next = [entry, ...recent].slice(0, 25);
      setRecent(next);
      try {
        await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // Keep UI responsive even if write fails.
      }
    };

    const timeout = setTimeout(() => {
      void saveRecent();
    }, 500);

    return () => clearTimeout(timeout);
  }, [amountInput, category, fromUnits, numericAmount, recent, result, toUnits]);

  const toggleFavorite = async () => {
    const id = makeFavoriteId(category, fromUnits[category], toUnits[category]);
    const exists = favorites.some((item) => item.id === id);

    const next = exists
      ? favorites.filter((item) => item.id !== id)
      : [{ id, category, from: fromUnits[category], to: toUnits[category] }, ...favorites];

    setFavorites(next);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // No-op.
    }
  };

  const isFavorite = favorites.some(
    (item) => item.id === makeFavoriteId(category, fromUnits[category], toUnits[category]),
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: isDark ? '#0B1017' : '#EEF3FA' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.title}>
          Convertly
        </ThemedText>
        <ThemedText style={styles.subtitle}>Fully offline unit & currency converter</ThemedText>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#121A24' : '#FFFFFF' }]}> 
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmentRow}>
            {CATEGORIES.map((item) => {
              const active = item === category;
              return (
                <Pressable
                  key={item}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => setCategory(item)}>
                  <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {CATEGORY_LABELS[item]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.block}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Amount
            </ThemedText>
            <TextInput
              value={amountInput}
              onChangeText={setAmountInput}
              keyboardType="decimal-pad"
              placeholder="Enter value"
              placeholderTextColor={isDark ? '#708099' : '#97A4B8'}
              style={[
                styles.input,
                {
                  color: isDark ? '#ECF3FF' : '#122033',
                  backgroundColor: isDark ? '#1A2533' : '#F4F8FF',
                },
              ]}
            />
          </View>

          <View style={styles.converterRow}>
            <View style={styles.unitCol}>
              <UnitPicker
                label="From"
                value={fromUnits[category]}
                options={options}
                onChange={(next) => setFromUnits((prev) => ({ ...prev, [category]: next }))}
              />
            </View>

            <Pressable
              style={styles.swapButton}
              onPress={() => {
                const from = fromUnits[category];
                const to = toUnits[category];
                setFromUnits((prev) => ({ ...prev, [category]: to }));
                setToUnits((prev) => ({ ...prev, [category]: from }));
              }}>
              <ThemedText style={styles.swapButtonText}>⇄</ThemedText>
            </Pressable>

            <View style={styles.unitCol}>
              <UnitPicker
                label="To"
                value={toUnits[category]}
                options={options}
                onChange={(next) => setToUnits((prev) => ({ ...prev, [category]: next }))}
              />
            </View>
          </View>

          <View style={[styles.resultCard, { backgroundColor: isDark ? '#14263E' : '#EAF3FF' }]}> 
            <ThemedText type="defaultSemiBold">Converted value</ThemedText>
            <ThemedText style={styles.resultText}>{formatNumber(result)}</ThemedText>
          </View>

          <Pressable style={styles.favoriteButton} onPress={() => void toggleFavorite()}>
            <ThemedText style={styles.favoriteText}>
              {isFavorite ? '★ Remove Favorite' : '☆ Save to Favorites'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#121A24' : '#FFFFFF' }]}> 
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Favorites
          </ThemedText>
          {favorites.length === 0 ? (
            <ThemedText style={styles.emptyText}>No favorites yet.</ThemedText>
          ) : (
            favorites.slice(0, 8).map((item) => (
              <Pressable
                key={item.id}
                style={styles.listItem}
                onPress={() => {
                  setCategory(item.category);
                  setFromUnits((prev) => ({ ...prev, [item.category]: item.from }));
                  setToUnits((prev) => ({ ...prev, [item.category]: item.to }));
                }}>
                <ThemedText style={styles.listTitle}>{CATEGORY_LABELS[item.category]}</ThemedText>
                <ThemedText>
                  {UNIT_LABELS[item.category][item.from]} → {UNIT_LABELS[item.category][item.to]}
                </ThemedText>
              </Pressable>
            ))
          )}
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#121A24' : '#FFFFFF' }]}> 
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Conversions
          </ThemedText>
          {recent.length === 0 ? (
            <ThemedText style={styles.emptyText}>No recent conversions yet.</ThemedText>
          ) : (
            recent.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.listItem}>
                <ThemedText style={styles.listTitle}>{CATEGORY_LABELS[item.category]}</ThemedText>
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
  content: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 30,
    gap: 14,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    opacity: 0.72,
    marginTop: -4,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  segmentButton: {
    borderRadius: 999,
    backgroundColor: '#DFE7F4',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentButtonActive: {
    backgroundColor: ACCENT,
  },
  segmentText: {
    fontSize: 13,
    color: '#1D2E45',
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  block: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  converterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  unitCol: {
    flex: 1,
    gap: 6,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: '#C3D1E6',
    backgroundColor: '#F7FAFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerButtonText: {
    flex: 1,
    marginRight: 8,
  },
  pickerChevron: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  swapButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  swapButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    marginTop: -1,
  },
  resultCard: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  resultText: {
    color: ACCENT,
    fontSize: 31,
    fontWeight: '800',
  },
  favoriteButton: {
    backgroundColor: ACCENT,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: 'center',
  },
  favoriteText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionTitle: {
    marginBottom: 2,
  },
  emptyText: {
    opacity: 0.72,
  },
  listItem: {
    borderWidth: 1,
    borderColor: '#D6E0EF',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  listTitle: {
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    gap: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  doneText: {
    color: ACCENT,
    fontWeight: '700',
  },
  optionItem: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  optionItemActive: {
    backgroundColor: '#EAF2FF',
  },
  optionTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
});