import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, login } from '../../src/features/auth/api/client';
import { saveTokens } from '../../src/features/auth/storage/secure-token-store';

/**
 * US2 · Sign-in screen. One primary action; failures are shown with text (not
 * color alone) per constitution Principle VII. The API returns a uniform error
 * for wrong/unknown credentials, so the message never reveals which factor failed.
 */
export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await login({ email, password });
      await saveTokens(tokens);
      router.replace('/');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not sign in.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

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

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {error}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, marginBottom: 8 },
  error: { color: '#b00020', marginVertical: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
