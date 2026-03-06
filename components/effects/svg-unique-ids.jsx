import { useId, useLayoutEffect, useRef } from 'react';

/**
 * Wraps agent SVG content and rewrites all id and url(#id) references inside
 * the SVG so that each mounted instance has unique IDs. Fixes duplicate-ID
 * issues when the same agent (e.g. agent-1-a) is rendered multiple times,
 * which otherwise causes missing fills or fills appearing on the wrong instance.
 */
export function SvgUniqueIds({ children, className, style }) {
  const prefix = useId().replace(/:/g, '-');
  const ref = useRef(null);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const idMap = {};
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // First pass: assign new unique ids (include SVG root and all descendants)
    const withId = svg.hasAttribute('id')
      ? [svg, ...svg.querySelectorAll('[id]')]
      : svg.querySelectorAll('[id]');
    withId.forEach((el) => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      const newId = `${prefix}-${oldId}`;
      idMap[oldId] = newId;
      el.setAttribute('id', newId);
    });

    // Second pass: only elements that can reference ids (fill, clip-path, style, href)
    const refAttrs = ['fill', 'clip-path', 'clipPath', 'style', 'href'];
    const idList = Object.keys(idMap);
    if (idList.length === 0) return;
    const combinedRe = new RegExp(
      '#' + idList.map(escapeRegex).join('\\b|#') + '\\b',
      'g'
    );
    const all = [svg, ...svg.querySelectorAll('*')];
    all.forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (!refAttrs.includes(attr.name) && !attr.name.includes('href')) continue;
        let val = attr.value;
        if (typeof val !== 'string' || val.indexOf('#') === -1) continue;
        const newVal = val.replace(combinedRe, (m) => {
          const id = m.slice(1);
          return idMap[id] !== undefined ? '#' + idMap[id] : m;
        });
        if (newVal !== val) el.setAttribute(attr.name, newVal);
      }
    });
  }, [prefix]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
