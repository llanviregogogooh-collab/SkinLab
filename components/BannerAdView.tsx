// components/BannerAdView.tsx
import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { BANNER_AD_UNIT_ID } from '../services/ads';
import { C } from '../constants/theme';

export default function BannerAdView() {
  const [BannerAd, setBannerAd] = useState<any>(null);
  const [BannerAdSize, setBannerAdSize] = useState<any>(null);

  useEffect(() => {
    try {
      const moduleName = 'react-native-google-' + 'mobile-ads';
      const admob = require(moduleName);
      setBannerAd(() => admob.BannerAd);
      setBannerAdSize(admob.BannerAdSize);
    } catch {
      // Expo Go / AdMob not available
    }
  }, []);

  if (!BannerAd || !BannerAdSize || !BANNER_AD_UNIT_ID) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', backgroundColor: C.bg },
});
