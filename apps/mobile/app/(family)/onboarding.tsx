import type { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../src/features/auth/session/session-context';

/**
 * FR-007 target · Placeholder family-onboarding screen. It only proves the routing
 * rule for users with no family; the full Create-family / Join-by-6-char-code UI is
 * delivered in FAM-9. A Sign Out escape hatch is provided so the placeholder is not a
 * dead end.
 */
export default function OnboardingScreen(): ReactElement {
  const { signOut } = useSession();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join or create a family</Text>
      <Text style={styles.help}>
        Your account is not part of a family yet. Family onboarding (create a family or join with a
        6-character code) arrives in the next release.
      </Text>

      <TouchableOpacity style={styles.button} onPress={signOut} accessibilityRole="button">
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  help: { fontSize: 14, color: '#444', marginBottom: 12 },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
