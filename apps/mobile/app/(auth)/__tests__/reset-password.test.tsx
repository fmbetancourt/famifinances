import { fireEvent, render, screen } from '@testing-library/react-native';
import ResetPasswordScreen from '../reset-password';

// FR-003 · The new password on the reset screen is validated with the same policy and
// real-time feedback as sign-up.
describe('ResetPasswordScreen password validation (FR-003)', () => {
  it('shows missing-rule feedback for a weak new password and blocks submit', () => {
    render(<ResetPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText('New password'), 'weak');

    expect(screen.getByText(/At least 12 characters/)).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityState?.disabled).toBe(true);
  });
});
