import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/features/auth/api/client';
import { resendVerification, verifyEmail } from '../../src/features/auth/api/verification';

/**
 * US6 · Email verification screen. A 6-digit code (OTP) is entered in-app. Status
 * is conveyed with text + icon, never color alone (constitution Principle VII).
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onVerify() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      await verifyEmail(code);
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    try {
      await resendVerification();
      setInfo('✓ A new code has been sent.');
    } catch (err) {
      // Only a 2xx means the request was accepted; a failure must not read as success.
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : 'Could not resend the code. Please try again.',
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.help}>Enter the 6-digit code we sent to your email address.</Text>

      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        accessibilityLabel="Verification code"
      />

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}

      <TouchableOpacity
        style={styles.button}
        onPress={onVerify}
        disabled={submitting || code.length !== 6}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Verify</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onResend} accessibilityRole="button">
        <Text style={styles.link}>Resend code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  help: { fontSize: 14, color: '#444', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { color: '#b00020', marginVertical: 8 },
  info: { color: '#1b5e20', marginVertical: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#1b5e20', textAlign: 'center', marginTop: 16, fontWeight: '500' },
});
