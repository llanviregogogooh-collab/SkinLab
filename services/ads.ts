// services/ads.ts
// AdMob連携 — Development Build時のみ動作、Expo Goではモック
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Google AdMob 広告ユニットID
const BANNER_IOS_PROD = 'ca-app-pub-3510999862027011/6550435476';
const INTERSTITIAL_IOS_PROD = 'ca-app-pub-3510999862027011/5547656635';
const BANNER_IOS_TEST = 'ca-app-pub-3940256099942544/2934735716';
const BANNER_ANDROID_TEST = 'ca-app-pub-3940256099942544/6300978111';
const INTERSTITIAL_IOS_TEST = 'ca-app-pub-3940256099942544/4411468910';
const INTERSTITIAL_ANDROID_TEST = 'ca-app-pub-3940256099942544/1033173712';

export const BANNER_AD_UNIT_ID = Platform.select({
  ios: __DEV__ ? BANNER_IOS_TEST : BANNER_IOS_PROD,
  android: BANNER_ANDROID_TEST,
  default: __DEV__ ? BANNER_IOS_TEST : BANNER_IOS_PROD,
});

export const INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: __DEV__ ? INTERSTITIAL_IOS_TEST : INTERSTITIAL_IOS_PROD,
  android: INTERSTITIAL_ANDROID_TEST,
  default: __DEV__ ? INTERSTITIAL_IOS_TEST : INTERSTITIAL_IOS_PROD,
});

let MobileAds: any = null;
let InterstitialAdModule: any = null;
let AdEventType: any = null;
let interstitialAd: any = null;
let isInterstitialLoaded = false;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export async function initAds(): Promise<void> {
  if (isExpoGo()) {
    __DEV__ && console.log('AdMob: Expo Go detected — skipping initialization');
    return;
  }
  try {
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

/** 広告オブジェクトを安全に破棄 */
function destroyInterstitial(): void {
  if (interstitialAd) {
    try { interstitialAd.removeAllListeners(); } catch {}
    interstitialAd = null;
  }
  isInterstitialLoaded = false;
}

/**
 * インタースティシャル広告をプリロード
 * LOADED のみ監視。CLOSED / ERROR は showInterstitial() 側で処理する。
 */
function loadInterstitial(): void {
  if (!InterstitialAdModule || !INTERSTITIAL_AD_UNIT_ID) return;
  try {
    destroyInterstitial();
    interstitialAd = InterstitialAdModule.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);
    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
      isInterstitialLoaded = true;
    });
    interstitialAd.addAdEventListener(AdEventType.ERROR, (error: any) => {
      __DEV__ && console.warn('Interstitial load error:', error);
      isInterstitialLoaded = false;
      setTimeout(() => loadInterstitial(), 30000);
    });
    interstitialAd.load();
  } catch (e) {
    __DEV__ && console.warn('Failed to load interstitial:', e);
  }
}

/**
 * インタースティシャル広告を表示し、閉じられるまで待つ。
 * CLOSED / ERROR の両方で必ず resolve する。タイムアウト付き。
 */
export function showInterstitial(): Promise<boolean> {
  if (!interstitialAd || !isInterstitialLoaded) {
    __DEV__ && console.log('Interstitial not ready');
    return Promise.resolve(false);
  }

  const ad = interstitialAd;
  let settled = false;

  return new Promise<boolean>((resolve) => {
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      destroyInterstitial();
      setTimeout(() => {
        loadInterstitial();
        resolve(result);
      }, 600);
    };

    // 安全弁: 15秒でタイムアウト
    const timer = setTimeout(() => {
      __DEV__ && console.warn('Interstitial timed out');
      settle(false);
    }, 15000);

    ad.addAdEventListener(AdEventType.CLOSED, () => settle(true));
    ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
      __DEV__ && console.warn('Interstitial show error:', err);
      settle(false);
    });

    (async () => {
      try {
        await ad.show();
      } catch (e) {
        __DEV__ && console.warn('ad.show() threw:', e);
        settle(false);
      }
    })();
  });
}

export function isAdMobAvailable(): boolean {
  return MobileAds !== null;
}
