import { on, the, $, $$ } from '../../src/core/index.js';

// 1. Setup Localization Pillar
the.dictionary = {
  app_title: 'onTheMoney • Todo',
  btn_add: 'Add',
  items_left: {
    one: '1 item left',
    other: '{qty} items left'
  }
};

// 2. State Logic
const updateCount = () => {
  const count = $$('#todo-list [data-item]').filter(el => el.getAttribute('aria-checked') === 'false').length;
  // Update footer via advanced Intl
  const footer = $('footer [data-i18n="items_left"]');
  footer.setAttribute('data-i18n-qty', count);
  the.t(); // Re-hydrate
};

// 3. Event Pillar (Delegation)
on('#todo-form', 'submit', (e) => {
  e.preventDefault();
  const input = $('#todo-input');
  const task = input.value.trim();
  if (!task) return;

  const item = the($.clone('#todo-item'), { task });
  $('#todo-list').appendChild(item);
  
  input.value = '';
  updateCount();
});

on('#todo-list', 'change', '[data-action="toggle-todo"]', (e, target) => {
  const item = target.closest('[data-item]');
  the(item, 'checked', target.checked);
  updateCount();
});

on('#todo-list', 'click', '[data-action="delete-todo"]', (e, target) => {
  target.closest('[data-item]').remove();
  updateCount();
});

// 4. Initial Load
the.t(); // Initial translation hydration
updateCount();
