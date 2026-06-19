import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { DocumentProvider } from '../src/hooks/useDocuments';
import { ThemeProvider, useTheme } from '../src/hooks/useTheme';

function AppStack() {
  const { colors, theme } = useTheme();
  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.header },
          headerTintColor: colors.headerText,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="tabs" options={{ headerShown: false }} />
        <Stack.Screen name="scan/camera" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="scan/review" options={{ title: 'Review Scan' }} />
        <Stack.Screen name="document/[id]" options={{ title: 'Document' }} />
        <Stack.Screen name="document/edit" options={{ title: 'Edit Page' }} />
        <Stack.Screen name="tools/compress" options={{ title: 'Compress File' }} />
        <Stack.Screen name="tools/merge" options={{ title: 'Merge PDFs' }} />
        <Stack.Screen name="tools/convert" options={{ title: 'Convert to PDF' }} />
        <Stack.Screen name="tools/resize" options={{ title: 'Resize Image' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider>
        <DocumentProvider>
          <AppStack />
        </DocumentProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
