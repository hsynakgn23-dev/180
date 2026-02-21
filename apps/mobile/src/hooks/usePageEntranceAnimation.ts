import { useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';

export const usePageEntranceAnimation = () => {
  const pageEntrance = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.timing(pageEntrance, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [pageEntrance]);

  const pageEnterTranslateY = pageEntrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return {
    pageEntrance,
    pageEnterTranslateY,
  };
};

