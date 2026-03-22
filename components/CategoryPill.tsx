// components/CategoryPill.tsx
import { View, Text, StyleSheet } from 'react-native';
import { CategoryKey, CATEGORY_LABELS } from '../types';
import { CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS } from '../constants/theme';

export default function CategoryPill({ category }: { category: CategoryKey }) {
  const color = CATEGORY_COLORS[category];
  const bg = CATEGORY_BG[category];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color }]}>{CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
    marginBottom: 6,
  },
  pillText: { fontSize: 11, fontWeight: '600' },
});
