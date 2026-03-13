// components/ImageCropper.tsx
// フリーフォーム画像クロップUI
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Image,
  Modal,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

interface Props {
  visible: boolean;
  imageUri: string;
  onCrop: (croppedUri: string) => void;
  onCancel: () => void;
}

const SCREEN = Dimensions.get('window');
const HANDLE_HIT = 36;
const MIN_CROP = 50;
const OVERLAY = 'rgba(0,0,0,0.6)';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

interface Box { x: number; y: number; w: number; h: number }

export default function ImageCropper({ visible, imageUri, onCrop, onCancel }: Props) {
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [disp, setDisp] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const cancelledRef = useRef(false);

  const cropR = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const startC = useRef<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const dispR = useRef({ w: 0, h: 0 });
  const mode = useRef<'move' | 'tl' | 'tr' | 'bl' | 'br' | null>(null);

  // 元画像のサイズ取得
  useEffect(() => {
    if (!visible || !imageUri) {
      setReady(false);
      setNatural({ w: 0, h: 0 });
      return;
    }
    setReady(false);
    cancelledRef.current = false;
    Image.getSize(imageUri, (w, h) => {
      setNatural({ w, h });
    }, () => {});
  }, [visible, imageUri]);

  // natural + container の両方が揃ったら disp/crop/ready を計算
  useEffect(() => {
    if (natural.w <= 1 || natural.h <= 1 || container.w <= 0 || container.h <= 0) return;
    const scale = Math.min(container.w / natural.w, container.h / natural.h);
    const dw = natural.w * scale;
    const dh = natural.h * scale;
    setDisp({ w: dw, h: dh });
    dispR.current = { w: dw, h: dh };
    const mx = Math.min(20, dw * 0.05);
    const my = Math.min(20, dh * 0.05);
    const init: Box = { x: mx, y: my, w: dw - mx * 2, h: dh - my * 2 };
    setCrop(init);
    cropR.current = init;
    setReady(true);
  }, [natural, container]);

  const handleContainerLayout = (e: any) => {
    const { width: cw, height: ch } = e.nativeEvent.layout;
    setContainer({ w: cw, h: ch });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      const c = cropR.current;
      startC.current = { ...c };
      const corners: Array<['tl' | 'tr' | 'bl' | 'br', number, number]> = [
        ['tl', c.x, c.y],
        ['tr', c.x + c.w, c.y],
        ['bl', c.x, c.y + c.h],
        ['br', c.x + c.w, c.y + c.h],
      ];
      let found = false;
      for (const [name, cx, cy] of corners) {
        if (Math.abs(x - cx) < HANDLE_HIT && Math.abs(y - cy) < HANDLE_HIT) {
          mode.current = name;
          found = true;
          break;
        }
      }
      if (!found) {
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
          mode.current = 'move';
        } else {
          mode.current = null;
        }
      }
    },
    onPanResponderMove: (_, g) => {
      if (!mode.current) return;
      const { dx, dy } = g;
      const s = startC.current;
      const d = dispR.current;
      let n: Box;
      switch (mode.current) {
        case 'move':
          n = { x: clamp(s.x + dx, 0, d.w - s.w), y: clamp(s.y + dy, 0, d.h - s.h), w: s.w, h: s.h };
          break;
        case 'tl': {
          const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_CROP);
          const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_CROP);
          n = { x: nx, y: ny, w: s.w + (s.x - nx), h: s.h + (s.y - ny) };
          break;
        }
        case 'tr': {
          const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_CROP);
          n = { x: s.x, y: ny, w: clamp(s.w + dx, MIN_CROP, d.w - s.x), h: s.h + (s.y - ny) };
          break;
        }
        case 'bl': {
          const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_CROP);
          n = { x: nx, y: s.y, w: s.w + (s.x - nx), h: clamp(s.h + dy, MIN_CROP, d.h - s.y) };
          break;
        }
        case 'br':
          n = { x: s.x, y: s.y, w: clamp(s.w + dx, MIN_CROP, d.w - s.x), h: clamp(s.h + dy, MIN_CROP, d.h - s.y) };
          break;
        default:
          return;
      }
      cropR.current = n;
      setCrop(n);
    },
    onPanResponderRelease: () => { mode.current = null; },
  }), []);

  const doCrop = async () => {
    setBusy(true);
    cancelledRef.current = false;
    try {
      const sx = natural.w / disp.w;
      const sy = natural.h / disp.h;
      const c = cropR.current;
      const result = await manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: Math.max(0, Math.round(c.x * sx)),
            originY: Math.max(0, Math.round(c.y * sy)),
            width: Math.max(1, Math.round(c.w * sx)),
            height: Math.max(1, Math.round(c.h * sy)),
          },
        }],
        { format: SaveFormat.JPEG, compress: 0.9 }
      );
      // キャンセルされていなければコールバック
      if (!cancelledRef.current) {
        onCrop(result.uri);
      }
    } catch (e) {
      __DEV__ && console.warn('Crop error:', e);
      if (!cancelledRef.current) {
        onCrop(imageUri);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    onCancel();
  };

  if (!visible) return null;

  const cornerPositions = [
    { x: crop.x, y: crop.y },
    { x: crop.x + crop.w, y: crop.y },
    { x: crop.x, y: crop.y + crop.h },
    { x: crop.x + crop.w, y: crop.y + crop.h },
  ];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={s.root}>
        <SafeAreaView style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={s.header}>
            <Text style={s.headerText}>成分表の範囲を選択してください</Text>
            <Text style={s.headerHint}>四隅をドラッグしてリサイズ・中央をドラッグで移動</Text>
          </View>
        </SafeAreaView>

        <View style={s.imageArea} onLayout={handleContainerLayout}>
          {disp.w > 0 && (
            <View
              style={{ width: disp.w, height: disp.h }}
              {...panResponder.panHandlers}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ width: disp.w, height: disp.h }}
                resizeMode="cover"
              />

              {ready && (
                <>
                  <View style={[s.overlay, { top: 0, left: 0, right: 0, height: crop.y }]} />
                  <View style={[s.overlay, { top: crop.y + crop.h, left: 0, right: 0, bottom: 0 }]} />
                  <View style={[s.overlay, { top: crop.y, left: 0, width: crop.x, height: crop.h }]} />
                  <View style={[s.overlay, { top: crop.y, left: crop.x + crop.w, right: 0, height: crop.h }]} />

                  <View
                    style={[s.cropBorder, { left: crop.x, top: crop.y, width: crop.w, height: crop.h }]}
                    pointerEvents="none"
                  >
                    <View style={[s.gridH, { top: '33.3%' }]} />
                    <View style={[s.gridH, { top: '66.6%' }]} />
                    <View style={[s.gridV, { left: '33.3%' }]} />
                    <View style={[s.gridV, { left: '66.6%' }]} />
                  </View>

                  {cornerPositions.map((pos, i) => (
                    <View
                      key={i}
                      style={[s.handle, { left: pos.x - 11, top: pos.y - 11 }]}
                      pointerEvents="none"
                    />
                  ))}
                </>
              )}
            </View>
          )}
        </View>

        <SafeAreaView style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.cancelBtn, busy && { opacity: 0.4 }]}
              onPress={handleCancel}
              disabled={busy}
              activeOpacity={0.7}
            >
              <Text style={s.cancelText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.cropBtn}
              onPress={doCrop}
              disabled={busy || !ready}
              activeOpacity={0.7}
            >
              {busy ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={[s.cropText, !ready && { opacity: 0.4 }]}>切り取って認識</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' },
  headerText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  headerHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 4 },
  imageArea: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', backgroundColor: OVERLAY },
  cropBorder: { position: 'absolute', borderWidth: 2, borderColor: '#FFF' },
  gridH: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.35)' },
  handle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFF',
    borderWidth: 2.5,
    borderColor: '#3B82F6',
  },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center' },
  cancelText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cropBtn: { flex: 1.5, padding: 16, borderRadius: 14, backgroundColor: '#3B82F6', alignItems: 'center' },
  cropText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
