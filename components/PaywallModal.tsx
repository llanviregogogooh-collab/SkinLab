// components/PaywallModal.tsx
import { View, Text, ScrollView, Modal, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, shadow } from '../constants/theme';
import { purchasePremium, restorePurchases } from '../services/subscription';
import GradientButton from './GradientButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPremiumActivated: () => void;
}

export default function PaywallModal({ visible, onClose, onPremiumActivated }: Props) {
  const handlePurchase = async () => {
    const success = await purchasePremium();
    if (success) {
      onPremiumActivated();
      Alert.alert('ありがとうございます！', 'プレミアムプランが有効になりました。');
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      onPremiumActivated();
      Alert.alert('復元完了', 'プレミアムプランが復元されました。');
    } else {
      Alert.alert('復元できませんでした', '有効な購入が見つかりませんでした。');
    }
  };

  const BENEFITS = [
    { icon: '🔍', color: C.accent, text: '成分解析 無制限', sub: '無料: 1日5回まで' },
    { icon: '📦', color: C.purple, text: 'シェルフ保存 無制限', sub: '無料: 5件まで' },
    { icon: '🚫', color: C.pink, text: '広告を完全非表示', sub: '快適な使用体験' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* グラデーションヘッダー */}
          <LinearGradient
            colors={[C.gradStart, C.gradEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>💎</Text>
            </View>
            <Text style={styles.title}>Premium</Text>
            <Text style={styles.subtitle}>すべての機能を制限なく使えます</Text>
          </LinearGradient>

          <View style={styles.body}>
            {/* ベネフィットカード */}
            <View style={styles.benefitsCard}>
              {BENEFITS.map((item, i) => (
                <View key={i} style={[styles.benefitRow, i > 0 && styles.benefitBorder]}>
                  <View style={[styles.benefitIcon, { backgroundColor: `${item.color}15` }]}>
                    <Text style={styles.benefitIconText}>{item.icon}</Text>
                  </View>
                  <View style={styles.benefitTextWrap}>
                    <Text style={styles.benefitTitle}>{item.text}</Text>
                    <Text style={styles.benefitSub}>{item.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* 購入ボタン */}
            <View style={styles.purchaseWrap}>
              <GradientButton onPress={handlePurchase} label="月額330円でプレミアムに登録" icon="💎" />
            </View>

            <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
              <Text style={styles.restoreText}>購入を復元する</Text>
            </TouchableOpacity>

            {/* Apple必須: サブスクリプション開示情報 */}
            <View style={styles.disclosure}>
              <Text style={styles.disclosureText}>
                月額330円（税込）の自動更新サブスクリプションです。{'\n'}
                購入確認時にApple IDアカウントに課金されます。{'\n'}
                現在の期間終了の24時間前までにキャンセルしない限り、サブスクリプションは自動的に更新されます。{'\n'}
                アカウントへの課金は、現在の期間終了前24時間以内に行われます。{'\n'}
                サブスクリプションの管理・キャンセルは、端末の「設定」→ Apple ID →「サブスクリプション」から行えます。
              </Text>
              <View style={styles.links}>
                <TouchableOpacity onPress={() => Linking.openURL('https://llanviregogogooh-collab.github.io/SkinLab/privacy-policy.html')}>
                  <Text style={styles.linkText}>プライバシーポリシー</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL('https://llanviregogogooh-collab.github.io/SkinLab/terms-of-service.html')}>
                  <Text style={styles.linkText}>利用規約</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },
  header: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' },
  closeBtn: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 16, color: '#FFF', fontWeight: '600' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconText: { fontSize: 36 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  body: { padding: 24, marginTop: -16 },
  benefitsCard: { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden', ...shadow(0.06, 10, 3) },
  benefitRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  benefitBorder: { borderTopWidth: 1, borderTopColor: C.border },
  benefitIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  benefitIconText: { fontSize: 20 },
  benefitTextWrap: { flex: 1 },
  benefitTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  benefitSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  purchaseWrap: { marginTop: 20 },
  restoreBtn: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  restoreText: { color: C.accent, fontSize: 13, fontWeight: '600' },
  disclosure: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  disclosureText: { fontSize: 11, color: C.textMuted, lineHeight: 18, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'center', marginTop: 12, gap: 16 },
  linkText: { fontSize: 11, color: C.accent, textDecorationLine: 'underline' },
});
