import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Play,
  Pause,
  Square,
  Plus,
  Minus,
  PackagePlus,
  BarChart3,
  Trash2,
  Package,
  ChevronDown,
  Search,
  PenLine,
  Banknote,
  CreditCard,
  Smartphone,
  Gift,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors, { getPaymentColor } from '@/constants/colors';
import KeyboardSafeModal from '@/components/KeyboardSafeModal';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import { posKeys, useAdminEventDetail } from '@/hooks/use-pos-data';
import { usePosStore } from '@/store/pos-store';
import { isUnlimitedQuantity } from '@/utils/inventory';
import { formatMoney, parseDollarInput } from '@/utils/money';
import PRESET_DRINKS, { PresetDrink } from '@/constants/preset-drinks';
import type { EventStatus, PaymentMethod } from '@/types/pos';

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string; IconComp: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', IconComp: Banknote },
  { key: 'card', label: 'Card', IconComp: CreditCard },
  { key: 'mobile', label: 'Mobile', IconComp: Smartphone },
  { key: 'comp', label: 'Comp', IconComp: Gift },
];

const ADD_ITEM_INPUT_MARGIN = 20;

function getQuantityDisplay(qty: number | null): string {
  return isUnlimitedQuantity(qty) ? 'Unlimited' : `${qty} remaining`;
}

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const pairedAdmin = usePosStore((state) => state.pairedAdmin);
  const updateEventStatus = usePosStore((state) => state.updateEventStatus);
  const addItem = usePosStore((state) => state.addItem);
  const restockItem = usePosStore((state) => state.restockItem);
  const setItemQuantity = usePosStore((state) => state.setItemQuantity);
  const removeItem = usePosStore((state) => state.removeItem);
  const deleteEvent = usePosStore((state) => state.deleteEvent);
  const setDefaultPaymentMethod = usePosStore((state) => state.setDefaultPaymentMethod);
  const { data: event, isLoading } = useAdminEventDetail(pairedAdmin?.adminId, eventId);

  const [showAddItem, setShowAddItem] = useState(false);
  const [addMode, setAddMode] = useState<'preset' | 'custom'>('preset');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [presetSearch, setPresetSearch] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<PresetDrink | null>(null);
  const [showPresetList, setShowPresetList] = useState(false);

  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return PRESET_DRINKS;
    const q = presetSearch.toLowerCase();
    return PRESET_DRINKS.filter((d) => d.name.toLowerCase().includes(q));
  }, [presetSearch]);

  const [adjustModal, setAdjustModal] = useState<string | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'reduce'>('add');
  const [adjustQty, setAdjustQty] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const adjustQtyInputRef = useRef<TextInput | null>(null);
  const presetSearchInputRef = useRef<TextInput | null>(null);
  const customNameInputRef = useRef<TextInput | null>(null);
  const customPriceInputRef = useRef<TextInput | null>(null);
  const customQtyInputRef = useRef<TextInput | null>(null);
  const presetPriceInputRef = useRef<TextInput | null>(null);
  const presetQtyInputRef = useRef<TextInput | null>(null);
  const focusedAddItemInputRef = useRef<React.RefObject<TextInput | null> | null>(null);
  const currentScrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);

  const items = useMemo(
    () => (event ? Object.values(event.items).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [event]
  );
  const selectedAdjustItem = adjustModal ? event?.items[adjustModal] : undefined;
  const isAdjustingUnlimited = selectedAdjustItem ? isUnlimitedQuantity(selectedAdjustItem.qtyRemaining) : false;

  const ensureInputVisible = useCallback((input: TextInput | null) => {
    if (Platform.OS !== 'android' || !input || !scrollViewRef.current) return;

    requestAnimationFrame(() => {
      input.measureInWindow((_, inputY, _width, inputHeight) => {
        const viewportHeight = Dimensions.get('window').height;
        const visibleBottom = viewportHeight - keyboardHeightRef.current - ADD_ITEM_INPUT_MARGIN;
        const inputBottom = inputY + inputHeight;

        if (inputBottom <= visibleBottom) return;

        const scrollDelta = inputBottom - visibleBottom;
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, currentScrollYRef.current + scrollDelta),
          animated: true,
        });
      });
    });
  }, []);

  const handleAddItemInputFocus = useCallback((inputRef: React.RefObject<TextInput | null>) => {
    focusedAddItemInputRef.current = inputRef;
    ensureInputVisible(inputRef.current);
  }, [ensureInputVisible]);

  const handleAddItemInputBlur = useCallback((inputRef: React.RefObject<TextInput | null>) => {
    if (focusedAddItemInputRef.current === inputRef) {
      focusedAddItemInputRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      const viewportHeight = Dimensions.get('window').height;
      const keyboardHeight = event.endCoordinates.height || Math.max(0, viewportHeight - event.endCoordinates.screenY);
      keyboardHeightRef.current = keyboardHeight;
      ensureInputVisible(focusedAddItemInputRef.current?.current ?? null);
    });

    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeightRef.current = 0;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [ensureInputVisible]);

  React.useEffect(() => {
    if (!showAddItem) {
      focusedAddItemInputRef.current = null;
    }
  }, [showAddItem]);

  const handleStatusChange = useCallback(
    (newStatus: EventStatus) => {
      if (!eventId) return;
      const messages: Record<string, string> = {
        live: 'Go live? Cashiers will be able to sell items.',
        paused: 'Pause this event? Sales will be temporarily disabled.',
        closed: 'Close this event? This cannot be undone.',
      };
      Alert.alert('Confirm', messages[newStatus] ?? 'Change status?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await updateEventStatus(eventId, newStatus);
              if (pairedAdmin) {
                void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Failed';
              Alert.alert('Error', msg);
            }
          },
        },
      ]);
    },
    [eventId, pairedAdmin, queryClient, updateEventStatus]
  );

  const handleSelectPreset = useCallback((preset: PresetDrink) => {
    setSelectedPreset(preset);
    setItemName(preset.name);
    setItemPrice((preset.priceCents / 100).toFixed(2));
    setShowPresetList(false);
    setPresetSearch('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleAddItem = async () => {
    const trimmedName = addMode === 'preset' && selectedPreset ? selectedPreset.name : itemName.trim();
    if (!trimmedName) { Alert.alert('Error', 'Enter item name'); return; }
    const priceCents = addMode === 'preset' && selectedPreset ? parseDollarInput(itemPrice) : parseDollarInput(itemPrice);
    if (priceCents === null || priceCents <= 0) { Alert.alert('Error', 'Enter a valid price'); return; }
    const qtyStr = itemQty.trim();
    let qty: number | null = null;
    if (qtyStr !== '') {
      qty = parseInt(qtyStr, 10);
      if (isNaN(qty) || qty < 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }
    }
    if (!eventId) return;

    setAddLoading(true);
    try {
      await addItem(eventId, trimmedName, priceCents, qty);
      if (pairedAdmin) {
        void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setItemName('');
      setItemPrice('');
      setItemQty('');
      setSelectedPreset(null);
      setPresetSearch('');
      setShowAddItem(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to add item';
      Alert.alert('Error', msg);
    } finally {
      setAddLoading(false);
    }
  };

  const handleAdjustQty = async () => {
    if (!eventId || !adjustModal) return;
    const qty = parseInt(adjustQty, 10);
    if (isNaN(qty) || qty <= 0) { Alert.alert('Error', 'Enter a valid quantity'); return; }

    const item = event?.items[adjustModal];
    if (!item) return;
    const currentQty = item.qtyRemaining;

    try {
      if (isUnlimitedQuantity(currentQty)) {
        await setItemQuantity(eventId, adjustModal, qty);
      } else if (adjustMode === 'add') {
        await restockItem(eventId, adjustModal, qty);
      } else {
        const newQty = Math.max(0, currentQty - qty);
        await setItemQuantity(eventId, adjustModal, newQty);
      }
      if (pairedAdmin) {
        void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAdjustModal(null);
      setAdjustQty('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      Alert.alert('Error', msg);
    }
  };

  const handleSetDefaultPayment = useCallback(async (method: PaymentMethod) => {
    if (!eventId) return;
    try {
      const current = event?.defaultPaymentMethod;
      await setDefaultPaymentMethod(eventId, current === method ? undefined : method);
      if (pairedAdmin) {
        void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      Alert.alert('Error', msg);
    }
  }, [event?.defaultPaymentMethod, eventId, pairedAdmin, queryClient, setDefaultPaymentMethod]);

  const handleRemoveItem = (itemId: string, name: string) => {
    if (!eventId) return;
    Alert.alert('Remove Item', `Remove "${name}" from this event?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeItem(eventId, itemId);
            if (pairedAdmin) {
              void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
            }
          } catch (error) {
            console.error('[EventDetail] Failed to remove item:', error);
            Alert.alert('Error', 'Failed to remove item');
          }
        },
      },
    ]);
  };

  const handleDeleteEvent = () => {
    if (!eventId || !event) return;
    Alert.alert('Delete Event', `Delete "${event.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(eventId);
          if (pairedAdmin) {
            void queryClient.invalidateQueries({ queryKey: posKeys.events(pairedAdmin.adminId) });
          }
          router.back();
        },
      },
    ]);
  };

  const closeAdjustModal = useCallback(() => {
    setAdjustModal(null);
    setAdjustQty('');
  }, []);

  const closePresetList = useCallback(() => {
    setShowPresetList(false);
    setPresetSearch('');
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

  const isLive = event.status === 'live';
  const isDraft = event.status === 'draft';
  const isPaused = event.status === 'paused';
  const isClosed = event.status === 'closed';
  const canAddItems = isDraft || isLive || isPaused;
  const canEditItems = isDraft;

  return (
    <>
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 80}
    >
      <Stack.Screen options={{ title: event.name }} />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        scrollEventThrottle={16}
        onScroll={(event) => {
          currentScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <StatusBadge status={event.status} size="medium" />
            <Text style={styles.orderCount}>{event.stats.totalOrders} orders</Text>
          </View>
          <Text style={styles.revenue}>{formatMoney(event.stats.totalRevenue)}</Text>

          <View style={styles.statusActions}>
            {isDraft && (
              <TouchableOpacity style={[styles.statusBtn, { backgroundColor: Colors.statusLiveBg }]} onPress={() => handleStatusChange('live')}>
                <Play size={16} color={Colors.statusLive} />
                <Text style={[styles.statusBtnText, { color: Colors.statusLive }]}>Go Live</Text>
              </TouchableOpacity>
            )}
            {isLive && (
              <>
                <TouchableOpacity style={[styles.statusBtn, { backgroundColor: Colors.statusPausedBg }]} onPress={() => handleStatusChange('paused')}>
                  <Pause size={16} color={Colors.statusPaused} />
                  <Text style={[styles.statusBtnText, { color: Colors.statusPaused }]}>Pause</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.statusBtn, { backgroundColor: Colors.statusClosedBg }]} onPress={() => handleStatusChange('closed')}>
                  <Square size={16} color={Colors.statusClosed} />
                  <Text style={[styles.statusBtnText, { color: Colors.statusClosed }]}>Close</Text>
                </TouchableOpacity>
              </>
            )}
            {isPaused && (
              <>
                <TouchableOpacity style={[styles.statusBtn, { backgroundColor: Colors.statusLiveBg }]} onPress={() => handleStatusChange('live')}>
                  <Play size={16} color={Colors.statusLive} />
                  <Text style={[styles.statusBtnText, { color: Colors.statusLive }]}>Resume</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.statusBtn, { backgroundColor: Colors.statusClosedBg }]} onPress={() => handleStatusChange('closed')}>
                  <Square size={16} color={Colors.statusClosed} />
                  <Text style={[styles.statusBtnText, { color: Colors.statusClosed }]}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {!isClosed && (
            <TouchableOpacity
              style={styles.reportsLink}
              onPress={() => router.push(`/admin/reports/${eventId}`)}
            >
              <BarChart3 size={16} color={Colors.primary} />
              <Text style={styles.reportsLinkText}>View Reports</Text>
            </TouchableOpacity>
          )}
          {isClosed && (
            <TouchableOpacity
              style={[styles.reportsLink, { backgroundColor: Colors.accentBg, borderColor: Colors.accent + '30' }]}
              onPress={() => router.push(`/admin/reports/${eventId}`)}
            >
              <BarChart3 size={16} color={Colors.accent} />
              <Text style={[styles.reportsLinkText, { color: Colors.accent }]}>End of Night Summary</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items ({items.length})</Text>
            {canAddItems && (
              <TouchableOpacity
                style={styles.addItemBtn}
                onPress={() => { setShowAddItem(!showAddItem); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Plus size={16} color={Colors.primary} />
                <Text style={styles.addItemBtnText}>{showAddItem ? 'Cancel' : 'Add'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showAddItem && (
            <View style={styles.addItemForm}>
              <View style={styles.modeToggle}>
                <TouchableOpacity
                  style={[styles.modeBtn, addMode === 'preset' && styles.modeBtnActive]}
                  onPress={() => { setAddMode('preset'); setItemName(''); setItemPrice(''); setSelectedPreset(null); }}
                >
                  <ChevronDown size={14} color={addMode === 'preset' ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.modeBtnText, addMode === 'preset' && styles.modeBtnTextActive]}>From Menu</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeBtn, addMode === 'custom' && styles.modeBtnActive]}
                  onPress={() => { setAddMode('custom'); setSelectedPreset(null); setItemName(''); setItemPrice(''); }}
                >
                  <PenLine size={14} color={addMode === 'custom' ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.modeBtnText, addMode === 'custom' && styles.modeBtnTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>

              {addMode === 'preset' && (
                <>
                  <TouchableOpacity
                    style={styles.presetSelector}
                    onPress={() => setShowPresetList(true)}
                  >
                    <Text style={selectedPreset ? styles.presetSelectedText : styles.presetPlaceholder}>
                      {selectedPreset ? selectedPreset.name : 'Select a drink...'}
                    </Text>
                    <ChevronDown size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                  {selectedPreset && (
                    <View style={styles.inputRow}>
                      <TextInput
                        ref={presetPriceInputRef}
                        style={[styles.input, styles.inputHalf]}
                        value={itemPrice}
                        onChangeText={setItemPrice}
                        placeholder="Price ($)"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="decimal-pad"
                        onFocus={() => handleAddItemInputFocus(presetPriceInputRef)}
                        onBlur={() => handleAddItemInputBlur(presetPriceInputRef)}
                      />
                      <TextInput
                        ref={presetQtyInputRef}
                        style={[styles.input, styles.inputHalf]}
                        value={itemQty}
                        onChangeText={setItemQty}
                        placeholder="Qty (blank = unlimited)"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad"
                        autoFocus
                        onFocus={() => handleAddItemInputFocus(presetQtyInputRef)}
                        onBlur={() => handleAddItemInputBlur(presetQtyInputRef)}
                      />
                    </View>
                  )}
                </>
              )}

              {addMode === 'custom' && (
                <>
                  <TextInput
                    ref={customNameInputRef}
                    style={styles.input}
                    value={itemName}
                    onChangeText={setItemName}
                    placeholder="Item name (e.g. Special Cocktail)"
                    placeholderTextColor={Colors.textMuted}
                    autoFocus
                    onFocus={() => handleAddItemInputFocus(customNameInputRef)}
                    onBlur={() => handleAddItemInputBlur(customNameInputRef)}
                  />
                  <View style={styles.inputRow}>
                    <TextInput
                      ref={customPriceInputRef}
                      style={[styles.input, styles.inputHalf]}
                      value={itemPrice}
                      onChangeText={setItemPrice}
                      placeholder="Price ($)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="decimal-pad"
                      onFocus={() => handleAddItemInputFocus(customPriceInputRef)}
                      onBlur={() => handleAddItemInputBlur(customPriceInputRef)}
                    />
                    <TextInput
                      ref={customQtyInputRef}
                      style={[styles.input, styles.inputHalf]}
                      value={itemQty}
                      onChangeText={setItemQty}
                      placeholder="Qty (blank = unlimited)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="number-pad"
                      onFocus={() => handleAddItemInputFocus(customQtyInputRef)}
                      onBlur={() => handleAddItemInputBlur(customQtyInputRef)}
                    />
                  </View>
                </>
              )}

              {(addMode === 'custom' || selectedPreset) && (
                <TouchableOpacity
                  style={[styles.submitBtn, addLoading && styles.submitBtnDisabled]}
                  onPress={handleAddItem}
                  disabled={addLoading}
                >
                  <Text style={styles.submitBtnText}>{addLoading ? 'Adding...' : 'Add Item'}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {items.length === 0 ? (
            <EmptyState
              icon={<Package size={40} color={Colors.textMuted} />}
              title="No items"
              subtitle="Add drinks and items for sale"
            />
          ) : (
            <View style={styles.itemList}>
              {items.map((item) => (
                <View key={item.itemId} style={styles.itemCard}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemPrice}>{formatMoney(item.price)}</Text>
                  </View>
                  <View style={styles.itemFooter}>
                    <Text style={[styles.itemQty, item.qtyRemaining === 0 && styles.itemQtyZero]}>
                      {getQuantityDisplay(item.qtyRemaining)}
                    </Text>
                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => { setAdjustModal(item.itemId); setAdjustMode('add'); setAdjustQty(''); }}
                      >
                        <PackagePlus size={16} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.iconBtn}
                        onPress={() => { setAdjustModal(item.itemId); setAdjustMode('reduce'); setAdjustQty(''); }}
                      >
                        <Minus size={16} color={Colors.statusPaused} />
                      </TouchableOpacity>
                      {canEditItems && (
                        <TouchableOpacity
                          style={styles.iconBtn}
                          onPress={() => handleRemoveItem(item.itemId, item.name)}
                        >
                          <Trash2 size={16} color={Colors.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {!isClosed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Payment Method</Text>
            <Text style={styles.paymentHint}>Pre-selects the payment method at checkout for cashiers</Text>
            <View style={styles.paymentGrid}>
              {PAYMENT_OPTIONS.map(({ key, label, IconComp }) => {
                const isSelected = event.defaultPaymentMethod === key;
                const color = getPaymentColor(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.paymentBtn,
                      isSelected && { borderColor: color, backgroundColor: color + '15' },
                    ]}
                    onPress={() => handleSetDefaultPayment(key)}
                    activeOpacity={0.7}
                  >
                    <IconComp size={18} color={isSelected ? color : Colors.textMuted} />
                    <Text style={[styles.paymentLabel, isSelected && { color }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {isDraft && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteEvent}>
            <Trash2 size={16} color={Colors.danger} />
            <Text style={styles.deleteBtnText}>Delete Event</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>

    <KeyboardSafeModal
      visible={adjustModal !== null}
      onRequestClose={closeAdjustModal}
      animationType="fade"
      variant="centered"
      initialFocusRef={adjustQtyInputRef}
      contentStyle={styles.modalContent}
    >
      <Text style={styles.modalTitle}>
        {isAdjustingUnlimited ? 'Set Quantity' : adjustMode === 'add' ? 'Restock Item' : 'Reduce Quantity'}
      </Text>
      {selectedAdjustItem && (
        <Text style={styles.modalSubtitle}>
          Current: {getQuantityDisplay(selectedAdjustItem.qtyRemaining)}
        </Text>
      )}
      <View style={styles.adjustModeToggle}>
        <TouchableOpacity
          style={[styles.adjustModeBtn, adjustMode === 'add' && styles.adjustModeBtnActiveAdd]}
          onPress={() => setAdjustMode('add')}
        >
          <Plus size={14} color={adjustMode === 'add' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.adjustModeText, adjustMode === 'add' && styles.adjustModeTextActive]}>Add</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.adjustModeBtn, adjustMode === 'reduce' && styles.adjustModeBtnActiveReduce]}
          onPress={() => setAdjustMode('reduce')}
        >
          <Minus size={14} color={adjustMode === 'reduce' ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.adjustModeText, adjustMode === 'reduce' && styles.adjustModeTextActive]}>Reduce</Text>
        </TouchableOpacity>
      </View>
      <TextInput
        ref={adjustQtyInputRef}
        style={styles.input}
        value={adjustQty}
        onChangeText={setAdjustQty}
        placeholder={isAdjustingUnlimited ? 'New quantity' : adjustMode === 'add' ? 'Quantity to add' : 'Quantity to remove'}
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
      />
      <View style={styles.modalActions}>
        <TouchableOpacity style={styles.modalCancel} onPress={closeAdjustModal}>
          <Text style={styles.modalCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalConfirm, !isAdjustingUnlimited && adjustMode === 'reduce' && { backgroundColor: Colors.statusPaused }]}
          onPress={handleAdjustQty}
        >
          <Text style={styles.modalConfirmText}>
            {isAdjustingUnlimited ? 'Set' : adjustMode === 'add' ? 'Restock' : 'Reduce'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardSafeModal>

    <KeyboardSafeModal
      visible={showPresetList}
      onRequestClose={closePresetList}
      animationType="slide"
      variant="bottom-sheet"
      initialFocusRef={presetSearchInputRef}
      contentStyle={styles.presetModalContent}
    >
      <View style={styles.presetModalHeader}>
        <Text style={styles.presetModalTitle}>Select Drink</Text>
        <TouchableOpacity onPress={closePresetList}>
          <Text style={styles.presetModalClose}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.presetSearchWrap}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          ref={presetSearchInputRef}
          style={styles.presetSearchInput}
          value={presetSearch}
          onChangeText={setPresetSearch}
          placeholder="Search drinks..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>
      <FlatList
        data={filteredPresets}
        keyExtractor={(item) => item.name}
        style={styles.presetList}
        contentContainerStyle={styles.presetListContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.presetRow}
            onPress={() => handleSelectPreset(item)}
            activeOpacity={0.6}
          >
            <Text style={styles.presetRowName}>{item.name}</Text>
            <Text style={styles.presetRowPrice}>{formatMoney(item.priceCents)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.presetEmpty}>
            <Text style={styles.presetEmptyText}>No drinks found</Text>
          </View>
        }
      />
    </KeyboardSafeModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 120 },
  errorText: { color: Colors.danger, textAlign: 'center', marginTop: 40, fontSize: 16 },
  statusSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  orderCount: { fontSize: 14, color: Colors.textSecondary },
  revenue: { fontSize: 32, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  statusActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  statusBtnText: { fontSize: 14, fontWeight: '600' as const },
  reportsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primaryBg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  reportsLinkText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.primaryBg,
  },
  addItemBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  addItemForm: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  inputRow: { flexDirection: 'row', gap: 10 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputHalf: { flex: 1 },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  itemList: { gap: 8 },
  itemCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: { fontSize: 16, fontWeight: '500' as const, color: Colors.text, flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: '700' as const, color: Colors.primary },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemQty: { fontSize: 13, color: Colors.textSecondary },
  itemQtyZero: { color: Colors.danger },
  itemActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.dangerBg,
    borderWidth: 1,
    borderColor: Colors.danger + '30',
  },
  deleteBtnText: { fontSize: 15, fontWeight: '600' as const, color: Colors.danger },
  modalSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  adjustModeToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  adjustModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adjustModeBtnActiveAdd: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  adjustModeBtnActiveReduce: {
    backgroundColor: Colors.statusPaused,
    borderColor: Colors.statusPaused,
  },
  adjustModeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  adjustModeTextActive: {
    color: Colors.white,
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paymentBtn: {
    flexBasis: '47%' as unknown as number,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: Colors.transparent,
  },
  paymentLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  paymentHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '500' as const, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  modeToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modeBtnTextActive: {
    color: Colors.white,
  },
  presetSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetPlaceholder: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  presetSelectedText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  presetModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '70%',
    paddingBottom: 34,
  },
  presetModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
  },
  presetModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  presetModalClose: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  presetSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetSearchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  presetList: {
    flex: 1,
  },
  presetListContent: {
    flexGrow: 1,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '40',
  },
  presetRowName: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  presetRowPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginLeft: 12,
  },
  presetEmpty: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetEmptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});
