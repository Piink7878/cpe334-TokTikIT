import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useRequester } from "../contexts/RequesterContext";
import { getCategories, getRelatedSystems, createTicket, Category, RelatedSystem } from "../api";

export default function CreateTicket() {
  const { selectedRequester } = useRequester();
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  
  const [formData, setFormData] = useState({
    categoryId: "",
    relatedSystemId: "",
    requestedPriority: "MEDIUM",
    summary: "",
    description: "",
  });
  
  const [files, setFiles] = useState<File[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  
  const [successTicketNumber, setSuccessTicketNumber] = useState<string | null>(null);
  
  const currentDate = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  useEffect(() => {
    Promise.all([getCategories(), getRelatedSystems()])
      .then(([cats, sysData]) => {
        setCategories(cats);
        // Assuming API returns { data: [...] } for related systems
        setRelatedSystems(sysData.data || sysData);
        setLoadingMetadata(false);
      })
      .catch((err) => {
        console.error("Failed to load metadata", err);
        setErrorMsg("Failed to load categories or related systems. Please try again later.");
        setLoadingMetadata(false);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for the field being edited
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
      
      // Live Validation
      if (selectedFiles.length > 5) {
        setFieldErrors(prev => ({ ...prev, attachments: "You can only select up to 5 files." }));
        return;
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      const invalidFiles = selectedFiles.filter(f => !allowedTypes.includes(f.type));
      if (invalidFiles.length > 0) {
        setFieldErrors(prev => ({ ...prev, attachments: "Invalid file type selected. Only JPG, PNG, WEBP, and PDF are allowed." }));
        return;
      }
      const oversizedFiles = selectedFiles.filter(f => f.size > 5242880);
      if (oversizedFiles.length > 0) {
        setFieldErrors(prev => ({ ...prev, attachments: "One or more files exceed the 5MB limit." }));
        return;
      }

      setFieldErrors(prev => ({ ...prev, attachments: "" }));
    }
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.categoryId) errors.categoryId = "Category is required.";
    if (!formData.relatedSystemId) errors.relatedSystemId = "Related System is required.";
    if (!formData.summary || formData.summary.trim().length < 5 || formData.summary.trim().length > 150) {
      errors.summary = "Summary must be between 5 and 150 characters.";
    }
    if (!formData.description || formData.description.trim().length < 10 || formData.description.trim().length > 3000) {
      errors.description = "Description must be between 10 and 3000 characters.";
    }
    
    // File validation
    if (files.length > 5) {
      errors.attachments = "You can only select up to 5 files.";
    } else {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (files.some(f => !allowedTypes.includes(f.type))) {
        errors.attachments = "Invalid file type selected. Only JPG, PNG, WEBP, and PDF are allowed.";
      } else if (files.some(f => f.size > 5242880)) {
        errors.attachments = "One or more files exceed the 5MB limit.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !selectedRequester) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const data = new FormData();
    data.append("requesterId", selectedRequester.id.toString());
    data.append("categoryId", formData.categoryId);
    data.append("relatedSystemId", formData.relatedSystemId);
    data.append("requestedPriority", formData.requestedPriority);
    data.append("summary", formData.summary.trim());
    data.append("description", formData.description.trim());
    
    files.forEach(file => {
      data.append("attachments", file);
    });

    try {
      const response = await createTicket(data, selectedRequester.id);
      setSuccessTicketNumber(response.data.ticketNumber);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while creating the ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successTicketNumber) {
    return (
      <div className="container py-5" style={{ maxWidth: 800 }}>
        <div className="alert d-flex flex-column align-items-center justify-content-center p-5 shadow-sm" style={{ backgroundColor: "var(--color-pale-green)", borderColor: "var(--color-secondary)", borderRadius: 8 }}>
          <div className="mb-3" style={{ fontSize: 48, color: "var(--color-primary)" }}>✓</div>
          <h2 className="mb-2" style={{ color: "var(--color-text-main)" }}>Ticket Created Successfully</h2>
          <p className="mb-4 text-center" style={{ color: "var(--color-text-muted)" }}>
            Your ticket has been submitted. The official ticket number is:
          </p>
          <div className="px-4 py-2 mb-4 font-monospace fs-4 fw-bold" style={{ backgroundColor: "#FFFFFF", border: "2px dashed var(--color-primary)", borderRadius: 8, color: "var(--color-primary)" }}>
            {successTicketNumber}
          </div>
          <Link to="/my-tickets" className="btn btn-primary" style={{ padding: "10px 24px" }}>
            Back to My Tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 1200 }}>
      {/* Breadcrumb */}
      <nav aria-label="breadcrumb" className="mb-3">
        <ol className="breadcrumb mb-0">
          <li className="breadcrumb-item"><Link to="/my-tickets" style={{ color: "var(--color-secondary)", textDecoration: "none" }}>My Tickets</Link></li>
          <li className="breadcrumb-item active" aria-current="page" style={{ color: "var(--color-text-muted)" }}>Create Ticket</li>
        </ol>
      </nav>

      <h2 className="mb-4" style={{ fontWeight: 600, color: "var(--color-text-main)" }}>Create Support Ticket</h2>

      {errorMsg && (
        <div className="alert mb-4 shadow-sm" style={{ backgroundColor: "var(--color-danger-bg)", color: "var(--color-danger)", border: "1px solid var(--color-danger)" }}>
          <div className="d-flex align-items-center">
            <span className="me-2 fw-bold">Error:</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card shadow-sm border-0" style={{ borderRadius: 8, backgroundColor: "var(--color-surface)" }}>
        <div className="card-body p-4 p-md-5">
          
          {/* Read-Only System Row */}
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label d-block mb-1 text-muted fw-semibold" style={{ fontSize: 14 }}>Ticket Date</label>
              <input type="text" className="form-control" value={currentDate} disabled style={{ backgroundColor: "var(--color-surface-muted)", color: "var(--color-text-muted)" }} />
            </div>
            <div className="col-md-6">
              <label className="form-label d-block mb-1 text-muted fw-semibold" style={{ fontSize: 14 }}>Requester</label>
              <input type="text" className="form-control" value={selectedRequester?.name || ""} disabled style={{ backgroundColor: "var(--color-surface-muted)", color: "var(--color-text-muted)" }} />
            </div>
          </div>

          <hr style={{ borderColor: "var(--color-border-subtle)" }} className="mb-4" />

          {/* Group Classification Fields */}
          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label d-block mb-1 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                Category <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <select 
                className={`form-select ${fieldErrors.categoryId ? "is-invalid" : ""}`}
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                disabled={loadingMetadata || isSubmitting}
                style={fieldErrors.categoryId ? { borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-bg)" } : {}}
              >
                <option value="">-- Select Category --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {fieldErrors.categoryId && <div className="mt-1" style={{ fontSize: 12, color: "var(--color-danger)" }}>⚠️ {fieldErrors.categoryId}</div>}
            </div>

            <div className="col-md-6">
              <label className="form-label d-block mb-1 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                Related System <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <select 
                className={`form-select ${fieldErrors.relatedSystemId ? "is-invalid" : ""}`}
                name="relatedSystemId"
                value={formData.relatedSystemId}
                onChange={handleChange}
                disabled={loadingMetadata || isSubmitting}
                style={fieldErrors.relatedSystemId ? { borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-bg)" } : {}}
              >
                <option value="">-- Select System --</option>
                {relatedSystems.map(rs => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
              </select>
              {fieldErrors.relatedSystemId && <div className="mt-1" style={{ fontSize: 12, color: "var(--color-danger)" }}>⚠️ {fieldErrors.relatedSystemId}</div>}
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <label className="form-label d-block mb-1 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
                Requested Priority <span style={{ color: "var(--color-danger)" }}>*</span>
              </label>
              <select 
                className="form-select"
                name="requestedPriority"
                value={formData.requestedPriority}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          {/* Main Content Fields */}
          <div className="mb-4">
            <label className="form-label d-block mb-1 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
              Ticket Summary <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.summary ? "is-invalid" : ""}`}
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Brief description of the issue..."
              style={fieldErrors.summary ? { borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-bg)" } : {}}
            />
            {fieldErrors.summary && <div className="mt-1" style={{ fontSize: 12, color: "var(--color-danger)" }}>⚠️ {fieldErrors.summary}</div>}
            {!fieldErrors.summary && <div className="mt-1" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>5-150 characters.</div>}
          </div>

          <div className="mb-4">
            <label className="form-label d-block mb-1 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
              Description <span style={{ color: "var(--color-danger)" }}>*</span>
            </label>
            <textarea 
              className={`form-control ${fieldErrors.description ? "is-invalid" : ""}`}
              name="description"
              rows={5}
              value={formData.description}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="Provide detailed information about your request..."
              style={fieldErrors.description ? { borderColor: "var(--color-danger)", backgroundColor: "var(--color-danger-bg)" } : {}}
            />
            {fieldErrors.description && <div className="mt-1" style={{ fontSize: 12, color: "var(--color-danger)" }}>⚠️ {fieldErrors.description}</div>}
          </div>

          {/* Attachments */}
          <div className="mb-5 p-4 rounded" style={{ backgroundColor: "var(--color-bg-page)", border: "1px dashed var(--color-border-input)" }}>
            <label className="form-label d-block mb-2 fw-semibold" style={{ fontSize: 14, color: "var(--color-text-main)" }}>
              Attachments (Optional)
            </label>
            <input 
              type="file" 
              className="form-control mb-2" 
              multiple 
              onChange={handleFileChange}
              disabled={isSubmitting}
              accept=".jpg,.jpeg,.png,.webp,.pdf"
            />
            <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              Max 5 files. Permitted formats: JPG, PNG, WEBP, PDF. Max size: 5 MB per file.
            </div>
            {fieldErrors.attachments && <div className="mt-2 fw-bold" style={{ fontSize: 13, color: "var(--color-danger)" }}>⚠️ {fieldErrors.attachments}</div>}
            
            {files.length > 0 && (
              <div className="mt-3">
                <span style={{ fontSize: 13, fontWeight: 600 }}>Selected files:</span>
                <ul className="mb-0 mt-1" style={{ fontSize: 13, color: "var(--color-text-main)" }}>
                  {files.map((f, i) => (
                    <li key={i}>{f.name} ({(f.size / 1024 / 1024).toFixed(2)} MB)</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="d-flex flex-column flex-sm-row justify-content-end gap-3 border-top pt-4" style={{ borderColor: "var(--color-border-subtle)" }}>
            <Link to="/my-tickets" className="btn text-center" style={{ border: "1px solid var(--color-secondary)", color: "var(--color-secondary)", backgroundColor: "#FFFFFF" }}>
              Cancel
            </Link>
            <button 
              type="submit" 
              className="btn btn-primary position-relative d-flex justify-content-center align-items-center"
              disabled={isSubmitting || loadingMetadata}
              style={{ minWidth: 150 }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" style={{ width: "14px", height: "14px", borderWidth: "2px" }}></span>
                  Submitting...
                </>
              ) : (
                "Submit Ticket"
              )}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
