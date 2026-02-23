export default class The {
  static dictionary = {};
  static locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';

  static the(...args) {
    if (args.length === 2 && typeof args[0] === 'string') {
      return this.#setGlobal(args[0], args[1]);
    }
    
    const [el, key, val] = args;
    if (typeof key === 'object') {
      Object.entries(key).forEach(([k, v]) => this.#setScoped(el, k, v));
      return el;
    }
    
    return this.#setScoped(el, key, val);
  }

  static _t(key, options = {}) {
    if (!key) {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        const qty = el.getAttribute('data-i18n-qty');
        const val = el.getAttribute('data-i18n-val');
        const type = el.getAttribute('data-i18n-type');
        el.textContent = this._t(k, { 
          qty: qty !== null ? Number(qty) : undefined, 
          val: val !== null ? val : undefined, 
          type 
        });
      });
      return;
    }

    let entry = this.dictionary[key];
    if (!entry) return key;

    if (typeof entry === 'object' && options.qty !== undefined) {
      const rule = new Intl.PluralRules(this.locale).select(options.qty);
      entry = entry[rule] || entry.other;
    }

    if (typeof entry !== 'string') return key;

    let result = entry;
    if (options.val !== undefined) {
      let formattedVal = options.val;
      const numericVal = Number(options.val);
      
      if (options.type === 'currency') {
        formattedVal = new Intl.NumberFormat(this.locale, { style: 'currency', currency: 'USD' }).format(numericVal);
      } else if (options.type === 'date') {
        const date = new Date(options.val);
        formattedVal = isNaN(date.getTime()) ? options.val : new Intl.DateTimeFormat(this.locale).format(date);
      } else if (options.type === 'number') {
        formattedVal = new Intl.NumberFormat(this.locale).format(numericVal);
      }
      result = result.replace('{val}', formattedVal);
    }

    if (options.qty !== undefined) {
      result = result.replace('{qty}', options.qty);
    }

    return result;
  }

  static #setGlobal(key, val) {
    this.#setScoped(document.body, key, val);
    localStorage.setItem(key, val);
    document.querySelectorAll(`[data-text="${key}"]`).forEach(el => el.textContent = val);
  }

  static #setScoped(el, key, val) {
    const ariaMap = {
      expanded: 'aria-expanded',
      selected: 'aria-selected',
      hidden: 'aria-hidden',
      checked: 'aria-checked',
      disabled: 'aria-disabled'
    };

    const attr = ariaMap[key] || `data-${key}`;
    el.setAttribute(attr, val);
    
    el.querySelectorAll(`[data-text="${key}"]`).forEach(item => item.textContent = val);
    if (el.getAttribute('data-text') === key) el.textContent = val;

    return el;
  }

  static handshake() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      this.#setGlobal(key, localStorage.getItem(key));
    }
    this._t();
  }
}
