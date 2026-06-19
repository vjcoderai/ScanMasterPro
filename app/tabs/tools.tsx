import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const TOOLS: Tool[] = [
  {
    id: 'compress',
    title: 'Compress File',
    description: 'Reduce size of PDF, JPG, or PNG files',
    icon: 'archive-outline',
    color: '#4F46E5',
    route: '/tools/compress',
  },
  {
    id: 'convert',
    title: 'Images to PDF',
    description: 'Convert JPG or PNG images into a single PDF',
    icon: 'document-attach-outline',
    color: '#0891B2',
    route: '/tools/convert',
  },
  {
    id: 'merge',
    title: 'Merge PDFs',
    description: 'Combine multiple PDF documents into one',
    icon: 'git-merge-outline',
    color: '#059669',
    route: '/tools/merge',
  },
  {
    id: 'resize',
    title: 'Resize Image',
    description: 'Resize images to standard or custom dimensions',
    icon: 'resize-outline',
    color: '#D97706',
    route: '/tools/resize',
  },
];

export default function ToolsScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Document Tools</Text>
      <Text style={styles.pageSubtitle}>Everything you need to manage your files</Text>

      <View style={styles.grid}>
        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.id}
            style={styles.toolCard}
            onPress={() => router.push(tool.route as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.toolIconContainer, { backgroundColor: tool.color + '15' }]}>
              <Ionicons name={tool.icon as any} size={32} color={tool.color} />
            </View>
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.toolDesc}>{tool.description}</Text>
            <View style={styles.toolArrow}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
        <Text style={styles.infoText}>
          All processing happens on your device. Your files are never uploaded to any server.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: 40 },
  pageTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  grid: { gap: Spacing.md },
  toolCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
    position: 'relative',
  },
  toolIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  toolTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  toolDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  toolArrow: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.primary,
    lineHeight: 20,
  },
});
