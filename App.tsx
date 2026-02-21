// App.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createScanResult, getMatchStats, groupByCategory, parseIngredientText } from './services/matcher';
import {
  ScanResult,
  IngredientEntry,
  CategoryKey,
  CATEGORY_LABELS,
} from './types';

// ── テーマカラー ──
const C = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  border: '#EEEEEE',
  text: '#1A1A1A',
  textSub: '#666666',
  textMuted: '#999999',
  accent: '#2D9D6E',
  accentSoft: '#E8F5EE',
  pink: '#E85D75',
  pinkSoft: '#FDE8EC',
  purple: '#7C5CFC',
  purpleSoft: '#EEEAFF',
  gold: '#D4930D',
  goldSoft: '#FFF3DB',
  blue: '#3B82F6',
  blueSoft: '#E8F0FE',
  orange: '#E67E22',
  orangeSoft: '#FEF0E0',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  brightening: C.pink,
  moisturizing: C.blue,
  anti_inflammatory: C.accent,
  antioxidant: C.gold,
  exfoliating: C.orange,
  anti_aging: C.purple,
};

const CATEGORY_BG: Record<CategoryKey, string> = {
  brightening: C.pinkSoft,
  moisturizing: C.blueSoft,
  anti_inflammatory: C.accentSoft,
  antioxidant: C.goldSoft,
  exfoliating: C.orangeSoft,
  anti_aging: C.purpleSoft,
};

// ══════════════════════════════════════════
// ダミーOCRデータ（テスト用）
// ══════════════════════════════════════════
const DUMMY_PRODUCTS: { name: string; ingredients: string[] }[] = [
  {
    name: 'Obagi C25 セラム NEO',
    ingredients: [
      'エトキシジグリコール', 'アスコルビン酸', 'DPG', '水', 'グリセリン',
      'ナイアシンアミド', 'BG', 'トコフェロール', 'アーチチョーク葉エキス',
      'ツボクサエキス', 'パンテノール', 'フェノキシエタノール',
    ],
  },
  {
    name: 'メラノCC 薬用しみ集中対策美容液',
    ingredients: [
      'アスコルビン酸', 'トコフェロール', 'グリチルリチン酸2K', 'アルピニアカツマダイ種子エキス',
      'BG', 'エトキシジグリコール', 'エタノール', 'アルピニアホワイト',
    ],
  },
  {
    name: 'IPSA ザ・タイムR アクア',
    ingredients: [
      '水', 'BG', 'グリセリン', 'DPG', 'ナイアシンアミド',
      'トラネキサム酸', 'アセチルヒアルロン酸Na', 'ヒアルロン酸Na',
      'パンテノール', 'グリチルリチン酸2K', 'フェノキシエタノール',
    ],
  },
  {
    name: 'ドクターシーラボ VC100エッセンスローション',
    ingredients: [
      '水', 'DPG', 'グリセリン', 'パルミチン酸アスコルビルリン酸3Na',
      'ナイアシンアミド', 'ヒアルロン酸Na', 'セラミドNP',
      'アラントイン', 'BG', 'フェノキシエタノール',
    ],
  },
];

// ══════════════════════════════════════════
// 成分タグ
// ══════════════════════════════════════════
function CategoryPill({ category }: { category: CategoryKey }) {
  const color = CATEGORY_COLORS[category] || C.accent;
  return (
    <View style={[st.pill, { backgroundColor: `${color}18` }]}>
      <Text style={[st.pillText, { color }]}>{CATEGORY_LABELS[category]}</Text>
    </View>
  );
}

// ══════════════════════════════════════════
// メインApp
// ══════════════════════════════════════════
const STORAGE_KEY = '@skinlab_shelf';

export default function App() {
  const [tab, setTab] = useState<'home' | 'scan' | 'shelf'>('home');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientEntry | null>(null);
  const [savedResults, setSavedResults] = useState<ScanResult[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [productNameInput, setProductNameInput] = useState('');

  // ── AsyncStorage: 起動時に読み込み ──
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) setSavedResults(JSON.parse(json));
      } catch (e) {
        console.warn('シェルフ読み込みエラー:', e);
      }
    })();
  }, []);

  // ── AsyncStorage: 保存用ヘルパー ──
  const persistShelf = useCallback(async (results: ScanResult[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (e) {
      console.warn('シェルフ保存エラー:', e);
    }
  }, []);

  const runDummyScan = (productIndex: number) => {
    const product = DUMMY_PRODUCTS[productIndex];
    const result = createScanResult(product.ingredients, '', product.name);
    setScanResult(result);
    setTab('scan');
  };

  // ── テキスト入力から成分解析 ──
  const runTextScan = () => {
    const trimmed = ingredientInput.trim();
    if (!trimmed) {
      Alert.alert('入力エラー', '成分リストを入力してください。');
      return;
    }
    const parsed = parseIngredientText(trimmed);
    if (parsed.length === 0) {
      Alert.alert('入力エラー', '成分を検出できませんでした。\n成分名をカンマや改行で区切って入力してください。');
      return;
    }
    Keyboard.dismiss();
    const result = createScanResult(parsed, '', productNameInput.trim() || '手入力スキャン');
    setScanResult(result);
    setTab('scan');
    setIngredientInput('');
    setProductNameInput('');
  };

  const saveResult = () => {
    if (scanResult) {
      // 同じIDの重複保存を防止
      setSavedResults((prev) => {
        if (prev.some((r) => r.id === scanResult.id)) return prev;
        const next = [scanResult, ...prev];
        persistShelf(next);
        return next;
      });
      setTab('shelf');
    }
  };

  const deleteResult = (id: string) => {
    Alert.alert('削除確認', 'この製品をシェルフから削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: () => {
          setSavedResults((prev) => {
            const next = prev.filter((r) => r.id !== id);
            persistShelf(next);
            return next;
          });
        },
      },
    ]);
  };

  // ── 成分詳細モーダル ──
  const renderIngredientModal = () => {
    if (!selectedIngredient) return null;
    const ing = selectedIngredient;

    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={st.modalTitle}>{ing.name_ja}</Text>
                <Text style={st.modalSubtitle}>{ing.name_inci}</Text>
              </View>
              <TouchableOpacity style={st.closeBtn} onPress={() => setSelectedIngredient(null)}>
                <Text style={st.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 }}>
              {ing.categories.map((cat) => (
                <CategoryPill key={cat} category={cat} />
              ))}
            </View>

            <View style={st.card}>
              <Text style={st.cardTitle}>概要</Text>
              <Text style={st.cardBody}>{ing.description}</Text>
            </View>

            <View style={st.card}>
              <Text style={st.cardTitle}>安全性</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={st.safetyBox}>
                  <Text style={st.safetyLabel}>刺激性</Text>
                  <Text style={[st.safetyValue, {
                    color: ing.safety.irritation === 'low' ? C.accent :
                           ing.safety.irritation === 'medium' ? C.gold : C.pink
                  }]}>
                    {ing.safety.irritation === 'low' ? '低' : ing.safety.irritation === 'medium' ? '中' : '高'}
                  </Text>
                </View>
                <View style={st.safetyBox}>
                  <Text style={st.safetyLabel}>光感受性</Text>
                  <Text style={[st.safetyValue, { color: ing.safety.photosensitivity ? C.orange : C.accent }]}>
                    {ing.safety.photosensitivity ? 'あり' : 'なし'}
                  </Text>
                </View>
                <View style={st.safetyBox}>
                  <Text style={st.safetyLabel}>コメド</Text>
                  <Text style={[st.safetyValue, {
                    color: ing.safety.comedogenic <= 1 ? C.accent : ing.safety.comedogenic <= 3 ? C.gold : C.pink
                  }]}>
                    {ing.safety.comedogenic}/5
                  </Text>
                </View>
              </View>
              {ing.safety.note ? (
                <View style={st.cautionBox}>
                  <Text style={st.cautionText}>⚠️ {ing.safety.note}</Text>
                </View>
              ) : null}
            </View>

            {ing.research.length > 0 && (
              <View style={st.card}>
                <Text style={st.cardTitle}>📚 研究エビデンス</Text>
                {ing.research.map((paper, i) => (
                  <View key={i} style={[st.paperItem, i > 0 && { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 }]}>
                    <Text style={st.paperTitle}>{paper.title}</Text>
                    <Text style={st.paperJournal}>{paper.journal}, {paper.year}</Text>
                    <Text style={st.paperFinding}>→ {paper.finding}</Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ── ホーム画面 ──
  const renderHome = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <Text style={st.pageTitle}>SkinLab</Text>
      <Text style={st.pageSubtitle}>成分から、本当の価値を知る</Text>

      <View style={st.ctaCard}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>📸</Text>
        <Text style={st.ctaTitle}>全成分表をスキャン</Text>
        <Text style={st.ctaSubtitle}>
          カメラで撮影するだけで成分を即解析{'\n'}（現在はテストデータで動作確認中）
        </Text>
      </View>

      {/* ── 成分テキスト入力セクション ── */}
      <View style={[st.card, { marginTop: 20 }]}>
        <Text style={st.sectionTitle}>📝 成分リストを入力</Text>
        <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 14 }}>
          製品ページからコピーした全成分を貼り付けて解析
        </Text>

        <Text style={st.inputLabel}>製品名（任意）</Text>
        <TextInput
          style={st.textInputSingle}
          value={productNameInput}
          onChangeText={setProductNameInput}
          placeholder="例: メラノCC 美容液"
          placeholderTextColor={C.textMuted}
          returnKeyType="next"
        />

        <Text style={[st.inputLabel, { marginTop: 12 }]}>全成分リスト</Text>
        <TextInput
          style={st.textInputMulti}
          value={ingredientInput}
          onChangeText={setIngredientInput}
          placeholder={'例:\n水、グリセリン、BG、ナイアシンアミド、\nトコフェロール、フェノキシエタノール'}
          placeholderTextColor={C.textMuted}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={[st.analyzeBtn, !ingredientInput.trim() && { opacity: 0.5 }]}
          onPress={runTextScan}
          disabled={!ingredientInput.trim()}
          activeOpacity={0.7}
        >
          <Text style={st.analyzeBtnText}>解析する</Text>
        </TouchableOpacity>
      </View>

      <Text style={[st.sectionTitle, { marginTop: 24 }]}>🧪 テスト用サンプル製品</Text>
      <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>
        タップすると成分解析結果を表示します
      </Text>
      {DUMMY_PRODUCTS.map((product, i) => (
        <TouchableOpacity key={i} style={st.productCard} onPress={() => runDummyScan(i)} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={st.productName}>{product.name}</Text>
            <Text style={st.productCount}>{product.ingredients.length}成分</Text>
          </View>
          <Text style={{ color: C.accent, fontSize: 16 }}>→</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  // ── スキャン結果画面 ──
  const renderScanResult = () => {
    if (!scanResult) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={st.emptyText}>ホーム画面からスキャンしてください</Text>
        </View>
      );
    }

    const stats = getMatchStats(scanResult.ingredients);
    const unmatched = scanResult.ingredients.filter((i) => !i.entry);
    const grouped = groupByCategory(scanResult.ingredients);
    const categoryKeys = Object.keys(CATEGORY_LABELS) as CategoryKey[];
    // カテゴリに属さないがDBにはある成分
    const uncategorized = scanResult.ingredients.filter(
      (i) => i.entry && i.entry.categories.length === 0
    );

    return (
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={st.pageTitle}>{scanResult.product_name || '解析結果'}</Text>
        <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>
          {stats.total}成分中 {stats.matched}件がDB登録済み
        </Text>

        {/* カテゴリ別グルーピング */}
        {categoryKeys.map((catKey) => {
          const items = grouped[catKey];
          if (!items || items.length === 0) return null;
          const color = CATEGORY_COLORS[catKey];
          const bg = CATEGORY_BG[catKey];

          return (
            <View key={catKey} style={[st.categorySection, { borderLeftColor: color }]}>
              <View style={[st.categoryHeader, { backgroundColor: bg }]}>
                <Text style={[st.categoryTitle, { color }]}>{CATEGORY_LABELS[catKey]}</Text>
                <Text style={[st.categoryCount, { color }]}>{items.length}成分</Text>
              </View>
              {items.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={st.groupedIngredient}
                  onPress={() => setSelectedIngredient(item.entry)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={st.ingredientName}>{item.entry!.name_ja}</Text>
                    <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                  </View>
                  <Text style={st.ingredientOrder}>#{item.order}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {/* カテゴリなし成分 */}
        {uncategorized.length > 0 && (
          <>
            <Text style={[st.sectionTitle, { marginTop: 16 }]}>その他の成分</Text>
            {uncategorized.map((item, i) => (
              <TouchableOpacity key={i} style={st.ingredientCard} onPress={() => setSelectedIngredient(item.entry)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={st.ingredientName}>{item.entry!.name_ja}</Text>
                  <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                </View>
                <Text style={st.ingredientOrder}>#{item.order}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* 未マッチ */}
        {unmatched.length > 0 && (
          <>
            <Text style={[st.sectionTitle, { marginTop: 20, color: C.textMuted }]}>
              未登録成分 ({unmatched.length})
            </Text>
            <View style={st.card}>
              {unmatched.map((item, i) => (
                <Text key={i} style={st.unmatchedText}>#{item.order} {item.raw_text}</Text>
              ))}
            </View>
          </>
        )}

        {savedResults.some((r) => r.id === scanResult.id) ? (
          <View style={[st.saveBtn, { backgroundColor: C.border }]}>
            <Text style={[st.saveBtnText, { color: C.textMuted }]}>✓ 保存済み</Text>
          </View>
        ) : (
          <TouchableOpacity style={st.saveBtn} onPress={saveResult}>
            <Text style={st.saveBtnText}>マイシェルフに保存</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // ── マイシェルフ画面 ──
  const renderShelf = () => (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
      <Text style={st.pageTitle}>マイシェルフ</Text>
      <Text style={st.pageSubtitle}>保存した製品の解析結果</Text>

      {savedResults.length === 0 ? (
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📦</Text>
          <Text style={st.emptyText}>まだ保存した製品がありません</Text>
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
            スキャン結果から「マイシェルフに保存」で追加できます
          </Text>
        </View>
      ) : (
        savedResults.map((result) => (
          <TouchableOpacity key={result.id} style={st.shelfCard} onPress={() => { setScanResult(result); setTab('scan'); }} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={st.productName}>{result.product_name || '無題の製品'}</Text>
              <Text style={st.productCount}>{result.ingredients.filter((x) => x.entry).length}成分マッチ</Text>
            </View>
            <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 12 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>{new Date(result.scanned_at).toLocaleDateString('ja-JP')}</Text>
                <Text style={{ color: C.accent, fontSize: 12, marginTop: 4 }}>詳細 →</Text>
              </View>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); deleteResult(result.id); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: C.textMuted, fontSize: 16 }}>🗑</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      {tab === 'home' && renderHome()}
      {tab === 'scan' && renderScanResult()}
      {tab === 'shelf' && renderShelf()}
      {renderIngredientModal()}
      <View style={st.tabBar}>
        {([
          { key: 'home', icon: '🏠', label: 'ホーム' },
          { key: 'scan', icon: '📊', label: '結果' },
          { key: 'shelf', icon: '📦', label: 'シェルフ' },
        ] as const).map((t) => (
          <TouchableOpacity key={t.key} style={st.tabItem} onPress={() => setTab(t.key)}>
            <Text style={{ fontSize: 20, opacity: tab === t.key ? 1 : 0.4 }}>{t.icon}</Text>
            <Text style={[st.tabLabel, { color: tab === t.key ? C.accent : C.textMuted }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A1A' },
  pageSubtitle: { fontSize: 13, color: '#999', marginTop: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 10 },
  emptyText: { color: '#666', fontSize: 14 },
  ctaCard: { backgroundColor: '#E8F5EE', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2D9D6E30' },
  ctaTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A', marginBottom: 6 },
  ctaSubtitle: { fontSize: 12, color: '#666', textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#666', lineHeight: 20 },
  productCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  productCount: { fontSize: 11, color: '#999', marginTop: 2 },
  categorySection: { marginBottom: 16, borderLeftWidth: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryCount: { fontSize: 12, fontWeight: '600' },
  groupedIngredient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  ingredientCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center' },
  ingredientOrder: { fontSize: 11, color: '#999', fontWeight: '600' },
  ingredientName: { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
  ingredientInci: { fontSize: 11, color: '#999', marginTop: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 6, marginBottom: 4 },
  pillText: { fontSize: 10, fontWeight: '600' },
  safetyBox: { flex: 1, backgroundColor: '#FAFAFA', borderRadius: 10, padding: 10, alignItems: 'center' },
  safetyLabel: { fontSize: 10, color: '#999', marginBottom: 4 },
  safetyValue: { fontSize: 18, fontWeight: '700' },
  cautionBox: { backgroundColor: '#FFF8E8', padding: 10, borderRadius: 8, marginTop: 10 },
  cautionText: { fontSize: 11, color: '#E67E22', lineHeight: 16 },
  paperItem: { marginBottom: 10 },
  paperTitle: { fontSize: 12, fontWeight: '600', color: '#3B82F6' },
  paperJournal: { fontSize: 10, color: '#999', marginTop: 2 },
  paperFinding: { fontSize: 11, color: '#666', marginTop: 4 },
  unmatchedText: { fontSize: 12, color: '#E67E22', marginBottom: 4 },
  saveBtn: { backgroundColor: '#2D9D6E', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  inputLabel: { color: '#555', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  textInputSingle: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A' },
  textInputMulti: { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A', minHeight: 120, maxHeight: 200 },
  analyzeBtn: { backgroundColor: '#2D9D6E', padding: 14, borderRadius: 12, alignItems: 'center' as const, marginTop: 16 },
  analyzeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  shelfCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#EEE', flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A' },
  modalSubtitle: { fontSize: 13, color: '#999', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#666' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8, paddingBottom: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE' },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
