import { render, screen } from '@testing-library/react';
import Home from '../pages/index';

describe('Home', () => {
  it('renders the hero copy', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /compliance document hub/i })).toBeInTheDocument();
    expect(
      screen.getByText(/foundational next\.js application scaffolded to power the compliance/i)
    ).toBeInTheDocument();
  });
});
