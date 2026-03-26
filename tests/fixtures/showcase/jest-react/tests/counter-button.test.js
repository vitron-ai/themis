const React = require('react');
const { afterEach, describe, expect, test } = require('@jest/globals');
const { cleanup, fireEvent, render, screen, waitFor } = require('@testing-library/react');
const { CounterButton } = require('../src/CounterButton');
const { AsyncStatusButton } = require('../src/AsyncStatusButton');

afterEach(() => {
  cleanup();
});

describe('jest react showcase', () => {
  test('counter button increments', () => {
    render(React.createElement(CounterButton, { label: 'Clicks' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clicks 0' }));
    expect(screen.getByRole('button', { name: 'Clicks 1' })).toBeTruthy();
  });

  test('async status settles', async () => {
    render(React.createElement(AsyncStatusButton));
    fireEvent.click(screen.getByRole('button', { name: 'Status idle' }));
    expect(screen.getByRole('button', { name: 'Status loading' })).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Status saved' })).toBeTruthy();
    });
  });
});
