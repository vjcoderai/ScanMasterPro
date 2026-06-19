import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/hooks/useTheme';
import { Spacing, BorderRadius, FontSize } from '../../src/constants';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

const TOOLS: Tool[] = [
  { id: 'compress', title: 'Compress File', description: 'Reduce size of JPG or PNG images', icon: 'archive-outline', color: '#4F46E5', route: '/tools/compress' },
  { id: 'convert', title: 'Images to PDF', description: 'Convert JPG or PNG images into a single PDF', icon: 'document-attach-outline', color: '#0891B2', route: '/tools/convert' },
  { id: 'merge', title: 'Merge PDFs', description: 'Combine multiple PDF documents into one', icon: 'git-merge-outline', color: '#059669', route: '/tools/merge' },
  { id: 'resize', title: 'Resize Image', description: 'Resize images to standard or custom dimensions', icon: 'resize-outline', color: '#D97706', route: '/tools/resize' },
];

export default function ToolsScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>Document Tools</Text>
      <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>Everything you need to manage your files</Text>

      <View style={styles.grid}>
        {TOOLS.map(tool => (
          <TouchableOpacity key={tool.id} style={[styles.toolCard, { backgroundColor: colors.card }]} onPress={() => router.push(tool.route as any)} activeOpacity={0.8}>
            <View style={[styles.toolIconContainer, { backgroundColor: tool.color + '15' }]}>
              <Ionicons name={tool.icon as any} size={32} color={tool.color} />
            </View>
            <Text style={[styles.toolTitle, { color: colors.text }]}>{tool.title}</Text>
            <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>{tool.description}</Text>
            <View style={styles.toolArrow}><Ionicons name="chevron-forward" size={16} color={colors.textTertiary} /></View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.primary }]}>
          All processing happens on your device. Results are automatically saved to organized folders on your dashboard.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.md, paddingBottom: 40 },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800', marginBottom: 4 },
  pageSubtitle: { fontSize: FontSize.md, marginBottom: Spacing.lg },
  grid: { gap: Spacing.md },
  toolCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, position: 'relative' },
  toolIconContainer: { width: 56, height: 56, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  toolTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: 4 },
  toolDesc: { fontSize: FontSize.sm, lineHeight: 20 },
  toolArrow: { position: 'absolute', right: Spacing.md, top: '50%' },
  infoBox: { flexDirection: 'row', borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.lg, gap: Spacing.sm, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: FontSize.sm, lineHeight: 20 },
});
