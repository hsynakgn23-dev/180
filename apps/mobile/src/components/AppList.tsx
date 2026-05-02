import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { forwardRef, useWindowDimensions, type ReactElement, type Ref } from 'react';
import { Platform } from 'react-native';

const DEFAULT_ESTIMATED_ITEM_SIZE = 96;
const DRAW_DISTANCE_ITEM_MULTIPLIER = 6;

export type AppListHandle<ItemT> = FlashListRef<ItemT>;

export type AppListProps<ItemT> = FlashListProps<ItemT> & {
  estimatedItemSize?: number;
};

const defaultKeyExtractor = <ItemT,>(item: ItemT, index: number): string => {
  if (item && typeof item === 'object') {
    const keyedItem = item as { key?: unknown; id?: unknown };

    if (keyedItem.key != null) {
      return String(keyedItem.key);
    }

    if (keyedItem.id != null) {
      return String(keyedItem.id);
    }
  }

  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }

  return String(index);
};

const AppListInner = <ItemT,>(
  {
    estimatedItemSize = DEFAULT_ESTIMATED_ITEM_SIZE,
    horizontal,
    drawDistance,
    removeClippedSubviews,
    keyExtractor,
    keyboardShouldPersistTaps = 'handled',
    nestedScrollEnabled = true,
    contentInsetAdjustmentBehavior = 'automatic',
    showsHorizontalScrollIndicator,
    showsVerticalScrollIndicator,
    ...props
  }: AppListProps<ItemT>,
  ref: Ref<AppListHandle<ItemT>>,
): ReactElement => {
  const { height, width } = useWindowDimensions();
  const viewportSize = horizontal ? width : height;
  // FlashList v2 measures cells itself; AppList keeps estimatedItemSize as a stable sizing hint.
  const resolvedDrawDistance =
    drawDistance ?? Math.max(viewportSize, estimatedItemSize * DRAW_DISTANCE_ITEM_MULTIPLIER);

  return (
    <FlashList
      ref={ref}
      horizontal={horizontal}
      drawDistance={resolvedDrawDistance}
      removeClippedSubviews={removeClippedSubviews ?? Platform.OS === 'android'}
      keyExtractor={keyExtractor ?? defaultKeyExtractor}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      nestedScrollEnabled={nestedScrollEnabled}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator ?? (horizontal ? false : undefined)}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator ?? (horizontal ? undefined : false)}
      {...props}
    />
  );
};

export const AppList = forwardRef(AppListInner) as <ItemT>(
  props: AppListProps<ItemT> & { ref?: Ref<AppListHandle<ItemT>> },
) => ReactElement;
