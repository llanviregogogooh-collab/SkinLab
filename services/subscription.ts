// services/subscription.ts
// RevenueCat連携 — Development Build時のみ動作、Expo Goではモック
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

const PREMIUM_CACHE_KEY = '@skinlab_premium';
const REVENUECAT_API_KEY_IOS = 'YOUR_REVENUECAT_IOS_API_KEY'; // TODO: RevenueCatダッシュボードで取得
const REVENUECAT_API_KEY_ANDROID = 'YOUR_REVENUECAT_ANDROID_API_KEY';
const ENTITLEMENT_ID = 'premium';

let Purchases: any = null;

/** Expo Go かどうか */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/**
 * RevenueCat SDKの初期化
 * Development Buildでのみ動作。Expo Goではスキップ
 */
export async function initPurchases(): Promise<void> {
  if (isExpoGo()) {
    console.log('RevenueCat: Expo Go detected — skipping initialization');
    return;
  }

  try {
    // Metro の静的解析を回避するためモジュール名を変数化
    const moduleName = 'react-native-' + 'purchases';
    const rc = require(moduleName);
    Purchases = rc.default || rc;
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
    Purchases.configure({ apiKey });
    console.log('RevenueCat initialized');
  } catch (e) {
    console.warn('RevenueCat not available:', e);
    Purchases = null;
  }
}

/**
 * プレミアムステータスを確認
 */
export async function checkPremiumStatus(): Promise<boolean> {
  if (Purchases) {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify(isPremium));
      return isPremium;
    } catch (e) {
      console.warn('Failed to check premium status:', e);
    }
  }

  try {
    const cached = await AsyncStorage.getItem(PREMIUM_CACHE_KEY);
    return cached ? JSON.parse(cached) : false;
  } catch {
    return false;
  }
}

/**
 * プレミアムプランを購入
 */
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
    if (!currentOffering) {
      console.warn('No offerings available');
      return false;
    }

    const monthlyPackage = currentOffering.monthly;
    if (!monthlyPackage) {
      console.warn('No monthly package available');
      return false;
    }

    const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
    const isPremium = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify(isPremium));
    return isPremium;
  } catch (e: any) {
    if (e.userCancelled) {
      console.log('User cancelled purchase');
    } else {
      console.warn('Purchase error:', e);
    }
    return false;
  }
}

/**
 * 購入を復元
 */
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
    await AsyncStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify(isPremium));
    return isPremium;
  } catch (e) {
    console.warn('Restore error:', e);
    return false;
  }
}
