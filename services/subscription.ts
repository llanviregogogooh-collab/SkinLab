// services/subscription.ts
// RevenueCat連携 — Development Build時のみ動作、Expo Goではモック
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

const PREMIUM_CACHE_KEY = '@clearlab_premium';
const REVENUECAT_API_KEY_IOS = 'appl_TpeYsPjarNvzuzNKbHxMDrlEQYG';
const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';
const ENTITLEMENT_ID = 'premium';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

let Purchases: any = null;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

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
    if (!currentOffering) return false;
    const monthlyPackage = currentOffering.monthly;
    if (!monthlyPackage) return false;
    const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
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
