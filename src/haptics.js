// Haptics: Capacitor Haptics plugin inside the native apps, navigator.vibrate on Android browsers, silent elsewhere.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
const native = Capacitor.isNativePlatform();
const STY = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
const MS = { light: 12, medium: 25, heavy: 45 };
export function buzz(kind = 'light') {
  try {
    if (native) Haptics.impact({ style: STY[kind] || ImpactStyle.Light });
    else if (navigator.vibrate) navigator.vibrate(MS[kind] || 15);
  } catch { }
}
