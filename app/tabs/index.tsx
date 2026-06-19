import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { useDocuments } from '../../src/hooks/useDocuments';
import { Document, DocumentSortOrder } from '../../src/types';
import { Colors, Spacing, BorderRadius, FontSize } from '../../src/constants';
import { formatDateTime, formatFileSize } from '../../src/utils/storage';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - Spacing.md * 3) / 2;

export default function DocumentsScreen() {
  const router = useRouter();
  const { documents, loading, deleteDocument, refreshDocuments } = useDocuments();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<DocumentSortOrder>('date_desc');
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useFocusEffect(
    useCallback(() => {
      refreshDocuments();
    }, [refreshDocuments])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshDocuments();
    setRefreshing(false);
  }, [refreshDocuments]);

  const filteredDocs = documents
    .filter((d) =>
      d.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortOrder) {
        case 'date_asc': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date_desc': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  const handleDelete = (doc: Document) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${doc.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteDocument(doc.id),
        },
      ]
    );
  };

  const handleShare = async (doc: Document) => {
    if (!doc.fileUri) {
      Alert.alert('Export Required', 'Please open the document and export it first.');
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(doc.fileUri);
    }
  };

  const formatBadge = (format: string) => format.toUpperCase();

  const renderGridItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.gridCard}
      onPress={() => router.push(`/document/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.thumbnail}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImage} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="document-outline" size={40} color={Colors.primary} />
          </View>
        )}
        <View style={styles.formatBadge}>
          <Text style={styles.formatBadgeText}>{formatBadge(item.format)}</Text>
        </View>
        <View style={styles.pageCountBadge}>
          <Text style={styles.pageCountText}>{item.pages.length}p</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.cardDate}>{formatDateTime(item.updatedAt)}</Text>
        {item.fileSize ? (
          <Text style={styles.cardSize}>{formatFileSize(item.fileSize)}</Text>
        ) : null}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => handleShare(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderListItem = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.listCard}
      onPress={() => router.push(`/document/${item.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.listThumb}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.listThumbImage} />
        ) : (
          <View style={styles.listThumbPlaceholder}>
            <Ionicons name="document-outline" size={28} color={Colors.primary} />
          </View>
        )}
      </View>
      <View style={styles.listInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.cardDate}>{formatDateTime(item.updatedAt)}</Text>
        <View style={styles.listMeta}>
          <View style={styles.formatBadgeSmall}>
            <Text style={styles.formatBadgeSmallText}>{formatBadge(item.format)}</Text>
          </View>
          <Text style={styles.cardDate}> · {item.pages.length} page{item.pages.length !== 1 ? 's' : ''}</Text>
          {item.fileSize ? <Text style={styles.cardDate}> · {formatFileSize(item.fileSize)}</Text> : null}
        </View>
      </View>
      <View style={styles.listActions}>
        <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
          <Ionicons name="share-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textTertiary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor={Colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Text style={styles.docCount}>
          {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
        </Text>
        <View style={styles.toolbarRight}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setSortOrder(sortOrder === 'date_desc' ? 'name_asc' : 'date_desc')}
          >
            <Ionicons name="swap-vertical-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={Colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : filteredDocs.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={80} color={Colors.primaryLight} />
          <Text style={styles.emptyTitle}>No Documents Yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the scan button below to scan your first document
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocs}
          key={viewMode}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapper : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/scan/camera')}
        activeOpacity={0.85}
      >
        <Ionicons name="camera" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 44,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  docCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  toolbarRight: { flexDirection: 'row', gap: Spacing.xs },
  toolBtn: { padding: Spacing.xs },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: 100 },
  columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
  gridCard: {
    width: CARD_W,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbnail: { width: '100%', aspectRatio: 0.75, backgroundColor: Colors.surfaceSecondary },
  thumbnailImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSecondary,
  },
  formatBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  formatBadgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  pageCountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pageCountText: { color: Colors.white, fontSize: 10, fontWeight: '600' },
  cardInfo: { padding: Spacing.sm },
  cardName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  cardDate: { fontSize: 11, color: Colors.textTertiary },
  cardSize: { fontSize: 11, color: Colors.textTertiary, marginTop: 1 },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  listCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  listThumb: { width: 70, height: 80, backgroundColor: Colors.surfaceSecondary },
  listThumbImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  listThumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listInfo: { flex: 1, padding: Spacing.sm, justifyContent: 'center' },
  listMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  formatBadgeSmall: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  formatBadgeSmallText: { color: Colors.white, fontSize: 9, fontWeight: '700' },
  listActions: {
    flexDirection: 'column',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.sm,
  },
  actionBtn: { padding: Spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
