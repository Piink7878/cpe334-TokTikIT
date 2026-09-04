import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttachmentSection } from '../../src/components/AttachmentSection';
import * as api from '../../src/api';
import * as auth from '../../src/contexts/RequesterContext';

vi.mock('../../src/api');
vi.mock('../../src/contexts/RequesterContext');

describe('AttachmentSection Component', () => {
  const mockRequester = { id: 1, name: 'John Doe', email: 'john@example.com' };
  
  const mockActiveAttachment = {
    id: 1,
    originalFilename: 'active-file.pdf',
    fileSize: 1048576, // 1 MB
    contentType: 'application/pdf',
    isRemoved: false,
    removedAt: null,
    removedReason: null,
    createdAt: '2026-09-02T10:15:30.000Z'
  };

  const mockRemovedAttachment = {
    id: 2,
    originalFilename: 'removed-file.jpg',
    fileSize: 2048576,
    contentType: 'image/jpeg',
    isRemoved: true,
    removedAt: '2026-09-02T12:00:00.000Z',
    removedReason: 'Wrong file uploaded',
    createdAt: '2026-09-02T10:15:30.000Z'
  };

  const mockUpdateCallback = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    (auth.useRequester as any).mockReturnValue({ selectedRequester: mockRequester });
  });

  const renderComponent = (attachments: any[] = []) => {
    return render(
      <AttachmentSection 
        ticketId={101} 
        attachments={attachments} 
        onAttachmentUpdate={mockUpdateCallback} 
      />
    );
  };

  it('renders empty state correctly', () => {
    renderComponent([]);
    expect(screen.getByText(/No attachments uploaded yet/)).toBeInTheDocument();
    expect(screen.getByText('Attachments (0/5)')).toBeInTheDocument();
  });

  it('renders active attachments with download and remove buttons', () => {
    renderComponent([mockActiveAttachment]);
    
    expect(screen.getByText('active-file.pdf')).toBeInTheDocument();
    expect(screen.getByText(/1 MB/)).toBeInTheDocument();
    expect(screen.getByTestId('download-btn-1')).toBeInTheDocument();
    expect(screen.getByTestId('remove-btn-1')).toBeInTheDocument();
  });

  it('renders soft-removed attachments without action buttons and shows reason', () => {
    renderComponent([mockRemovedAttachment]);
    
    expect(screen.getByText('removed-file.jpg')).toBeInTheDocument();
    expect(screen.getByText(/Wrong file uploaded/)).toBeInTheDocument();
    expect(screen.getByText('File unavailable')).toBeInTheDocument();
    
    // Download and remove buttons should not exist for removed attachment
    expect(screen.queryByTestId('download-btn-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('remove-btn-2')).not.toBeInTheDocument();
  });

  it('disables upload button when 5 active attachments are reached', () => {
    const fiveActive = Array(5).fill(null).map((_, i) => ({ ...mockActiveAttachment, id: i + 1 }));
    renderComponent(fiveActive);

    expect(screen.getByText('Attachments (5/5)')).toBeInTheDocument();
    expect(screen.getByTestId('add-attachment-btn')).toBeDisabled();
    expect(screen.getByText('Maximum of 5 active attachments reached.')).toBeInTheDocument();
  });

  it('handles attachment upload', async () => {
    (api.uploadAttachment as any).mockResolvedValueOnce({ data: { id: 3 } });
    renderComponent();

    const fileInput = screen.getByTestId('file-upload-input');
    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.uploadAttachment).toHaveBeenCalledWith(101, file, mockRequester.id);
      expect(mockUpdateCallback).toHaveBeenCalled();
    });
  });

  it('shows error if uploaded file exceeds 5MB', async () => {
    renderComponent();

    const fileInput = screen.getByTestId('file-upload-input');
    // Mock a large file
    const file = new File([''], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 }); // 6 MB
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/exceeds the 5MB limit/)).toBeInTheDocument();
      expect(api.uploadAttachment).not.toHaveBeenCalled();
    });
  });

  it('shows error if uploaded file is unsupported type', async () => {
    renderComponent();

    const fileInput = screen.getByTestId('file-upload-input');
    const file = new File([''], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/)).toBeInTheDocument();
      expect(api.uploadAttachment).not.toHaveBeenCalled();
    });
  });

  it('opens remove modal and handles soft removal', async () => {
    (api.removeAttachment as any).mockResolvedValueOnce({ data: { isRemoved: true } });
    renderComponent([mockActiveAttachment]);

    // Click remove
    fireEvent.click(screen.getByTestId('remove-btn-1'));

    // Modal should appear
    expect(screen.getByText('Remove Attachment')).toBeInTheDocument();

    // Submit without reason should fail
    fireEvent.click(screen.getByTestId('confirm-remove-btn'));
    expect(screen.getByText(/non-empty removal reason is required/)).toBeInTheDocument();

    // Fill reason and submit
    fireEvent.change(screen.getByTestId('removal-reason-input'), { target: { value: 'Wrong file uploaded' } });
    fireEvent.click(screen.getByTestId('confirm-remove-btn'));

    await waitFor(() => {
      expect(api.removeAttachment).toHaveBeenCalledWith(1, 'Wrong file uploaded', mockRequester.id);
      expect(mockUpdateCallback).toHaveBeenCalled();
    });
  });
});
