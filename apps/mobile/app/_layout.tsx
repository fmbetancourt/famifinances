import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { SessionProvider, useSession } from '../src/features/auth/session/session-context';

/**
 * Renders a loading gate while the session is being restored from SecureStore (FR-008),
 * so no protected screen renders before the session status is known (data-model INV-4).
 */
function RootNavigator(): JSX.Element {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator accessibilityLabel="Loading session" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout(): JSX.Element {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
