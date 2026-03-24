import { describe, test, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const state = { value: 0 };

function Counter({ step = 1, label = 'provider' } = {}) {
  return {
    $$typeof: 'react.test.element',
    type: 'button',
    key: null,
    props: {
      onClick() {
        state.value += step;
      },
      children: `${label} ${state.value}`
    }
  };
}

describe.each([
  ['vi-one', 1],
  ['vi-two', 3]
])('vitest context %s', (label, step) => {
  beforeEach(() => {
    state.value = 0;
  });

  test.each([
    ['click scenario', step],
    ['timeout scenario', step]
  ])('%s', async (_, increment) => {
    const { rerender } = render(<Counter label={label} step={increment} />);
    const button = screen.getByRole('button', { name: `${label} 0` });

    fireEvent.click(button);
    rerender(<Counter label={label} step={increment} />);
    expect(screen.getByText(`${label} ${increment}`)).toBeInTheDocument();

    setTimeout(() => {
      state.value += increment;
      rerender(<Counter label={label} step={increment} />);
    }, 0);

    await waitFor(() => {
      expect(screen.getByText(`${label} ${(increment * 2)}`)).toBeInTheDocument();
    });

    cleanup();
  });
});
