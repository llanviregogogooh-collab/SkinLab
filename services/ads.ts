// services/ads.ts
// AdMob連携 — Development Build時のみ動作、Expo Goではモック
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Google AdMob 広告ユニットID
// 本番ID（App Store リリース後に有効）
const BANNER_IOS_PROD = 'ca-app-pub-3510999862027011/6550435476';
const INTERSTITIAL_IOS_PROD = 'ca-app-pub-3510999862027011/5547656635';
// Google公式テストID（Dev Build / __DEV__ 時に使用）
const BANNER_IOS_TEST = 'ca-app-pub-3940256099942544/2934735716';
const BANNER_ANDROID_TEST = 'ca-app-pub-3940256099942544/6300978111';
const INTERSTITIAL_IOS_TEST = 'ca-app-pub-3940256099942544/4411468910';
const INTERSTITIAL_ANDROID_TEST = 'ca-app-pub-3940256099942544/1033173712';

export const BANNER_AD_UNIT_ID = Platform.select({
  ios: __DEV__ ? BANNER_IOS_TEST : BANNER_IOS_PROD,
  android: BANNER_ANDROID_TEST, // TODO: Android本番ID取得後に差し替え
  default: __DEV__ ? BANNER_IOS_TEST : BANNER_IOS_PROD,
});

export const INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: __DEV__ ? INTERSTITIAL_IOS_TEST : INTERSTITIAL_IOS_PROD,
  android: INTERSTITIAL_ANDROID_TEST, // TODO: Android本番ID取得後に差し替え
  default: __DEV__ ? INTERSTITIAL_IOS_TEST : INTERSTITIAL_IOS_PROD,
});

let MobileAds: any = null;
let InterstitialAdModule: any = null;
let AdEventType: any = null;
let interstitialAd: any = null;
let isInterstitialLoaded = false;

/** Expo Go かどうか */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * AdMob SDKの初期化
 * Development Buildでのみ動作
 */
export async function initAds(): Promise<void> {
  if (isExpoGo()) {
    __DEV__ && console.log('AdMob: Expo Go detected — skipping initialization');
    return;
  }

  try {
    // Metro の静的解析を回避するためモジュール名を変数化
    const moduleName = 'react-native-google-' + 'mobile-ads';
    const admob = require(moduleName);
    MobileAds = admob.default || admob;
    InterstitialAdModule = admob.InterstitialAd;
    AdEventType = admob.AdEventType;

    if (MobileAds.initialize) {
      await MobileAds.initialize();
    }
    loadInterstitial();
    __DEV__ && console.log('AdMob initialized');
  } catch (e) {
    __DEV__ && console.warn('AdMob not available:', e);
    MobileAds = null;
  }
}

/**
 * インタースティシャル広告をプリロード
 */
function loadInterstitial(): void {
  if (!InterstitialAdModule || !INTERSTITIAL_AD_UNIT_ID) return;

  try {
    // 古い広告オブジェクトのリスナーを確実に解放
    if (interstitialAd) {
      try { interstitialAd.removeAllListeners(); } catch {}
      interstitialAd = null;
    }

    interstitialAd = InterstitialAdModule.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      // ネイティブUIの完全なdismissを待ってから次の広告をロード
      setTimeout(() => loadInterstitial(), 500);
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      __DEV__ && console.warn('Interstitial ad error:', error);
      isInterstitialLoaded = false;
      // エラー時はリトライ
      setTimeout(() => loadInterstitial(), 30000);
    });

    interstitialAd.load();
  } catch (e) {
    __DEV__ && console.warn('Failed to load interstitial:', e);
  }
}

/**
 * インタースティシャル広告を表示
 */
export async function showInterstitial(): Promise<boolean> {
  if (!interstitialAd || !isInterstitialLoaded) {
    __DEV__ && console.log('Interstitial not ready (Expo Go or not loaded)');
    return false;
  }

  try {
    await interstitialAd.show();
    return true;
  } catch (e) {
    __DEV__ && console.warn('Failed to show interstitial:', e);
    return false;
  }
}

/**
 * AdMobが利用可能かどうか
 */
export function isAdMobAvailable(): boolean {
  return MobileAds !== null;
}
