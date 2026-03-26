import React from 'react';

export function CounterButton({ label = 'Clicks' }) {
  const [count, setCount] = React.useState(0);

  return React.createElement(
    'button',
    {
      onClick() {
        setCount((value) => value + 1);
      }
    },
    `${label} ${count}`
  );
}
