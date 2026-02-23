import On from './On.js';
import The from './The.js';
import Select from './Select.js';

// Named Exports (First-Class Citizens)
export const on = On.on;
on.emit = On.emit;

export const the = The.the;
export const _t = The._t;
the.t = _t;

export const $ = Select.$;
$.clone = Select.clone;

export const $$ = Select.$$;

// Default Export (Everything included)
export default { on, the, $, $$, _t };

// The Handshake (Auto-rehydrate on import)
if (typeof document !== 'undefined') {
  The.handshake();
}
