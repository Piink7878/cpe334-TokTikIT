import React, { useState, useRef } from "react";
import { Attachment, uploadAttachment, removeAttachment, downloadAttachment } from "../api";
import { useRequester } from "../contexts/RequesterContext";

interface AttachmentSectionProps {
  ticketId: number;
  attachments: Attachment[];
  onAttachmentUpdate: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({ ticketId, attachments, onAttachmentUpdate }) => {
  const { selectedRequester } = useRequester();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const [attachmentToRemove, setAttachmentToRemove] = useState<number | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAttachments = attachments.filter(a => !a.isRemoved);
  const removedAttachments = attachments.filter(a => a.isRemoved);
  const hasReachedLimit = activeAttachments.length >= 5;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRequester) return;

    if (hasReachedLimit) {
      setUploadError("A ticket cannot have more than 5 active attachments.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Attachment file size exceeds the 5MB limit.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError("Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      await uploadAttachment(ticketId, file, selectedRequester.id);
      onAttachmentUpdate();
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (att: Attachment) => {
    if (!selectedRequester) return;
    try {
      await downloadAttachment(att.id, att.originalFilename, selectedRequester.id);
    } catch (err: any) {
      alert(err.message || "Failed to download attachment");
    }
  };

  const confirmRemove = async () => {
    if (!selectedRequester || !attachmentToRemove) return;
    if (removalReason.trim().length < 5) {
      setRemoveError("A non-empty removal reason is required (min 5 characters).");
      return;
    }

    setRemoveError(null);
    setIsRemoving(true);

    try {
      await removeAttachment(attachmentToRemove, removalReason, selectedRequester.id);
      onAttachmentUpdate();
      setAttachmentToRemove(null);
      setRemovalReason("");
    } catch (err: any) {
      setRemoveError(err.message || "Failed to remove attachment");
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="attachment-section mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0 fs-5" style={{ color: '#1A2E22', fontWeight: 600 }}>Attachments ({activeAttachments.length}/5)</h3>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            style={{ display: 'none' }} 
            disabled={isUploading || hasReachedLimit}
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            data-testid="file-upload-input"
          />
          <button 
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#0B7A46', 
              color: '#0B7A46' 
            }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || hasReachedLimit}
            data-testid="add-attachment-btn"
          >
            {isUploading ? 'Uploading...' : '+ Add Attachment'}
          </button>
        </div>
      </div>

      {hasReachedLimit && (
        <div className="alert py-2 px-3 mb-3 text-sm" style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: 'none', borderRadius: '6px' }}>
          Maximum of 5 active attachments reached.
        </div>
      )}

      {uploadError && (
        <div className="alert py-2 px-3 mb-3 text-sm" style={{ backgroundColor: '#FDF2F2', color: '#D32F2F', border: '1px solid #D32F2F', borderRadius: '6px' }}>
          {uploadError}
        </div>
      )}

      {attachments.length === 0 && (
        <div className="text-center p-4 rounded" style={{ backgroundColor: '#F0F4F2', border: '1px dashed #CBD5E1' }}>
          <p className="mb-0 text-muted">No attachments uploaded yet.</p>
        </div>
      )}

      <div className="d-flex flex-column gap-2" data-testid="attachments-list">
        {activeAttachments.map(att => (
          <div key={att.id} className="card shadow-sm border-0" style={{ borderRadius: '8px' }} data-testid={`attachment-active-${att.id}`}>
            <div className="card-body p-3 d-flex justify-content-between align-items-center">
              <div>
                <div style={{ fontWeight: 500, color: '#1A2E22' }}>{att.originalFilename}</div>
                <div style={{ fontSize: '12px', color: '#5B6B64' }}>
                  {formatFileSize(att.fileSize)} • Uploaded on {new Date(att.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-sm btn-light" 
                  onClick={() => handleDownload(att)}
                  style={{ color: '#0B7A46' }}
                  data-testid={`download-btn-${att.id}`}
                >
                  Download
                </button>
                <button 
                  className="btn btn-sm" 
                  onClick={() => { setAttachmentToRemove(att.id); setRemovalReason(""); }}
                  style={{ color: '#D32F2F', backgroundColor: '#FDF2F2' }}
                  data-testid={`remove-btn-${att.id}`}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {removedAttachments.length > 0 && removedAttachments.map(att => (
          <div key={att.id} className="card shadow-sm border-0" style={{ borderRadius: '8px', opacity: 0.6 }} data-testid={`attachment-removed-${att.id}`}>
            <div className="card-body p-3 d-flex justify-content-between align-items-center">
              <div>
                <div style={{ fontWeight: 500, color: '#1A2E22', textDecoration: 'line-through' }}>{att.originalFilename}</div>
                <div style={{ fontSize: '12px', color: '#5B6B64' }}>
                  <span className="badge rounded-pill me-2" style={{ backgroundColor: '#E0E5E2', color: '#5B6B64' }}>Removed</span>
                  Removed by requester: {att.removedReason} on {att.removedAt ? new Date(att.removedAt).toLocaleDateString() : 'Unknown'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: '#5B6B64' }}>File unavailable</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {attachmentToRemove && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content" style={{ borderRadius: '8px', border: 'none' }}>
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title" style={{ color: '#1A2E22', fontWeight: 600 }}>Remove Attachment</h5>
                <button type="button" className="btn-close" onClick={() => setAttachmentToRemove(null)} data-testid="cancel-remove-icon"></button>
              </div>
              <div className="modal-body">
                <p style={{ color: '#5B6B64', fontSize: '14px' }}>Are you sure you want to remove this attachment? The file will no longer be downloadable.</p>
                
                {removeError && (
                  <div className="alert py-2 px-3 mb-3 text-sm" style={{ backgroundColor: '#FDF2F2', color: '#D32F2F', border: '1px solid #D32F2F', borderRadius: '6px' }}>
                    {removeError}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label" style={{ fontSize: '14px', fontWeight: 500, color: '#1A2E22', marginBottom: '6px' }}>
                    Reason for removal <span style={{ color: '#D32F2F' }}>*</span>
                  </label>
                  <textarea 
                    className="form-control" 
                    rows={3} 
                    value={removalReason}
                    onChange={e => setRemovalReason(e.target.value)}
                    style={{ borderColor: '#CBD5E1' }}
                    placeholder="Provide a reason..."
                    data-testid="removal-reason-input"
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-top-0 pt-0">
                <button type="button" className="btn btn-secondary" onClick={() => setAttachmentToRemove(null)} disabled={isRemoving} style={{ backgroundColor: '#FFFFFF', borderColor: '#0B7A46', color: '#0B7A46' }} data-testid="cancel-remove-btn">
                  Cancel
                </button>
                <button type="button" className="btn" onClick={confirmRemove} disabled={isRemoving} style={{ backgroundColor: '#D32F2F', color: '#FFFFFF' }} data-testid="confirm-remove-btn">
                  {isRemoving ? 'Removing...' : 'Confirm Removal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
