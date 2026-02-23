// JS-003: Good (no direct style)
the('.menu', 'visible', 'true');

// JS-009: Good (event delegation)
on(document, 'click', 'button', (e) => console.log(e));

// JS-011: Good (static attribute names)
el.setAttribute('aria-expanded', 'true');
el.setAttribute('data-state', 'active');
