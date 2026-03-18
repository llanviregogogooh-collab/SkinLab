// utils/platform.ts
import Constants from 'expo-constants';

/** Expo Go 上で動作しているかどうか */
export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}
