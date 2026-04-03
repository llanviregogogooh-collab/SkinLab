// App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  Keyboard,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { createScanResult, getMatchStats, groupByCategory, parseIngredientText } from './services/matcher';
import { initPurchases, checkPremiumStatus } from './services/subscription';
import { initAds, showInterstitial, isAdMobAvailable } from './services/ads';
import { takePhoto, pickImage, recognizeText, cleanOCRText, isOCRAvailable } from './services/ocr';
import { ScanResult, IngredientEntry, CategoryKey, CATEGORY_LABELS } from './types';

import {
  C, shadow,
  CATEGORY_COLORS, CATEGORY_BG, CATEGORY_ICONS,
  FREE_DAILY_SCAN_LIMIT, FREE_SHELF_LIMIT,
  INTERSTITIAL_SCAN_INTERVAL, INTERSTITIAL_DETAIL_INTERVAL,
  STORAGE_KEY, SCAN_COUNT_KEY, LIFETIME_SCAN_KEY,
  REVIEW_REQUESTED_KEY, REVIEW_TRIGGER_COUNT,
} from './constants/theme';

import ImageCropper from './components/ImageCropper';
import GradientButton from './components/GradientButton';
import BannerAdView from './components/BannerAdView';
import PaywallModal from './components/PaywallModal';
import IngredientDetailModal from './components/IngredientDetailModal';
import CategoryPill from './components/CategoryPill';

// ══════════════════════════════════════════
// メインApp
// ══════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState<'home' | 'scan' | 'shelf'>('home');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientEntry | null>(null);
  const [savedResults, setSavedResults] = useState<ScanResult[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [productNameInput, setProductNameInput] = useState('');

  // ── OCR ──
  const [ocrLoading, setOcrLoading] = useState(false);

  // ── 画像クロップ ──
  const [cropImageUri, setCropImageUri] = useState<string | null>(null);
  const [cropDefaultName, setCropDefaultName] = useState('');

  // ── プレミアム・広告 ──
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [dailyScanCount, setDailyScanCount] = useState(0);
  const [scanDate, setScanDate] = useState('');
  const [scanCountReady, setScanCountReady] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const scanAdCounterRef = useRef(0);
  const detailAdCounterRef = useRef(0);
  const scanningRef = useRef(false);

  // ── AsyncStorage: 起動時に読み込み ──
  useEffect(() => {
    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) setSavedResults(JSON.parse(json));
      } catch (e) {
        __DEV__ && console.warn('シェルフ読み込みエラー:', e);
      }
    })();
  }, []);

  const loadScanCount = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      const today = new Date().toDateString();
      if (json) {
        const { count, date } = JSON.parse(json);
        setDailyScanCount(date === today ? count : 0);
      }
      setScanDate(today);
    } catch (e) {
      __DEV__ && console.warn('スキャンカウント読み込みエラー:', e);
    }
    setScanCountReady(true);
  }, []);

  useEffect(() => { loadScanCount(); }, [loadScanCount]);

  useEffect(() => {
    (async () => {
      await initPurchases();
      const premium = await checkPremiumStatus();
      setIsPremium(premium);
      if (!premium) {
        const adsInitialized = await initAds();
        setAdsReady(adsInitialized);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') loadScanCount();
    });
    return () => subscription.remove();
  }, [loadScanCount]);

  const incrementScanCount = useCallback(async () => {
    const today = new Date().toDateString();
    const newCount = (scanDate === today ? dailyScanCount : 0) + 1;
    setDailyScanCount(newCount);
    setScanDate(today);
    AsyncStorage.setItem(SCAN_COUNT_KEY, JSON.stringify({ count: newCount, date: today }))
      .catch((e) => __DEV__ && console.warn('スキャンカウント保存エラー:', e));
  }, [scanDate, dailyScanCount]);

  const canScan = (): boolean => {
    if (!scanCountReady) return false;
    if (isPremium) return true;
    const today = new Date().toDateString();
    const effectiveCount = scanDate === today ? dailyScanCount : 0;
    if (effectiveCount >= FREE_DAILY_SCAN_LIMIT) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  const persistShelf = useCallback(async (results: ScanResult[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (e) {
      __DEV__ && console.warn('シェルフ保存エラー:', e);
    }
  }, []);

  const handlePostScanAd = async () => {
    if (isPremium) return;
    scanAdCounterRef.current += 1;
    if (scanAdCounterRef.current >= INTERSTITIAL_SCAN_INTERVAL) {
      const shown = await showInterstitial();
      if (shown) scanAdCounterRef.current = 0;
    }
  };

  const maybeRequestReview = useCallback(async () => {
    try {
      const alreadyRequested = await AsyncStorage.getItem(REVIEW_REQUESTED_KEY);
      if (alreadyRequested) return;
      const raw = await AsyncStorage.getItem(LIFETIME_SCAN_KEY);
      const lifetimeScans = (raw ? parseInt(raw, 10) : 0) + 1;
      await AsyncStorage.setItem(LIFETIME_SCAN_KEY, String(lifetimeScans));
      if (lifetimeScans === REVIEW_TRIGGER_COUNT) {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (isAvailable) {
          await StoreReview.requestReview();
          await AsyncStorage.setItem(REVIEW_REQUESTED_KEY, 'true');
        }
      }
    } catch {
      // レビューリクエスト失敗は無視
    }
  }, []);

  // ── スキャン関数 ──
  const runTextScan = async () => {
    if (scanningRef.current) return;
    if (!canScan()) return;
    const trimmed = ingredientInput.trim();
    if (!trimmed) { Alert.alert('入力エラー', '成分リストを入力してください。'); return; }
    const parsed = parseIngredientText(trimmed);
    if (parsed.length === 0) { Alert.alert('入力エラー', '成分を検出できませんでした。\n成分名をカンマや改行で区切って入力してください。'); return; }
    scanningRef.current = true;
    try {
      Keyboard.dismiss();
      const result = createScanResult(parsed, '', productNameInput.trim() || '手入力スキャン');
      incrementScanCount();
      await handlePostScanAd();
      setScanResult(result);
      setTab('scan');
      setIngredientInput('');
      setProductNameInput('');
      maybeRequestReview();
    } finally {
      scanningRef.current = false;
    }
  };

  const runCameraScan = async () => {
    if (scanningRef.current) return;
    if (!canScan()) return;
    scanningRef.current = true;
    try {
      const uri = await takePhoto();
      if (!uri) return;
      setCropImageUri(uri);
      setCropDefaultName('カメラスキャン');
    } catch (e) {
      __DEV__ && console.warn('Camera scan error:', e);
      Alert.alert('エラー', 'カメラスキャン中にエラーが発生しました。');
    } finally {
      scanningRef.current = false;
    }
  };

  const runImageScan = async () => {
    if (scanningRef.current) return;
    if (!canScan()) return;
    scanningRef.current = true;
    try {
      const uri = await pickImage();
      if (!uri) return;
      setCropImageUri(uri);
      setCropDefaultName('画像スキャン');
    } catch (e) {
      __DEV__ && console.warn('Image scan error:', e);
      Alert.alert('エラー', '画像スキャン中にエラーが発生しました。');
    } finally {
      scanningRef.current = false;
    }
  };

  const handleCropDone = (croppedUri: string) => {
    const name = cropDefaultName;
    setCropImageUri(null);
    setOcrLoading(true);
    setTimeout(() => {
      void (async () => {
        try { await processOCRImage(croppedUri, name); } finally { setOcrLoading(false); }
      })();
    }, 400);
  };

  const processOCRImage = async (imageUri: string, defaultName: string) => {
    const rawText = await recognizeText(imageUri);
    if (!rawText) return;
    const cleaned = cleanOCRText(rawText);
    const parsed = parseIngredientText(cleaned);
    if (parsed.length === 0) {
      setIngredientInput(rawText);
      setProductNameInput('');
      Alert.alert('成分を検出できませんでした', '認識テキストを入力欄にセットしました。\n手動で修正してから解析してください。');
      return;
    }
    const result = createScanResult(parsed, '', defaultName);
    incrementScanCount();
    await handlePostScanAd();
    setScanResult(result);
    setTab('scan');
    maybeRequestReview();
  };

  // ── 保存・編集・削除 ──
  const doSave = (result: ScanResult) => {
    if (!isPremium && savedResults.length >= FREE_SHELF_LIMIT) { Alert.alert('上限に達しました', `保存できるのは${FREE_SHELF_LIMIT}件までです。\nプレミアムプランで無制限に保存できます。`, [{ text: 'キャンセル', style: 'cancel' }, { text: 'プレミアムへ', onPress: () => setShowPaywall(true) }]); return; }
    setSavedResults((prev) => {
      if (prev.some((r) => r.id === result.id)) return prev;
      const next = [result, ...prev];
      persistShelf(next);
      return next;
    });
    setTab('shelf');
  };

  const saveResult = () => {
    if (!scanResult) return;
    if (!scanResult.product_name.trim()) {
      Alert.prompt('製品名を入力', 'シェルフに保存するために製品名を入力してください。', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '保存', onPress: (name?: string) => {
          if (!name?.trim()) { Alert.alert('入力エラー', '製品名を入力してください。'); return; }
          const updated = { ...scanResult, product_name: name.trim() };
          setScanResult(updated);
          doSave(updated);
        }},
      ], 'plain-text', '', 'default');
      return;
    }
    doSave(scanResult);
  };

  const renameProduct = (id: string, currentName: string) => {
    Alert.prompt('製品名を編集', '', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '保存', onPress: (name?: string) => {
        if (!name?.trim()) { Alert.alert('入力エラー', '製品名を入力してください。'); return; }
        setSavedResults((prev) => {
          const next = prev.map((r) => r.id === id ? { ...r, product_name: name.trim() } : r);
          persistShelf(next);
          return next;
        });
      }},
    ], 'plain-text', currentName, 'default');
  };

  const deleteResult = (id: string) => {
    Alert.alert('削除確認', 'この製品をシェルフから削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => {
        setSavedResults((prev) => {
          const next = prev.filter((r) => r.id !== id);
          persistShelf(next);
          return next;
        });
      }},
    ]);
  };

  const openIngredientDetail = async (entry: IngredientEntry | null) => {
    if (!entry) return;
    if (!isPremium) {
      detailAdCounterRef.current += 1;
      if (detailAdCounterRef.current % INTERSTITIAL_DETAIL_INTERVAL === 0) {
        await showInterstitial();
      }
    }
    setSelectedIngredient(entry);
  };

  // ══════════════════════════════════════════
  // ホーム画面
  // ══════════════════════════════════════════
  const renderHome = () => (
    <ScrollView contentContainerStyle={st.scrollPadding} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={[C.gradStart, C.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.heroGrad}
      >
        <Text style={st.heroTitle}>ClearLab.</Text>
        <Text style={st.heroSub}>成分から、本当の価値を知る</Text>
      </LinearGradient>

      <View style={st.sectionBody}>
        {/* OCRスキャンカード */}
        <View style={[st.card, st.cardCenter]}>
          <View style={st.scanIconWrap}>
            <Text style={st.scanIconText}>📸</Text>
          </View>
          <Text style={st.scanCardTitle}>全成分表をスキャン</Text>
          <Text style={st.scanCardSub}>
            カメラ撮影またはスクリーンショットから{'\n'}成分を自動認識して解析します
          </Text>

          {ocrLoading ? (
            <View style={st.ocrLoadingWrap}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={st.ocrLoadingText}>テキストを認識中...</Text>
            </View>
          ) : (
            <View style={st.scanBtnRow}>
              <TouchableOpacity style={[st.scanBtn, st.flex1]} onPress={runCameraScan} activeOpacity={0.7}>
                <LinearGradient colors={[C.gradStart, C.accentDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.scanBtnInner}>
                  <Text style={st.scanBtnEmoji}>📷</Text>
                  <Text style={st.scanBtnText}>カメラ撮影</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={[st.scanBtn, st.flex1]} onPress={runImageScan} activeOpacity={0.7}>
                <LinearGradient colors={[C.purple, '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={st.scanBtnInner}>
                  <Text style={st.scanBtnEmoji}>🖼</Text>
                  <Text style={st.scanBtnText}>スクショ選択</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {!isOCRAvailable() && (
            <View style={st.ocrWarning}>
              <Text style={st.ocrWarningText}>※ Expo Goでは文字認識が利用できません。Development Buildで実行してください。</Text>
            </View>
          )}
        </View>


        {/* 成分テキスト入力 */}
        <View style={[st.card, { marginTop: 16 }]}>
          <View style={st.sectionTitleRow}>
            <Text style={st.sectionIcon}>📝</Text>
            <Text style={st.sectionTitle}>成分リストを入力</Text>
          </View>
          <Text style={st.sectionHint}>製品ページからコピーした全成分を貼り付けて解析</Text>

          <Text style={st.inputLabel}>製品名（任意）</Text>
          <TextInput
            style={st.textInputSingle}
            value={productNameInput}
            onChangeText={setProductNameInput}
            placeholder="例: メラノCC 美容液"
            placeholderTextColor={C.textMuted}
            returnKeyType="next"
          />

          <Text style={[st.inputLabel, { marginTop: 14 }]}>全成分リスト</Text>
          <TextInput
            style={st.textInputMulti}
            value={ingredientInput}
            onChangeText={setIngredientInput}
            placeholder={'例:\n水、グリセリン、BG、ナイアシンアミド、\nトコフェロール、フェノキシエタノール'}
            placeholderTextColor={C.textMuted}
            multiline
            textAlignVertical="top"
          />

          <View style={{ marginTop: 16 }}>
            <GradientButton onPress={runTextScan} label="解析する" icon="🔬" disabled={!ingredientInput.trim()} />
          </View>
        </View>
      </View>
    </ScrollView>
  );

  // ══════════════════════════════════════════
  // スキャン結果画面
  // ══════════════════════════════════════════
  const renderScanResult = () => {
    if (!scanResult) {
      return (
        <View style={st.emptyWrap}>
          <View style={st.emptyIconWrap}>
            <Text style={st.emptyIcon}>📊</Text>
          </View>
          <Text style={st.emptyTitle}>解析結果がありません</Text>
          <Text style={st.emptyHint}>ホーム画面からスキャンまたは{'\n'}テキスト入力で解析を開始してください</Text>
        </View>
      );
    }

    const stats = getMatchStats(scanResult.ingredients);
    const unmatched = scanResult.ingredients.filter((i) => !i.entry);
    const grouped = groupByCategory(scanResult.ingredients);
    const categoryKeys = Object.keys(CATEGORY_LABELS) as CategoryKey[];
    const uncategorized = scanResult.ingredients.filter((i) => i.entry && i.entry.categories.length === 0);

    return (
      <ScrollView contentContainerStyle={st.scrollPadding} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[C.accentSoft, C.bg]} style={st.resultHeader}>
          <Text style={st.pageTitle}>{scanResult.product_name || '解析結果'}</Text>
          <View style={st.matchBarRow}>
            <View style={st.flex1}>
              <View style={st.matchBarBg}>
                <LinearGradient
                  colors={[C.gradStart, C.gradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[st.matchBarFill, { width: `${stats.total > 0 ? (stats.matched / stats.total) * 100 : 0}%` as any }]}
                />
              </View>
            </View>
            <Text style={st.matchCount}>{stats.matched}/{stats.total}</Text>
          </View>
          <Text style={st.matchHint}>{stats.total}成分中 {stats.matched}件がDB登録済み</Text>
        </LinearGradient>

        <View style={st.sectionBody}>
          {categoryKeys.map((catKey) => {
            const items = grouped[catKey];
            if (!items || items.length === 0) return null;
            const color = CATEGORY_COLORS[catKey];
            const bg = CATEGORY_BG[catKey];
            const icon = CATEGORY_ICONS[catKey];

            return (
              <View key={catKey} style={[st.categorySection, { borderLeftColor: color }]}>
                <View style={[st.categoryHeader, { backgroundColor: bg }]}>
                  <View style={st.row}>
                    <Text style={st.categoryIcon}>{icon}</Text>
                    <Text style={[st.categoryTitle, { color }]}>{CATEGORY_LABELS[catKey]}</Text>
                  </View>
                  <View style={[st.categoryBadge, { backgroundColor: `${color}20` }]}>
                    <Text style={[st.categoryCount, { color }]}>{items.length}</Text>
                  </View>
                </View>
                {items.map((item, i) => (
                  <TouchableOpacity key={i} style={st.groupedIngredient} onPress={() => openIngredientDetail(item.entry)} activeOpacity={0.6}>
                    <View style={st.flex1}>
                      <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
                      <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                    </View>
                    <View style={st.ingredientMeta}>
                      <Text style={st.ingredientOrder}>#{item.order}</Text>
                      <Text style={st.chevron}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          {uncategorized.length > 0 && (
            <>
              <View style={st.sectionTitleRow}>
                <Text style={st.sectionIcon}>🧪</Text>
                <Text style={st.sectionTitle}>その他の成分</Text>
              </View>
              {uncategorized.map((item, i) => (
                <TouchableOpacity key={i} style={st.ingredientCard} onPress={() => openIngredientDetail(item.entry)} activeOpacity={0.7}>
                  <View style={st.flex1}>
                    <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
                    <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                  </View>
                  <View style={st.ingredientMeta}>
                    <Text style={st.ingredientOrder}>#{item.order}</Text>
                    <Text style={st.chevron}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {unmatched.length > 0 && (
            <>
              <View style={[st.sectionTitleRow, { marginTop: 20 }]}>
                <Text style={st.sectionIcon}>❓</Text>
                <Text style={[st.sectionTitle, { color: C.textMuted, marginBottom: 0 }]}>未登録成分 ({unmatched.length})</Text>
              </View>
              <View style={[st.card, { backgroundColor: '#FAFBFC' }]}>
                {unmatched.map((item, i) => (
                  <Text key={i} style={[st.unmatchedText, i > 0 && st.unmatchedBorder]}>#{item.order}  {item.raw_text}</Text>
                ))}
              </View>
            </>
          )}

          {savedResults.some((r) => r.id === scanResult.id) ? (
            <View style={[st.savedBadge, { marginTop: 24 }]}>
              <Text style={st.savedBadgeCheck}>✓</Text>
              <Text style={st.savedBadgeText}>保存済み</Text>
            </View>
          ) : (
            <View style={{ marginTop: 24 }}>
              <GradientButton onPress={saveResult} label="マイシェルフに保存" icon="📦" />
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // ══════════════════════════════════════════
  // マイシェルフ画面
  // ══════════════════════════════════════════
  const renderShelf = () => (
    <ScrollView contentContainerStyle={st.scrollPadding} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[C.accentSoft, C.bg]} style={st.resultHeader}>
        <Text style={st.pageTitle}>マイシェルフ</Text>
        <Text style={st.pageSubtitle}>保存した製品の解析結果</Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20 }}>
        {savedResults.length === 0 ? (
          <View style={st.shelfEmpty}>
            <View style={st.shelfEmptyIcon}>
              <Text style={st.shelfEmptyEmoji}>📦</Text>
            </View>
            <Text style={st.shelfEmptyTitle}>まだ保存した製品がありません</Text>
            <Text style={st.shelfEmptyHint}>スキャン結果から{'\n'}「マイシェルフに保存」で追加できます</Text>
          </View>
        ) : (
          savedResults.map((result) => (
            <TouchableOpacity
              key={result.id}
              style={st.shelfCard}
              onPress={() => { setScanResult(result); setTab('scan'); }}
              activeOpacity={0.7}
            >
              <View style={st.shelfCardIcon}>
                <Text style={st.shelfCardEmoji}>🧴</Text>
              </View>
              <View style={st.flex1}>
                <Text style={st.productName}>{result.product_name || '無題の製品'}</Text>
                <View style={st.shelfMeta}>
                  <Text style={st.productCount}>{result.ingredients.filter((x) => x.entry).length}成分マッチ</Text>
                  <Text style={st.shelfDot}>●</Text>
                  <Text style={st.shelfDate}>{new Date(result.scanned_at).toLocaleDateString('ja-JP')}</Text>
                </View>
              </View>
              <View style={st.shelfActions}>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); renameProduct(result.id, result.product_name); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={st.iconBtn}>
                  <Text style={st.editIcon}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); deleteResult(result.id); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={st.iconBtn}>
                  <Text style={st.deleteIcon}>🗑</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );

  // ══════════════════════════════════════════
  // メインレイアウト
  // ══════════════════════════════════════════
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tab === 'home' ? C.gradStart : C.bg }}>
      <StatusBar barStyle={tab === 'home' ? 'light-content' : 'dark-content'} />
      {tab === 'home' && renderHome()}
      {tab === 'scan' && renderScanResult()}
      {tab === 'shelf' && renderShelf()}

      <IngredientDetailModal ingredient={selectedIngredient} onClose={() => setSelectedIngredient(null)} />

      <ImageCropper visible={!!cropImageUri} imageUri={cropImageUri || ''} onCrop={handleCropDone} onCancel={() => setCropImageUri(null)} />

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onPremiumActivated={() => {
          setIsPremium(true);
          setShowPaywall(false);
          setAdsReady(false);
        }}
      />

      {adsReady && !isPremium && <BannerAdView />}

      {/* タブバー */}
      <View style={st.tabBar}>
        {([
          { key: 'home', icon: '🏠', label: 'ホーム' },
          { key: 'scan', icon: '📊', label: '結果' },
          { key: 'shelf', icon: '📦', label: 'シェルフ' },
        ] as const).map((t) => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={st.tabItem} onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <View style={[st.tabIconWrap, isActive && st.tabIconActive]}>
                <Text style={st.tabIconText}>{t.icon}</Text>
              </View>
              <Text style={[st.tabLabel, isActive && st.tabLabelActive]}>{t.label}</Text>
              {isActive && <View style={st.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════
// スタイル（すべて StyleSheet.create に集約）
// ══════════════════════════════════════════
const st = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  scrollPadding: { paddingBottom: 100 },
  sectionBody: { padding: 20 },

  // ── ページ共通 ──
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  pageSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIcon: { fontSize: 16, marginRight: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  sectionHint: { color: C.textMuted, fontSize: 12, marginBottom: 16 },

  // ── カード ──
  card: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 12, ...shadow(0.06, 10, 3) },
  cardCenter: { padding: 24, alignItems: 'center' },

  // ── ヒーロー ──
  heroGrad: { paddingTop: 16, paddingBottom: 32, paddingHorizontal: 24 },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: 1 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  // ── OCRスキャン ──
  scanIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  scanIconText: { fontSize: 28 },
  scanCardTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 },
  scanCardSub: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  scanBtnRow: { flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' },
  scanBtn: { borderRadius: 14, overflow: 'hidden', ...shadow(0.12, 8, 3) },
  scanBtnInner: { paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center' },
  scanBtnEmoji: { fontSize: 18, marginBottom: 4 },
  scanBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  ocrLoadingWrap: { marginTop: 20, alignItems: 'center' },
  ocrLoadingText: { fontSize: 13, color: C.accent, marginTop: 8, fontWeight: '600' },
  ocrWarning: { backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 12, width: '100%' },
  ocrWarningText: { fontSize: 11, color: '#92400E', textAlign: 'center' },

  // ── 入力 ──
  inputLabel: { color: C.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInputSingle: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },
  textInputMulti: { backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 120, maxHeight: 200 },

  // ── 結果ヘッダー ──
  resultHeader: { paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20 },
  matchBarRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  matchBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  matchBarFill: { height: 6, borderRadius: 3 },
  matchCount: { fontSize: 13, fontWeight: '700', color: C.accent },
  matchHint: { color: C.textMuted, fontSize: 12, marginTop: 6 },

  // ── カテゴリセクション ──
  categorySection: { marginBottom: 16, borderLeftWidth: 4, borderRadius: 16, overflow: 'hidden', backgroundColor: C.card, ...shadow(0.05, 8, 2) },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  categoryIcon: { fontSize: 14, marginRight: 6 },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  categoryCount: { fontSize: 12, fontWeight: '700' },
  groupedIngredient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },

  // ── 成分カード ──
  ingredientCard: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', ...shadow(0.04, 6, 2) },
  ingredientName: { fontSize: 14, fontWeight: '700', color: C.text },
  ingredientInci: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  ingredientOrder: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  ingredientMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chevron: { color: C.textMuted, fontSize: 12 },
  unmatchedText: { fontSize: 12, color: C.orange, marginBottom: 6, paddingVertical: 2 },
  unmatchedBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6 },

  // ── 保存済みバッジ ──
  savedBadge: { backgroundColor: '#ECFDF5', padding: 16, borderRadius: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  savedBadgeCheck: { fontSize: 16, marginRight: 6 },
  savedBadgeText: { color: '#10B981', fontSize: 15, fontWeight: '700' },

  // ── 空表示 ──
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 6 },
  emptyHint: { fontSize: 13, color: C.textMuted, textAlign: 'center' },

  // ── シェルフ ──
  shelfEmpty: { alignItems: 'center', marginTop: 48, padding: 20 },
  shelfEmptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  shelfEmptyEmoji: { fontSize: 36 },
  shelfEmptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  shelfEmptyHint: { color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  shelfCard: { backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', ...shadow(0.06, 8, 3) },
  shelfCardIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  shelfCardEmoji: { fontSize: 18 },
  shelfMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  shelfDot: { fontSize: 3, color: C.textMuted },
  shelfDate: { color: C.textMuted, fontSize: 11 },
  shelfActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  productName: { fontSize: 15, fontWeight: '600', color: C.text },
  productCount: { fontSize: 11, color: C.textMuted },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F8FAFC', justifyContent: 'center', alignItems: 'center' },
  editIcon: { color: C.accent, fontSize: 13 },
  deleteIcon: { color: C.textMuted, fontSize: 13 },

  // ── タブバー ──
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 6, paddingBottom: 20, backgroundColor: C.card, ...shadow(0.08, 16, -4) },
  tabItem: { alignItems: 'center', paddingHorizontal: 16 },
  tabIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tabIconActive: { backgroundColor: C.accentSoft },
  tabIconText: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, color: C.textMuted },
  tabLabelActive: { color: C.accent },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.accent, marginTop: 3 },
});
