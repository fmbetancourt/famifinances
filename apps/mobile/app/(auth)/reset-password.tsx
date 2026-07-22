import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiError, confirmPasswordReset } from '../../src/features/auth/api/client';
import {
  PASSWORD_RULE_LABELS,
  evaluatePassword,
} from '../../src/features/auth/session/password-policy';

/**
 * US3 · Reset-password screen. Enters the emailed 6-digit code and a new password. The
 * new password is validated against the same complexity policy as sign-up (FR-003), with
 * real-time feedback. On success all sessions are revoked server-side, so the user signs
 * in fresh.
 */
export default function ResetPasswordScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const evaluation = useMemo(() => evaluatePassword(newPassword), [newPassword]);
  const canSubmit = evaluation.valid && code.length === 6 && !submitting;

  async function onSubmit(): Promise<void> {
    setError(null);
    setSubmitting(true);
    try {
      await confirmPasswordReset({ email, code, newPassword });
      router.replace('/(auth)/sign-in');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset the password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set a new password</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />

      <Text style={styles.label}>Reset code</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        accessibilityLabel="Reset code"
      />

      <Text style={styles.label}>New password</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
        accessibilityLabel="New password"
      />

      {newPassword.length > 0 && evaluation.missing.length > 0 ? (
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
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Reset password</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, marginBottom: 8 },
  rules: { marginBottom: 8, gap: 2 },
  ruleItem: { color: '#8a6d00', fontSize: 13 },
  error: { color: '#b00020', marginVertical: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { backgroundColor: '#9e9e9e' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
