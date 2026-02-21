import { Pressable, StyleSheet, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { MOBILE_THEME } from './theme';

type UiButtonTone = 'neutral' | 'brand' | 'teal' | 'danger';
const TAP_HIT_SLOP = { top: 8, right: 8, bottom: 8, left: 8 } as const;

type UiButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: UiButtonTone;
  stretch?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

const buttonToneMap: Record<UiButtonTone, { container: ViewStyle; label: TextStyle }> = {
  neutral: {
    container: {
      backgroundColor: MOBILE_THEME.color.buttonNeutralBg,
      borderColor: MOBILE_THEME.color.buttonNeutralBorder,
      borderWidth: 1,
    },
    label: {
      color: MOBILE_THEME.color.buttonNeutralText,
    },
  },
  brand: {
    container: {
      backgroundColor: MOBILE_THEME.color.buttonBrandBg,
    },
    label: {
      color: MOBILE_THEME.color.buttonBrandText,
    },
  },
  teal: {
    container: {
      backgroundColor: MOBILE_THEME.color.buttonTealBg,
    },
    label: {
      color: MOBILE_THEME.color.buttonBrandText,
    },
  },
  danger: {
    container: {
      backgroundColor: MOBILE_THEME.color.buttonDangerBg,
    },
    label: {
      color: MOBILE_THEME.color.buttonDangerText,
    },
  },
};

export const UiButton = ({
  label,
  onPress,
  disabled = false,
  tone = 'brand',
  stretch = false,
  style,
  labelStyle,
  accessibilityLabel,
  accessibilityHint,
}: UiButtonProps) => {
  const toneStyle = buttonToneMap[tone];
  return (
    <Pressable
      style={({ pressed }) => [
        styles.buttonBase,
        toneStyle.container,
        stretch ? styles.buttonStretch : null,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={TAP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.buttonLabel, toneStyle.label, labelStyle]}>{label}</Text>
    </Pressable>
  );
};

type UiChipTone = 'amber' | 'sky';

type UiChipProps = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  tone?: UiChipTone;
  count?: number;
  accessibilityLabel?: string;
};

const chipToneMap: Record<UiChipTone, { base: ViewStyle; active: ViewStyle; text: TextStyle; textActive: TextStyle }> = {
  amber: {
    base: {
      borderColor: MOBILE_THEME.color.amberBorder,
      backgroundColor: MOBILE_THEME.color.amberBg,
    },
    active: {
      borderColor: MOBILE_THEME.color.amberActiveBorder,
      backgroundColor: MOBILE_THEME.color.amberActiveBg,
    },
    text: {
      color: MOBILE_THEME.color.textMuted,
    },
    textActive: {
      color: MOBILE_THEME.color.amberActiveText,
    },
  },
  sky: {
    base: {
      borderColor: MOBILE_THEME.color.skyBorder,
      backgroundColor: MOBILE_THEME.color.skyBg,
    },
    active: {
      borderColor: MOBILE_THEME.color.skyActiveBorder,
      backgroundColor: MOBILE_THEME.color.skyActiveBg,
    },
    text: {
      color: MOBILE_THEME.color.textMuted,
    },
    textActive: {
      color: MOBILE_THEME.color.skyActiveText,
    },
  },
};

export const UiChip = ({
  label,
  onPress,
  selected = false,
  tone = 'amber',
  count,
  accessibilityLabel,
}: UiChipProps) => {
  const toneStyle = chipToneMap[tone];
  const text = typeof count === 'number' ? `${label} (${count})` : label;
  return (
    <Pressable
      style={[
        styles.chipBase,
        toneStyle.base,
        selected ? toneStyle.active : null,
      ]}
      onPress={onPress}
      hitSlop={TAP_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || text}
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, toneStyle.text, selected ? toneStyle.textActive : null]}>
        {text}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStretch: {
    flex: 1,
  },
  buttonPressed: {
    opacity: 0.86,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.15,
  },
  chipBase: {
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
