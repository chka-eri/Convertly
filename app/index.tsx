// app/index.tsx — Convertly: Offline Unit & Currency Converter
// Run: npx expo install @react-native-async-storage/async-storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// ─── Storage Keys ───────────────────────────────────────────────────────────
const FAVORITES_KEY = '@Convertly_favorites';
const RECENT_KEY = '@Convertly_recent';

// ─── Types ───────────────────────────────────────────────────────────────────
type Category = 'Length' | 'Weight' | 'Temperature' | 'Volume' | 'Currency';

interface Unit {
  label: string;
  symbol: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
}

interface Favorite {
  id: string;
  category: Category;
  from: string;
  to: string;
}

interface RecentEntry {
  id: string;
  category: Category;
  from: string;
  to: string;
  inputValue: string;
  result: string;
  timestamp: number;
}

// ─── Conversion Data ─────────────────────────────────────────────────────────

// Length (base: meter)
const LENGTH_UNITS: Unit[] = [
  { label: 'Kilometer',   symbol: 'km',  toBase: v => v * 1000,      fromBase: v => v / 1000 },
  { label: 'Meter',       symbol: 'm',   toBase: v => v,             fromBase: v => v },
  { label: 'Centimeter',  symbol: 'cm',  toBase: v => v / 100,       fromBase: v => v * 100 },
  { label: 'Millimeter',  symbol: 'mm',  toBase: v => v / 1000,      fromBase: v => v * 1000 },
  { label: 'Micrometer',  symbol: 'μm',  toBase: v => v / 1e6,       fromBase: v => v * 1e6 },
  { label: 'Mile',        symbol: 'mi',  toBase: v => v * 1609.344,  fromBase: v => v / 1609.344 },
  { label: 'Yard',        symbol: 'yd',  toBase: v => v * 0.9144,    fromBase: v => v / 0.9144 },
  { label: 'Foot',        symbol: 'ft',  toBase: v => v * 0.3048,    fromBase: v => v / 0.3048 },
  { label: 'Inch',        symbol: 'in',  toBase: v => v * 0.0254,    fromBase: v => v / 0.0254 },
  { label: 'Nautical mi', symbol: 'nmi', toBase: v => v * 1852,      fromBase: v => v / 1852 },
  { label: 'Light-year',  symbol: 'ly',  toBase: v => v * 9.461e15,  fromBase: v => v / 9.461e15 },
  { label: 'Furlong',     symbol: 'fur', toBase: v => v * 201.168,   fromBase: v => v / 201.168 },
  { label: 'Fathom',      symbol: 'ftm', toBase: v => v * 1.8288,    fromBase: v => v / 1.8288 },
];

// Weight (base: kilogram)
const WEIGHT_UNITS: Unit[] = [
  { label: 'Metric Ton',  symbol: 't',   toBase: v => v * 1000,       fromBase: v => v / 1000 },
  { label: 'Kilogram',    symbol: 'kg',  toBase: v => v,              fromBase: v => v },
  { label: 'Gram',        symbol: 'g',   toBase: v => v / 1000,       fromBase: v => v * 1000 },
  { label: 'Milligram',   symbol: 'mg',  toBase: v => v / 1e6,        fromBase: v => v * 1e6 },
  { label: 'Microgram',   symbol: 'μg',  toBase: v => v / 1e9,        fromBase: v => v * 1e9 },
  { label: 'Pound',       symbol: 'lb',  toBase: v => v * 0.453592,   fromBase: v => v / 0.453592 },
  { label: 'Ounce',       symbol: 'oz',  toBase: v => v * 0.0283495,  fromBase: v => v / 0.0283495 },
  { label: 'Stone',       symbol: 'st',  toBase: v => v * 6.35029,    fromBase: v => v / 6.35029 },
  { label: 'US Ton',      symbol: 'ton', toBase: v => v * 907.185,    fromBase: v => v / 907.185 },
  { label: 'UK Ton',      symbol: 'LT',  toBase: v => v * 1016.05,    fromBase: v => v / 1016.05 },
  { label: 'Carat',       symbol: 'ct',  toBase: v => v * 0.0002,     fromBase: v => v / 0.0002 },
  { label: 'Grain',       symbol: 'gr',  toBase: v => v * 6.479891e-5,fromBase: v => v / 6.479891e-5 },
];

// Temperature (special — no simple base/scale formula, handled separately)
const TEMP_UNITS: Unit[] = [
  { label: 'Celsius',    symbol: '°C', toBase: v => v,                           fromBase: v => v },
  { label: 'Fahrenheit', symbol: '°F', toBase: v => (v - 32) * 5 / 9,           fromBase: v => v * 9 / 5 + 32 },
  { label: 'Kelvin',     symbol: 'K',  toBase: v => v - 273.15,                  fromBase: v => v + 273.15 },
  { label: 'Rankine',    symbol: '°R', toBase: v => (v - 491.67) * 5 / 9,       fromBase: v => (v + 273.15) * 9 / 5 },
  { label: 'Delisle',    symbol: '°De',toBase: v => 100 - v * 2 / 3,            fromBase: v => (100 - v) * 3 / 2 },
  { label: 'Newton',     symbol: '°N', toBase: v => v * 100 / 33,               fromBase: v => v * 33 / 100 },
  { label: 'Réaumur',    symbol: '°Ré',toBase: v => v * 5 / 4,                  fromBase: v => v * 4 / 5 },
  { label: 'Rømer',      symbol: '°Rø',toBase: v => (v - 7.5) * 40 / 21,        fromBase: v => v * 21 / 40 + 7.5 },
];

// Volume (base: liter)
const VOLUME_UNITS: Unit[] = [
  { label: 'Cubic meter',  symbol: 'm³',  toBase: v => v * 1000,        fromBase: v => v / 1000 },
  { label: 'Liter',        symbol: 'L',   toBase: v => v,               fromBase: v => v },
  { label: 'Milliliter',   symbol: 'mL',  toBase: v => v / 1000,        fromBase: v => v * 1000 },
  { label: 'Cubic cm',     symbol: 'cm³', toBase: v => v / 1000,        fromBase: v => v * 1000 },
  { label: 'Cubic inch',   symbol: 'in³', toBase: v => v * 0.0163871,   fromBase: v => v / 0.0163871 },
  { label: 'Cubic foot',   symbol: 'ft³', toBase: v => v * 28.3168,     fromBase: v => v / 28.3168 },
  { label: 'US Gallon',    symbol: 'gal', toBase: v => v * 3.78541,     fromBase: v => v / 3.78541 },
  { label: 'UK Gallon',    symbol: 'UKgal',toBase: v => v * 4.54609,    fromBase: v => v / 4.54609 },
  { label: 'US Quart',     symbol: 'qt',  toBase: v => v * 0.946353,    fromBase: v => v / 0.946353 },
  { label: 'US Pint',      symbol: 'pt',  toBase: v => v * 0.473176,    fromBase: v => v / 0.473176 },
  { label: 'US Cup',       symbol: 'cup', toBase: v => v * 0.236588,    fromBase: v => v / 0.236588 },
  { label: 'US fl. oz',    symbol: 'fl oz',toBase: v => v * 0.0295735,  fromBase: v => v / 0.0295735 },
  { label: 'Tablespoon',   symbol: 'tbsp',toBase: v => v * 0.0147868,   fromBase: v => v / 0.0147868 },
  { label: 'Teaspoon',     symbol: 'tsp', toBase: v => v * 0.00492892,  fromBase: v => v / 0.00492892 },
  { label: 'Barrel (oil)', symbol: 'bbl', toBase: v => v * 158.987,     fromBase: v => v / 158.987 },
];

// Currency (base: USD) — hard-coded approximate rates
const CURRENCY_UNITS: Unit[] = [
  { label: 'US Dollar',          symbol: 'USD', toBase: v => v,            fromBase: v => v },
  { label: 'Euro',               symbol: 'EUR', toBase: v => v / 0.92,     fromBase: v => v * 0.92 },
  { label: 'British Pound',      symbol: 'GBP', toBase: v => v / 0.79,     fromBase: v => v * 0.79 },
  { label: 'Japanese Yen',       symbol: 'JPY', toBase: v => v / 149.5,    fromBase: v => v * 149.5 },
  { label: 'Canadian Dollar',    symbol: 'CAD', toBase: v => v / 1.36,     fromBase: v => v * 1.36 },
  { label: 'Australian Dollar',  symbol: 'AUD', toBase: v => v / 1.53,     fromBase: v => v * 1.53 },
  { label: 'Swiss Franc',        symbol: 'CHF', toBase: v => v / 0.89,     fromBase: v => v * 0.89 },
  { label: 'Chinese Yuan',       symbol: 'CNY', toBase: v => v / 7.24,     fromBase: v => v * 7.24 },
  { label: 'Indian Rupee',       symbol: 'INR', toBase: v => v / 83.1,     fromBase: v => v * 83.1 },
  { label: 'Brazilian Real',     symbol: 'BRL', toBase: v => v / 4.97,     fromBase: v => v * 4.97 },
  { label: 'South Korean Won',   symbol: 'KRW', toBase: v => v / 1325,     fromBase: v => v * 1325 },
  { label: 'Mexican Peso',       symbol: 'MXN', toBase: v => v / 17.15,    fromBase: v => v * 17.15 },
  { label: 'Singapore Dollar',   symbol: 'SGD', toBase: v => v / 1.34,     fromBase: v => v * 1.34 },
  { label: 'Hong Kong Dollar',   symbol: 'HKD', toBase: v => v / 7.82,     fromBase: v => v * 7.82 },
  { label: 'Norwegian Krone',    symbol: 'NOK', toBase: v => v / 10.55,    fromBase: v => v * 10.55 },
  { label: 'Swedish Krona',      symbol: 'SEK', toBase: v => v / 10.42,    fromBase: v => v * 10.42 },
  { label: 'Danish Krone',       symbol: 'DKK', toBase: v => v / 6.89,     fromBase: v => v * 6.89 },
  { label: 'New Zealand Dollar', symbol: 'NZD', toBase: v => v / 1.63,     fromBase: v => v * 1.63 },
  { label: 'South African Rand', symbol: 'ZAR', toBase: v => v / 18.63,    fromBase: v => v * 18.63 },
  { label: 'UAE Dirham',         symbol: 'AED', toBase: v => v / 3.67,     fromBase: v => v * 3.67 },
  { label: 'Saudi Riyal',        symbol: 'SAR', toBase: v => v / 3.75,     fromBase: v => v * 3.75 },
  { label: 'Turkish Lira',       symbol: 'TRY', toBase: v => v / 30.5,     fromBase: v => v * 30.5 },
  { label: 'Russian Ruble',      symbol: 'RUB', toBase: v => v / 91.5,     fromBase: v => v * 91.5 },
  { label: 'Polish Zloty',       symbol: 'PLN', toBase: v => v / 4.02,     fromBase: v => v * 4.02 },
  { label: 'Thai Baht',          symbol: 'THB', toBase: v => v / 35.1,     fromBase: v => v * 35.1 },
];

// Map category → unit array
const UNITS_MAP: Record<Category, Unit[]> = {
  Length: LENGTH_UNITS,
  Weight: WEIGHT_UNITS,
  Temperature: TEMP_UNITS,
  Volume: VOLUME_UNITS,
  Currency: CURRENCY_UNITS,
};

// Emoji for each category tab
const CATEGORY_ICONS: Record<Category, string> = {
  Length: '📏',
  Weight: '⚖️',
  Temperature: '🌡️',
  Volume: '🧪',
  Currency: '💱',
};

const CATEGORIES: Category[] = ['Length', 'Weight', 'Temperature', 'Volume', 'Currency'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert from one unit to another via base unit */
function convert(value: number, from: Unit, to: Unit): number {
  const base = from.toBase(value);
  return to.fromBase(base);
}

/** Format a number with commas and up to 6 significant decimal places */
function formatNumber(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  let decimals = 2;
  if (abs === 0) decimals = 0;
  else if (abs < 0.0001) decimals = 8;
  else if (abs < 0.01) decimals = 6;
  else if (abs < 1) decimals = 4;
  else if (abs < 1000) decimals = 4;
  else decimals = 2;

  return n.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Animated Pressable Component ────────────────────────────────────────────

function AnimatedPressable({
  onPress,
  onLongPress,
  children,
  style,
  haptic = true,
  disabled,
  ...props
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  children: React.ReactNode;
  style?: any;
  haptic?: boolean;
  disabled?: boolean;
  [key: string]: any;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPressIn={() => {
        scale.value = withSpring(0.94, { damping: 15, stiffness: 300 });
        opacity.value = withTiming(0.85, { duration: 80 });
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 250 });
        opacity.value = withTiming(1, { duration: 150 });
      }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      {...props}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Animated Result Component ───────────────────────────────────────────────

function AnimatedResult({ value, unit, style, ...props }: {
  value: string;
  unit: string;
  style?: any;
  [key: string]: any;
}) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 80 });
    translateY.value = withTiming(8, { duration: 80 });
    const t = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    }, 100);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Animated.Text style={[style, animatedStyle]} {...props}>
      {value} {unit}
    </Animated.Text>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ConvertlyApp() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const C = dark ? DARK : LIGHT;

  // App state
  const [activeCategory, setActiveCategory] = useState<Category>('Length');
  const [inputValue, setInputValue] = useState('1');
  const [fromUnit, setFromUnit] = useState<Unit>(LENGTH_UNITS[1]); // Meter
  const [toUnit, setToUnit] = useState<Unit>(LENGTH_UNITS[0]);     // Kilometer

  // Picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to'>('from');

  // Drawer states
  const [showFavorites, setShowFavorites] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  // Persisted data
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);

  // Refs to prevent duplicate haptics
  const lastCategoryRef = useRef<Category>('Length');

  // ── Load persisted data on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const favJson = await AsyncStorage.getItem(FAVORITES_KEY);
        if (favJson) setFavorites(JSON.parse(favJson));
        const recJson = await AsyncStorage.getItem(RECENT_KEY);
        if (recJson) setRecent(JSON.parse(recJson));
      } catch (_) {}
    })();
  }, []);

  // ── When category changes, reset units to sensible defaults ──────────────
  useEffect(() => {
    const units = UNITS_MAP[activeCategory];
    setFromUnit(units[1] ?? units[0]);
    setToUnit(units[0]);
    setInputValue('1');
  }, [activeCategory]);

  // ── Computed result ───────────────────────────────────────────────────────
  const numericInput = parseFloat(inputValue.replace(/,/g, '')) || 0;
  const result = isNaN(numericInput) ? null : convert(numericInput, fromUnit, toUnit);
  const resultStr = result !== null ? formatNumber(result) : '—';

  // ── Save to recent on every valid conversion ──────────────────────────────
  const saveRecent = useCallback(async (res: string) => {
    if (!res || res === '—') return;
    const entry: RecentEntry = {
      id: uid(),
      category: activeCategory,
      from: fromUnit.symbol,
      to: toUnit.symbol,
      inputValue,
      result: res,
      timestamp: Date.now(),
    };
    const updated = [entry, ...recent].slice(0, 30);
    setRecent(updated);
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch (_) {}
  }, [activeCategory, fromUnit, toUnit, inputValue, recent]);

  useEffect(() => {
    if (resultStr !== '—' && inputValue.length > 0) {
      const t = setTimeout(() => saveRecent(resultStr), 600);
      return () => clearTimeout(t);
    }
  }, [resultStr]);

  // ── Swap from/to ──────────────────────────────────────────────────────────
  const handleSwap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const handleCategoryChange = (cat: Category) => {
    if (cat !== lastCategoryRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      lastCategoryRef.current = cat;
    }
    setActiveCategory(cat);
  };

  // ── Favorites ─────────────────────────────────────────────────────────────
  const isFavorited = favorites.some(
    f => f.category === activeCategory && f.from === fromUnit.symbol && f.to === toUnit.symbol
  );

  const toggleFavorite = async () => {
    Haptics.notificationAsync(
      isFavorited ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
    );
    let updated: Favorite[];
    if (isFavorited) {
      updated = favorites.filter(
        f => !(f.category === activeCategory && f.from === fromUnit.symbol && f.to === toUnit.symbol)
      );
    } else {
      const fav: Favorite = { id: uid(), category: activeCategory, from: fromUnit.symbol, to: toUnit.symbol };
      updated = [fav, ...favorites];
    }
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  const loadFavorite = (fav: Favorite) => {
    const units = UNITS_MAP[fav.category];
    const f = units.find(u => u.symbol === fav.from);
    const t = units.find(u => u.symbol === fav.to);
    if (!f || !t) return;
    setActiveCategory(fav.category);
    setTimeout(() => {
      setFromUnit(f);
      setToUnit(t);
      setInputValue('1');
    }, 50);
    setShowFavorites(false);
  };

  const deleteFavorite = async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  // ── Picker helpers ────────────────────────────────────────────────────────
  const openPicker = (target: 'from' | 'to') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const selectUnit = (unit: Unit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (pickerTarget === 'from') setFromUnit(unit);
    else setToUnit(unit);
    setPickerVisible(false);
  };

  // ── Styles (dynamic, dark/light) ──────────────────────────────────────────
  const s = makeStyles(C);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[s.root, { backgroundColor: C.bg }]}>

        {/* ── Gradient Header ───────────────────────────────────────────── */}
        <LinearGradient
          colors={C.headerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.headerGradient}
        >
          <View style={s.header}>
            <View>
              <Text style={s.appTitle}>Convertly</Text>
              <Text style={s.appSubtitle}>Unit & Currency Converter</Text>
            </View>
            <View style={s.headerActions}>
              <AnimatedPressable
                style={s.headerBtn}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowRecent(true); setShowFavorites(false); }}
              >
                <Text style={s.headerBtnIcon}>🕐</Text>
                <Text style={s.headerBtnText}>Recent</Text>
              </AnimatedPressable>
              <AnimatedPressable
                style={[s.headerBtn, { marginLeft: 8 }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFavorites(true); setShowRecent(false); }}
              >
                <Text style={s.headerBtnIcon}>⭐</Text>
                <Text style={s.headerBtnText}>Saved</Text>
              </AnimatedPressable>
            </View>
          </View>

          {/* ── Category Chips ─────────────────────────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContainer}
          >
            {CATEGORIES.map((cat, idx) => {
              const active = cat === activeCategory;
              return (
                <AnimatedPressable
                  key={cat}
                  haptic={false}
                  style={[
                    s.tab,
                    active && s.tabActive,
                  ]}
                  onPress={() => handleCategoryChange(cat)}
                >
                  {active ? (
                    <LinearGradient
                      colors={C.chipGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.tabGradient}
                    >
                      <Text style={[s.tabText, s.tabTextActive]}>
                        {CATEGORY_ICONS[cat]}  {cat}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <>
                      <Text style={[s.tabText, { color: C.textMuted }]}>
                        {CATEGORY_ICONS[cat]}  {cat}
                      </Text>
                    </>
                  )}
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </LinearGradient>

        {/* ── Main Content ─────────────────────────────────────────────── */}
        <ScrollView
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Converter Card */}
          <Animated.View entering={FadeInDown.springify().damping(14).stiffness(120)}>
            <View style={s.glassCard}>
              {/* From Unit */}
              <Text style={[s.sectionLabel, { color: C.accent }]}>FROM</Text>
              <AnimatedPressable
                style={[s.unitSelector, { backgroundColor: C.glassInput }]}
                onPress={() => openPicker('from')}
                haptic={false}
              >
                <View style={s.unitSelectorContent}>
                  <View style={s.unitIconCircle}>
                    <Text style={s.unitIconText}>{fromUnit.symbol.slice(0, 2)}</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[s.unitLabel, { color: C.text }]}>{fromUnit.label}</Text>
                    <Text style={[s.unitSymbol, { color: C.accent }]}>{fromUnit.symbol}</Text>
                  </View>
                </View>
                <Text style={[s.chevron, { color: C.textMuted }]}>›</Text>
              </AnimatedPressable>

              {/* Input */}
              <View style={[s.inputWrapper, { backgroundColor: C.glassInput }]}>
                <Text style={[s.inputPrefix, { color: C.accent }]}>⌨</Text>
                <TextInput
                  style={[s.input, { color: C.text }]}
                  value={inputValue}
                  onChangeText={setInputValue}
                  keyboardType="decimal-pad"
                  placeholder="Enter value"
                  placeholderTextColor={C.textMuted}
                  returnKeyType="done"
                />
              </View>

              {/* Swap + Favorite row */}
              <View style={s.actionsRow}>
                <AnimatedPressable
                  style={[s.actionBtn, { backgroundColor: C.accent }]}
                  onPress={handleSwap}
                >
                  <LinearGradient
                    colors={C.btnGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.actionBtnGradient}
                  >
                    <Text style={s.actionBtnIcon}>⇅</Text>
                    <Text style={s.actionBtnText}>Swap</Text>
                  </LinearGradient>
                </AnimatedPressable>
                <AnimatedPressable
                  style={[
                    s.actionBtn,
                    {
                      marginLeft: 10,
                      backgroundColor: isFavorited ? 'transparent' : C.glassInput,
                      borderWidth: 1,
                      borderColor: isFavorited ? 'transparent' : C.glassBorder,
                    },
                    isFavorited && s.actionBtnFav,
                  ]}
                  onPress={toggleFavorite}
                >
                  <View style={[s.actionBtnInner, isFavorited && s.actionBtnInnerFav]}>
                    <Text style={[s.actionBtnIcon, isFavorited ? { color: '#FCD34D' } : { color: C.textMuted }]}>
                      {isFavorited ? '★' : '☆'}
                    </Text>
                    <Text style={[s.actionBtnText, { color: isFavorited ? '#FCD34D' : C.textMuted }]}>
                      {isFavorited ? 'Saved' : 'Save'}
                    </Text>
                  </View>
                </AnimatedPressable>
              </View>

              {/* To Unit */}
              <Text style={[s.sectionLabel, { color: C.accent, marginTop: 4 }]}>TO</Text>
              <AnimatedPressable
                style={[s.unitSelector, { backgroundColor: C.glassInput }]}
                onPress={() => openPicker('to')}
                haptic={false}
              >
                <View style={s.unitSelectorContent}>
                  <View style={s.unitIconCircle}>
                    <Text style={s.unitIconText}>{toUnit.symbol.slice(0, 2)}</Text>
                  </View>
                  <View style={{ marginLeft: 12 }}>
                    <Text style={[s.unitLabel, { color: C.text }]}>{toUnit.label}</Text>
                    <Text style={[s.unitSymbol, { color: C.accent }]}>{toUnit.symbol}</Text>
                  </View>
                </View>
                <Text style={[s.chevron, { color: C.textMuted }]}>›</Text>
              </AnimatedPressable>

              {/* Result */}
              <View style={[s.resultBox, { borderColor: C.accent }]}>
                <LinearGradient
                  colors={C.resultGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={s.resultGradient}
                >
                  <Text style={[s.resultLabel, { color: C.accent }]}>Result</Text>
                  <AnimatedResult
                    value={resultStr}
                    unit={toUnit.symbol}
                    style={[s.resultValue, { color: C.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  />
                  <Text style={[s.resultEquation, { color: C.textMuted }]}>
                    {formatNumber(numericInput)} {fromUnit.symbol}  =  {resultStr} {toUnit.symbol}
                  </Text>
                  {activeCategory === 'Currency' && (
                    <Text style={s.rateNote}>
                      ⚠️ Rates are approximate
                    </Text>
                  )}
                </LinearGradient>
              </View>
            </View>
          </Animated.View>

          {/* Quick reference card */}
          <Animated.View
            entering={FadeInDown.springify().damping(14).stiffness(120).delay(100)}
          >
            <View style={[s.glassCard, { marginTop: 16 }]}>
              <Text style={[s.cardTitle, { color: C.text }]}>All {activeCategory} Units</Text>
              {UNITS_MAP[activeCategory].map((unit, idx) => {
                const val = convert(numericInput, fromUnit, unit);
                return (
                  <Animated.View
                    key={unit.symbol}
                    entering={FadeInUp.springify().damping(20).stiffness(150).delay(idx * 30)}
                    layout={Layout.springify().damping(20)}
                  >
                    <View style={[s.referenceRow, { borderBottomColor: C.glassBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.refLabel, { color: C.text }]}>{unit.label}</Text>
                        <Text style={[s.refSymbol, { color: C.textMuted }]}>{unit.symbol}</Text>
                      </View>
                      <Text style={[s.refValue, { color: C.accent }]}>{formatNumber(val)}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </Animated.View>
        </ScrollView>

        {/* ── Unit Picker Modal ─────────────────────────────────────────── */}
        <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setPickerVisible(false)}>
            <Animated.View entering={FadeInUp.springify().damping(20)} style={[s.modalSheet, { backgroundColor: C.card }]}>
              <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>
                <View style={s.modalHandle} />
                <Text style={[s.modalTitle, { color: C.text }]}>
                  Select {activeCategory} Unit
                </Text>
                <FlatList
                  data={UNITS_MAP[activeCategory]}
                  keyExtractor={u => u.symbol}
                  renderItem={({ item, index }) => {
                    const isSelected = item.symbol === (pickerTarget === 'from' ? fromUnit : toUnit).symbol;
                    return (
                      <AnimatedPressable
                        style={[
                          s.pickerRow,
                          { borderBottomColor: C.glassBorder },
                          isSelected && { backgroundColor: C.resultBg },
                        ]}
                        onPress={() => selectUnit(item)}
                        haptic={false}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[s.pickerDot, isSelected && { backgroundColor: C.accent }]} />
                          <View style={{ marginLeft: 12 }}>
                            <Text style={[s.pickerLabel, { color: C.text }]}>{item.label}</Text>
                            <Text style={[s.pickerSymbol, { color: isSelected ? C.accent : C.textMuted }]}>
                              {item.symbol}
                            </Text>
                          </View>
                        </View>
                        {isSelected && (
                          <View style={[s.pickerCheck, { backgroundColor: C.accent }]}>
                            <Text style={s.pickerCheckText}>✓</Text>
                          </View>
                        )}
                      </AnimatedPressable>
                    );
                  }}
                />
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* ── Favorites Drawer ──────────────────────────────────────────── */}
        <Modal visible={showFavorites} animationType="slide" transparent onRequestClose={() => setShowFavorites(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setShowFavorites(false)}>
            <Animated.View entering={FadeInUp.springify().damping(20)} style={[s.modalSheet, { backgroundColor: C.card }]}>
              <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>
                <View style={s.modalHandle} />
                <Text style={[s.modalTitle, { color: C.text }]}>⭐ Saved Conversions</Text>
                {favorites.length === 0 ? (
                  <Text style={[s.emptyText, { color: C.textMuted }]}>
                    No favorites yet. Tap ☆ to bookmark a conversion.
                  </Text>
                ) : (
                  <FlatList
                    data={favorites}
                    keyExtractor={f => f.id}
                    renderItem={({ item }) => (
                      <AnimatedPressable
                        style={[s.pickerRow, { borderBottomColor: C.glassBorder }]}
                        onPress={() => loadFavorite(item)}
                        haptic={false}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.pickerLabel, { color: C.text }]}>
                            {CATEGORY_ICONS[item.category]}  {item.category}
                          </Text>
                          <Text style={[s.pickerSymbol, { color: C.accent }]}>
                            {item.from}  →  {item.to}
                          </Text>
                        </View>
                        <AnimatedPressable
                          onPress={() => deleteFavorite(item.id)}
                          style={s.deleteBtn}
                          haptic={false}
                        >
                          <Text style={{ color: '#EF4444', fontSize: 16, fontWeight: '700' }}>✕</Text>
                        </AnimatedPressable>
                      </AnimatedPressable>
                    )}
                  />
                )}
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* ── Recent Drawer ─────────────────────────────────────────────── */}
        <Modal visible={showRecent} animationType="slide" transparent onRequestClose={() => setShowRecent(false)}>
          <Pressable style={s.modalOverlay} onPress={() => setShowRecent(false)}>
            <Animated.View entering={FadeInUp.springify().damping(20)} style={[s.modalSheet, { backgroundColor: C.card }]}>
              <Pressable onPress={e => e.stopPropagation()} style={{ flex: 1 }}>
                <View style={s.modalHandle} />
                <Text style={[s.modalTitle, { color: C.text }]}>🕐 Recent Conversions</Text>
                {recent.length === 0 ? (
                  <Text style={[s.emptyText, { color: C.textMuted }]}>No recent conversions yet.</Text>
                ) : (
                  <FlatList
                    data={recent}
                    keyExtractor={r => r.id}
                    renderItem={({ item }) => (
                      <AnimatedPressable
                        style={[s.pickerRow, { borderBottomColor: C.glassBorder }]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const units = UNITS_MAP[item.category];
                          const f = units.find(u => u.symbol === item.from);
                          const t = units.find(u => u.symbol === item.to);
                          if (f && t) {
                            setActiveCategory(item.category);
                            setTimeout(() => {
                              setFromUnit(f);
                              setToUnit(t);
                              setInputValue(item.inputValue);
                            }, 50);
                          }
                          setShowRecent(false);
                        }}
                        haptic={false}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[s.pickerLabel, { color: C.text }]}>
                            {CATEGORY_ICONS[item.category]}  {item.inputValue} {item.from}  →  {item.result} {item.to}
                          </Text>
                          <Text style={[s.pickerSymbol, { color: C.textMuted }]}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      </AnimatedPressable>
                    )}
                  />
                )}
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────
interface Colors {
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
  inputBg: string;
  resultBg: string;
  headerText: string;
  headerMuted: string;
  headerGradient: readonly [string, string, ...string[]];
  chipGradient: readonly [string, string, ...string[]];
  resultGradient: readonly [string, string, ...string[]];
  btnGradient: readonly [string, string, ...string[]];
  glassInput: string;
  glassBorder: string;
}

const LIGHT: Colors = {
  bg: '#F0EFFA',
  card: 'rgba(255,255,255,0.72)',
  text: '#1E1B4B',
  textMuted: '#64748B',
  accent: '#6C63FF',
  border: '#E5E7EB',
  inputBg: '#F9FAFB',
  resultBg: 'rgba(108,99,255,0.08)',
  headerText: '#1E1B4B',
  headerMuted: '#64748B',
  headerGradient: ['rgba(108,99,255,0.06)', 'rgba(59,130,246,0.04)'],
  chipGradient: ['#6C63FF', '#3B82F6', '#06B6D4'],
  resultGradient: ['rgba(108,99,255,0.06)', 'rgba(6,182,212,0.03)'],
  btnGradient: ['#6C63FF', '#3B82F6'],
  glassInput: 'rgba(255,255,255,0.55)',
  glassBorder: 'rgba(255,255,255,0.35)',
};

const DARK: Colors = {
  bg: '#08080F',
  card: 'rgba(255,255,255,0.05)',
  text: '#F1F5F9',
  textMuted: '#64748B',
  accent: '#8B83FF',
  border: '#1E293B',
  inputBg: 'rgba(255,255,255,0.04)',
  resultBg: 'rgba(139,131,255,0.1)',
  headerText: '#F1F5F9',
  headerMuted: '#94A3B8',
  headerGradient: ['rgba(139,131,255,0.08)', 'rgba(59,130,246,0.04)'],
  chipGradient: ['#7C3AED', '#3B82F6', '#06B6D4'],
  resultGradient: ['rgba(139,131,255,0.06)', 'rgba(6,182,212,0.02)'],
  btnGradient: ['#7C3AED', '#3B82F6'],
  glassInput: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.08)',
};

// ─── Styles Factory ───────────────────────────────────────────────────────────
function makeStyles(C: Colors) {
  return StyleSheet.create({
    root: { flex: 1 },

    // Header
    headerGradient: {
      paddingTop: 4,
      paddingBottom: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 8,
    },
    appTitle: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.8,
      color: C.headerText,
    },
    appSubtitle: {
      fontSize: 12,
      fontWeight: '500',
      color: C.headerMuted,
      letterSpacing: 0.2,
      marginTop: 1,
    },
    headerActions: { flexDirection: 'row' },
    headerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.5)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.6)',
    },
    headerBtnIcon: { fontSize: 14, marginRight: 4 },
    headerBtnText: { fontSize: 12, fontWeight: '600', color: C.headerMuted },

    // Tabs
    tabsScroll: { flexGrow: 0, marginTop: 4 },
    tabsContainer: {
      paddingHorizontal: 16,
      paddingBottom: 10,
      flexDirection: 'row',
    },
    tab: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
      paddingVertical: 2,
      borderRadius: 24,
      marginRight: 8,
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.5)',
    },
    tabActive: {
      borderWidth: 0,
    },
    tabGradient: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#FFFFFF',
    },

    // Scroll + Card
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 12,
    },
    glassCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.glassBorder,
      backgroundColor: C.card,
      padding: 18,
      shadowColor: '#6C63FF',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 14,
      letterSpacing: -0.3,
    },

    // Converter
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 6,
      marginTop: 4,
    },
    unitSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.glassBorder,
      padding: 14,
      marginBottom: 10,
    },
    unitSelectorContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    unitIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: 'rgba(108,99,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    unitIconText: {
      fontSize: 14,
      fontWeight: '700',
      color: C.accent,
    },
    unitLabel: { fontSize: 16, fontWeight: '600' },
    unitSymbol: { fontSize: 12, fontWeight: '500', marginTop: 2, opacity: 0.8 },
    chevron: { fontSize: 24, fontWeight: '300' },

    // Input
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.glassBorder,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    inputPrefix: {
      fontSize: 18,
      marginRight: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 22,
      fontWeight: '600',
    },
    actionsRow: { flexDirection: 'row', marginBottom: 10 },
    actionBtn: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
    },
    actionBtnGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    actionBtnInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
    },
    actionBtnInnerFav: {
      borderRadius: 14,
    },
    actionBtnFav: {
      borderWidth: 1.5,
      borderColor: 'rgba(252,211,77,0.3)',
      backgroundColor: 'rgba(252,211,77,0.08)',
    },
    actionBtnIcon: { fontSize: 16, marginRight: 6, fontWeight: '700' },
    actionBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

    // Result
    resultBox: {
      borderRadius: 16,
      borderWidth: 1.5,
      overflow: 'hidden',
      marginTop: 8,
    },
    resultGradient: {
      padding: 18,
    },
    resultLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    resultValue: {
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -1,
      marginBottom: 4,
    },
    resultEquation: {
      fontSize: 12,
      marginTop: 2,
      fontWeight: '500',
    },
    rateNote: {
      fontSize: 11,
      marginTop: 8,
      fontStyle: 'italic',
      color: '#94A3B8',
    },

    // Reference list
    referenceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    refLabel: { fontSize: 14, fontWeight: '500' },
    refSymbol: { fontSize: 11, marginTop: 1, opacity: 0.7 },
    refValue: { fontSize: 15, fontWeight: '700' },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 12,
      maxHeight: '75%',
      borderWidth: 1,
      borderColor: C.glassBorder,
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: '#94A3B8',
      alignSelf: 'center',
      marginBottom: 14,
      opacity: 0.5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      paddingHorizontal: 24,
      marginBottom: 12,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'transparent',
    },
    pickerCheck: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickerCheckText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    pickerLabel: { fontSize: 15, fontWeight: '500' },
    pickerSymbol: { fontSize: 13, fontWeight: '600', marginTop: 1 },
    deleteBtn: { padding: 8 },
    emptyText: { padding: 32, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  });
}
