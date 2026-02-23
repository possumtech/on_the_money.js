import On from './On.js';
import The from './The.js';
import Select from './Select.js';

export { On, The, Select };

// The Three Pillars
export const on = On.on;
on.emit = On.emit;

export const the = The.the;
export const _t = The._t;
the.t = _t;

export const $ = Select.$;
export const $$ = Select.$$;
$.clone = Select.clone;
$.all = $$;
