import { useRef, RefObject } from 'react';

export function useEntrance<T extends HTMLElement = HTMLDivElement>(
  _type: string = 'fadeInUp',
  _opts: { delay?: number; duration?: number } = {},
  _deps: any[] = []
): RefObject<T> {
  const ref = useRef<T>(null);
  return ref;
}

export function useChildrenStagger<T extends HTMLElement = HTMLElement>(
  _deps: any[] = [],
  _opts: { stagger?: number; delay?: number } = {}
): RefObject<T> {
  const ref = useRef<T>(null);
  return ref;
}