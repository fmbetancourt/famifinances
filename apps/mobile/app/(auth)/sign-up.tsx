import { useMemo, useState, type ReactElement } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, register } from '../../src/features/auth/api/client';
import {
  PASSWORD_RULE_LABELS,
  evaluatePassword,
} from '../../src/features/auth/session/password-policy';

/**
 * US2 · Sign-up screen. One primary action; errors are conveyed with text (not color
 * alone) per constitution Principle VII. Password complexity is validated in real time
 * (FR-003): unmet rules are listed and the submit stays disabled until all pass. On
 * success the user is routed to email verification.
 */
export default function SignUpScreen(): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const evaluation = useMemo(() => evaluatePassword(password), [password]);
  const canSubmit = evaluation.valid && email.length > 0 && !submitting;

  async function onSubmit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await register({ email, password });
      router.replace('/(auth)/verify-email');
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create your account</Text>

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

      {password.length > 0 && evaluation.missing.length > 0 ? (
        <View style={styles.rules} accessibilityLabel="Password requirements">
          {evaluation.missing.map((rule) => (
            <Text key={rule} style={styles.ruleItem}>
              • {PASSWORD_RULE_LABELS[rule]}
            </Text>
          ))}
        </View>
      ) : null}

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}

      <TouchableOpacity
        style={[styles.button, canSubmit ? null : styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Create account</Text>}
      </TouchableOpacity>
    </View>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    return err.message;
  }
  return 'Could not create the account.';
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, marginBottom: 8 },
  rules: { marginBottom: 8, gap: 2 },
  ruleItem: { color: '#8a6d00', fontSize: 13 },
  error: { color: '#b00020', marginVertical: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#9e9e9e' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
