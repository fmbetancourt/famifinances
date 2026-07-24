import { useState, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, login } from '../../src/features/auth/api/client';
import { useSession } from '../../src/features/auth/session/session-context';
import type { SessionReason } from '../../src/features/auth/session/session-bootstrap';

/**
 * US1 · Sign-in screen. One primary action; failures are shown with text (not color
 * alone) per constitution Principle VII. On success the token pair is handed to the
 * session (which persists it and resolves identity + family), then routing is delegated
 * to the launch redirect. Invalid credentials collapse to a single uniform message that
 * does not reveal which factor failed (FR-011); throttling shows a friendly notice (FR-010).
 */
export default function SignInScreen(): ReactElement {
  const router = useRouter();
  const { establishSession, reason } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await login({ email, password });
      await establishSession(tokens);
      router.replace('/');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  // A live form error takes precedence; otherwise surface why a prior session ended
  // (spec Edge Cases: expired/revoked session, or an offline restore).
  const notice = error ?? sessionNotice(reason);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        accessibilityLabel="Password"
      />

      {notice ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {notice}
        </Text>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={onSubmit}
        disabled={submitting}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Sign in</Text>}
      </TouchableOpacity>
    </View>
  );
}

/**
 * Maps an error to a user-facing message. A 401 collapses to a single non-enumerating
 * message (FR-011); a 429 is presented as a friendly throttle notice (FR-010).
 */
/** Arrival notice derived from why the previous session ended (spec Edge Cases). */
function sessionNotice(reason: SessionReason): string | null {
  if (reason === 'expired') {
    return 'Your session has expired. Please sign in again.';
  }
  if (reason === 'offline') {
    return 'You appear to be offline. Check your connection and try again.';
  }
  return null;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (err.status === 401) {
      return 'Invalid email or password.';
    }
    return err.message;
  }
  return 'Could not sign in.';
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, marginBottom: 8 },
  error: { color: '#b00020', marginVertical: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
