import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText, ThemedView } from '@/components/Themed';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

type CategoryKey = 'length' | 'weight' | 'temperature' | 'volume' | 'currency';

type UnitOption = {
  label: string;
  value: string;
};

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

type LinearUnit = {
  toBase: number;
};

type TempUnit = {
  toKelvinA: number;
  toKelvinB: number;
};

const FAVORITES_KEY = '@Convertly_favorites';
const RECENT_KEY = '@Convertly_recent';
const ACCENT = '#007AFF';

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  length: 'Length',
  weight: 'Weight',
  temperature: 'Temperature',
  volume: 'Volume',
  currency: 'Currency',
};

const LENGTH_UNITS: Record<string, LinearUnit> = {
  m: { toBase: 1 },
  km: { toBase: 1000 },
  cm: { toBase: 0.01 },
  mm: { toBase: 0.001 },
  um: { toBase: 0.000001 },
  nm: { toBase: 0.000000001 },
  mi: { toBase: 1609.344 },
  yd: { toBase: 0.9144 },
  ft: { toBase: 0.3048 },
  in: { toBase: 0.0254 },
  nmi: { toBase: 1852 },
  fur: { toBase: 201.168 },
  chain: { toBase: 20.1168 },
  rod: { toBase: 5.0292 },
  mil: { toBase: 0.0000254 },
  au: { toBase: 149_597_870_700 },
};

const WEIGHT_UNITS: Record<string, LinearUnit> = {
  kg: { toBase: 1 },
  g: { toBase: 0.001 },
  mg: { toBase: 0.000001 },
  ug: { toBase: 0.000000001 },
  lb: { toBase: 0.45359237 },
  oz: { toBase: 0.028349523125 },
  ton_us: { toBase: 907.18474 },
  ton_metric: { toBase: 1000 },
  ton_uk: { toBase: 1016.0469088 },
  st: { toBase: 6.35029318 },
  ct: { toBase: 0.0002 },
  grain: { toBase: 0.00006479891 },
  dwt: { toBase: 0.00155517384 },
  slug: { toBase: 14.59390294 },
  amu: { toBase: 1.6605390666e-27 },
  q: { toBase: 100 },
};

const VOLUME_UNITS: Record<string, LinearUnit> = {
  l: { toBase: 1 },
  ml: { toBase: 0.001 },
  m3: { toBase: 1000 },
  cm3: { toBase: 0.001 },
  mm3: { toBase: 0.000001 },
  in3: { toBase: 0.016387064 },
  ft3: { toBase: 28.316846592 },
  yd3: { toBase: 764.554857984 },
  gal_us: { toBase: 3.785411784 },
  qt_us: { toBase: 0.946352946 },
  pt_us: { toBase: 0.473176473 },
  cup_us: { toBase: 0.2365882365 },
  floz_us: { toBase: 0.0295735295625 },
  tbsp_us: { toBase: 0.01478676478125 },
  tsp_us: { toBase: 0.00492892159375 },
  bbl_us: { toBase: 158.987294928 },
};

const TEMPERATURE_UNITS: Record<string, TempUnit> = {
  C: { toKelvinA: 1, toKelvinB: 273.15 },
  F: { toKelvinA: 5 / 9, toKelvinB: 255.3722222222222 },
  K: { toKelvinA: 1, toKelvinB: 0 },
  R: { toKelvinA: 5 / 9, toKelvinB: 0 },
  Re: { toKelvinA: 1.25, toKelvinB: 273.15 },
  De: { toKelvinA: -2 / 3, toKelvinB: 373.15 },
  N: { toKelvinA: 100 / 33, toKelvinB: 273.15 },
  Ro: { toKelvinA: 40 / 21, toKelvinB: 258.8642857142857 },
  Cx10: { toKelvinA: 0.1, toKelvinB: 273.15 },
  Cx100: { toKelvinA: 0.01, toKelvinB: 273.15 },
  Fx10: { toKelvinA: 1 / 18, toKelvinB: 255.3722222222222 },
  Fx100: { toKelvinA: 1 / 180, toKelvinB: 255.3722222222222 },
  Kx10: { toKelvinA: 0.1, toKelvinB: 0 },
  Kx100: { toKelvinA: 0.01, toKelvinB: 0 },
  Rx10: { toKelvinA: 1 / 18, toKelvinB: 0 },
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
  BRL: 5.0,
  AED: 3.6725,
  SAR: 3.75,
  TRY: 32.1,
  PLN: 3.95,
  THB: 35.9,
  IDR: 15690,
};

const UNIT_LABELS: Record<CategoryKey, Record<string, string>> = {
  length: {
    m: 'Meter (m)',
    km: 'Kilometer (km)',
    cm: 'Centimeter (cm)',
    mm: 'Millimeter (mm)',
    um: 'Micrometer (μm)',
    nm: 'Nanometer (nm)',
    mi: 'Mile (mi)',
    yd: 'Yard (yd)',
    ft: 'Foot (ft)',
    in: 'Inch (in)',
    nmi: 'Nautical Mile (nmi)',
    fur: 'Furlong (fur)',
    chain: 'Chain',
    rod: 'Rod',
    mil: 'Mil',
    au: 'Astronomical Unit (AU)',
  },
  weight: {
    kg: 'Kilogram (kg)',
    g: 'Gram (g)',
    mg: 'Milligram (mg)',
    ug: 'Microgram (μg)',
    lb: 'Pound (lb)',
    oz: 'Ounce (oz)',
    ton_us: 'US Ton',
    ton_metric: 'Metric Ton',
    ton_uk: 'UK Ton',
    st: 'Stone (st)',
    ct: 'Carat (ct)',
    grain: 'Grain',
    dwt: 'Pennyweight (dwt)',
    slug: 'Slug',
    amu: 'Atomic Mass Unit (amu)',
    q: 'Quintal (q)',
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
    Cx10: 'Celsius ×10',
    Cx100: 'Celsius ×100',
    Fx10: 'Fahrenheit ×10',
    Fx100: 'Fahrenheit ×100',
    Kx10: 'Kelvin ×10',
    Kx100: 'Kelvin ×100',
    Rx10: 'Rankine ×10',
  },
  volume: {
    l: 'Liter (L)',
    ml: 'Milliliter (mL)',
    m3: 'Cubic Meter (m³)',
    cm3: 'Cubic Centimeter (cm³)',
    mm3: 'Cubic Millimeter (mm³)',
    in3: 'Cubic Inch (in³)',
    ft3: 'Cubic Foot (ft³)',
    yd3: 'Cubic Yard (yd³)',
    gal_us: 'US Gallon',
    qt_us: 'US Quart',
    pt_us: 'US Pint',
    cup_us: 'US Cup',
    floz_us: 'US Fluid Ounce',
    tbsp_us: 'US Tablespoon',
    tsp_us: 'US Teaspoon',
    bbl_us: 'US Barrel',
  },
  currency: Object.fromEntries(
    Object.keys(CURRENCY_TO_USD).map((currency) => [currency, `${currency} (${currency})`]),
  ),
};

const tabs: CategoryKey[] = ['length', 'weight', 'temperature', 'volume', 'currency'];

function unitOptions(category: CategoryKey): UnitOption[] {
  return Object.keys(UNIT_LABELS[category]).map((value) => ({
    label: UNIT_LABELS[category][value],
    value,
  }));
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 8,
  }).format(value);
}

function convert(category: CategoryKey, amount: number, from: string, to: string): number {
  if (from === to) {
    return amount;
  }

  if (category === 'temperature') {
    const fromUnit = TEMPERATURE_UNITS[from];
    const toUnit = TEMPERATURE_UNITS[to];
    const kelvin = fromUnit.toKelvinA * amount + fromUnit.toKelvinB;
    return (kelvin - toUnit.toKelvinB) / toUnit.toKelvinA;
  }

  if (category === 'currency') {
    const fromRate = CURRENCY_TO_USD[from];
    const toRate = CURRENCY_TO_USD[to];
    const usd = amount / fromRate;
    return usd * toRate;
  }

  const table = category === 'length' ? LENGTH_UNITS : category === 'weight' ? WEIGHT_UNITS : VOLUME_UNITS;
  const inBase = amount * table[from].toBase;
  return inBase / table[to].toBase;
}

function makeFavoriteId(category: CategoryKey, from: string, to: string) {
  return `${category}:${from}:${to}`;
}

function PickerField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: UnitOption[];
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
        <ThemedText style={styles.pickerText}>{selectedLabel}</ThemedText>
        <ThemedText style={styles.pickerChevron}>▾</ThemedText>
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">Select {label}</ThemedText>
              <Pressable onPress={() => setVisible(false)}>
                <ThemedText style={styles.doneText}>Done</ThemedText>
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.optionItem, option.value === value && styles.optionItemActive]}
                  onPress={() => {
                    onChange(option.value);
                    setVisible(false);
                  }}>
                  <ThemedText style={option.value === value ? styles.optionActiveText : undefined}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
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
  const [amount, setAmount] = useState('1');

  const [fromUnit, setFromUnit] = useState<Record<CategoryKey, string>>({
    length: 'm',
    weight: 'kg',
    temperature: 'C',
    volume: 'l',
    currency: 'USD',
  });

  const [toUnit, setToUnit] = useState<Record<CategoryKey, string>>({
    length: 'ft',
    weight: 'lb',
    temperature: 'F',
    volume: 'gal_us',
    currency: 'EUR',
  });

  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const options = useMemo(() => unitOptions(category), [category]);

  const numericAmount = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amount]);

  const result = useMemo(
    () => convert(category, numericAmount, fromUnit[category], toUnit[category]),
    [category, numericAmount, fromUnit, toUnit],
  );

  useEffect(() => {
    (async () => {
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
        // no-op for resilience in case corrupted local data exists
      }
    })();
  }, []);

  const saveFavorites = useCallback(async (next: FavoriteItem[]) => {
    setFavorites(next);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  }, []);

  const saveRecent = useCallback(async (next: RecentItem[]) => {
    setRecent(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, []);

  const swapUnits = useCallback(() => {
    setFromUnit((current) => ({ ...current, [category]: toUnit[category] }));
    setToUnit((current) => ({ ...current, [category]: fromUnit[category] }));
  }, [category, fromUnit, toUnit]);

  const toggleFavorite = useCallback(async () => {
    const id = makeFavoriteId(category, fromUnit[category], toUnit[category]);
    const exists = favorites.some((favorite) => favorite.id === id);

    if (exists) {
      await saveFavorites(favorites.filter((favorite) => favorite.id !== id));
      return;
    }

    await saveFavorites([
      {
        id,
        category,
        from: fromUnit[category],
        to: toUnit[category],
      },
      ...favorites,
    ]);
  }, [category, favorites, fromUnit, saveFavorites, toUnit]);

  const addToRecent = useCallback(async () => {
    const nextItem: RecentItem = {
      id: `${Date.now()}`,
      category,
      amount: numericAmount,
      from: fromUnit[category],
      to: toUnit[category],
      result,
      createdAt: new Date().toISOString(),
    };

    const next = [nextItem, ...recent].slice(0, 25);
    await saveRecent(next);
  }, [category, fromUnit, numericAmount, recent, result, saveRecent, toUnit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void addToRecent();
    }, 500);

    return () => clearTimeout(timer);
  }, [addToRecent]);

  const activeFavoriteId = makeFavoriteId(category, fromUnit[category], toUnit[category]);
  const isFavorite = favorites.some((favorite) => favorite.id === activeFavoriteId);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: isDark ? '#0B0B0D' : '#F2F4F8' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.title}>
          Convertly
        </ThemedText>
        <ThemedText style={styles.subtitle}>Offline Unit & Currency Converter</ThemedText>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#15171A' : '#FFFFFF' }]}>
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const active = category === tab;
              return (
                <Pressable
                  key={tab}
                  style={[styles.tabButton, active && styles.tabButtonActive]}
                  onPress={() => setCategory(tab)}>
                  <ThemedText style={[styles.tabText, active && styles.tabTextActive]}>
                    {CATEGORY_LABELS[tab]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.inputBlock}>
            <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>
              Amount
            </ThemedText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="Enter value"
              placeholderTextColor={isDark ? '#888' : '#A0A0A0'}
              style={[
                styles.amountInput,
                {
                  color: isDark ? '#FFF' : '#111',
                  backgroundColor: isDark ? '#22252A' : '#F4F7FB',
                },
              ]}
            />
          </View>

          <View style={styles.pickersRow}>
            <View style={styles.pickerCol}>
              <PickerField
                label="From"
                value={fromUnit[category]}
                options={options}
                onChange={(value) => setFromUnit((current) => ({ ...current, [category]: value }))}
              />
            </View>

            <Pressable style={styles.swapButton} onPress={swapUnits}>
              <ThemedText style={styles.swapButtonText}>⇄</ThemedText>
            </Pressable>

            <View style={styles.pickerCol}>
              <PickerField
                label="To"
                value={toUnit[category]}
                options={options}
                onChange={(value) => setToUnit((current) => ({ ...current, [category]: value }))}
              />
            </View>
          </View>

          <View style={[styles.resultCard, { backgroundColor: isDark ? '#1D2530' : '#EAF2FF' }]}>
            <ThemedText type="defaultSemiBold">Converted Value</ThemedText>
            <ThemedText style={styles.resultText}>{formatNumber(result)}</ThemedText>
          </View>

          <Pressable style={styles.favoriteButton} onPress={() => void toggleFavorite()}>
            <ThemedText style={styles.favoriteButtonText}>
              {isFavorite ? '★ Remove Favorite' : '☆ Save to Favorites'}
            </ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#15171A' : '#FFFFFF' }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Favorites
          </ThemedText>
          {favorites.length === 0 ? (
            <ThemedText>No favorites yet.</ThemedText>
          ) : (
            favorites.slice(0, 8).map((favorite) => (
              <Pressable
                key={favorite.id}
                style={styles.listItem}
                onPress={() => {
                  setCategory(favorite.category);
                  setFromUnit((current) => ({ ...current, [favorite.category]: favorite.from }));
                  setToUnit((current) => ({ ...current, [favorite.category]: favorite.to }));
                }}>
                <ThemedText style={styles.listTitle}>{CATEGORY_LABELS[favorite.category]}</ThemedText>
                <ThemedText>
                  {UNIT_LABELS[favorite.category][favorite.from]} → {UNIT_LABELS[favorite.category][favorite.to]}
                </ThemedText>
              </Pressable>
            ))
          )}
        </ThemedView>

        <ThemedView style={[styles.card, { backgroundColor: isDark ? '#15171A' : '#FFFFFF' }]}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Recent Conversions
          </ThemedText>
          {recent.length === 0 ? (
            <ThemedText>No recent conversions yet.</ThemedText>
          ) : (
            recent.slice(0, 10).map((entry) => (
              <View key={entry.id} style={styles.listItem}>
                <ThemedText style={styles.listTitle}>{CATEGORY_LABELS[entry.category]}</ThemedText>
                <ThemedText>
                  {formatNumber(entry.amount)} {entry.from} → {formatNumber(entry.result)} {entry.to}
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
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 28,
    gap: 14,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
  },
  subtitle: {
    opacity: 0.7,
    marginTop: -4,
    marginBottom: 2,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tabButton: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#DCE1EA',
  },
  tabButtonActive: {
    backgroundColor: ACCENT,
  },
  tabText: {
    fontSize: 13,
    color: '#24324A',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  inputBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
  },
  amountInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  pickerCol: {
    flex: 1,
    gap: 6,
  },
  pickerButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFC8D8',
    paddingHorizontal: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F7F9FC',
  },
  pickerText: {
    flex: 1,
    marginRight: 8,
  },
  pickerChevron: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  swapButton: {
    backgroundColor: ACCENT,
    borderRadius: 999,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  swapButtonText: {
    color: '#fff',
    fontSize: 20,
    marginTop: -2,
  },
  resultCard: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  resultText: {
    fontSize: 30,
    color: ACCENT,
    fontWeight: '700',
  },
  favoriteButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    alignItems: 'center',
  },
  favoriteButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionTitle: {
    marginBottom: 2,
  },
  listItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8DEEA',
    padding: 10,
    gap: 2,
  },
  listTitle: {
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    maxHeight: '70%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
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
    fontWeight: '600',
  },
  optionItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  optionItemActive: {
    backgroundColor: '#EAF2FF',
  },
  optionActiveText: {
    color: ACCENT,
    fontWeight: '600',
  },
});
