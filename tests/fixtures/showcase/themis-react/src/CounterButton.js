const counterState = {
  count: 0
};

function CounterButton({ label = 'Clicks' } = {}) {
  return {
    $$typeof: 'react.test.element',
    type: 'button',
    key: null,
    props: {
      onClick() {
        counterState.count += 1;
      },
      children: `${label} ${counterState.count}`
    }
  };
}

function resetCounterButton() {
  counterState.count = 0;
}

module.exports = {
  CounterButton,
  resetCounterButton
};
