import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSession } from '../../src/features/auth/session/session-context';

/**
 * Placeholder authenticated home screen (the full app is out of scope for FAM-8).
 * It exercises two session flows: a "Sync" action that calls `reload()` — which hits
 * `/auth/me` through `authFetch` and therefore transparently rotates an expired access
 * token (FR-002, SC-002) — and an explicit Sign Out (FR-005).
 */
export default function HomeScreen(): JSX.Element {
  const { user, reload, signOut } = useSession();
  const [busy, setBusy] = useState(false);

  async function onSync(): Promise<void> {
    setBusy(true);
    try {
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FamiFinances</Text>
      <Text style={styles.subtitle} accessibilityLabel="Signed-in email">
        Signed in as {user?.email ?? 'unknown'}
      </Text>

      <TouchableOpacity style={styles.secondary} onPress={onSync} disabled={busy} accessibilityRole="button">
        {busy ? <ActivityIndicator /> : <Text style={styles.secondaryText}>Sync session</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={signOut} accessibilityRole="button">
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#444', marginBottom: 12 },
  secondary: { borderWidth: 1, borderColor: '#1b5e20', borderRadius: 8, padding: 14, alignItems: 'center' },
  secondaryText: { color: '#1b5e20', fontWeight: '600' },
  button: { backgroundColor: '#1b5e20', borderRadius: 8, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
