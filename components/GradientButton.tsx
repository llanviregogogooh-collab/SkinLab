// components/GradientButton.tsx
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, shadow } from '../constants/theme';

interface Props {
  onPress: () => void;
  label: string;
  icon?: string;
  style?: any;
  disabled?: boolean;
  colors?: readonly [string, string, ...string[]];
  textStyle?: any;
}

export default function GradientButton({ onPress, label, icon, style, disabled, colors, textStyle }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[styles.wrapper, disabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={colors || [C.gradStart, C.gradEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        {icon ? <Text style={styles.icon}>{icon}</Text> : null}
        <Text style={[styles.label, textStyle]}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    ...shadow(0.15, 8, 3),
  },
  disabled: { opacity: 0.5 },
  gradient: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  icon: { fontSize: 16, marginRight: 6 },
  label: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
