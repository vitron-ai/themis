const { CounterButton, resetCounterButton } = require('../src/CounterButton');
const { AsyncStatusButton, resetAsyncStatusButton } = require('../src/AsyncStatusButton');

intent('native themis react counter button', ({ context, run, verify, cleanup: cleanupPhase }) => {
  let view = null;

  context(() => {
    resetCounterButton();
  });

  run(() => {
    view = render(CounterButton({ label: 'Clicks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clicks 0' }));
    view.rerender(CounterButton({ label: 'Clicks' }));
  });

  verify(() => {
    expect(screen.getByRole('button', { name: 'Clicks 1' })).toBeTruthy();
  });

  cleanupPhase(() => {
    cleanup();
  });
});

test('native themis react async status settles', async () => {
  resetAsyncStatusButton();
  const view = render(AsyncStatusButton());
  fireEvent.click(screen.getByRole('button', { name: 'Status idle' }));
  view.rerender(AsyncStatusButton());

  expect(screen.getByRole('button', { name: 'Status loading' })).toBeTruthy();

  await waitFor(() => {
    view.rerender(AsyncStatusButton());
    expect(screen.getByRole('button', { name: 'Status saved' })).toBeTruthy();
  });

  cleanup();
});
