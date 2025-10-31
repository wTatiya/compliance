import { render, screen } from '@testing-library/react';
import Home from '../pages/index';

describe('Home', () => {
  it('renders the hero copy', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /department compliance/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /review department status summaries, keep track of assignee responsibilities, and quickly launch updates\./i
      )
    ).toBeInTheDocument();
  });
});
