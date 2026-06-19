import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { DocumentProvider } from '../src/hooks/useDocuments';
import { Colors } from '../src/constants';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <DocumentProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: Colors.primary },
            headerTintColor: Colors.white,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: Colors.background },
          }}
        >
          <Stack.Screen name="tabs" options={{ headerShown: false }} />
          <Stack.Screen
            name="scan/camera"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="scan/review"
            options={{
              title: 'Review Scan',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="document/[id]"
            options={{
              title: 'Document',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="document/edit"
            options={{
              title: 'Edit Page',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="tools/compress"
            options={{ title: 'Compress File' }}
          />
          <Stack.Screen
            name="tools/merge"
            options={{ title: 'Merge PDFs' }}
          />
          <Stack.Screen
            name="tools/convert"
            options={{ title: 'Convert Images to PDF' }}
          />
          <Stack.Screen
            name="tools/resize"
            options={{ title: 'Resize Image' }}
          />
        </Stack>
      </DocumentProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
