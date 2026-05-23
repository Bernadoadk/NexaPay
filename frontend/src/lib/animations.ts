import anime from 'animejs';

type Target = Parameters<typeof anime>[0]['targets'];

export function fadeInUp(
  targets: Target,
  opts: { duration?: number; delay?: number; stagger?: number } = {}
) {
  return anime({
    targets,
    translateY: [14, 0],
    opacity: [0, 1],
    duration: opts.duration ?? 480,
    delay: opts.stagger != null
      ? anime.stagger(opts.stagger, { start: opts.delay ?? 0 })
      : (opts.delay ?? 0),
    easing: 'easeOutQuad',
  });
}

export function fadeIn(
  targets: Target,
  opts: { duration?: number; delay?: number } = {}
) {
  return anime({
    targets,
    opacity: [0, 1],
    duration: opts.duration ?? 380,
    delay: opts.delay ?? 0,
    easing: 'easeOutQuad',
  });
}

export function slideDown(
  targets: Target,
  opts: { duration?: number; delay?: number } = {}
) {
  return anime({
    targets,
    translateY: [-12, 0],
    opacity: [0, 1],
    duration: opts.duration ?? 420,
    delay: opts.delay ?? 0,
    easing: 'easeOutQuad',
  });
}

export function popIn(
  targets: Target,
  opts: { delay?: number; duration?: number } = {}
) {
  return anime({
    targets,
    scale: [0.4, 1],
    opacity: [0, 1],
    duration: opts.duration ?? 580,
    delay: opts.delay ?? 0,
    easing: 'easeOutBack',
  });
}

export function countUpEl(
  el: HTMLElement,
  target: number,
  opts: { delay?: number; duration?: number } = {}
) {
  const obj = { val: 0 };
  return anime({
    targets: obj,
    val: [0, target],
    round: 1,
    duration: opts.duration ?? 1000,
    delay: opts.delay ?? 0,
    easing: 'easeOutExpo',
    update() {
      el.textContent = String(Math.round(obj.val));
    },
  });
}
