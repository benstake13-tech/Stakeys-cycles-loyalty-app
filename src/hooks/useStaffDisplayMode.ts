import { useSyncExternalStore } from 'react';

// A wide screen plus a mouse/trackpad is a desktop workspace. A phone rotated
// to landscape remains in phone mode. External screens and input changes adapt live.
export const STAFF_DESKTOP_QUERY = '(min-width: 900px) and (any-hover: hover) and (any-pointer: fine)';
const getSnapshot = () => typeof window !== 'undefined' && (typeof window.matchMedia === 'function'
  ? window.matchMedia(STAFF_DESKTOP_QUERY).matches
  : window.innerWidth >= 900);
const subscribe = (notify: () => void) => {
  const media = window.matchMedia?.(STAFF_DESKTOP_QUERY);
  if (media?.addEventListener) {
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};
export const useStaffDisplayMode = (): 'desktop' | 'phone' =>
  useSyncExternalStore(subscribe, getSnapshot, () => false) ? 'desktop' : 'phone';
