# SkinLab 開発引継ぎ書

## プロジェクト概要
スキンケア成分解析iOSアプリ「SkinLab」の開発。
全成分表をカメラで撮影→成分を自動認識→カテゴリ別にグルーピング表示。各成分の安全性・研究エビデンスも閲覧可能。

## 開発環境
- **OS**: Windows PC + iPhone（Macなし）
- **フレームワーク**: React Native (Expo) + TypeScript
- **テスト**: Expo Go（`npx expo start --lan`で接続確認済み）
- **プロジェクトパス**: `c:\開発関係\SkinLab`
- **Git**: インストール済み、`git init`済み
- **EAS CLI**: インストール済み、`eas build:configure`済み（iOS）
- **Apple Developer Program**: 登録済み（ただしアカウント有効化待ちの可能性あり）

## 技術方針（確定済み）
- **OCR**: Apple Vision（無料・オフライン）→ Development Build必要 → Apple Developer有効化後に対応
- **成分分析**: ローカル成分DB（JSONベース）でマッチング。**AI API（Claude API等）は使わない**
- **コスト**: API課金なし。すべてデバイス上で完結
- **デザイン**: 白基調

## 現在のファイル構成
```
SkinLab/
├── App.tsx                    ← メイン画面（ホーム・結果・シェルフの3タブ）
├── types/index.ts             ← 型定義
├── data/ingredients.ts        ← 成分DB（初期28成分、他AIで拡充作業済み）
├── services/
│   ├── matcher.ts             ← OCRテキスト↔DB マッチング & カテゴリ別グルーピング
│   └── ocr.ts                 ← Apple Vision OCR（Development Build時に使用）
├── app.json                   ← Expo設定
├── eas.json                   ← EAS Build設定
└── .env                       ← （未作成・現時点では不要）
```

## 実装済み機能
- ✅ タブナビゲーション（ホーム / 結果 / マイシェルフ）
- ✅ ダミーデータによるスキャンシミュレーション（4製品）
- ✅ 成分マッチングエンジン（完全一致→alias→INCI→部分一致）
- ✅ **カテゴリ別グルーピング表示**（美白・保湿・抗炎症・抗酸化・角質ケア・エイジング）
- ✅ カテゴリに属さない成分の「その他」表示
- ✅ 未登録成分の表示（DB追加候補として）
- ✅ 成分タップ→詳細モーダル（概要・安全性・研究エビデンス）
- ✅ マイシェルフ保存（メモリ内、AsyncStorage未実装）
- ✅ Expo Goでの動作確認済み

## 削除済み・不採用とした機能
- ❌ レーダーチャート（算出根拠が不明確なため削除）
- ❌ 効能スコアバー（同上）
- ❌ 総合スコア（87点のような数値表示）
- ❌ 製品比較（VS画面）→ MVPには入れない
- ❌ 注目の成分セクション（ホーム画面）→ MVPには入れない
- ❌ AIコメント・AI分析 → 不要
- ❌ Claude API連携 → コスト回避のため不採用

## 未実装・次にやること
### 直近の作業
1. **成分DB拡充の結果を `data/ingredients.ts` に組み込む**（他AIで生成済みのはず）
2. **AsyncStorageでマイシェルフの永続化**
3. **Apple Developer有効化確認 → Development Build → OCR実装**

### その後
4. UIデザインの仕上げ（白基調で調整）
5. サブスクリプション課金（RevenueCat）
6. App Store審査提出（EAS Build / EAS Submit）
7. プライバシーポリシー・利用規約（他AIで生成予定）
8. 薬機法チェック（他AIで確認予定）

## 役割分担
| 担当 | 作業 |
|------|------|
| **Claude** | プログラミング、設計書作成 |
| **他のAI** | 成分DB拡充、アイコン/ストア素材、掲載テキスト、薬機法チェック、利用規約 |
| **本人** | 精査・最終判断、スキンケア知識での品質チェック |

## 注意事項
- `react-native-svg` はインストール済みだが現在未使用（レーダーチャート削除のため）
- `@react-native-ml-kit/text-recognition` はインストール済みだがExpo Goでは動作しない（Development Build必要）
- `expo-camera`, `expo-image-picker`, `expo-file-system` もインストール済み
- OCRの `services/ocr.ts` は作成済みだが未テスト

## 新しいチャットでの最初の指示例
```
SkinLabアプリの開発の続きです。引継ぎ書を添付します。
[このファイルを添付]
次にやりたいことは「○○」です。
```
