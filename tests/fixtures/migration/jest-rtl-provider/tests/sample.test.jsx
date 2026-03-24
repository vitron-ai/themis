import { describe, test, expect } from '@jest/globals';
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
  ['first', 1],
  ['second', 2]
])('context %s', (label, step) => {
  beforeEach(() => {
    state.value = 0;
  });

  test.each([
    ['click increment', step],
    ['delayed increment', step]
  ])('%s', async (_, increment) => {
    const { rerender } = render(<Counter label={label} step={increment} />);
    const initialButton = screen.getByRole('button', { name: `${label} 0` });

    fireEvent.click(initialButton);
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
