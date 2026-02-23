// Compliant event delegation
on(document.body, 'click', '[data-action="submit"]', (e) => {
  console.log('Good!');
});
