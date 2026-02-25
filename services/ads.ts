// services/ads.ts
// AdMob連携 — Development Build時のみ動作、Expo Goではモック
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Google AdMob テスト用広告ユニットID
const TEST_BANNER_IOS = 'ca-app-pub-3940256099942544/2934735716';
const TEST_BANNER_ANDROID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';

// TODO: 本番用広告ユニットID
// const PROD_BANNER_IOS = 'ca-app-pub-XXXX/XXXX';
// const PROD_INTERSTITIAL_IOS = 'ca-app-pub-XXXX/XXXX';

export const BANNER_AD_UNIT_ID = Platform.select({
  ios: TEST_BANNER_IOS,
  android: TEST_BANNER_ANDROID,
  default: TEST_BANNER_IOS,
});

export const INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: TEST_INTERSTITIAL_IOS,
  android: TEST_INTERSTITIAL_ANDROID,
  default: TEST_INTERSTITIAL_IOS,
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
    interstitialAd = InterstitialAdModule.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });

    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      isInterstitialLoaded = false;
      loadInterstitial();
    });

    interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      __DEV__ && console.warn('Interstitial ad error:', error);
      isInterstitialLoaded = false;
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
