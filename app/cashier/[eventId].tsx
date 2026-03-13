import React, { useState, useMemo, useCallback } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  PanResponder,
  Pressable,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter, Stack } from 'expo-router';
import {
  Plus,
  Minus,
  ShoppingCart,
  X,
  PenLine,
  ChevronRight,
  Search,
  RefreshCw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import KeyboardSafeModal from '@/components/KeyboardSafeModal';
import { useCashierEventDetail } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { isUnlimitedQuantity } from '@/utils/inventory';
import { formatMoney, parseDollarInput } from '@/utils/money';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_COLS = SCREEN_WIDTH > 500 ? 3 : 2;
const CARD_GAP = 10;
const CARD_WIDTH = (SCREEN_WIDTH - 40 - CARD_GAP * (GRID_COLS - 1)) / GRID_COLS;
const CART_SHEET_HIDDEN_OFFSET = SCREEN_HEIGHT;
const CART_SHEET_ANIMATION_DURATION = 220;
const CART_SHEET_DISMISS_THRESHOLD = 120;
const CART_SHEET_DISMISS_VELOCITY = 1.1;

export default function POSScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const cart = usePosStore((state) => state.cart);
  const addToCart = usePosStore((state) => state.addToCart);
  const incrementCartLine = usePosStore((state) => state.incrementCartLine);
  const decrementCartLine = usePosStore((state) => state.decrementCartLine);
  const removeCartLine = usePosStore((state) => state.removeCartLine);
  const clearCart = usePosStore((state) => state.clearCart);
  const setCurrentEvent = usePosStore((state) => state.setCurrentEvent);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { data: event, isLoading, refetch } = useCashierEventDetail(pairedAdmin?.adminId, eventId);
  const [showCart, setShowCart] = useState(false);
  const [isCartMounted, setIsCartMounted] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualReason, setManualReason] = useState('');
  const itemSearchInputRef = React.useRef<TextInput | null>(null);
  const manualNameInputRef = React.useRef<TextInput | null>(null);
  const cartTranslateY = React.useRef(new Animated.Value(CART_SHEET_HIDDEN_OFFSET)).current;
  const cartBackdropOpacity = React.useRef(new Animated.Value(0)).current;
  const cartSheetHeightRef = React.useRef(CART_SHEET_HIDDEN_OFFSET);
  const cartAnimationRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    if (eventId) {
      setCurrentEvent(eventId);
    }
  }, [eventId, setCurrentEvent]);

  const getCartHiddenOffset = useCallback(
    () => Math.max(cartSheetHeightRef.current, CART_SHEET_HIDDEN_OFFSET),
    []
  );

  const stopCartAnimation = useCallback(() => {
    cartAnimationRef.current?.stop();
    cartAnimationRef.current = null;
  }, []);

  const animateCartSheet = useCallback(
    (translateTo: number, backdropTo: number, onComplete?: () => void) => {
      stopCartAnimation();

      const animation = Animated.parallel([
        Animated.timing(cartTranslateY, {
          toValue: translateTo,
          duration: CART_SHEET_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(cartBackdropOpacity, {
          toValue: backdropTo,
          duration: CART_SHEET_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]);

      cartAnimationRef.current = animation;
      animation.start(({ finished }) => {
        if (cartAnimationRef.current === animation) {
          cartAnimationRef.current = null;
        }

        if (finished) {
          onComplete?.();
        }
      });
    },
    [cartBackdropOpacity, cartTranslateY, stopCartAnimation]
  );

  const openCart = useCallback(() => {
    const hiddenOffset = getCartHiddenOffset();
    setIsCartMounted(true);
    setShowCart(true);
    cartTranslateY.setValue(hiddenOffset);
    cartBackdropOpacity.setValue(0);
    requestAnimationFrame(() => {
      animateCartSheet(0, 1);
    });
  }, [animateCartSheet, cartBackdropOpacity, cartTranslateY, getCartHiddenOffset]);

  const closeCart = useCallback(
    (onComplete?: () => void) => {
      setShowCart(false);

      if (!isCartMounted) {
        onComplete?.();
        return;
      }

      animateCartSheet(getCartHiddenOffset(), 0, () => {
        setIsCartMounted(false);
        onComplete?.();
      });
    },
    [animateCartSheet, getCartHiddenOffset, isCartMounted]
  );

  React.useEffect(
    () => () => {
      stopCartAnimation();
    },
    [stopCartAnimation]
  );

  React.useEffect(() => {
    if (!isCartMounted || cart.length > 0) {
      return;
    }

    closeCart();
  }, [cart.length, closeCart, isCartMounted]);

  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (removeEvent) => {
      if (!isCartMounted) {
        return;
      }

      removeEvent.preventDefault();
      if (showCart) {
        closeCart();
      }
    });

    return unsubscribe;
  }, [closeCart, isCartMounted, navigation, showCart]);

  const cartPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          showCart && gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderGrant: () => {
          stopCartAnimation();
          cartTranslateY.stopAnimation((value) => {
            cartTranslateY.setValue(Math.max(0, value));
          });
          cartBackdropOpacity.stopAnimation((value) => {
            cartBackdropOpacity.setValue(value);
          });
        },
        onPanResponderMove: (_event, gestureState) => {
          const nextTranslateY = Math.max(0, gestureState.dy);
          cartTranslateY.setValue(nextTranslateY);
          cartBackdropOpacity.setValue(Math.max(0, 1 - nextTranslateY / getCartHiddenOffset()));
        },
        onPanResponderRelease: (_event, gestureState) => {
          const shouldDismiss =
            gestureState.dy > CART_SHEET_DISMISS_THRESHOLD ||
            gestureState.vy > CART_SHEET_DISMISS_VELOCITY;

          if (shouldDismiss) {
            closeCart();
            return;
          }

          animateCartSheet(0, 1);
        },
        onPanResponderTerminate: () => {
          animateCartSheet(0, 1);
        },
      }),
    [
      animateCartSheet,
      cartBackdropOpacity,
      cartTranslateY,
      closeCart,
      getCartHiddenOffset,
      showCart,
      stopCartAnimation,
    ]
  );

  const items = useMemo(
    () => (event ? Object.values(event.items).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [event]
  );

  const itemSearchQuery = useMemo(() => itemSearch.trim().toLowerCase(), [itemSearch]);

  const filteredItems = useMemo(() => {
    if (!itemSearchQuery) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(itemSearchQuery));
  }, [itemSearchQuery, items]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
    [cart]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, l) => sum + l.qty, 0),
    [cart]
  );

  const getCartQtyForItem = useCallback(
    (itemId: string) => {
      const line = cart.find((l) => l.type === 'inventory' && l.itemId === itemId);
      return line?.qty ?? 0;
    },
    [cart]
  );

  const handleAddInventoryItem = useCallback(
    (item: { itemId: string; name: string; price: number; qtyRemaining: number | null }) => {
      const qtyRemaining = item.qtyRemaining;
      const inCart = getCartQtyForItem(item.itemId);
      if (!isUnlimitedQuantity(qtyRemaining) && inCart >= qtyRemaining) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addToCart({
        type: 'inventory',
        itemId: item.itemId,
        name: item.name,
        unitPrice: item.price,
        qty: 1,
        maxQty: isUnlimitedQuantity(qtyRemaining) ? undefined : qtyRemaining,
      });
    },
    [addToCart, getCartQtyForItem]
  );

  const handleAddManual = () => {
    const name = manualName.trim();
    if (!name) { Alert.alert('Error', 'Enter a name'); return; }
    const priceCents = parseDollarInput(manualPrice);
    if (priceCents === null || priceCents <= 0) { Alert.alert('Error', 'Enter a valid price'); return; }
    const qty = parseInt(manualQty, 10);
    if (isNaN(qty) || qty < 1) { Alert.alert('Error', 'Enter a valid quantity'); return; }
    const reason = manualReason.trim();
    if (!reason) { Alert.alert('Error', 'A reason is required for manual items'); return; }

    addToCart({
      type: 'manual',
      name,
      unitPrice: priceCents,
      qty,
      reason,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setManualName('');
    setManualPrice('');
    setManualQty('1');
    setManualReason('');
    setShowManual(false);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Add items before checking out');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeCart(() => {
      router.push('/cashier/checkout');
    });
  };

  const handleRefresh = useCallback(async () => {
    if (!pairedAdmin?.adminId || !eventId) {
      return;
    }

    setIsRefreshing(true);

    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [eventId, pairedAdmin?.adminId, refetch]);

  const handleClearSearch = useCallback(() => {
    setItemSearch('');
    requestAnimationFrame(() => {
      itemSearchInputRef.current?.focus();
    });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: event.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerActionBtn, styles.refreshHeaderBtn, isRefreshing && styles.headerActionBtnDisabled]}
                onPress={() => {
                  void handleRefresh();
                }}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={18} color={Colors.primary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.headerActionBtn, styles.manualHeaderBtn]} onPress={() => setShowManual(true)}>
                <PenLine size={18} color={Colors.accent} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <View style={styles.searchBarWrap}>
        <View style={styles.searchBar}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            ref={itemSearchInputRef}
            style={styles.searchInput}
            value={itemSearch}
            onChangeText={setItemSearch}
            placeholder="Search items..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {itemSearch.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearButton}
              onPress={handleClearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <X size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.itemsScroll}
        contentContainerStyle={[
          styles.itemsGrid,
          filteredItems.length === 0 && styles.emptyItemsGrid,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.textSecondary}
            colors={[Colors.primary]}
          />
        }
        alwaysBounceVertical
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>
              {items.length === 0 ? 'No items added yet' : `No items match "${itemSearch.trim()}"`}
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              {items.length === 0
                ? 'Ask the admin to add inventory items for this event.'
                : 'Try a different item name or clear the search.'}
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const inCart = getCartQtyForItem(item.itemId);
            const qtyRemaining = item.qtyRemaining;
            const isUnlimitedStock = isUnlimitedQuantity(qtyRemaining);
            const soldOut = item.qtyRemaining === 0;
            const finiteQtyRemaining = isUnlimitedStock ? 0 : qtyRemaining;
            const atMax = !isUnlimitedStock && inCart >= finiteQtyRemaining;

            return (
              <TouchableOpacity
                key={item.itemId}
                style={[
                  styles.itemCard,
                  { width: CARD_WIDTH },
                  soldOut && styles.itemCardSoldOut,
                  inCart > 0 && styles.itemCardSelected,
                ]}
                onPress={() => handleAddInventoryItem(item)}
                disabled={soldOut}
                activeOpacity={0.7}
              >
                {inCart > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{inCart}</Text>
                  </View>
                )}
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.itemCardPrice}>{formatMoney(item.price)}</Text>
                <Text style={[styles.itemRemaining, soldOut && styles.itemSoldOut]}>
                  {soldOut ? 'SOLD OUT' : isUnlimitedStock ? 'Unlimited' : `${finiteQtyRemaining - inCart} left`}
                </Text>
                {!soldOut && (
                  <View style={[styles.addIndicator, atMax && styles.addIndicatorDisabled]}>
                    <Plus size={16} color={atMax ? Colors.textMuted : Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {cartItemCount > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={openCart}
          activeOpacity={0.8}
        >
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarBadge}>
              <ShoppingCart size={18} color={Colors.white} />
              <View style={styles.cartBarCount}>
                <Text style={styles.cartBarCountText}>{cartItemCount}</Text>
              </View>
            </View>
            <Text style={styles.cartBarLabel}>View Cart</Text>
          </View>
          <View style={styles.cartBarRight}>
            <Text style={styles.cartBarTotal}>{formatMoney(cartTotal)}</Text>
            <ChevronRight size={18} color={Colors.white} />
          </View>
        </TouchableOpacity>
      )}

      {isCartMounted && (
        <View style={styles.cartOverlay}>
          <Animated.View style={[styles.cartBackdrop, { opacity: cartBackdropOpacity }]}>
            <Pressable style={styles.cartBackdropPressable} onPress={() => closeCart()} />
          </Animated.View>
          <Animated.View
            style={[
              styles.cartModalContent,
              styles.cartSheet,
              { transform: [{ translateY: cartTranslateY }] },
            ]}
            onLayout={(layoutEvent) => {
              cartSheetHeightRef.current = layoutEvent.nativeEvent.layout.height;
            }}
          >
            <View style={styles.cartHandleZone} {...cartPanResponder.panHandlers}>
              <View style={styles.cartHandle} />
            </View>
            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Cart ({cartItemCount})</Text>
              <TouchableOpacity onPress={() => closeCart()}>
                <X size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.cartList} keyboardShouldPersistTaps="handled">
              {cart.map((line, idx) => (
                <View key={`${line.itemId ?? line.name}-${idx}`} style={styles.cartLine}>
                  <View style={styles.cartLineInfo}>
                    <Text style={styles.cartLineName} numberOfLines={1}>{line.name}</Text>
                    {line.type === 'manual' && (
                      <Text style={styles.cartLineReason}>{line.reason}</Text>
                    )}
                    <Text style={styles.cartLinePrice}>
                      {formatMoney(line.unitPrice)} × {line.qty} = {formatMoney(line.unitPrice * line.qty)}
                    </Text>
                  </View>
                  <View style={styles.cartLineActions}>
                    <TouchableOpacity style={styles.qtyBtn} onPress={() => decrementCartLine(idx)}>
                      <Minus size={14} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{line.qty}</Text>
                    <TouchableOpacity
                      style={[styles.qtyBtn, line.type === 'inventory' && line.maxQty !== undefined && line.qty >= line.maxQty && styles.qtyBtnDisabled]}
                      onPress={() => incrementCartLine(idx)}
                      disabled={line.type === 'inventory' && line.maxQty !== undefined && line.qty >= line.maxQty}
                    >
                      <Plus size={14} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeCartLine(idx)}>
                      <X size={14} color={Colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.cartFooter}>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => {
                  clearCart();
                  closeCart();
                }}
              >
                <Text style={styles.clearBtnText}>Clear Cart</Text>
              </TouchableOpacity>
              <View style={styles.cartTotalRow}>
                <Text style={styles.cartTotalLabel}>Total</Text>
                <Text style={styles.cartTotalValue}>{formatMoney(cartTotal)}</Text>
              </View>
              <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
                <Text style={styles.checkoutBtnText}>Checkout</Text>
                <ChevronRight size={18} color={Colors.white} />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      <KeyboardSafeModal
        visible={showManual}
        onRequestClose={() => setShowManual(false)}
        animationType="slide"
        variant="centered"
        initialFocusRef={manualNameInputRef}
        contentStyle={styles.manualModal}
      >
        <View style={styles.cartModalHeader}>
          <Text style={styles.cartModalTitle}>Custom Item</Text>
          <TouchableOpacity onPress={() => setShowManual(false)}>
            <X size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.manualForm}>
          <TextInput
            ref={manualNameInputRef}
            style={styles.input}
            value={manualName}
            onChangeText={setManualName}
            placeholder="Item name"
            placeholderTextColor={Colors.textMuted}
          />
          <View style={styles.manualRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={manualPrice}
              onChangeText={setManualPrice}
              placeholder="Price ($)"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.input, { width: 80 }]}
              value={manualQty}
              onChangeText={setManualQty}
              placeholder="Qty"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
            />
          </View>
          <TextInput
            style={styles.input}
            value={manualReason}
            onChangeText={setManualReason}
            placeholder="Reason (required)"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity style={styles.submitBtn} onPress={handleAddManual}>
            <Text style={styles.submitBtnText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      </KeyboardSafeModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  errorText: { color: Colors.danger, textAlign: 'center', marginTop: 40, fontSize: 16 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionBtnDisabled: {
    opacity: 0.7,
  },
  refreshHeaderBtn: {
    backgroundColor: Colors.primaryBg,
  },
  manualHeaderBtn: {
    backgroundColor: Colors.accentBg,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: Colors.bg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: Colors.text,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsScroll: { flex: 1 },
  itemsGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: CARD_GAP,
    paddingBottom: 100,
  },
  emptyItemsGrid: {
    justifyContent: 'center',
  },
  emptyState: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 14,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    minHeight: 120,
    alignSelf: 'flex-start',
    justifyContent: 'space-between',
  },
  itemCardSoldOut: { opacity: 0.35 },
  itemCardSelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  cartBadgeText: { fontSize: 12, fontWeight: '700' as const, color: Colors.white },
  itemName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 6 },
  itemCardPrice: { fontSize: 18, fontWeight: '700' as const, color: Colors.primary, marginBottom: 4 },
  itemRemaining: { fontSize: 12, color: Colors.textSecondary },
  itemSoldOut: { color: Colors.danger, fontWeight: '600' as const },
  addIndicator: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addIndicatorDisabled: { backgroundColor: Colors.surface },
  cartBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cartBarBadge: { flexDirection: 'row', alignItems: 'center' },
  cartBarCount: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  cartBarCountText: { fontSize: 11, fontWeight: '700' as const, color: Colors.white },
  cartBarLabel: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  cartBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartBarTotal: { fontSize: 18, fontWeight: '700' as const, color: Colors.white },
  cartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  cartBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cartBackdropPressable: {
    flex: 1,
  },
  cartModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 34,
    overflow: 'hidden',
  },
  cartSheet: {
    width: '100%',
  },
  cartHandleZone: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 2,
  },
  cartHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text },
  cartList: { paddingHorizontal: 20 },
  cartLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  cartLineInfo: { flex: 1, marginRight: 12 },
  cartLineName: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  cartLineReason: { fontSize: 12, color: Colors.accent, marginTop: 2 },
  cartLinePrice: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  cartLineActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyText: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, minWidth: 24, textAlign: 'center' as const },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.dangerBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  cartFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  clearBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  clearBtnText: { fontSize: 14, color: Colors.danger, fontWeight: '500' as const },
  cartTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTotalLabel: { fontSize: 18, fontWeight: '600' as const, color: Colors.textSecondary },
  cartTotalValue: { fontSize: 28, fontWeight: '800' as const, color: Colors.text },
  checkoutBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnText: { fontSize: 17, fontWeight: '700' as const, color: Colors.white },
  manualModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  manualForm: { padding: 20, gap: 12 },
  manualRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
});
