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
  Modal,
  Alert,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Linking,
  Platform,
  Animated,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import ImageCropper from './components/ImageCropper';

// ── テーマカラー（洗練されたパレット） ──
const C = {
  bg: '#F0F4FA',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#475569',
  textMuted: '#94A3B8',
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentSoft: '#EFF6FF',
  accentDark: '#1D4ED8',
  gradStart: '#3B82F6',
  gradEnd: '#8B5CF6',
  pink: '#F43F5E',
  pinkSoft: '#FFF1F2',
  purple: '#8B5CF6',
  purpleSoft: '#F5F3FF',
  gold: '#F59E0B',
  goldSoft: '#FFFBEB',
  blue: '#38BDF8',
  blueSoft: '#F0F9FF',
  orange: '#F97316',
  orangeSoft: '#FFF7ED',
  cyan: '#06B6D4',
  cyanSoft: '#ECFEFF',
  emerald: '#10B981',
  emeraldSoft: '#ECFDF5',
  amber: '#D97706',
  amberSoft: '#FFFBEB',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  brightening: C.pink,
  moisturizing: C.blue,
  anti_inflammatory: C.cyan,
  antioxidant: C.gold,
  exfoliating: C.orange,
  anti_aging: C.purple,
  oil_based: C.emerald,
  uv_filter: C.amber,
};

const CATEGORY_BG: Record<CategoryKey, string> = {
  brightening: C.pinkSoft,
  moisturizing: C.blueSoft,
  anti_inflammatory: C.cyanSoft,
  antioxidant: C.goldSoft,
  exfoliating: C.orangeSoft,
  anti_aging: C.purpleSoft,
  oil_based: C.emeraldSoft,
  uv_filter: C.amberSoft,
};

const CATEGORY_ICONS: Record<CategoryKey, string> = {
  brightening: '✨',
  moisturizing: '💧',
  anti_inflammatory: '🛡',
  antioxidant: '🍇',
  exfoliating: '🧴',
  anti_aging: '⏳',
  oil_based: '🫧',
  uv_filter: '☀️',
};

// ── iOS向けシャドウ ──
const shadow = (opacity = 0.08, radius = 12, offsetY = 4) =>
  Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation: Math.round(radius / 2) },
    default: {},
  }) as Record<string, unknown>;

// ══════════════════════════════════════════
// 成分タグ
// ══════════════════════════════════════════
function CategoryPill({ category }: { category: CategoryKey }) {
  const color = CATEGORY_COLORS[category] || C.accent;
  const bg = CATEGORY_BG[category] || C.accentSoft;
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      <Text style={[st.pillText, { color }]}>{CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}</Text>
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
    // isAdMobAvailable() はここで見ない（非同期初期化との競合を避けるため）
    // Expo Go では require が throw するので try/catch で吸収
    try {
      const moduleName = 'react-native-google-' + 'mobile-ads';
      const admob = require(moduleName);
      setBannerAd(() => admob.BannerAd);
      setBannerAdSize(admob.BannerAdSize);
    } catch {
      // Expo Go / AdMob not available
    }
  }, []);

  if (!BannerAd || !BannerAdSize || !BANNER_AD_UNIT_ID) {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', backgroundColor: C.bg }}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

// ══════════════════════════════════════════
// グラデーションボタン
// ══════════════════════════════════════════
function GradientButton({
  onPress,
  label,
  icon,
  style,
  disabled,
  colors,
  textStyle,
}: {
  onPress: () => void;
  label: string;
  icon?: string;
  style?: any;
  disabled?: boolean;
  colors?: readonly [string, string, ...string[]];
  textStyle?: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[{ borderRadius: 14, overflow: 'hidden', ...shadow(0.15, 8, 3) }, disabled && { opacity: 0.5 }, style]}
    >
      <LinearGradient
        colors={colors || [C.gradStart, C.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
      >
        {icon ? <Text style={{ fontSize: 16, marginRight: 6 }}>{icon}</Text> : null}
        <Text style={[{ color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 }, textStyle]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
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
  const scanningRef = useRef(false); // 連打防止用

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

  // 日次スキャンカウントを AsyncStorage から読み込み・日付チェック
  const loadScanCount = useCallback(async () => {
    try {
      const json = await AsyncStorage.getItem(SCAN_COUNT_KEY);
      const today = new Date().toDateString();
      if (json) {
        const { count, date } = JSON.parse(json);
        if (date === today) {
          setDailyScanCount(count);
          setScanDate(today);
        } else {
          setDailyScanCount(0);
          setScanDate(today);
        }
      } else {
        setScanDate(today);
      }
    } catch (e) {
      __DEV__ && console.warn('スキャンカウント読み込みエラー:', e);
    }
    setScanCountReady(true);
  }, []);

  // ── スキャンカウントを先に読み込み（課金初期化より前） ──
  useEffect(() => {
    loadScanCount();
  }, [loadScanCount]);

  // ── 課金・広告の初期化 ──
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

  // ── フォアグラウンド復帰時に日付チェック ──
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadScanCount();
      }
    });
    return () => subscription.remove();
  }, [loadScanCount]);

  const incrementScanCount = useCallback(async () => {
    const today = new Date().toDateString();
    setDailyScanCount((prev) => {
      const base = scanDate === today ? prev : 0;
      const newCount = base + 1;
      AsyncStorage.setItem(SCAN_COUNT_KEY, JSON.stringify({
        count: newCount,
        date: today,
      })).catch((e) => __DEV__ && console.warn('スキャンカウント保存エラー:', e));
      return newCount;
    });
    setScanDate(today);
  }, [scanDate]);

  // ── AsyncStorage: 保存用ヘルパー ──
  const persistShelf = useCallback(async (results: ScanResult[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (e) {
      __DEV__ && console.warn('シェルフ保存エラー:', e);
    }
  }, []);

  const resetDevScanLimits = useCallback(async () => {
    if (!__DEV__) return;
    const today = new Date().toDateString();
    try {
      await AsyncStorage.removeItem(SCAN_COUNT_KEY);
      setDailyScanCount(0);
      setScanDate(today);
      setShowPaywall(false);
      scanAdCounterRef.current = 0;
      detailAdCounterRef.current = 0;
      Alert.alert('開発用', '解析上限をリセットしました。');
    } catch (e) {
      __DEV__ && console.warn('開発用リセットエラー:', e);
      Alert.alert('開発用', '解析上限のリセットに失敗しました。');
    }
  }, []);
  // ── スキャン制限チェック ──
  const canScan = (): boolean => {
    if (!scanCountReady) return false; // 起動直後はカウント読み込み完了まで不許可
    if (isPremium) return true;
    const today = new Date().toDateString();
    const effectiveCount = scanDate === today ? dailyScanCount : 0;
    if (effectiveCount >= FREE_DAILY_SCAN_LIMIT) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  // ── スキャン後の広告表示 ──
  // 広告が実際に表示できたときだけカウントをリセットする
  const handlePostScanAd = async () => {
    if (isPremium) return;
    scanAdCounterRef.current += 1;
    if (scanAdCounterRef.current >= INTERSTITIAL_SCAN_INTERVAL) {
      const shown = await showInterstitial();
      if (shown) {
        scanAdCounterRef.current = 0;
      }
      // shown === false: カウントは保持し、次回また挑戦
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
  const runTextScan = async () => {
    if (scanningRef.current) return;
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

  // ── OCRスキャン（カメラ撮影） → クロッパー表示 ──
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

  // ── OCRスキャン（スクショ・フォトライブラリ） → クロッパー表示 ──
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

  // ── クロップ完了 → 少し待ってからOCR処理 ──
  const handleCropDone = (croppedUri: string) => {
    const name = cropDefaultName;
    setCropImageUri(null);
    setOcrLoading(true);
    setTimeout(() => {
      void (async () => {
        try {
          await processOCRImage(croppedUri, name);
        } finally {
          setOcrLoading(false);
        }
      })();
    }, 400);
  };

  const handleCropCancel = () => {
    setCropImageUri(null);
  };

  // ── OCR共通処理 ──
  const processOCRImage = async (imageUri: string, defaultName: string) => {
    const rawText = await recognizeText(imageUri);
    if (!rawText) {
      return;
    }

    const cleaned = cleanOCRText(rawText);
    const parsed = parseIngredientText(cleaned);

    if (parsed.length === 0) {
      setIngredientInput(rawText);
      setProductNameInput('');
      Alert.alert(
        '成分を検出できませんでした',
        '認識テキストを入力欄にセットしました。\n手動で修正してから解析してください。'
      );
      return;
    }

    const result = createScanResult(parsed, '', defaultName);
    incrementScanCount();
    await handlePostScanAd();
    setScanResult(result);
    setTab('scan');
    maybeRequestReview();
  };


  const saveResult = () => {
    if (!scanResult) return;

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
  // 広告対象回は先に広告を出し、閉じてからモーダルを開く
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
  // ペイウォールモーダル
  // ══════════════════════════════════════════
  const renderPaywall = () => (
    <Modal visible={showPaywall} animationType="slide" presentationStyle="pageSheet">
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
          {/* グラデーションヘッダー */}
          <LinearGradient
            colors={[C.gradStart, C.gradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' }}
          >
            <TouchableOpacity
              style={{ position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setShowPaywall(false)}
            >
              <Text style={{ fontSize: 16, color: '#FFF', fontWeight: '600' }}>✕</Text>
            </TouchableOpacity>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 36 }}>💎</Text>
            </View>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>Premium</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
              すべての機能を制限なく使えます
            </Text>
          </LinearGradient>

          <View style={{ padding: 24, marginTop: -16 }}>
            {/* ベネフィットカード */}
            <View style={[st.card, { padding: 0, overflow: 'hidden' }]}>
              {[
                { icon: '🔍', color: C.accent, text: '成分解析 無制限', sub: '無料: 1日5回まで' },
                { icon: '📦', color: C.purple, text: 'シェルフ保存 無制限', sub: '無料: 5件まで' },
                { icon: '🚫', color: C.pink, text: '広告を完全非表示', sub: '快適な使用体験' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: C.border }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${item.color}15`, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                    <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: C.text }}>{item.text}</Text>
                    <Text style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{item.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* 購入ボタン */}
            <View style={{ marginTop: 20 }}>
              <GradientButton
                onPress={async () => {
                  const success = await purchasePremium();
                  if (success) {
                    setIsPremium(true);
                    setShowPaywall(false);
                    Alert.alert('ありがとうございます！', 'プレミアムプランが有効になりました。');
                  } else {
                    // purchasePremium() 側で userCancelled 以外の失敗アラートを表示する
                  }
                }}
                label="月額330円でプレミアムに登録"
                icon="💎"
              />
            </View>

            <TouchableOpacity
              style={{ alignItems: 'center', marginTop: 16, paddingVertical: 8 }}
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
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600' }}>購入を復元する</Text>
            </TouchableOpacity>

            {/* Apple必須: サブスクリプション開示情報 */}
            <View style={{ marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ fontSize: 11, color: C.textMuted, lineHeight: 18, textAlign: 'center' }}>
                月額330円（税込）の自動更新サブスクリプションです。{'\n'}
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
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  // ══════════════════════════════════════════
  // 成分詳細モーダル
  // ══════════════════════════════════════════
  const renderIngredientModal = () => {
    if (!selectedIngredient) return null;
    const ing = selectedIngredient;

    return (
      <Modal visible={true} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 40 }} bounces={false}>
            {/* ヘッダーグラデーション */}
            <LinearGradient
              colors={[C.accentSoft, C.bg]}
              style={{ paddingTop: 20, paddingBottom: 16, paddingHorizontal: 20 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={st.modalTitle}>{ing.name_cosmetic}</Text>
                  <Text style={st.modalSubtitle}>{ing.name_inci}</Text>
                </View>
                <TouchableOpacity style={st.closeBtn} onPress={() => setSelectedIngredient(null)}>
                  <Text style={st.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
                {ing.categories.map((cat) => (
                  <CategoryPill key={cat} category={cat} />
                ))}
              </View>
            </LinearGradient>

            <View style={{ padding: 20 }}>
              {/* 概要カード */}
              <View style={st.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>📋</Text>
                  <Text style={st.cardTitle}>概要</Text>
                </View>
                <Text style={st.cardBody}>{ing.description}</Text>
              </View>

              {/* 安全性カード */}
              <View style={st.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>🛡</Text>
                  <Text style={st.cardTitle}>安全性</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={st.safetyBox}>
                    <Text style={st.safetyLabel}>刺激性</Text>
                    <Text style={[st.safetyValue, {
                      color: ing.safety.irritation === 'low' ? '#10B981' :
                             ing.safety.irritation === 'medium' ? C.gold : C.pink
                    }]}>
                      {ing.safety.irritation === 'low' ? '低' : ing.safety.irritation === 'medium' ? '中' : '高'}
                    </Text>
                  </View>
                  <View style={st.safetyBox}>
                    <Text style={st.safetyLabel}>光感受性</Text>
                    <Text style={[st.safetyValue, { color: ing.safety.photosensitivity ? C.orange : '#10B981' }]}>
                      {ing.safety.photosensitivity ? 'あり' : 'なし'}
                    </Text>
                  </View>
                  <View style={st.safetyBox}>
                    <Text style={st.safetyLabel}>コメド</Text>
                    <Text style={[st.safetyValue, {
                      color: ing.safety.comedogenic <= 1 ? '#10B981' : ing.safety.comedogenic <= 3 ? C.gold : C.pink
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

              {/* 研究エビデンスカード */}
              {ing.research.length > 0 && (
                <View style={st.card}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 16, marginRight: 6 }}>📚</Text>
                    <Text style={st.cardTitle}>研究エビデンス</Text>
                  </View>
                  {ing.research.map((paper, i) => (
                    <View key={i} style={[st.paperItem, i > 0 && { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 }]}>
                      <Text style={st.paperTitle}>{paper.title}</Text>
                      <Text style={st.paperJournal}>{paper.journal}, {paper.year}</Text>
                      <Text style={st.paperFinding}>→ {paper.finding}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // ══════════════════════════════════════════
  // ホーム画面
  // ══════════════════════════════════════════
  const renderHome = () => (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* ── ヒーローヘッダー ── */}
      <LinearGradient
        colors={[C.gradStart, C.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: 16, paddingBottom: 32, paddingHorizontal: 24 }}
      >
        <Text style={{ fontSize: 28, fontWeight: '800', color: '#FFF', letterSpacing: 1 }}>ClearLab.</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
          成分から、本当の価値を知る
        </Text>
      </LinearGradient>

      <View style={{ padding: 20, marginTop: -16 }}>
        {/* ── OCRスキャンカード ── */}
        <View style={[st.card, { padding: 24, alignItems: 'center' }]}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 28 }}>📸</Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 6 }}>全成分表をスキャン</Text>
          <Text style={{ fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 20 }}>
            カメラ撮影またはスクリーンショットから{'\n'}成分を自動認識して解析します
          </Text>

          {ocrLoading ? (
            <View style={{ marginTop: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={{ fontSize: 13, color: C.accent, marginTop: 8, fontWeight: '600' }}>テキストを認識中...</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, width: '100%' }}>
              <TouchableOpacity
                style={[st.scanBtn, { flex: 1 }]}
                onPress={runCameraScan}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[C.gradStart, C.accentDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={st.scanBtnInner}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>📷</Text>
                  <Text style={st.scanBtnText}>カメラ撮影</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.scanBtn, { flex: 1 }]}
                onPress={runImageScan}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={[C.purple, '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={st.scanBtnInner}
                >
                  <Text style={{ fontSize: 18, marginBottom: 4 }}>🖼</Text>
                  <Text style={st.scanBtnText}>スクショ選択</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {!isOCRAvailable() && (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 12, width: '100%' }}>
              <Text style={{ fontSize: 11, color: '#92400E', textAlign: 'center' }}>
                ※ Expo Goでは文字認識が利用できません。Development Buildで実行してください。
              </Text>
            </View>
          )}
        </View>

        {/* ── プレミアムバナー（無料ユーザーのみ） ── */}
        {!isPremium && (
          <TouchableOpacity
            style={{ marginTop: 12, borderRadius: 16, overflow: 'hidden', ...shadow(0.1, 8, 3) }}
            onPress={() => setShowPaywall(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#EEF2FF', '#F5F3FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ padding: 18, flexDirection: 'row', alignItems: 'center' }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(139,92,252,0.12)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 22 }}>💎</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: C.text }}>プレミアムにアップグレード</Text>
                <Text style={{ fontSize: 12, color: C.textSub, marginTop: 2 }}>
                  広告なし・解析無制限・シェルフ無制限 — 月額330円
                </Text>
              </View>
              <Text style={{ fontSize: 16, color: C.purple }}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        {__DEV__ && (
          <TouchableOpacity
            style={[st.card, { marginTop: 12, borderWidth: 1, borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]}
            activeOpacity={0.8}
            onPress={() => {
              Alert.alert(
                '開発用',
                '解析上限をリセットしますか？',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: 'リセット', style: 'destructive', onPress: () => { void resetDevScanLimits(); } },
                ]
              );
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#92400E' }}>開発用: 解析上限をリセット</Text>
            <Text style={{ fontSize: 12, color: '#B45309', marginTop: 4 }}>
              本番ビルドでは表示も実行もされません。
            </Text>
          </TouchableOpacity>
        )}

        {/* ── 成分テキスト入力セクション ── */}
        <View style={[st.card, { marginTop: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ fontSize: 16, marginRight: 6 }}>📝</Text>
            <Text style={st.sectionTitle}>成分リストを入力</Text>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 12, marginBottom: 16 }}>
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
            <GradientButton
              onPress={runTextScan}
              label="解析する"
              icon="🔬"
              disabled={!ingredientInput.trim()}
            />
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 32 }}>📊</Text>
          </View>
          <Text style={{ fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 6 }}>解析結果がありません</Text>
          <Text style={{ fontSize: 13, color: C.textMuted, textAlign: 'center' }}>ホーム画面からスキャンまたは{'\n'}テキスト入力で解析を開始してください</Text>
        </View>
      );
    }

    const stats = getMatchStats(scanResult.ingredients);
    const unmatched = scanResult.ingredients.filter((i) => !i.entry);
    const grouped = groupByCategory(scanResult.ingredients);
    const categoryKeys = Object.keys(CATEGORY_LABELS) as CategoryKey[];
    const uncategorized = scanResult.ingredients.filter(
      (i) => i.entry && i.entry.categories.length === 0
    );

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* 結果ヘッダー */}
        <LinearGradient
          colors={[C.accentSoft, C.bg]}
          style={{ paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20 }}
        >
          <Text style={st.pageTitle}>{scanResult.product_name || '解析結果'}</Text>
          {/* マッチ率バー */}
          <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                <LinearGradient
                  colors={[C.gradStart, C.gradEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: 6, width: `${stats.total > 0 ? (stats.matched / stats.total) * 100 : 0}%`, borderRadius: 3 }}
                />
              </View>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: C.accent }}>
              {stats.matched}/{stats.total}
            </Text>
          </View>
          <Text style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>
            {stats.total}成分中 {stats.matched}件がDB登録済み
          </Text>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          {/* カテゴリ別グルーピング */}
          {categoryKeys.map((catKey) => {
            const items = grouped[catKey];
            if (!items || items.length === 0) return null;
            const color = CATEGORY_COLORS[catKey];
            const bg = CATEGORY_BG[catKey];
            const icon = CATEGORY_ICONS[catKey];

            return (
              <View key={catKey} style={[st.categorySection, { borderLeftColor: color }]}>
                <View style={[st.categoryHeader, { backgroundColor: bg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, marginRight: 6 }}>{icon}</Text>
                    <Text style={[st.categoryTitle, { color }]}>{CATEGORY_LABELS[catKey]}</Text>
                  </View>
                  <View style={{ backgroundColor: `${color}20`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 }}>
                    <Text style={[st.categoryCount, { color }]}>{items.length}</Text>
                  </View>
                </View>
                {items.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={st.groupedIngredient}
                    onPress={() => openIngredientDetail(item.entry)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
                      <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={st.ingredientOrder}>#{item.order}</Text>
                      <Text style={{ color: C.textMuted, fontSize: 12 }}>›</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}

          {/* カテゴリなし成分 */}
          {uncategorized.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 10 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>🧪</Text>
                <Text style={st.sectionTitle}>その他の成分</Text>
              </View>
              {uncategorized.map((item, i) => (
                <TouchableOpacity key={i} style={st.ingredientCard} onPress={() => openIngredientDetail(item.entry)} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.ingredientName}>{item.entry!.name_cosmetic}</Text>
                    <Text style={st.ingredientInci}>{item.entry!.name_inci}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={st.ingredientOrder}>#{item.order}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 12 }}>›</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* 未マッチ */}
          {unmatched.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
                <Text style={{ fontSize: 14, marginRight: 6 }}>❓</Text>
                <Text style={[st.sectionTitle, { color: C.textMuted, marginBottom: 0 }]}>
                  未登録成分 ({unmatched.length})
                </Text>
              </View>
              <View style={[st.card, { backgroundColor: '#FAFBFC' }]}>
                {unmatched.map((item, i) => (
                  <Text key={i} style={[st.unmatchedText, i > 0 && { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 6 }]}>
                    #{item.order}  {item.raw_text}
                  </Text>
                ))}
              </View>
            </>
          )}

          {savedResults.some((r) => r.id === scanResult.id) ? (
            <View style={[st.savedBadge, { marginTop: 24 }]}>
              <Text style={{ fontSize: 16, marginRight: 6 }}>✓</Text>
              <Text style={{ color: '#10B981', fontSize: 15, fontWeight: '700' }}>保存済み</Text>
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
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      {/* ヘッダー */}
      <LinearGradient
        colors={[C.accentSoft, C.bg]}
        style={{ paddingTop: 16, paddingBottom: 24, paddingHorizontal: 20 }}
      >
        <Text style={st.pageTitle}>マイシェルフ</Text>
        <Text style={st.pageSubtitle}>保存した製品の解析結果</Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: 20 }}>
        {savedResults.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 48, padding: 20 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 36 }}>📦</Text>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 }}>まだ保存した製品がありません</Text>
            <Text style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              スキャン結果から{'\n'}「マイシェルフに保存」で追加できます
            </Text>
          </View>
        ) : (
          savedResults.map((result, idx) => (
            <TouchableOpacity
              key={result.id}
              style={st.shelfCard}
              onPress={() => { setScanResult(result); setTab('scan'); }}
              activeOpacity={0.7}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.accentSoft, justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 18 }}>🧴</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.productName}>{result.product_name || '無題の製品'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                  <Text style={st.productCount}>
                    {result.ingredients.filter((x) => x.entry).length}成分マッチ
                  </Text>
                  <Text style={{ fontSize: 3, color: C.textMuted }}>●</Text>
                  <Text style={{ color: C.textMuted, fontSize: 11 }}>
                    {new Date(result.scanned_at).toLocaleDateString('ja-JP')}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); renameProduct(result.id, result.product_name); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={st.iconBtn}
                >
                  <Text style={{ color: C.accent, fontSize: 13 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); deleteResult(result.id); }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={st.iconBtn}
                >
                  <Text style={{ color: C.textMuted, fontSize: 13 }}>🗑</Text>
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
      {renderIngredientModal()}
      {renderPaywall()}

      {/* ── 画像クロップUI ── */}
      <ImageCropper
        visible={!!cropImageUri}
        imageUri={cropImageUri || ''}
        onCrop={handleCropDone}
        onCancel={handleCropCancel}
      />

      {/* ── バナー広告（無料ユーザーのみ） ── */}
      {/* key={adsReady} により initAds() 完了後に再マウントして確実に表示 */}
      {!isPremium && <BannerAdView key={String(adsReady)} />}

      {/* ── タブバー ── */}
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
                <Text style={{ fontSize: 20 }}>{t.icon}</Text>
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
// スタイル
// ══════════════════════════════════════════
const st = StyleSheet.create({
  // ── ページ共通 ──
  pageTitle: { fontSize: 26, fontWeight: '800', color: C.text, letterSpacing: 0.3 },
  pageSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 10 },
  emptyText: { color: C.textSub, fontSize: 14 },

  // ── カード ──
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    ...shadow(0.06, 10, 3),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  cardBody: { fontSize: 13, color: C.textSub, lineHeight: 22 },

  // ── スキャンボタン ──
  scanBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    ...shadow(0.12, 8, 3),
  },
  scanBtnInner: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scanBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // ── カテゴリセクション ──
  categorySection: {
    marginBottom: 16,
    borderLeftWidth: 4,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: C.card,
    ...shadow(0.05, 8, 2),
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryTitle: { fontSize: 14, fontWeight: '700' },
  categoryCount: { fontSize: 12, fontWeight: '700' },
  groupedIngredient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  // ── 成分カード ──
  ingredientCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow(0.04, 6, 2),
  },
  ingredientOrder: { fontSize: 11, color: C.textMuted, fontWeight: '600' },
  ingredientName: { fontSize: 14, fontWeight: '700', color: C.text },
  ingredientInci: { fontSize: 11, color: C.textMuted, marginTop: 2 },

  // ── タグ ──
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
    marginBottom: 6,
  },
  pillText: { fontSize: 11, fontWeight: '600' },

  // ── 安全性 ──
  safetyBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  safetyLabel: { fontSize: 10, color: C.textMuted, marginBottom: 6, fontWeight: '500' },
  safetyValue: { fontSize: 20, fontWeight: '800' },
  cautionBox: {
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  cautionText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

  // ── 研究論文 ──
  paperItem: { marginBottom: 12 },
  paperTitle: { fontSize: 13, fontWeight: '600', color: C.accent },
  paperJournal: { fontSize: 11, color: C.textMuted, marginTop: 3 },
  paperFinding: { fontSize: 12, color: C.textSub, marginTop: 4, lineHeight: 18 },
  unmatchedText: { fontSize: 12, color: C.orange, marginBottom: 6, paddingVertical: 2 },

  // ── 保存ボタン関連 ──
  savedBadge: {
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },

  // ── 入力 ──
  inputLabel: { color: C.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  textInputSingle: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
  },
  textInputMulti: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    minHeight: 120,
    maxHeight: 200,
  },

  // ── シェルフ ──
  shelfCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow(0.06, 8, 3),
  },
  productName: { fontSize: 15, fontWeight: '600', color: C.text },
  productCount: { fontSize: 11, color: C.textMuted },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── モーダル ──
  modalTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  modalSubtitle: { fontSize: 13, color: C.textMuted, marginTop: 3 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 16, color: C.textSub, fontWeight: '600' },

  // ── タブバー ──
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 20,
    backgroundColor: C.card,
    ...shadow(0.08, 16, -4),
  },
  tabItem: { alignItems: 'center', paddingHorizontal: 16 },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: C.accentSoft,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2, color: C.textMuted },
  tabLabelActive: { color: C.accent },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
    marginTop: 3,
  },
});
