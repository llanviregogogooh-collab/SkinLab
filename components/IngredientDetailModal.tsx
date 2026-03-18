// components/IngredientDetailModal.tsx
import { View, Text, ScrollView, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, shadow } from '../constants/theme';
import { IngredientEntry } from '../types';
import CategoryPill from './CategoryPill';

interface Props {
  ingredient: IngredientEntry | null;
  onClose: () => void;
}

export default function IngredientDetailModal({ ingredient, onClose }: Props) {
  if (!ingredient) return null;
  const ing = ingredient;

  return (
    <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <LinearGradient
            colors={[C.accentSoft, C.bg]}
            style={styles.header}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTitleWrap}>
                <Text style={styles.title}>{ing.name_cosmetic}</Text>
                <Text style={styles.subtitle}>{ing.name_inci}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pills}>
              {ing.categories.map((cat) => (
                <CategoryPill key={cat} category={cat} />
              ))}
            </View>
          </LinearGradient>

          <View style={styles.body}>
            {/* 概要 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>📋</Text>
                <Text style={styles.cardTitle}>概要</Text>
              </View>
              <Text style={styles.cardBody}>{ing.description}</Text>
            </View>

            {/* 安全性 */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardIcon}>🛡</Text>
                <Text style={styles.cardTitle}>安全性</Text>
              </View>
              <View style={styles.safetyRow}>
                <View style={styles.safetyBox}>
                  <Text style={styles.safetyLabel}>刺激性</Text>
                  <Text style={[styles.safetyValue, {
                    color: ing.safety.irritation === 'low' ? '#10B981' :
                           ing.safety.irritation === 'medium' ? C.gold : C.pink
                  }]}>
                    {ing.safety.irritation === 'low' ? '低' : ing.safety.irritation === 'medium' ? '中' : '高'}
                  </Text>
                </View>
                <View style={styles.safetyBox}>
                  <Text style={styles.safetyLabel}>光感受性</Text>
                  <Text style={[styles.safetyValue, { color: ing.safety.photosensitivity ? C.orange : '#10B981' }]}>
                    {ing.safety.photosensitivity ? 'あり' : 'なし'}
                  </Text>
                </View>
                <View style={styles.safetyBox}>
                  <Text style={styles.safetyLabel}>コメド</Text>
                  <Text style={[styles.safetyValue, {
                    color: ing.safety.comedogenic <= 1 ? '#10B981' : ing.safety.comedogenic <= 3 ? C.gold : C.pink
                  }]}>
                    {ing.safety.comedogenic}/5
                  </Text>
                </View>
              </View>
              {ing.safety.note ? (
                <View style={styles.cautionBox}>
                  <Text style={styles.cautionText}>⚠️ {ing.safety.note}</Text>
                </View>
              ) : null}
            </View>

            {/* 研究エビデンス */}
            {ing.research.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardIcon}>📚</Text>
                  <Text style={styles.cardTitle}>研究エビデンス</Text>
                </View>
                {ing.research.map((paper, i) => (
                  <View key={i} style={[styles.paperItem, i > 0 && styles.paperBorder]}>
                    <Text style={styles.paperTitle}>{paper.title}</Text>
                    <Text style={styles.paperJournal}>{paper.journal}, {paper.year}</Text>
                    <Text style={styles.paperFinding}>→ {paper.finding}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },
  header: { paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitleWrap: { flex: 1, marginRight: 12 },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.06)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: C.textSub, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  body: { padding: 20 },
  card: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 12, ...shadow(0.06, 10, 3) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardIcon: { fontSize: 16, marginRight: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardBody: { fontSize: 13, color: C.textSub, lineHeight: 22 },
  safetyRow: { flexDirection: 'row', gap: 8 },
  safetyBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center' },
  safetyLabel: { fontSize: 10, color: C.textMuted, marginBottom: 6, fontWeight: '500' },
  safetyValue: { fontSize: 20, fontWeight: '800' },
  cautionBox: { backgroundColor: '#FFFBEB', padding: 12, borderRadius: 10, marginTop: 12, borderWidth: 1, borderColor: '#FDE68A' },
  cautionText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  paperItem: { marginBottom: 12 },
  paperBorder: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  paperTitle: { fontSize: 13, fontWeight: '600', color: C.accent },
  paperJournal: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  paperFinding: { fontSize: 12, color: C.textSub, marginTop: 4, lineHeight: 18 },
});
