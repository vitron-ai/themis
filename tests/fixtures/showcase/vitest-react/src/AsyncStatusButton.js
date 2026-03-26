import React from 'react';

export function AsyncStatusButton() {
  const [status, setStatus] = React.useState('idle');

  return React.createElement(
    'button',
    {
      onClick() {
        setStatus('loading');
        setTimeout(() => {
          setStatus('saved');
        }, 0);
      }
    },
    `Status ${status}`
  );
}
