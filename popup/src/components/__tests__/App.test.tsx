import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../App';

describe('App popup shell', () => {
  it('renders the navigation tabs without crashing', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Review/i })).toBeInTheDocument();
    });
  });
});
