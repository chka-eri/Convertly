import { ThemedText, ThemedView } from '@/components/Themed';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

const CATEGORIES = ['Length', 'Weight', 'Temperature', 'Volume', 'Currency'];

const CONVERSIONS = {
  Length: { 'Meter (m)': 1, 'Foot (ft)': 3.28084, 'Inch (in)': 39.3701, 'Kilometer (km)': 0.001 },
  Weight: { 'Kilogram (kg)': 1, 'Pound (lb)': 2.20462, 'Gram (g)': 1000 },
  Temperature: { 'Celsius (°C)': (v) => v, 'Fahrenheit (°F)': (v) => (v * 9/5) + 32, 'Kelvin (K)': (v) => v + 273.15 },
  Volume: { 'Liter (L)': 1, 'Gallon (US)': 0.264172, 'Milliliter (mL)': 1000 },
  Currency: { 'USD': 1, 'EUR': 0.92, 'GBP': 0.79, 'INR': 83.5 },
};

export default function Convertly() {
  const [category, setCategory] = useState('Length');
  const [amount, setAmount] = useState('');
  const [fromUnit, setFromUnit] = useState('');
  const [toUnit, setToUnit] = useState('');
  const [result, setResult] = useState('');
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const loadRecent = async () => {
      try {
        const saved = await AsyncStorage.getItem('@Convertly_recent');
        if (saved) setRecent(JSON.parse(saved));
      } catch (e) {}
    };
    loadRecent();
  }, []);

  const saveRecent = async (newRecent) => {
    try {
      await AsyncStorage.setItem('@Convertly_recent', JSON.stringify(newRecent));
      setRecent(newRecent);
    } catch (e) {}
  };

  const performConversion = () => {
    if (!amount || !fromUnit || !toUnit) {
      setResult('');
      return;
    }

    const value = parseFloat(amount);
    if (isNaN(value)) {
      setResult('Invalid number');
      return;
    }

    let converted = value;

    if (category === 'Temperature') {
      let celsius = value;
      if (fromUnit.includes('Fahrenheit')) celsius = (value - 32) * 5 / 9;
      if (fromUnit.includes('Kelvin')) celsius = value - 273.15;

      if (toUnit.includes('Fahrenheit')) converted = celsius * 9 / 5 + 32;
      else if (toUnit.includes('Kelvin')) converted = celsius + 273.15;
      else converted = celsius;
    } else {
      const fromRate = CONVERSIONS[category][fromUnit] || 1;
      const toRate = CONVERSIONS[category][toUnit] || 1;
      converted = (value / fromRate) * toRate;
    }

    setResult(Number(converted.toFixed(4)).toLocaleString());

    const newEntry = { 
      category, 
      from: `${amount} ${fromUnit}`, 
      to: `${Number(converted.toFixed(4)).toLocaleString()} ${toUnit}` 
    };
    const updatedRecent = [newEntry, ...recent.slice(0, 9)];
    saveRecent(updatedRecent);
  };

  useEffect(() => {
    performConversion();
  }, [amount, fromUnit, toUnit, category]);

  const swapUnits = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Convertly</ThemedText>
      <ThemedText style={styles.subtitle}>Fully offline unit & currency converter</ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryBtn, category === cat && styles.activeBtn]}
            onPress={() => {
              setCategory(cat);
              setFromUnit('');
              setToUnit('');
              setAmount('');
              setResult('');
            }}
          >
            <ThemedText style={category === cat ? styles.activeText : styles.inactiveText}>
              {cat}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ThemedText style={styles.label}>Amount</ThemedText>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder="Enter value"
        placeholderTextColor="#888"
      />

      <View style={styles.row}>
        <View style={styles.pickerContainer}>
          <ThemedText style={styles.label}>From</ThemedText>
          <TextInput 
            style={styles.unitPicker} 
            value={fromUnit} 
            onChangeText={setFromUnit} 
            placeholder="Select unit" 
            placeholderTextColor="#888" 
          />
        </View>

        <TouchableOpacity style={styles.swapBtn} onPress={swapUnits}>
          <ThemedText style={{ fontSize: 24 }}>⇄</ThemedText>
        </TouchableOpacity>

        <View style={styles.pickerContainer}>
          <ThemedText style={styles.label}>To</ThemedText>
          <TextInput 
            style={styles.unitPicker} 
            value={toUnit} 
            onChangeText={setToUnit} 
            placeholder="Select unit" 
            placeholderTextColor="#888" 
          />
        </View>
      </View>

      <ThemedView style={styles.resultBox}>
        <ThemedText style={styles.label}>Converted value</ThemedText>
        <ThemedText style={styles.result}>{result || '—'}</ThemedText>
      </ThemedView>

      <ThemedText style={styles.sectionTitle}>Recent Conversions</ThemedText>
      {recent.length === 0 ? (
        <ThemedText style={styles.emptyText}>No recent conversions yet.</ThemedText>
      ) : (
        recent.map((item, index) => (
          <ThemedView key={index} style={styles.recentItem}>
            <ThemedText style={{ fontWeight: '600' }}>{item.category}</ThemedText>
            <ThemedText>{item.from} → {item.to}</ThemedText>
          </ThemedView>
        ))
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 36, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 16, opacity: 0.7, marginBottom: 20 },
  categoryScroll: { marginBottom: 20 },
  categoryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: '#333' },
  activeBtn: { backgroundColor: '#007AFF' },
  activeText: { color: 'white', fontWeight: '600' },
  inactiveText: { color: '#ccc' },
  label: { fontSize: 16, marginBottom: 8, opacity: 0.8 },
  input: { backgroundColor: '#333', color: 'white', padding: 14, borderRadius: 12, fontSize: 18, marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  pickerContainer: { flex: 1 },
  unitPicker: { backgroundColor: '#333', color: 'white', padding: 14, borderRadius: 12, fontSize: 16 },
  swapBtn: { padding: 12, marginHorizontal: 10 },
  resultBox: { backgroundColor: '#222', padding: 20, borderRadius: 16, marginBottom: 30 },
  result: { fontSize: 32, fontWeight: 'bold', color: '#007AFF' },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  recentItem: { backgroundColor: '#222', padding: 16, borderRadius: 12, marginBottom: 8 },
  emptyText: { color: '#888', fontStyle: 'italic' },
});