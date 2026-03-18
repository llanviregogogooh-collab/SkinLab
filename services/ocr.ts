// services/ocr.ts
// OCR（文字認識）サービス
// - カメラ撮影 / フォトライブラリ選択 → ML Kit Text Recognition で日本語テキスト抽出
// - ML Kit は Development Build 必須。Expo Go ではフォールバックUI
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { normalizeOcrText } from './normalizeOcrText';
import { isExpoGo } from '../utils/platform';
import { toHalfWidth } from '../utils/normalize';

/** ML Kit が使えるか */
export function isOCRAvailable(): boolean {
  return !isExpoGo();
}

/**
 * カメラで撮影して画像URIを返す
 */
export async function takePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('カメラ権限', 'カメラの使用を許可してください。');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * フォトライブラリから画像を選択してURIを返す
 * スクリーンショットの選択にも使用
 */
export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('フォトライブラリ権限', '写真へのアクセスを許可してください。');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0].uri;
}

/**
 * 画像URIからテキストを認識する（ML Kit Text Recognition）
 * Development Build でのみ動作
 * @returns 認識されたテキスト全文。失敗時は null
 */
export async function recognizeText(imageUri: string): Promise<string | null> {
  if (isExpoGo()) {
    Alert.alert(
      '開発モード',
      'Expo GoではOCRを使用できません。\nDevelopment Buildで実行するか、テキスト入力をご利用ください。'
    );
    return null;
  }

  try {
    // Metro の静的解析を回避するためモジュール名を変数化
    const moduleName = '@react-native-ml-kit/' + 'text-recognition';
    const TextRecognitionModule = require(moduleName);
    const TextRecognition = TextRecognitionModule.default || TextRecognitionModule;
    const TextRecognitionScript = TextRecognitionModule.TextRecognitionScript;

    // 日本語スクリプトで認識
    const result = await TextRecognition.recognize(
      imageUri,
      TextRecognitionScript?.JAPANESE
    );

    if (!result || !result.text) {
      return null;
    }

    return result.text;
  } catch (e) {
    __DEV__ && console.warn('OCR recognition error:', e);
    Alert.alert(
      'OCRエラー',
      'テキスト認識に失敗しました。画像が鮮明か確認してください。'
    );
    return null;
  }
}

/**
 * OCR結果テキストから成分リストを抽出する
 * ML Kitの認識テキストを成分パーサーに渡せる形に整形
 */
export function cleanOCRText(rawText: string): string {
  // 改行起因の分断空白を連結（\n が消える前に実行）
  let text = normalizeOcrText(rawText);

  // よくあるOCR誤認識の修正
  text = text.replace(/\|/g, 'l');       // パイプ → l
  text = toHalfWidth(text);              // 全角英数記号→半角（０-９含む）

  // 連続空白の正規化
  text = text.replace(/[\s\u3000]+/g, ' ');

  // 改行をカンマ区切りに変換（成分リストは改行区切りのことが多い）
  text = text.replace(/\n+/g, '、');

  return text.trim();
}
