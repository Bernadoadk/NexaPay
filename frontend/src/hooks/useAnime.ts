import { useEffect, useLayoutEffect, useRef } from 'react';
import type { DependencyList, RefObject } from 'react';
import { fadeInUp, fadeIn, popIn, slideDown, countUpEl } from '@/lib/animations';

export function useEntrance<T extends HTMLElement = HTMLDivElement>(
  type: 'fadeInUp' | 'fadeIn' | 'popIn' | 'slideDown' = 'fadeInUp',
  opts: { delay?: number; duration?: number } = {},
  deps: DependencyList = []
): RefObject<T> {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (ref.current) ref.current.style.opacity = '0';
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (type === 'fadeInUp') fadeInUp(el, opts);
    else if (type === 'fadeIn') fadeIn(el, opts);
    else if (type === 'popIn') popIn(el, opts);
    else slideDown(el, opts);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}

export function useStagger<T extends HTMLElement = HTMLDivElement>(
  selector: string,
  deps: DependencyList = [],
  opts: { stagger?: number; delay?: number } = {}
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (items.length === 0) return;
    items.forEach(el => { el.style.opacity = '0'; });
    requestAnimationFrame(() => {
      fadeInUp(items, { stagger: opts.stagger ?? 55, delay: opts.delay ?? 0 });
    });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}

export function useChildrenStagger<T extends HTMLElement = HTMLDivElement>(
  deps: DependencyList = [],
  opts: { stagger?: number; delay?: number } = {}
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.children) as HTMLElement[];
    if (items.length === 0) return;
    items.forEach(el => { el.style.opacity = '0'; });
    requestAnimationFrame(() => {
      fadeInUp(items, { stagger: opts.stagger ?? 60, delay: opts.delay ?? 0 });
    });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}

export function useCountUp(
  target: number,
  deps: DependencyList = [],
  opts: { delay?: number; duration?: number } = {}
): RefObject<HTMLElement> {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || target === 0) return;
    countUpEl(el, target, opts);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return ref;
}
