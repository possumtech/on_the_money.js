export default class The {
  static dictionary = {};

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

  static _t(key) {
    if (!key) {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const k = el.getAttribute('data-i18n');
        if (this.dictionary[k]) el.textContent = this.dictionary[k];
      });
      return;
    }
    return this.dictionary[key];
  }

  static #setGlobal(key, val) {
    this.#setScoped(document.body, key, val);
    localStorage.setItem(key, val);
    // Sync all data-text elements in the whole document
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
    
    // Sync scoped data-text elements if this is a container
    el.querySelectorAll(`[data-text="${key}"]`).forEach(item => item.textContent = val);
    // Also check if el itself is a data-text target
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
