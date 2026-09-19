// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CLS_NEUTRALIZED } from '../../../src/shared/constants.js';
import { neutralizeAncestors, restoreAncestors } from '../../../src/content/pseudo/containing-block.js';

function buildTree(html) {
  document.body.innerHTML = html;
  return document.getElementById('target');
}

describe('neutralizeAncestors / restoreAncestors', () => {
  it('marks a transform ancestor and stops at <html>', () => {
    const target = buildTree(`
      <div id="trap" style="transform: translateZ(0)">
        <div id="plain">
          <video id="target"></video>
        </div>
      </div>
    `);

    const hit = neutralizeAncestors(target);

    expect(hit).toEqual([document.getElementById('trap')]);
    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(true);
    expect(document.getElementById('plain').classList.contains(CLS_NEUTRALIZED)).toBe(false);
  });

  it('collects every trapping ancestor, nearest first', () => {
    const target = buildTree(`
      <div id="outer" style="filter: blur(1px)">
        <div id="inner" style="will-change: transform">
          <video id="target"></video>
        </div>
      </div>
    `);

    const hit = neutralizeAncestors(target);

    expect(hit.map((n) => n.id)).toEqual(['inner', 'outer']);
  });

  it('returns an empty list when no ancestor traps', () => {
    const target = buildTree('<div id="plain"><video id="target"></video></div>');

    expect(neutralizeAncestors(target)).toEqual([]);
  });

  it('restoreAncestors removes the class from every hit', () => {
    const target = buildTree('<div id="trap" style="transform: translateZ(0)"><video id="target"></video></div>');
    const hit = neutralizeAncestors(target);

    restoreAncestors(hit);

    expect(document.getElementById('trap').classList.contains(CLS_NEUTRALIZED)).toBe(false);
  });
});
