import { describe, test, expect } from '@jest/globals';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const state = { value: 0 };

function Counter() {
  return {
    $$typeof: 'react.test.element',
    type: 'button',
    key: null,
    props: {
      onClick() {
        state.value += 1;
      },
      children: `Count ${state.value}`
    }
  };
}

describe('jest rtl fixture', () => {
  test('renders and updates through testing-library compat', async () => {
    const view = render(<Counter />);
    const button = screen.getByRole('button', { name: 'Count 0' });

    fireEvent.click(button);
    view.rerender(<Counter />);

    await waitFor(() => {
      expect(screen.getByText('Count 1')).toBeInTheDocument();
    });

    cleanup();
  });
});
