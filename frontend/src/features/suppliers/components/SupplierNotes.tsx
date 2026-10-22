import { useState } from 'react';
import {
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  User,
  Check,
  X,
} from 'lucide-react';

import { Button } from '@/shared/components/common/Button';
import { Card } from '@/shared/components/common/Card';
import { Textarea } from '@/shared/components/forms/Textarea';
import { FormField } from '@/shared/components/forms/FormField';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Skeleton } from '@/shared/components/feedback/Skeleton';
import { ConfirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import { appToast } from '@/shared/utils/toast';
import { usePermissions } from '@/core/permissions/permission-context';
import { PERMISSIONS } from '@/core/permissions/permissionConstants';
import type { Supplier, SupplierNote } from '../types/supplier';
import { useSupplierNotes } from '../hooks/useSupplierNotes';

interface SupplierNotesProps {
  supplier: Supplier;
}

export function SupplierNotes({ supplier }: SupplierNotesProps) {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);
  const canEdit = hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);
  const canDelete =
    hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_DELETE) ||
    hasPermission(PERMISSIONS.SUPPLIERS.SUPPLIERS_EDIT);

  const {
    notes,
    isLoading,
    error,
    refetch,
    createNote,
    updateNote,
    deleteNote,
    isCreating,
    isUpdating,
    isDeleting,
  } = useSupplierNotes(supplier.id);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const [deletingNote, setDeletingNote] = useState<SupplierNote | null>(null);

  const handleStartAdd = () => {
    setIsAddOpen(true);
    setNewContent('');
    setAddError(null);
  };

  const handleCancelAdd = () => {
    setIsAddOpen(false);
    setNewContent('');
    setAddError(null);
  };

  const handleSaveNewNote = async () => {
    const trimmed = newContent.trim();
    if (!trimmed) {
      setAddError('Note content cannot be empty.');
      return;
    }
    if (trimmed.length > 2000) {
      setAddError('Note content cannot exceed 2000 characters.');
      return;
    }

    try {
      await createNote({ content: trimmed });
      appToast.success('Note added successfully.');
      handleCancelAdd();
    } catch {
      appToast.error('Failed to add note. Please try again.');
    }
  };

  const handleStartEdit = (note: SupplierNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditError(null);
  };

  const handleSaveEdit = async (noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      setEditError('Note content cannot be empty.');
      return;
    }
    if (trimmed.length > 2000) {
      setEditError('Note content cannot exceed 2000 characters.');
      return;
    }

    try {
      await updateNote(noteId, { content: trimmed });
      appToast.success('Note updated successfully.');
      handleCancelEdit();
    } catch {
      appToast.error('Failed to update note. Please try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingNote) return;
    try {
      await deleteNote(deletingNote.id);
      appToast.success('Note removed.');
      setDeletingNote(null);
    } catch {
      appToast.error('Failed to delete note. Please try again.');
    }
  };

  return (
    <Card className="p-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">
              Supplier Notes &amp; Activity Log
            </h3>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              {notes.length}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Internal procurement remarks, vendor communications, negotiation history, and audit notes.
          </p>
        </div>
        {canCreate && !isAddOpen && (
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={handleStartAdd}
          >
            Add Note
          </Button>
        )}
      </div>

      {/* Add Note Form */}
      {isAddOpen && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-6">
          <div className="space-y-3">
            <FormField
              label="New Internal Note"
              required
              error={addError ?? undefined}
              hint="Document discussions, agreed pricing, order requirements, or compliance notes."
            >
              <Textarea
                id="supplier-new-note"
                rows={3}
                placeholder="Enter note details..."
                value={newContent}
                maxLength={2000}
                error={Boolean(addError)}
                onChange={(e) => {
                  setNewContent(e.target.value);
                  if (addError) setAddError(null);
                }}
              />
            </FormField>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-slate-400">
                {newContent.length} / 2000 characters
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelAdd}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isLoading={isCreating}
                  disabled={!newContent.trim() || isCreating}
                  onClick={handleSaveNewNote}
                >
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content states */}
      {isLoading ? (
        <div className="space-y-3 p-6">
          <Skeleton height={68} />
          <Skeleton height={68} />
        </div>
      ) : error ? (
        <div className="p-6">
          <ErrorState message={error} onRetry={() => void refetch()} />
        </div>
      ) : notes.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title="No notes recorded yet"
            message="Add internal notes to keep track of vendor performance, negotiation outcomes, and important updates."
            action={
              canCreate && !isAddOpen ? (
                <Button
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={handleStartAdd}
                >
                  Add Note
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {notes.map((note) => {
            const isEditing = editingNoteId === note.id;
            const isEdited = note.updatedAt !== note.createdAt;

            return (
              <div
                key={note.id}
                className="p-6 transition-colors hover:bg-slate-50/40"
              >
                {isEditing ? (
                  /* Inline Edit Mode */
                  <div className="space-y-3">
                    <FormField
                      label="Edit Note"
                      required
                      error={editError ?? undefined}
                    >
                      <Textarea
                        rows={3}
                        value={editContent}
                        maxLength={2000}
                        error={Boolean(editError)}
                        onChange={(e) => {
                          setEditContent(e.target.value);
                          if (editError) setEditError(null);
                        }}
                      />
                    </FormField>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        {editContent.length} / 2000 characters
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          leftIcon={<X size={14} />}
                          onClick={handleCancelEdit}
                          disabled={isUpdating}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          leftIcon={<Check size={14} />}
                          isLoading={isUpdating}
                          disabled={!editContent.trim() || isUpdating}
                          onClick={() => handleSaveEdit(note.id)}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <User size={13} className="text-slate-400" />
                          {note.createdBy || 'Procurement User'}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" />
                          {new Date(note.createdAt).toLocaleDateString()} at{' '}
                          {new Date(note.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {isEdited && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                            edited
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Edit2 size={13} />}
                            onClick={() => handleStartEdit(note)}
                            className="text-slate-600 hover:text-slate-900"
                          >
                            Edit
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 size={13} />}
                            onClick={() => setDeletingNote(note)}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 whitespace-pre-wrap text-sm text-slate-800 leading-relaxed">
                      {note.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {canDelete && (
        <ConfirmDialog
          isOpen={Boolean(deletingNote)}
          title="Delete Supplier Note"
          message="Are you sure you want to delete this internal note? This action cannot be undone."
          variant="danger"
          confirmLabel="Delete Note"
          isLoading={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingNote(null)}
        />
      )}
    </Card>
  );
}
