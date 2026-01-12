'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * Hook that detects clicks outside of the referenced element
 * @param callback - Function to call when click outside is detected
 * @returns RefObject to attach to the element you want to detect outside clicks for
 */
export function useClickOutside<T extends HTMLElement>(callback: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [callback]);

  return ref;
}
