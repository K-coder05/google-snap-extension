// Ancestor "containing block" trap (SPEC.md §6.3). `position: fixed` is
// positioned relative to the viewport only if no ancestor establishes a
// containing block for fixed descendants. transform/filter/backdrop-filter/
// perspective/contain/will-change on an ancestor captures the fixed element
// into that ancestor's box instead — silently wrong size or position.
import { CLS_NEUTRALIZED } from '../../shared/constants.js';

export function establishesContainingBlock(cs) {
  return (
    cs.transform !== 'none' ||
    cs.filter !== 'none' ||
    cs.backdropFilter !== 'none' ||
    cs.perspective !== 'none' ||
    /paint|layout|strict|content/.test(cs.contain) ||
    /transform|filter|perspective|opacity/.test(cs.willChange)
  );
}

// Walks ancestors of `el` up to (excluding) <html>, adding CLS_NEUTRALIZED to
// any that establish a containing block. Only ever adds/removes a class, so
// the page's own inline styles are never clobbered. Returns the hit list so
// the caller can restore it later.
export function neutralizeAncestors(el) {
  const hit = [];
  for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (establishesContainingBlock(cs)) {
      n.classList.add(CLS_NEUTRALIZED);
      hit.push(n);
    }
  }
  return hit;
}

export function restoreAncestors(neutralized) {
  for (const n of neutralized) n.classList.remove(CLS_NEUTRALIZED);
}
