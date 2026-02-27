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
  ActivityIndicator,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { createScanResult, getMatchStats, groupByCategory, parseIngredientText } from './services/matcher';
import { initPurchases, checkPremiumStatus, purchasePremium, restorePurchases } from './services/subscription';
import { initAds, showInterstitial, BANNER_AD_UNIT_ID, isAdMobAvailable } from './services/ads';
import { takePhoto, pickImage, recognizeText, cleanOCRText, isOCRAvailable } from './services/ocr';
import {
  ScanResult,
  IngredientEntry,
  CategoryKey,
  CATEGORY_LABELS,
} from './types';

// ── テーマカラー ──
const C = {
  bg: '#F8FAFD',
  card: '#FFFFFF',
  border: '#E4EBF5',
  text: '#1A1A2E',
  textSub: '#5A6478',
  textMuted: '#94A3B8',
  accent: '#2B7DE9',
  accentSoft: '#E8F1FD',
  accentDark: '#1D5FB8',
  pink: '#E85D75',
  pinkSoft: '#FDE8EC',
  purple: '#7C5CFC',
  purpleSoft: '#EEEAFF',
  gold: '#D4930D',
  goldSoft: '#FFF3DB',
  blue: '#38BDF8',
  blueSoft: '#E0F4FE',
  orange: '#E67E22',
  orangeSoft: '#FEF0E0',
  cyan: '#06B6D4',
  cyanSoft: '#DFFBFE',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  brightening: C.pink,
  moisturizing: C.blue,
  anti_inflammatory: C.cyan,
  antioxidant: C.gold,
  exfoliating: C.orange,
  anti_aging: C.purple,
};

const CATEGORY_BG: Record<CategoryKey, string> = {
  brightening: C.pinkSoft,
  moisturizing: C.blueSoft,
  anti_inflammatory: C.cyanSoft,
  antioxidant: C.goldSoft,
  exfoliating: C.orangeSoft,
  anti_aging: C.purpleSoft,
};

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
// バナー広告コンポーネント
// ══════════════════════════════════════════
function BannerAdView() {
  const [BannerAd, setBannerAd] = useState<any>(null);
  const [BannerAdSize, setBannerAdSize] = useState<any>(null);

  useEffect(() => {
    if (!isAdMobAvailable()) return;
    try {
      const moduleName = 'react-native-google-' + 'mobile-ads';
      const admob = require(moduleName);
      setBannerAd(() => admob.BannerAd);
      setBannerAdSize(admob.BannerAdSize);
    } catch {
      // AdMob not available
    }
  }, []);

  if (!BannerAd || !BannerAdSize || !BANNER_AD_UNIT_ID) {
    return (
      <View style={{ backgroundColor: '#F3F6FB', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4EBF5' }}>
        <Text style={{ fontSize: 11, color: '#94A3B8' }}>広告スペース</Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: '#E4EBF5' }}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

// ══════════════════════════════════════════
// メインApp
// ══════════════════════════════════════════
const STORAGE_KEY = '@clearlab_shelf';
const SCAN_COUNT_KEY = '@clearlab_scan_count';
const LIFETIME_SCAN_KEY = '@clearlab_lifetime_scans';
const REVIEW_REQUESTED_KEY = '@clearlab_review_requested';
const REVIEW_TRIGGER_COUNT = 3;

// ── 無料プランの制限 ──
const FREE_DAILY_SCAN_LIMIT = 5;
const FREE_SHELF_LIMIT = 5;
const INTERSTITIAL_SCAN_INTERVAL = 2;   // 解析N回ごとに広告
const INTERSTITIAL_DETAIL_INTERVAL = 5; // 成分詳細N回ごとに広告

export default function App() {
  const [tab, setTab] = useState<'home' | 'scan' | 'shelf'>('home');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientEntry | null>(null);
  const [savedResults, setSavedResults] = useState<ScanResult[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [productNameInput, setProductNameInput] = useState('');

  // ── OCR ──
  const [ocrLoading, setOcrLoading] = useState(false);

  // ── プレミアム・広告 ──
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [dailyScanCount, setDailyScanCount] = useState(0);
  const [scanAdCounter, setScanAdCounter] = useState(0);
  const [detailAdCounter, setDetailAdCounter] = useState(0);

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

  // ── 課金・広告の初期化 ──
  useEffect(() => {
    (async () => {
      await initPurchases();
      const premium = await checkPremiumStatus();
      setIsPremium(premium);
      if (!premium) {
        await initAds();
      }
      // 日次スキャンカウントの復元
      try {
        const json = await AsyncStorage.getItem(SCAN_COUNT_KEY);
        if (json) {
          const { count, date } = JSON.parse(json);
          const today = new Date().toDateString();
          if (date === today) {
            setDailyScanCount(count);
          }
        }
      } catch (e) {
        __DEV__ && console.warn('スキャンカウント読み込みエラー:', e);
      }
    })();
  }, []);

  const incrementScanCount = useCallback(async () => {
    const newCount = dailyScanCount + 1;
    setDailyScanCount(newCount);
    try {
      await AsyncStorage.setItem(SCAN_COUNT_KEY, JSON.stringify({
        count: newCount,
        date: new Date().toDateString(),
      }));
    } catch (e) {
      __DEV__ && console.warn('スキャンカウント保存エラー:', e);
    }
  }, [dailyScanCount]);

  // ── AsyncStorage: 保存用ヘルパー ──
  const persistShelf = useCallback(async (results: ScanResult[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (e) {
      __DEV__ && console.warn('シェルフ保存エラー:', e);
    }
  }, []);

  // ── スキャン制限チェック ──
  const canScan = (): boolean => {
    if (isPremium) return true;
    if (dailyScanCount >= FREE_DAILY_SCAN_LIMIT) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  // ── スキャン後の広告表示 ──
  const handlePostScanAd = () => {
    if (isPremium) return;
    const newCount = scanAdCounter + 1;
    setScanAdCounter(newCount);
    if (newCount % INTERSTITIAL_SCAN_INTERVAL === 0) {
      showInterstitial();
    }
  };

  // ── レビュー促進（累計3回目のスキャン後） ──
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

  // ── テキスト入力から成分解析 ──
  const runTextScan = () => {
    if (!canScan()) return;
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
    incrementScanCount();
    handlePostScanAd();
    maybeRequestReview();
  };

  // ── OCRスキャン（カメラ撮影） ──
  const runCameraScan = async () => {
    if (!canScan()) return;
    setOcrLoading(true);
    try {
      const uri = await takePhoto();
      if (!uri) { setOcrLoading(false); return; }
      await processOCRImage(uri, 'カメラスキャン');
    } catch (e) {
      __DEV__ && console.warn('Camera scan error:', e);
      Alert.alert('エラー', 'カメラスキャン中にエラーが発生しました。');
    } finally {
      setOcrLoading(false);
    }
  };

  // ── OCRスキャン（スクショ・フォトライブラリ） ──
  const runImageScan = async () => {
    if (!canScan()) return;
    setOcrLoading(true);
    try {
      const uri = await pickImage();
      if (!uri) { setOcrLoading(false); return; }
      await processOCRImage(uri, '画像スキャン');
    } catch (e) {
      __DEV__ && console.warn('Image scan error:', e);
      Alert.alert('エラー', '画像スキャン中にエラーが発生しました。');
    } finally {
      setOcrLoading(false);
    }
  };

  // ── OCR共通処理 ──
  const processOCRImage = async (imageUri: string, defaultName: string) => {
    const rawText = await recognizeText(imageUri);
    if (!rawText) {
      // Expo Go の場合は recognizeText 内で Alert が出る
      // OCR失敗時もここに来る
      return;
    }

    const cleaned = cleanOCRText(rawText);
    const parsed = parseIngredientText(cleaned);

    if (parsed.length === 0) {
      // OCRは成功したがパースで成分が見つからない場合
      // ユーザーにOCR結果を編集させる
      setIngredientInput(rawText);
      setProductNameInput('');
      Alert.alert(
        '成分を検出できませんでした',
        '認識テキストを入力欄にセットしました。\n手動で修正してから解析してください。'
      );
      return;
    }

    const result = createScanResult(parsed, '', defaultName);
    setScanResult(result);
    setTab('scan');
    incrementScanCount();
    handlePostScanAd();
    maybeRequestReview();
  };

  const saveResult = () => {
    if (!scanResult) return;

    // 製品名が空なら入力を求める
    if (!scanResult.product_name.trim()) {
      Alert.prompt(
        '製品名を入力',
        'シェルフに保存するために製品名を入力してください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          {
            text: '保存',
            onPress: (name?: string) => {
              if (!name?.trim()) {
                Alert.alert('入力エラー', '製品名を入力してください。');
                return;
              }
              const updated = { ...scanResult, product_name: name.trim() };
              setScanResult(updated);
              doSave(updated);
            },
          },
        ],
        'plain-text',
        '',
        'default'
      );
      return;
    }

    doSave(scanResult);
  };

  const doSave = (result: ScanResult) => {
    // シェルフ保存数制限チェック
    if (!isPremium && savedResults.length >= FREE_SHELF_LIMIT) {
      setShowPaywall(true);
      return;
    }
    setSavedResults((prev) => {
      if (prev.some((r) => r.id === result.id)) return prev;
      const next = [result, ...prev];
      persistShelf(next);
      return next;
    });
    setTab('shelf');
  };

  const renameProduct = (id: string, currentName: string) => {
    Alert.prompt(
      '製品名を編集',
      '',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '保存',
          onPress: (name?: string) => {
            if (!name?.trim()) {
              Alert.alert('入力エラー', '製品名を入力してください。');
              return;
            }
            setSavedResults((prev) => {
              const next = prev.map((r) =>
                r.id === id ? { ...r, product_name: name.trim() } : r
              );
              persistShelf(next);
              return next;
            });
          },
        },
      ],
      'plain-text',
      currentName,
      'default'
    );
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

  // ── 成分詳細を開く（広告カウント付き） ──
  const openIngredientDetail = (entry: IngredientEntry | null) => {
    if (!entry) return;
    setSelectedIngredient(entry);
    if (!isPremium) {
      const newCount = detailAdCounter + 1;
      setDetailAdCounter(newCount);
      if (newCount % INTERSTITIAL_DETAIL_INTERVAL === 0) {
        showInterstitial();
      }
    }
  };

  // ── ペイウォールモーダル ──
  const renderPaywall = () => (
    <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <TouchableOpacity style={st.closeBtn} onPress={() => setShowPaywall(false)}>
            <Text style={st.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 28 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>💎</Text>
            <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>ClearLab. Premium</Text>
            <Text style={{ fontSize: 13, color: C.textSub, marginTop: 6, textAlign: 'center' }}>
              すべての機能を制限なく使えます
            </Text>
          </View>

          <View style={[st.card, { marginBottom: 16 }]}>
            {[
              { icon: '🔍', text: '成分解析 無制限（無料: 1日5回）' },
              { icon: '📦', text: 'シェルフ保存 無制限（無料: 5件）' },
              { icon: '🚫', text: '広告を完全非表示' },
            ].map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                <Text style={{ fontSize: 20, marginRight: 12 }}>{item.icon}</Text>
                <Text style={{ fontSize: 14, color: C.text, flex: 1 }}>{item.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[st.saveBtn, { marginTop: 8 }]}
            onPress={async () => {
              const success = await purchasePremium();
              if (success) {
                setIsPremium(true);
                setShowPaywall(false);
                Alert.alert('ありがとうございます！', 'プレミアムプランが有効になりました。');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={st.saveBtnText}>月額380円でプレミアムに登録</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ alignItems: 'center', marginTop: 16 }}
            onPress={async () => {
              const success = await restorePurchases();
              if (success) {
                setIsPremium(true);
                setShowPaywall(false);
                Alert.alert('復元完了', 'プレミアムプランが復元されました。');
              } else {
                Alert.alert('復元できませんでした', '有効な購入が見つかりませんでした。');
              }
            }}
          >
            <Text style={{ color: C.accent, fontSize: 13 }}>購入を復元する</Text>
          </TouchableOpacity>

          {/* Apple必須: サブスクリプション開示情報 */}
          <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
            <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 18, textAlign: 'center' }}>
              月額380円（税込）の自動更新サブスクリプションです。{'\n'}
              購入確認時にApple IDアカウントに課金されます。{'\n'}
              現在の期間終了の24時間前までにキャンセルしない限り、サブスクリプションは自動的に更新されます。{'\n'}
              アカウントへの課金は、現在の期間終了前24時間以内に行われます。{'\n'}
              サブスクリプションの管理・キャンセルは、端末の「設定」→ Apple ID →「サブスクリプション」から行えます。
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 16 }}>
              <TouchableOpacity onPress={() => Linking.openURL('https://llanviregogogooh-collab.github.io/SkinLab/privacy-policy.html')}>
                <Text style={{ fontSize: 11, color: C.accent, textDecorationLine: 'underline' }}>プライバシーポリシー</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL('https://llanviregogogooh-collab.github.io/SkinLab/terms-of-service.html')}>
                <Text style={{ fontSize: 11, color: C.accent, textDecorationLine: 'underline' }}>利用規約</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

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
                <Text style={st.modalTitle}>{ing.name_cosmetic}</Text>
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
      <Text style={st.pageTitle}>ClearLab.</Text>
      <Text style={st.pageSubtitle}>成分から、本当の価値を知る</Text>

      {/* ── OCRスキャンセクション ── */}
      <View style={st.ctaCard}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>📸</Text>
        <Text style={st.ctaTitle}>全成分表をスキャン</Text>
        <Text style={st.ctaSubtitle}>
          カメラで撮影、またはスクリーンショットから成分を自動認識
        </Text>

        {ocrLoading ? (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={{ fontSize: 13, color: C.accent, marginTop: 6 }}>テキストを認識中...</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' }}>
            <TouchableOpacity
              style={[st.analyzeBtn, { flex: 1 }]}
              onPress={runCameraScan}
              activeOpacity={0.7}
            >
              <Text style={st.analyzeBtnText}>📷 カメラ撮影</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[st.analyzeBtn, { flex: 1, backgroundColor: '#5BA4F5' }]}
              onPress={runImageScan}
              activeOpacity={0.7}
            >
              <Text style={st.analyzeBtnText}>🖼 スクショ選択</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isOCRAvailable() && (
          <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 8, textAlign: 'center' }}>
            ※ Expo Goでは文字認識が利用できません。Development Buildで実行してください。
          </Text>
        )}
      </View>

      {/* ── プレミアムバナー（無料ユーザーのみ） ── */}
      {!isPremium && (
        <TouchableOpacity
          style={[st.ctaCard, { marginTop: 12, backgroundColor: '#EBF3FF', borderColor: '#2B7DE920' }]}
          onPress={() => setShowPaywall(true)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20, marginBottom: 4 }}>💎</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>プレミアムにアップグレード</Text>
          <Text style={{ fontSize: 11, color: C.textSub, textAlign: 'center', marginTop: 4 }}>
            広告なし・解析無制限・シェルフ無制限 — 月額380円
          </Text>
        </TouchableOpacity>
      )}

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
                  onPress={() => openIngredientDetail(item.entry)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
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
              <TouchableOpacity key={i} style={st.ingredientCard} onPress={() => openIngredientDetail(item.entry)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.textMuted, fontSize: 10 }}>{new Date(result.scanned_at).toLocaleDateString('ja-JP')}</Text>
                <Text style={{ color: C.accent, fontSize: 12, marginTop: 4 }}>詳細 →</Text>
              </View>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); renameProduct(result.id, result.product_name); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: C.accent, fontSize: 14 }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); deleteResult(result.id); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ color: C.textMuted, fontSize: 14 }}>🗑</Text>
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
      {renderPaywall()}

      {/* ── バナー広告（無料ユーザーのみ） ── */}
      {!isPremium && (
        <BannerAdView />
      )}

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
  pageTitle: { fontSize: 24, fontWeight: '800', color: '#1A1A2E' },
  pageSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A2E', marginBottom: 10 },
  emptyText: { color: '#5A6478', fontSize: 14 },
  ctaCard: { backgroundColor: '#E8F1FD', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#2B7DE930' },
  ctaTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A2E', marginBottom: 6 },
  ctaSubtitle: { fontSize: 12, color: '#5A6478', textAlign: 'center', lineHeight: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E4EBF5' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', marginBottom: 4 },
  cardBody: { fontSize: 13, color: '#5A6478', lineHeight: 20 },
  productCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E4EBF5', flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  productCount: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  categorySection: { marginBottom: 16, borderLeftWidth: 3, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E4EBF5' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryCount: { fontSize: 12, fontWeight: '600' },
  groupedIngredient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#EEF2F9' },
  ingredientCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E4EBF5', flexDirection: 'row', alignItems: 'center' },
  ingredientOrder: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  ingredientName: { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  ingredientInci: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginRight: 6, marginBottom: 4 },
  pillText: { fontSize: 10, fontWeight: '600' },
  safetyBox: { flex: 1, backgroundColor: '#F3F6FB', borderRadius: 10, padding: 10, alignItems: 'center' },
  safetyLabel: { fontSize: 10, color: '#94A3B8', marginBottom: 4 },
  safetyValue: { fontSize: 18, fontWeight: '700' },
  cautionBox: { backgroundColor: '#FFF8E8', padding: 10, borderRadius: 8, marginTop: 10 },
  cautionText: { fontSize: 11, color: '#E67E22', lineHeight: 16 },
  paperItem: { marginBottom: 10 },
  paperTitle: { fontSize: 12, fontWeight: '600', color: '#2B7DE9' },
  paperJournal: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  paperFinding: { fontSize: 11, color: '#5A6478', marginTop: 4 },
  unmatchedText: { fontSize: 12, color: '#E67E22', marginBottom: 4 },
  saveBtn: { backgroundColor: '#2B7DE9', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  inputLabel: { color: '#5A6478', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  textInputSingle: { backgroundColor: '#F3F6FB', borderWidth: 1, borderColor: '#E4EBF5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E' },
  textInputMulti: { backgroundColor: '#F3F6FB', borderWidth: 1, borderColor: '#E4EBF5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A2E', minHeight: 120, maxHeight: 200 },
  analyzeBtn: { backgroundColor: '#2B7DE9', padding: 14, borderRadius: 12, alignItems: 'center' as const, marginTop: 16 },
  analyzeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  shelfCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E4EBF5', flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A2E' },
  modalSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E4EBF5', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#5A6478' },
  tabBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingTop: 8, paddingBottom: 20, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E4EBF5' },
  tabItem: { alignItems: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
});
