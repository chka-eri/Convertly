// app/index.tsx — Convertly: Offline Unit & Currency Converter
// Run: npx expo install @react-native-async-storage/async-storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
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
  // Determine significant decimal places
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
    const updated = [entry, ...recent].slice(0, 30); // keep last 30
    setRecent(updated);
    try {
      await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch (_) {}
  }, [activeCategory, fromUnit, toUnit, inputValue, recent]);

  // Save recent when result changes (debounce via useEffect)
  useEffect(() => {
    if (resultStr !== '—' && inputValue.length > 0) {
      const t = setTimeout(() => saveRecent(resultStr), 600);
      return () => clearTimeout(t);
    }
  }, [resultStr]);

  // ── Swap from/to ──────────────────────────────────────────────────────────
  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  // ── Favorites ─────────────────────────────────────────────────────────────
  const isFavorited = favorites.some(
    f => f.category === activeCategory && f.from === fromUnit.symbol && f.to === toUnit.symbol
  );

  const toggleFavorite = async () => {
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
    // Units will be reset by category effect, so set after a tick
    setTimeout(() => {
      setFromUnit(f);
      setToUnit(t);
      setInputValue('1');
    }, 50);
    setShowFavorites(false);
  };

  const deleteFavorite = async (id: string) => {
    const updated = favorites.filter(f => f.id !== id);
    setFavorites(updated);
    try {
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  };

  // ── Picker helpers ────────────────────────────────────────────────────────
  const openPicker = (target: 'from' | 'to') => {
    setPickerTarget(target);
    setPickerVisible(true);
  };

  const selectUnit = (unit: Unit) => {
    if (pickerTarget === 'from') setFromUnit(unit);
    else setToUnit(unit);
    setPickerVisible(false);
  };

  // ── Styles (dynamic, dark/light) ──────────────────────────────────────────
  const s = makeStyles(C);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Text style={[s.appTitle, { color: C.text }]}>Convertly</Text>
        <View style={s.headerActions}>
          <TouchableOpacity style={s.headerBtn} onPress={() => { setShowRecent(true); setShowFavorites(false); }}>
            <Text style={[s.headerBtnText, { color: C.accent }]}>🕐 Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.headerBtn} onPress={() => { setShowFavorites(true); setShowRecent(false); }}>
            <Text style={[s.headerBtnText, { color: C.accent }]}>⭐ Saved</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category Tabs ─────────────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsContainer}>
        {CATEGORIES.map(cat => {
          const active = cat === activeCategory;
          return (
            <TouchableOpacity
              key={cat}
              style={[s.tab, active && { backgroundColor: C.accent, borderColor: C.accent }]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[s.tabText, { color: active ? '#fff' : C.textMuted }]}>
                {CATEGORY_ICONS[cat]}{'  '}{cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Main Converter Card ───────────────────────────────────────────── */}
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>

          {/* From Unit */}
          <Text style={[s.sectionLabel, { color: C.textMuted }]}>FROM</Text>
          <TouchableOpacity style={[s.unitSelector, { backgroundColor: C.inputBg, borderColor: C.border }]} onPress={() => openPicker('from')}>
            <View>
              <Text style={[s.unitLabel, { color: C.text }]}>{fromUnit.label}</Text>
              <Text style={[s.unitSymbol, { color: C.accent }]}>{fromUnit.symbol}</Text>
            </View>
            <Text style={[s.chevron, { color: C.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Input */}
          <TextInput
            style={[s.input, { backgroundColor: C.inputBg, borderColor: C.border, color: C.text }]}
            value={inputValue}
            onChangeText={setInputValue}
            keyboardType="decimal-pad"
            placeholder="Enter value"
            placeholderTextColor={C.textMuted}
            returnKeyType="done"
          />

          {/* Swap + Favorite row */}
          <View style={s.actionsRow}>
            <TouchableOpacity style={[s.actionBtn, { backgroundColor: C.accent }]} onPress={handleSwap}>
              <Text style={s.actionBtnText}>⇅ Swap</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtnLast, { backgroundColor: isFavorited ? '#f59e0b' : C.inputBg, borderColor: C.border }]}
              onPress={toggleFavorite}
            >
              <Text style={[s.actionBtnText, { color: isFavorited ? '#fff' : C.textMuted }]}>
                {isFavorited ? '★ Saved' : '☆ Save'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* To Unit */}
          <Text style={[s.sectionLabel, { color: C.textMuted, marginTop: 8 }]}>TO</Text>
          <TouchableOpacity style={[s.unitSelector, { backgroundColor: C.inputBg, borderColor: C.border }]} onPress={() => openPicker('to')}>
            <View>
              <Text style={[s.unitLabel, { color: C.text }]}>{toUnit.label}</Text>
              <Text style={[s.unitSymbol, { color: C.accent }]}>{toUnit.symbol}</Text>
            </View>
            <Text style={[s.chevron, { color: C.textMuted }]}>›</Text>
          </TouchableOpacity>

          {/* Result */}
          <View style={[s.resultBox, { backgroundColor: C.resultBg, borderColor: C.accent }]}>
            <Text style={[s.resultLabel, { color: C.accent }]}>Result</Text>
            <Text style={[s.resultValue, { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit>
              {resultStr} {toUnit.symbol}
            </Text>
            <Text style={[s.resultEquation, { color: C.textMuted }]}>
              {formatNumber(numericInput)} {fromUnit.symbol} = {resultStr} {toUnit.symbol}
            </Text>
            {activeCategory === 'Currency' && (
              <Text style={[s.rateNote, { color: C.textMuted }]}>
                ⚠️ Rates are approximate. For live rates use a connected app.
              </Text>
            )}
          </View>
        </View>

        {/* Quick reference: all units in this category */}
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border, marginTop: 16 }]}>
          <Text style={[s.cardTitle, { color: C.text }]}>All {activeCategory} Units</Text>
          {UNITS_MAP[activeCategory].map(unit => {
            const val = convert(numericInput, fromUnit, unit);
            return (
              <View key={unit.symbol} style={[s.referenceRow, { borderBottomColor: C.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.refLabel, { color: C.text }]}>{unit.label}</Text>
                  <Text style={[s.refSymbol, { color: C.textMuted }]}>{unit.symbol}</Text>
                </View>
                <Text style={[s.refValue, { color: C.accent }]}>{formatNumber(val)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Unit Picker Modal ─────────────────────────────────────────────── */}
      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: C.card }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: C.text }]}>
              Select {activeCategory} Unit
            </Text>
            <FlatList
              data={UNITS_MAP[activeCategory]}
              keyExtractor={u => u.symbol}
              renderItem={({ item }) => {
                const isSelected = item.symbol === (pickerTarget === 'from' ? fromUnit : toUnit).symbol;
                return (
                  <TouchableOpacity
                    style={[s.pickerRow, { borderBottomColor: C.border }, isSelected && { backgroundColor: C.resultBg }]}
                    onPress={() => selectUnit(item)}
                  >
                    <Text style={[s.pickerLabel, { color: C.text }]}>{item.label}</Text>
                    <Text style={[s.pickerSymbol, { color: isSelected ? C.accent : C.textMuted }]}>{item.symbol}</Text>
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Favorites Drawer ──────────────────────────────────────────────── */}
      <Modal visible={showFavorites} animationType="slide" transparent onRequestClose={() => setShowFavorites(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowFavorites(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: C.card }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: C.text }]}>⭐ Saved Conversions</Text>
            {favorites.length === 0 ? (
              <Text style={[s.emptyText, { color: C.textMuted }]}>No favorites yet. Tap ☆ Save to bookmark a conversion.</Text>
            ) : (
              <FlatList
                data={favorites}
                keyExtractor={f => f.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[s.pickerRow, { borderBottomColor: C.border }]} onPress={() => loadFavorite(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.pickerLabel, { color: C.text }]}>{CATEGORY_ICONS[item.category]} {item.category}</Text>
                      <Text style={[s.pickerSymbol, { color: C.accent }]}>{item.from} → {item.to}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteFavorite(item.id)} style={s.deleteBtn}>
                      <Text style={{ color: '#ef4444', fontSize: 18 }}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Recent Drawer ─────────────────────────────────────────────────── */}
      <Modal visible={showRecent} animationType="slide" transparent onRequestClose={() => setShowRecent(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setShowRecent(false)}>
          <Pressable style={[s.modalSheet, { backgroundColor: C.card }]} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: C.text }]}>🕐 Recent Conversions</Text>
            {recent.length === 0 ? (
              <Text style={[s.emptyText, { color: C.textMuted }]}>No recent conversions yet.</Text>
            ) : (
              <FlatList
                data={recent}
                keyExtractor={r => r.id}
                renderItem={({ item }) => (
                  <View style={[s.pickerRow, { borderBottomColor: C.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.pickerLabel, { color: C.text }]}>
                        {CATEGORY_ICONS[item.category]} {item.inputValue} {item.from} → {item.result} {item.to}
                      </Text>
                      <Text style={[s.pickerSymbol, { color: C.textMuted }]}>
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </SafeAreaView>
  );
}

// ─── Theme Colors ─────────────────────────────────────────────────────────────
const LIGHT = {
  bg: '#f0f4ff',
  card: '#ffffff',
  text: '#1a1a2e',
  textMuted: '#6b7280',
  accent: '#3b82f6',
  border: '#e5e7eb',
  inputBg: '#f9fafb',
  resultBg: '#eff6ff',
};

const DARK = {
  bg: '#0f172a',
  card: '#1e293b',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  accent: '#60a5fa',
  border: '#334155',
  inputBg: '#0f172a',
  resultBg: '#1e3a5f',
};

type Colors = typeof LIGHT;

// ─── Styles Factory ───────────────────────────────────────────────────────────
function makeStyles(C: Colors) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    },
    appTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
    headerActions: { flexDirection: 'row' },
    headerBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: 'rgba(59,130,246,0.12)', marginLeft: 8 },
    headerBtnText: { fontSize: 13, fontWeight: '600' },

    // Tabs
    tabsScroll: { flexGrow: 0 },
    tabsContainer: { paddingHorizontal: 12, paddingBottom: 12, flexDirection: 'row' },
    tab: {
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 16, paddingVertical: 9,
      borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent',
      backgroundColor: 'rgba(0,0,0,0.06)', marginRight: 8,
    },
    tabText: { fontSize: 13, fontWeight: '600' },

    // Scroll + Card
    scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
    card: {
      borderRadius: 16, borderWidth: 1,
      padding: 16, marginBottom: 0,
    },
    cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },

    // Converter
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
    unitSelector: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12,
    },
    unitLabel: { fontSize: 16, fontWeight: '600' },
    unitSymbol: { fontSize: 12, fontWeight: '500', marginTop: 2 },
    chevron: { fontSize: 26, fontWeight: '300' },
    input: {
      borderRadius: 12, borderWidth: 1, padding: 14,
      fontSize: 22, fontWeight: '600', marginBottom: 12,
    },
    actionsRow: { flexDirection: 'row', marginBottom: 12 },
    actionBtn: {
      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
      borderWidth: 1, borderColor: 'transparent', marginRight: 10,
    },
    actionBtnLast: {
      flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center',
      borderWidth: 1, borderColor: 'transparent',
    },
    actionBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

    // Result
    resultBox: {
      borderRadius: 14, borderWidth: 1.5, padding: 16, marginTop: 8,
    },
    resultLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
    resultValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, marginBottom: 4 },
    resultEquation: { fontSize: 12, marginTop: 2 },
    rateNote: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },

    // Reference list
    referenceRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    refLabel: { fontSize: 14, fontWeight: '500' },
    refSymbol: { fontSize: 11, marginTop: 1 },
    refValue: { fontSize: 15, fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, maxHeight: '75%' },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#94a3b8', alignSelf: 'center', marginBottom: 12 },
    modalTitle: { fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerLabel: { fontSize: 15, fontWeight: '500' },
    pickerSymbol: { fontSize: 13, fontWeight: '600' },
    deleteBtn: { padding: 8 },
    emptyText: { padding: 24, textAlign: 'center', fontSize: 14 },
  });
}