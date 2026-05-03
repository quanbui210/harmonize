import { StyleSheet, View } from 'react-native';
import { Scale } from 'lucide-react-native';
import { lightTheme } from '@/constants/mobile-theme';

const { colors } = lightTheme;

export function BrandMark({ size = 40 }: { size?: number }) {
  const iconSize = Math.max(14, Math.round(size * 0.44));

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Scale size={iconSize} color={colors.text} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
