import React from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CounterButton } from '../src/CounterButton.js';
import { AsyncStatusButton } from '../src/AsyncStatusButton.js';

afterEach(() => {
  cleanup();
});

describe('vitest react showcase', () => {
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
