// services/subscription.ts
// RevenueCat連携 — Development Build時のみ動作、Expo Goではモック
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import { isExpoGo } from '../utils/platform';

const PREMIUM_CACHE_KEY = '@clearlab_premium';
const REVENUECAT_API_KEY_IOS = 'appl_TpeYsPjarNvzuzNKbHxMDrlEQYG';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';
const ENTITLEMENT_ID = 'premium';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

let Purchases: any = null;

export async function initPurchases(): Promise<void> {
  if (isExpoGo()) {
    __DEV__ && console.log('RevenueCat: Expo Go detected — skipping initialization');
    return;
  }
  try {
    const moduleName = 'react-native-' + 'purchases';
    const rc = require(moduleName);
    Purchases = rc.default || rc;
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    Purchases.configure({ apiKey });
    __DEV__ && console.log('RevenueCat initialized');
  } catch (e) {
    __DEV__ && console.warn('RevenueCat not available:', e);
    Purchases = null;
  }
}

/**
 * プレミアムステータスを確認
 * RevenueCat 確認失敗時はキャッシュを使うが、24時間で期限切れにする
 */
export async function checkPremiumStatus(): Promise<boolean> {
  if (Purchases) {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (__DEV__) {
        console.log('[RC] checkPremiumStatus - active entitlements:', Object.keys(customerInfo.entitlements.active));
      }
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify({
        isPremium,
        checkedAt: Date.now(),
      }));
      return isPremium;
    } catch (e) {
      __DEV__ && console.warn('Failed to check premium status:', e);
    }
  }

  // フォールバック: 期限付きキャッシュ
  try {
    const raw = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      // 旧形式（boolean直接）への後方互換
      if (typeof cached === 'boolean') return false;
      const { isPremium, checkedAt } = cached;
      if (isPremium && Date.now() - checkedAt > CACHE_TTL_MS) {
        __DEV__ && console.log('Premium cache expired');
        return false;
      }
      return isPremium;
    }
  } catch {}
  return false;
}

export async function purchasePremium(): Promise<boolean> {
  if (!Purchases) {
    Alert.alert(
      '開発モード',
      'Expo Goでは課金をテストできません。Development Buildで実行してください。'
    );
    return false;
  }
  try {
    const offerings = await Purchases.getOfferings();
    const currentOffering = offerings.current;

    if (__DEV__) {
      console.log('[RC] offerings.current:', currentOffering?.identifier ?? 'null');
      console.log('[RC] availablePackages:', currentOffering?.availablePackages?.map((p: any) => `${p.identifier}(${p.packageType})`));
    }

    if (!currentOffering) {
      Alert.alert('エラー', 'オファリングが取得できませんでした。しばらくしてからもう一度お試しください。');
      return false;
    }

    // .monthly ($rc_monthly) 優先。設定次第で null になるためフォールバックあり
    const monthlyPackage = currentOffering.monthly
      ?? currentOffering.availablePackages?.[0]
      ?? null;

    if (__DEV__) {
      console.log('[RC] selected package:', monthlyPackage?.identifier ?? 'null');
    }

    if (!monthlyPackage) {
      Alert.alert('エラー', '購入可能なプランが見つかりませんでした。');
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);

    if (__DEV__) {
      console.log('[RC] active entitlements after purchase:', Object.keys(customerInfo.entitlements.active));
    }

    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;

    if (__DEV__ && !isPremium) {
      console.warn(`[RC] entitlement "${ENTITLEMENT_ID}" not found. Active:`, Object.keys(customerInfo.entitlements.active));
    }

    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify({
      isPremium,
      checkedAt: Date.now(),
    }));
    return isPremium;
  } catch (e: any) {
    if (e.userCancelled) {
      __DEV__ && console.log('User cancelled purchase');
    } else {
      __DEV__ && console.warn('Purchase error:', e);
      Alert.alert('購入エラー', e?.message ?? '購入処理中にエラーが発生しました。\nしばらくしてからもう一度お試しください。');
    }
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!Purchases) {
    Alert.alert(
      '開発モード',
      'Expo Goでは購入復元をテストできません。Development Buildで実行してください。'
    );
    return false;
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify({
      isPremium,
      checkedAt: Date.now(),
    }));
    return isPremium;
  } catch (e) {
    __DEV__ && console.warn('Restore error:', e);
    return false;
  }
}
