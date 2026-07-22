import { fireEvent, render, screen } from '@testing-library/react-native';

// Inject the session so the screen renders deterministically for each `reason`.
let mockReason: 'none' | 'expired' | 'offline' = 'none';
jest.mock('../../../src/features/auth/session/session-context', () => ({
  useSession: () => ({ reason: mockReason, establishSession: jest.fn() }),
}));

import SignInScreen from '../sign-in';

describe('SignInScreen session notices (spec Edge Cases)', () => {
  it('shows the "session expired" message after a revoked/invalid session (T038)', () => {
    mockReason = 'expired';
    render(<SignInScreen />);
    expect(screen.getByText(/Your session has expired\. Please sign in again\./)).toBeTruthy();
  });

  it('shows an offline notice when a restore failed on connectivity', () => {
    mockReason = 'offline';
    render(<SignInScreen />);
    expect(screen.getByText(/You appear to be offline/)).toBeTruthy();
  });

  it('shows no notice for a fresh sign-in', () => {
    mockReason = 'none';
    render(<SignInScreen />);
    expect(screen.queryByText(/session has expired|offline/)).toBeNull();
  });

  it('lets a live form error take precedence over the reason notice', () => {
    mockReason = 'expired';
    render(<SignInScreen />);
    // Typing does not clear the notice, but the notice area still renders text.
    fireEvent.changeText(screen.getByLabelText('Email'), 'me@x.cl');
    expect(screen.getByText(/Your session has expired/)).toBeTruthy();
  });
});
