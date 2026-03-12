import React from 'react';
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type KeyboardEvent,
  type ModalProps,
} from 'react-native';

type Focusable = {
  focus: () => void;
};

type KeyboardSafeModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  variant: 'centered' | 'bottom-sheet';
  children: React.ReactNode;
  initialFocusRef?: React.RefObject<Focusable | null>;
  animationType?: ModalProps['animationType'];
  contentStyle?: StyleProp<ViewStyle>;
  overlayStyle?: StyleProp<ViewStyle>;
  onShow?: () => void;
};

const DIALOG_MARGIN = 24;
const INITIAL_FOCUS_DELAY_MS = 80;

function getKeyboardHeight(event: KeyboardEvent, viewportHeight: number) {
  const keyboardHeight = event.endCoordinates?.height ?? 0;
  if (keyboardHeight > 0) {
    return keyboardHeight;
  }

  const screenY = event.endCoordinates?.screenY;
  if (typeof screenY === 'number') {
    return Math.max(0, viewportHeight - screenY);
  }

  return 0;
}

export default function KeyboardSafeModal({
  visible,
  onRequestClose,
  variant,
  children,
  initialFocusRef,
  animationType = 'fade',
  contentStyle,
  overlayStyle,
  onShow,
}: KeyboardSafeModalProps) {
  const [dialogHeight, setDialogHeight] = React.useState(0);
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  const baselineHeightRef = React.useRef(Dimensions.get('window').height);
  const focusTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFocusTimeout = React.useCallback(() => {
    if (!focusTimeoutRef.current) return;
    clearTimeout(focusTimeoutRef.current);
    focusTimeoutRef.current = null;
  }, []);

  const handleModalShow = React.useCallback(() => {
    baselineHeightRef.current = Dimensions.get('window').height;
    setKeyboardHeight(0);
    clearFocusTimeout();
    onShow?.();

    if (initialFocusRef?.current) {
      focusTimeoutRef.current = setTimeout(() => {
        initialFocusRef.current?.focus();
      }, INITIAL_FOCUS_DELAY_MS);
    }
  }, [clearFocusTimeout, initialFocusRef, onShow]);

  React.useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      setDialogHeight(0);
      clearFocusTimeout();
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(getKeyboardHeight(event, baselineHeightRef.current));
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      clearFocusTimeout();
    };
  }, [clearFocusTimeout, visible]);

  React.useEffect(() => () => clearFocusTimeout(), [clearFocusTimeout]);

  const baselineHeight = baselineHeightRef.current;
  const visibleHeight = Math.max(baselineHeight - keyboardHeight, 0);
  const maxDialogHeight = Math.max(visibleHeight - DIALOG_MARGIN * 2, 0);

  const centeredTop =
    dialogHeight > 0
      ? Math.max(DIALOG_MARGIN, (baselineHeight - dialogHeight) / 2)
      : DIALOG_MARGIN;
  const bottomLimit = Math.max(DIALOG_MARGIN, visibleHeight - DIALOG_MARGIN);
  const overflow = dialogHeight > 0 ? Math.max(0, centeredTop + dialogHeight - bottomLimit) : 0;
  const shiftedTop = Math.max(DIALOG_MARGIN, centeredTop - overflow);

  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onRequestClose}
      onShow={handleModalShow}
      statusBarTranslucent
    >
      {variant === 'centered' ? (
        <ScrollView
          style={styles.overlay}
          contentContainerStyle={[
            styles.centeredOverlayContent,
            {
              minHeight: baselineHeight,
              paddingTop: shiftedTop,
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + DIALOG_MARGIN : DIALOG_MARGIN,
            },
            overlayStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
        >
          <View
            style={[styles.centeredContent, contentStyle, maxDialogHeight > 0 && { maxHeight: maxDialogHeight }]}
            onLayout={(event) => {
              setDialogHeight(event.nativeEvent.layout.height);
            }}
          >
            {children}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.sheetOverlay, overlayStyle]}>
          <View style={[styles.sheetContent, contentStyle]}>{children}</View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centeredOverlayContent: {
    alignItems: 'center',
    paddingHorizontal: DIALOG_MARGIN,
  },
  centeredContent: {
    width: '100%',
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    width: '100%',
  },
});
