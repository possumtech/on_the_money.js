// Compliant event delegation — action matches layout.html's data-action="save"
on(document.body, 'click', '[data-action="save"]', (e) => {
  console.log('Good!');
});
