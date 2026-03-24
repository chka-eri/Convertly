import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText, ThemedView } from '@/components/Themed';

type Category = 'Length' | 'Weight' | 'Temperature' | 'Volume' | 'Currency';
type LinearMap = Record<string, number>;

type RecentConversion = {
  id: string;
  category: Category;
  amount: number;
  from: string;
  to: string;
  result: number;
  createdAt: string;
};

const STORAGE_KEY = '@Convertly_recent';
const CATEGORIES: Category[] = ['Length', 'Weight', 'Temperature', 'Volume', 'Currency'];

const LENGTH_UNITS: LinearMap = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
  km: 1000,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
  mi: 1609.344,
};

const WEIGHT_UNITS: LinearMap = {
  mg: 0.000001,
  g: 0.001,
  kg: 1,
  oz: 0.028349523125,
  lb: 0.45359237,
  stone: 6.35029318,
  tonne: 1000,
};

const VOLUME_UNITS: LinearMap = {
  ml: 0.001,
  l: 1,
  m3: 1000,
  tsp: 0.00492892159375,
  tbsp: 0.01478676478125,
  cup: 0.2365882365,
  pt: 0.473176473,
  qt: 0.946352946,
  gal: 3.785411784,
};

const CURRENCY_TO_USD: LinearMap = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CAD: 1.36,
  AUD: 1.53,
  CHF: 0.89,
  CNY: 7.2,
  INR: 83.2,
  MXN: 17.1,
};

const UNITS_BY_CATEGORY: Record<Category, string[]> = {
  Length: Object.keys(LENGTH_UNITS),
  Weight: Object.keys(WEIGHT_UNITS),
  Temperature: ['C', 'F', 'K'],
  Volume: Object.keys(VOLUME_UNITS),
  Currency: Object.keys(CURRENCY_TO_USD),
};

function formatResult(value: number): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.abs(value) >= 1 ? 6 : 8,
  }).format(value);
}

function convertTemperature(value: number, from: string, to: string): number {
  let celsius = value;
  if (from === 'F') celsius = ((value - 32) * 5) / 9;
  if (from === 'K') celsius = value - 273.15;

  if (to === 'C') return celsius;
  if (to === 'F') return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

function convertValue(category: Category, amount: number, from: string, to: string): number {
  if (!Number.isFinite(amount)) return NaN;
  if (from === to) return amount;

  if (category === 'Temperature') return convertTemperature(amount, from, to);

  if (category === 'Currency') {
    const fromRate = CURRENCY_TO_USD[from];
    const toRate = CURRENCY_TO_USD[to];
    if (!fromRate || !toRate) return NaN;
    const usd = amount / fromRate;
    return usd * toRate;
  }

  const table = category === 'Length' ? LENGTH_UNITS : category === 'Weight' ? WEIGHT_UNITS : VOLUME_UNITS;
  const fromBase = table[from];
  const toBase = table[to];
  if (!fromBase || !toBase) return NaN;
  return (amount * fromBase) / toBase;
}

export default function ConvertlyScreen() {
  const [category, setCategory] = useState<Category>('Length');
  const [amount, setAmount] = useState('');
  const [fromUnit, setFromUnit] = useState<string>(UNITS_BY_CATEGORY.Length[0]);
  const [toUnit, setToUnit] = useState<string>(UNITS_BY_CATEGORY.Length[1]);
  const [recent, setRecent] = useState<RecentConversion[]>([]);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setRecent([]);
          return;
        }
        const parsed = JSON.parse(raw) as RecentConversion[];
        setRecent(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRecent([]);
      }
    };

    void loadRecent();
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
      if (amount.trim() === '') return;
      if (!Number.isFinite(numericAmount) || !Number.isFinite(converted)) return;

      const entry: RecentConversion = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        category,
        amount: numericAmount,
        from: fromUnit,
        to: toUnit,
        result: converted,
        createdAt: new Date().toISOString(),
      };

      setRecent((prev) => {
        const deduped = prev.filter(
          (item) =>
            !(
              item.category === entry.category &&
              item.amount === entry.amount &&
              item.from === entry.from &&
              item.to === entry.to &&
              Math.abs(item.result - entry.result) < 1e-12
            ),
        );
        const next = [entry, ...deduped].slice(0, 12);
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    };

    const timer = setTimeout(() => {
      void saveRecent();
    }, 350);

    return () => clearTimeout(timer);
  }, [amount, numericAmount, converted, category, fromUnit, toUnit]);

  const swapUnits = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Convertly
      </ThemedText>

      <View style={styles.segmentRow}>
        {CATEGORIES.map((item) => {
          const active = item === category;
          return (
            <TouchableOpacity
              key={item}
              style={[styles.segmentButton, active && styles.segmentButtonActive]}
              onPress={() => setCategory(item)}>
              <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>{item}</ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <ThemedText style={styles.label}>Amount</ThemedText>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder=""
        style={styles.input}
      />

      <ThemedText style={styles.label}>From</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
        {UNITS_BY_CATEGORY[category].map((unit) => (
          <TouchableOpacity
            key={`from-${unit}`}
            style={[styles.unitButton, fromUnit === unit && styles.unitButtonActive]}
            onPress={() => setFromUnit(unit)}>
            <ThemedText style={[styles.unitText, fromUnit === unit && styles.unitTextActive]}>{unit}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.swapRow}>
        <TouchableOpacity style={styles.swapButton} onPress={swapUnits}>
          <ThemedText style={styles.swapText}>Swap</ThemedText>
        </TouchableOpacity>
      </View>

      <ThemedText style={styles.label}>To</ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitsScroll}>
        {UNITS_BY_CATEGORY[category].map((unit) => (
          <TouchableOpacity
            key={`to-${unit}`}
            style={[styles.unitButton, toUnit === unit && styles.unitButtonActive]}
            onPress={() => setToUnit(unit)}>
            <ThemedText style={[styles.unitText, toUnit === unit && styles.unitTextActive]}>{unit}</ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ThemedView style={styles.resultCard}>
        <ThemedText style={styles.resultLabel}>Result</ThemedText>
        <ThemedText type="subtitle" style={styles.resultValue}>
          {Number.isFinite(converted) ? formatResult(converted) : ''}
        </ThemedText>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.recentTitle}>
        Recent Conversions
      </ThemedText>

      <ScrollView style={styles.recentList}>
        {recent.length === 0 ? (
          <ThemedText style={styles.emptyText}>No recent conversions yet.</ThemedText>
        ) : (
          recent.map((item) => (
            <ThemedView key={item.id} style={styles.recentItem}>
              <ThemedText>
                {item.amount} {item.from} → {formatResult(item.result)} {item.to}
              </ThemedText>
              <Text style={styles.recentMeta}>{item.category}</Text>
            </ThemedView>
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  title: {
    marginBottom: 14,
    textAlign: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  segmentButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },
  segmentButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  segmentText: {
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#9CA3AF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  unitsScroll: {
    marginBottom: 8,
  },
  unitButton: {
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },
  unitButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  unitText: {
    fontSize: 14,
  },
  unitTextActive: {
    color: '#FFFFFF',
  },
  swapRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  swapButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#374151',
  },
  swapText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  resultCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9CA3AF',
  },
  resultLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultValue: {
    minHeight: 28,
  },
  recentTitle: {
    marginTop: 14,
    marginBottom: 8,
  },
  recentList: {
    flex: 1,
  },
  emptyText: {
    opacity: 0.7,
    marginTop: 4,
  },
  recentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recentMeta: {
    marginTop: 4,
    fontSize: 12,
    color: '#6B7280',
  },
});
