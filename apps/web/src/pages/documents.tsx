import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Modal } from '../components/ui/modal';
import { SlideOutPanel } from '../components/ui/slide-out-panel';
import { PageShell } from '../components/layout/page-shell';
import { Table } from '../components/ui/table';
import { EmptyState } from '../components/ui/empty-state';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton';
import { FileUpload } from '../components/ui/file-upload';
import { api, apiClient } from '../lib/api-client';
import { formatDate } from '../lib/utils';
import { useCompanyRefresh } from '../hooks/use-company-refresh';
import { showToast } from '../stores/ui-store';
import {
  Plus,
  Download,
  Edit3,
  Trash2,
  Search,
  Upload,
  FileText,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  companyId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: DocumentCategory;
  description: string | null;
  tags: string[];
  version: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory =
  | 'BANK_STATEMENT'
  | 'RECEIPT'
  | 'INVOICE'
  | 'TAX_DOC'
  | 'CONTRACT'
  | 'FINANCIAL_REPORT'
  | 'PAYROLL_REPORT'
  | 'OTHER';

interface DocumentsListResponse {
  data: Document[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UploadPayload {
  file: File;
  companyId: string;
  category: DocumentCategory;
  description?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'BANK_STATEMENT', label: 'Bank Statement' },
  { value: 'RECEIPT', label: 'Receipt' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'TAX_DOC', label: 'Tax Document' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'FINANCIAL_REPORT', label: 'Financial Report' },
  { value: 'PAYROLL_REPORT', label: 'Payroll Report' },
  { value: 'OTHER', label: 'Other' },
];

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  BANK_STATEMENT: 'Bank Statement',
  RECEIPT: 'Receipt',
  INVOICE: 'Invoice',
  TAX_DOC: 'Tax Document',
  CONTRACT: 'Contract',
  FINANCIAL_REPORT: 'Financial Report',
  PAYROLL_REPORT: 'Payroll Report',
  OTHER: 'Other',
};

const CATEGORY_BADGE_COLORS: Record<DocumentCategory, string> = {
  BANK_STATEMENT: 'info',
  RECEIPT: 'success',
  INVOICE: 'warning',
  TAX_DOC: 'error',
  CONTRACT: 'neutral',
  FINANCIAL_REPORT: 'info',
  PAYROLL_REPORT: 'warning',
  OTHER: 'neutral',
} as const;

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
  return `${size} ${units[i]}`;
}

function getCategoryBadgeVariant(category: DocumentCategory) {
  return (CATEGORY_BADGE_COLORS[category] || 'neutral') as 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

// ─── API Hooks ─────────────────────────────────────────────────────────────

function useDocuments(companyId: string | undefined, categoryFilter: string) {
  return useQuery<DocumentsListResponse>({
    queryKey: ['documents', companyId, categoryFilter],
    queryFn: () =>
      api.get<DocumentsListResponse>('/v1/documents', {
        companyId,
        ...(categoryFilter ? { category: categoryFilter } : {}),
      }),
    enabled: !!companyId,
  });
}

function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, UploadPayload>({
    mutationFn: async ({ file, companyId, category, description }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('companyId', companyId);
      formData.append('category', category);
      if (description) formData.append('description', description);
      await apiClient.post('/v1/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showToast('success', 'Document Uploaded', 'The document has been uploaded successfully.');
    },
    onError: (err: any) => {
      showToast(
        'error',
        'Upload Failed',
        err?.response?.data?.message || 'Please check the file and try again.',
      );
    },
  });
}

function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id: string) => api.delete(`/v1/documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      showToast('success', 'Document Deleted', 'The document has been moved to trash.');
    },
    onError: (err: any) => {
      showToast(
        'error',
        'Delete Failed',
        err?.response?.data?.message || 'Please try again.',
      );
    },
  });
}

// ─── Main Page Component ──────────────────────────────────────────────────

export function Documents() {
  const { companyId, refreshKey } = useCompanyRefresh();
  const queryClient = useQueryClient();

  // Data
  const [categoryFilter, setCategoryFilter] = useState('');
  const { data, isLoading, isError, refetch } = useDocuments(
    companyId ?? undefined,
    categoryFilter,
  );
  const documents = data?.data ?? [];

  // Mutations
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  // UI state
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Upload panel state
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('OTHER');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Delete confirmation state
  const [deletingDocument, setDeletingDocument] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter & sort documents
  const filteredDocuments = useMemo(() => {
    const query = search.toLowerCase().trim();
    let result = documents;

    if (query) {
      result = result.filter(
        (doc) =>
          doc.fileName.toLowerCase().includes(query) ||
          (doc.description?.toLowerCase() ?? '').includes(query),
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'fileName':
          cmp = a.fileName.localeCompare(b.fileName);
          break;
        case 'fileSize':
          cmp = a.fileSize - b.fileSize;
          break;
        case 'version':
          cmp = a.version - b.version;
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        default:
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [documents, search, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  // ─── Upload Logic ──────────────────────────────────────────────────────

  const resetUpload = useCallback(() => {
    setUploadFile(null);
    setUploadCategory('OTHER');
    setUploadDescription('');
    setUploadError('');
  }, []);

  const openUploadPanel = useCallback(() => {
    resetUpload();
    setUploadPanelOpen(true);
  }, [resetUpload]);

  const closeUploadPanel = useCallback(() => {
    setUploadPanelOpen(false);
    resetUpload();
  }, [resetUpload]);

  const handleUpload = useCallback(async () => {
    if (!uploadFile) {
      setUploadError('Please select a file to upload.');
      return;
    }
    if (!companyId) {
      showToast('error', 'Missing Company', 'No active company context.');
      return;
    }

    setUploadError('');
    try {
      await uploadMutation.mutateAsync({
        file: uploadFile,
        companyId,
        category: uploadCategory,
        description: uploadDescription.trim() || undefined,
      });
      closeUploadPanel();
    } catch {
      // Error handled in mutation onError
    }
  }, [uploadFile, companyId, uploadCategory, uploadDescription, uploadMutation, closeUploadPanel]);

  // ─── Delete Logic ──────────────────────────────────────────────────────

  const openDeleteConfirm = useCallback((doc: Document) => {
    setDeletingDocument(doc);
  }, []);

  const closeDeleteConfirm = useCallback(() => {
    setDeletingDocument(null);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deletingDocument) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(deletingDocument.id);
      closeDeleteConfirm();
    } finally {
      setIsDeleting(false);
    }
  }, [deletingDocument, deleteMutation, closeDeleteConfirm]);

  // ─── Download Logic ────────────────────────────────────────────────────

  const handleDownload = useCallback((doc: Document) => {
    // The Vite proxy rewrites /api to /api/v1, so we can use the full path
    window.open(`/api/v1/documents/${doc.id}/download`, '_blank');
  }, []);

  // ─── Table Columns ─────────────────────────────────────────────────────

  const columns = useMemo(
    () => [
      {
        key: 'fileName',
        label: 'Name',
        sortable: true,
        render: (item: Document) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-kenya-green-100 text-kenya-green-700 dark:bg-kenya-green-900/30 dark:text-kenya-green-300">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[220px]">
                {item.fileName}
              </p>
              {item.description && (
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[220px]">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        label: 'Category',
        sortable: true,
        render: (item: Document) => (
          <Badge variant={getCategoryBadgeVariant(item.category)} size="sm">
            {CATEGORY_LABELS[item.category] || item.category}
          </Badge>
        ),
      },
      {
        key: 'fileSize',
        label: 'Size',
        sortable: true,
        render: (item: Document) => (
          <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
            {formatFileSize(item.fileSize)}
          </span>
        ),
      },
      {
        key: 'version',
        label: 'Version',
        sortable: true,
        render: (item: Document) => (
          <span className="text-sm text-gray-700 dark:text-gray-300">
            v{item.version}
          </span>
        ),
      },
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (item: Document) => (
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {formatDate(item.createdAt)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'text-right',
        render: (item: Document) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(item);
              }}
              className="touch-target rounded-lg p-2 text-gray-400 hover:text-kenya-green-600 hover:bg-kenya-green-50 dark:hover:text-kenya-green-400 dark:hover:bg-kenya-green-900/20 transition-colors"
              aria-label={`Download ${item.fileName}`}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(item);
              }}
              className="touch-target rounded-lg p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
              aria-label={`Edit ${item.fileName}`}
              title="Edit"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openDeleteConfirm(item);
              }}
              className="touch-target rounded-lg p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
              aria-label={`Delete ${item.fileName}`}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [handleDownload, openDeleteConfirm],
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <PageShell
      title={`Documents (${documents.length})`}
      subtitle="Upload, manage, and organise your company documents"
      actions={
        <Button size="sm" onClick={openUploadPanel}>
          <Upload className="h-4 w-4 mr-1.5" />
          Upload
        </Button>
      }
    >
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:bg-surface-dark dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500 min-h-[48px]"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select
            options={CATEGORY_OPTIONS}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="Filter by category"
          />
        </div>
      </div>

      {/* Document Table */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              Failed to load documents.
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState
            icon="📄"
            title="No documents yet"
            description="Upload your first document — bank statements, receipts, invoices, and more."
            action={{ label: 'Upload Document', onClick: openUploadPanel }}
          />
        </Card>
      ) : (
        <Table<Document>
          columns={columns}
          data={filteredDocuments}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          rowKey={(item) => item.id}
          emptyMessage="No documents match your search."
        />
      )}

      {/* ─── Upload SlideOutPanel ──────────────────────────────────────── */}
      <SlideOutPanel
        isOpen={uploadPanelOpen}
        onClose={closeUploadPanel}
        title="Upload Document"
        subtitle="Select a file and choose its category"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" size="md" className="flex-1" onClick={closeUploadPanel}>
              Cancel
            </Button>
            <Button
              size="md"
              className="flex-1"
              isLoading={uploadMutation.isPending}
              disabled={uploadMutation.isPending || !uploadFile}
              onClick={handleUpload}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              Upload
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* File selection */}
          <FileUpload
            label="Choose a file"
            accept=".pdf,.csv,.xlsx,.docx,.jpg,.jpeg,.png"
            maxSize={20}
            onFileSelect={(file) => setUploadFile(file)}
            error={uploadError}
          />

          {/* Category */}
          <Select
            label="Category *"
            options={CATEGORY_OPTIONS.filter((o) => o.value !== '')}
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
          />

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="upload-description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Description
            </label>
            <textarea
              id="upload-description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="Optional description of this document..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-kenya-green-500 focus:ring-kenya-green-500 dark:bg-surface-dark dark:text-gray-100 dark:border-gray-700 dark:placeholder-gray-500 min-h-[48px] text-base resize-none"
            />
          </div>

          {/* Allowed file types hint */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Allowed file types
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              PDF, CSV, XLSX, DOCX, JPG, PNG — max 20MB
            </p>
          </div>
        </div>
      </SlideOutPanel>

      {/* ─── Delete Confirmation Modal ──────────────────────────────────── */}
      <Modal
        isOpen={!!deletingDocument}
        onClose={closeDeleteConfirm}
        title="Delete Document"
        size="sm"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              type="button"
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={closeDeleteConfirm}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              className="flex-1"
              isLoading={isDeleting}
              disabled={isDeleting}
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                This will soft-delete this document
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                The document will be moved to trash and can be recovered by an
                administrator.
              </p>
            </div>
          </div>

          {deletingDocument && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <FileText className="h-8 w-8 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {deletingDocument.fileName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {CATEGORY_LABELS[deletingDocument.category]} —{' '}
                  {formatFileSize(deletingDocument.fileSize)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}
