import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { requestPasswordReset } from '../../src/features/auth/api/client';

/**
 * US7 · Forgot-password screen. Always shows the same confirmation regardless of
 * whether the email exists (no enumeration), then routes to the reset screen.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setSubmitting(true);
    try {
      await requestPasswordReset({ email });
    } catch {
      // Intentionally ignored: the response is uniform to avoid enumeration.
    } finally {
      setSubmitting(false);
      router.push({ pathname: '/(auth)/reset-password', params: { email } });
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset your password</Text>
      <Text style={styles.help}>
        Enter your email. If it is registered, we will send a 6-digit reset code.
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        accessibilityLabel="Email"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={onSubmit}
        disabled={submitting || email.length === 0}
        accessibilityRole="button"
      >
        {submitting ? <ActivityIndicator /> : <Text style={styles.buttonText}>Send reset code</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '600' },
  help: { fontSize: 14, color: '#444', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500' },
  input: { borderWidth: 1, borderColor: '#999', borderRadius: 8, padding: 12, marginBottom: 8 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
