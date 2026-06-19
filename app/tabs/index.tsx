import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, Image, Dimensions, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useDocuments } from '../../src/hooks/useDocuments';
import { useTheme } from '../../src/hooks/useTheme';
import { Document, FolderType } from '../../src/types';
import { Spacing, BorderRadius, FontSize, FOLDERS } from '../../src/constants';
import { formatDateTime, formatFileSize } from '../../src/utils/storage';
import { createPDFFromImages } from '../../src/utils/pdfUtils';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - Spacing.md * 3) / 2;

export default function DocumentsScreen() {
  const router = useRouter();
  const { documents, loading, deleteDocument, refreshDocuments, updateDocument } = useDocuments();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState<FolderType | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useFocusEffect(useCallback(() => { refreshDocuments(); }, [refreshDocuments]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const filteredDocs = documents
    .filter(d => activeFolder === 'all' || d.folder === activeFolder)
    .filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const handleDelete = (doc: Document) => {
    Alert.alert('Delete Document', `Delete "${doc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(doc.id) },
    ]);
  };

  const handleShare = async (doc: Document) => {
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) { Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.'); return; }

    // If a valid export already exists, share it directly
    if (doc.fileUri) {
      const info = await FileSystem.getInfoAsync(doc.fileUri);
      if (info.exists) {
        await Sharing.shareAsync(doc.fileUri);
        return;
      }
    }

    // No export yet - auto-generate one so the user is never blocked
    if (doc.pages.length === 0) {
      Alert.alert('Nothing to Share', 'This document has no content to share.');
      return;
    }

    try {
      let autoUri = '';
      if (doc.format === 'pdf' || doc.pages.length > 1) {
        const uris = doc.pages.map(p => p.uri);
        autoUri = await createPDFFromImages(uris, `${doc.name}_share_${Date.now()}`, doc.dateTimeStamp, doc.password);
      } else {
        autoUri = doc.pages[0].uri;
      }
      const info = await FileSystem.getInfoAsync(autoUri, { size: true });
      const size = info.exists && 'size' in info ? (info as any).size : 0;
      await updateDocument(doc.id, { fileUri: autoUri, fileSize: size });
      await Sharing.shareAsync(autoUri);
    } catch (e: any) {
      Alert.alert('Share Failed', e.message || 'Could not prepare file for sharing.');
    }
  };

  const getFolderColor = (folder: FolderType) =>
    FOLDERS.find(f => f.id === folder)?.color || colors.primary;

  const renderGridItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={[styles.gridCard, { backgroundColor: colors.card, shadowColor: colors.black }]}
      onPress={() => router.push(`/document/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.thumbnail, { backgroundColor: colors.surfaceSecondary }]}>
        {item.thumbnail
          ? <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImage} />
          : <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="document-outline" size={40} color={colors.primary} />
            </View>
        }
        <View style={[styles.formatBadge, { backgroundColor: getFolderColor(item.folder) }]}>
          <Text style={styles.formatBadgeText}>{item.format.toUpperCase()}</Text>
        </View>
        {item.isPasswordProtected && (
          <View style={[styles.lockBadge, { backgroundColor: colors.warning }]}>
            <Ionicons name="lock-closed" size={10} color={colors.white} />
          </View>
        )}
        <View style={[styles.pageCountBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Text style={styles.pageCountText}>{item.pages.length}p</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.cardDate, { color: colors.textTertiary }]}>{formatDateTime(item.updatedAt)}</Text>
        {item.fileSize ? <Text style={[styles.cardDate, { color: colors.textTertiary }]}>{formatFileSize(item.fileSize)}</Text> : null}
      </View>
      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={() => handleShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={[styles.listCard, { backgroundColor: colors.card }]}
      onPress={() => router.push(`/document/${item.id}`)}
    >
      <View style={[styles.listThumb, { backgroundColor: colors.surfaceSecondary }]}>
        {item.thumbnail
          ? <Image source={{ uri: item.thumbnail }} style={styles.listThumbImage} />
          : <View style={[styles.listThumbPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="document-outline" size={28} color={colors.primary} />
            </View>
        }
      </View>
      <View style={styles.listInfo}>
        <View style={styles.listNameRow}>
          <Text style={[styles.cardName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
          {item.isPasswordProtected && <Ionicons name="lock-closed" size={14} color={colors.warning} />}
        </View>
        <Text style={[styles.cardDate, { color: colors.textTertiary }]}>{formatDateTime(item.updatedAt)}</Text>
        <View style={styles.listMeta}>
          <View style={[styles.folderPill, { backgroundColor: getFolderColor(item.folder) + '20' }]}>
            <Text style={[styles.folderPillText, { color: getFolderColor(item.folder) }]}>
              {FOLDERS.find(f => f.id === item.folder)?.name || item.folder}
            </Text>
          </View>
          <Text style={[styles.cardDate, { color: colors.textTertiary }]}> · {item.pages.length}p</Text>
          {item.fileSize ? <Text style={[styles.cardDate, { color: colors.textTertiary }]}> · {formatFileSize(item.fileSize)}</Text> : null}
        </View>
      </View>
      <View style={styles.listActions}>
        <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
          <Ionicons name="share-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const folderCounts: Record<string, number> = { all: documents.length };
  FOLDERS.forEach(f => { folderCounts[f.id] = documents.filter(d => d.folder === f.id).length; });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search documents..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Folder Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.folderTabs} contentContainerStyle={styles.folderTabsContent}>
        <TouchableOpacity
          style={[styles.folderTab, activeFolder === 'all' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveFolder('all')}
        >
          <Ionicons name="layers-outline" size={14} color={activeFolder === 'all' ? colors.white : colors.textSecondary} />
          <Text style={[styles.folderTabText, { color: activeFolder === 'all' ? colors.white : colors.textSecondary }]}>
            All ({folderCounts.all})
          </Text>
        </TouchableOpacity>
        {FOLDERS.map(folder => (
          <TouchableOpacity
            key={folder.id}
            style={[styles.folderTab, activeFolder === folder.id && { backgroundColor: folder.color }]}
            onPress={() => setActiveFolder(folder.id as FolderType)}
          >
            <Ionicons name={folder.icon as any} size={14} color={activeFolder === folder.id ? colors.white : colors.textSecondary} />
            <Text style={[styles.folderTabText, { color: activeFolder === folder.id ? colors.white : colors.textSecondary }]}>
              {folder.name} ({folderCounts[folder.id] || 0})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={[styles.docCount, { color: colors.textSecondary }]}>{filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={styles.toolBtn} onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
          <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : filteredDocs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={80} color={colors.primaryLight} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Documents Yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Tap the camera button to scan your first document</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          key={viewMode}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={item => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => router.push('/scan/camera')} activeOpacity={0.85}>
        <Ionicons name="camera" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', margin: Spacing.md, marginBottom: Spacing.sm, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, borderWidth: 1, height: 44 },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md },
  folderTabs: { maxHeight: 44 },
  folderTabsContent: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingBottom: Spacing.sm },
  folderTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: 'rgba(0,0,0,0.06)' },
  folderTabText: { fontSize: FontSize.xs, fontWeight: '600' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  docCount: { fontSize: FontSize.sm, fontWeight: '500' },
  toolBtn: { padding: Spacing.xs },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
  gridCard: { width: CARD_W, borderRadius: BorderRadius.lg, overflow: 'hidden', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  thumbnail: { width: '100%', aspectRatio: 0.75 },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formatBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  formatBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  lockBadge: { position: 'absolute', top: 8, right: 28, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pageCountBadge: { position: 'absolute', top: 8, right: 8, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  pageCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  cardInfo: { padding: Spacing.sm },
  cardName: { fontSize: FontSize.sm, fontWeight: '600', marginBottom: 2 },
  cardDate: { fontSize: 11 },
  cardActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: Spacing.sm, borderTopWidth: 1 },
  listCard: { flexDirection: 'row', borderRadius: BorderRadius.md, marginBottom: Spacing.sm, overflow: 'hidden', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  listThumb: { width: 70, height: 80 },
  listThumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  listThumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listInfo: { flex: 1, padding: Spacing.sm, justifyContent: 'center' },
  listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  listMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  folderPill: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  folderPillText: { fontSize: 9, fontWeight: '700' },
  listActions: { flexDirection: 'column', justifyContent: 'space-around', paddingHorizontal: Spacing.sm },
  actionBtn: { padding: Spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: '700', marginTop: Spacing.md },
  emptySubtitle: { fontSize: FontSize.md, textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  fab: { position: 'absolute', right: Spacing.lg, bottom: Spacing.lg, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
});
