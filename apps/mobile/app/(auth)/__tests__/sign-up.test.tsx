import { fireEvent, render, screen } from '@testing-library/react-native';
import SignUpScreen from '../sign-up';

// FR-003 / US2-AS3 · Real-time password feedback; submit blocked until the password
// meets every rule.
describe('SignUpScreen password validation (FR-003)', () => {
  it('lists missing rules and disables submit for a weak password', () => {
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'me@x.cl');
    fireEvent.changeText(screen.getByLabelText('Password'), 'weak');

    expect(screen.getByText(/At least 12 characters/)).toBeTruthy();
    expect(screen.getByRole('button').props.accessibilityState?.disabled).toBe(true);
  });

  it('clears feedback and enables submit for a compliant password', () => {
    render(<SignUpScreen />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'me@x.cl');
    fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdef123456!');

    expect(screen.queryByText(/At least 12 characters/)).toBeNull();
    expect(screen.getByRole('button').props.accessibilityState?.disabled).toBe(false);
  });
});
