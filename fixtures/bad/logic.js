// JS-003: Bad
el.style.color = 'red';
delete el.style.display;

// JS-009: Bad
el.addEventListener('click', () => {});

// JS-011: Bad
el.setAttribute('data-' + key, value);
