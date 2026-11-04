const API_URL = import.meta.env.VITE_API_URL ?? "";

export interface Category {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

export interface TicketFilters {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  itPriority?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface Attachment {
  id: number;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  isRemoved: boolean;
  removedAt: string | null;
  removedReason: string | null;
  createdAt: string;
}

export interface Ticket {
  id: number;
  ticketNumber: string;
  summary: string;
  description?: string;
  requester?: { id: number; name: string; email: string; department?: string };
  category: { id: number; name: string };
  relatedSystem?: { id: number; name: string };
  requestedPriority: string;
  itPriority: string;
  status: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface SystemStatus {
  online: boolean;
  categories: Category[];
}
// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  let resHealth;
  let resCategories;

  try {
    resHealth = await fetch(`${API_URL}/api/health`, { credentials: "include" });
  } catch (error) {
    throw new Error("Backend is unreachable (Network Error). Please ensure the server is running.");
  }

  if (!resHealth.ok) {
    throw new Error(`Failed to fetch health check: ${resHealth.statusText}`);
  }

  try {
    resCategories = await fetch(`${API_URL}/api/categories`, { credentials: "include" });
  } catch (error) {
    throw new Error("Failed to reach categories endpoint (Network Error).");
  }

  if (!resCategories.ok) {
    throw new Error(`Failed to fetch categories: ${resCategories.statusText}`);
  }


  const categories = await resCategories.json();

  return { online: true, categories };
}

export async function getRequesters() {
  const res = await fetch(`${API_URL}/api/requesters`, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch requesters");
  }
  return res.json();
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export async function getRelatedSystems() {
  const res = await fetch(`${API_URL}/api/related-systems`, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch related systems");
  }
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API_URL}/api/categories`);
  if (!res.ok) {
    throw new Error("Failed to fetch categories");
  }
  // The API returns the array directly for categories
  return res.json();
}

export async function createTicket(formData: FormData) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    credentials: "include",
    method: "POST",
    headers: {},
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to create ticket");
  }
  return res.json();
}

export async function getTickets(filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  const queryString = params.toString();
  const url = `${API_URL}/api/tickets${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch tickets");
  }

  return res.json();
}

export async function getTicket(ticketId: number): Promise<{ data: Ticket }> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch ticket");
  }

  return res.json();
}

export async function uploadAttachment(ticketId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/attachments`, {
    credentials: "include",
    method: "POST",
    headers: {},
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to upload attachment");
  }

  return res.json();
}

export async function removeAttachment(attachmentId: number, reason: string) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}`, {
    credentials: "include",
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removalReason: reason })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to remove attachment");
  }

  return res.json();
}

export async function downloadAttachment(attachmentId: number, originalFilename: string) {
  const res = await fetch(`${API_URL}/api/attachments/${attachmentId}/download`, {
    method: "GET",
    headers: {}
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to download attachment");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = originalFilename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export interface StaffTicketFilters {
  search?: string;
  categoryId?: number;
  requestedPriority?: string;
  itPriority?: string;
  status?: string;
  ownerId?: string | 'unassigned' | 'me';
  followUpRequired?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface StaffTicket {
  id: number;
  ticketNumber: string;
  summary: string;
  category: { id: number; name: string };
  requestedPriority: string;
  itPriority: string;
  status: string;
  requester: { id: number; name: string };
  owner: { id: number; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function getStaffTickets(filters?: StaffTicketFilters): Promise<PaginatedResponse<StaffTicket>> {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, String(value));
      }
    });
  }

  const queryString = params.toString();
  const url = `${API_URL}/api/staff/tickets${queryString ? `?${queryString}` : ''}`;

  const res = await fetch(url, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch staff tickets");
  }

  return res.json();
}

export async function getStaffAssignees() {
  const res = await fetch(`${API_URL}/api/staff/assignees`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch assignees");
  }

  return res.json();
}

export async function getStaffTicketDetail(ticketId: number) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}`, {
    credentials: "include",
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to fetch ticket details");
  }

  return res.json();
}

export async function claimTicket(ticketId: number) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/claim`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to claim ticket");
  }

  return res.json();
}

export async function assignTicket(ticketId: number, assigneeId: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/assign`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assigneeId })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to assign ticket");
  }

  return res.json();
}

export async function updateTicketPriority(ticketId: number, itPriority: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/priority`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itPriority })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to update priority");
  }

  return res.json();
}

export async function updateTicketStatus(ticketId: number, status: string, rejectionReason?: string, expectedUpdatedAt?: string) {
  const res = await fetch(`${API_URL}/api/staff/tickets/${ticketId}/status`, {
    credentials: "include",
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, rejectionReason, expectedUpdatedAt })
  });

  if (!res.ok) {
    // ApiError is an Error, so existing callers reading err.message keep working; code/status drive the workflow messages.
    throw await toApiError(res, "Failed to update status");
  }

  return res.json();
}

export async function getPublicComments(ticketId: number) {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, { credentials: "include" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to load comments");
  }
  return res.json();
}

export async function addPublicComment(ticketId: number, content: string) {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content })
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>null);
    throw new Error(data?.error?.message || "Failed to add comment");
  }
  return res.json();
}

export async function addInternalNote(ticketId: number, content: string) {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/internal-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content })
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>null);
    throw new Error(data?.error?.message || "Failed to add note");
  }
  return res.json();
}

export async function indicateProblemResolved(ticketId: number) {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/indicate-resolved`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(()=>null);
    throw new Error(data?.error?.message || "Failed to indicate resolved");
  }
  return res.json();
}

export async function getUsers(search?: string, role?: string) {
  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (role) params.append("role", role);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/api/admin/users${qs ? `?${qs}` : ""}`, { credentials: "include" });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to load users");
  }
  return res.json();
}

export async function createUser(data: any) {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to create user");
  }
  return res.json();
}

export async function updateUser(id: string, data: any) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to update user");
  }
  return res.json();
}

export async function resetUserPassword(id: string, newPassword: string) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ newPassword })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    throw new Error(errorData?.error?.message || "Failed to reset password");
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Lab 4: Actions Taken client APIs (specification.md BR-04/BR-05, api-spec.md §2)
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ActionTakenUser {
  id: string;
  fullName: string;
  role: string;
}

export interface ActionTakenRevision {
  id: number;
  revisionNumber: number;
  editedAt: string;
  editor?: ActionTakenUser;
  originalData?: Record<string, unknown>;
  updatedData?: Record<string, unknown>;
}

export interface ActionTaken {
  id: number;
  ticketId: number;
  performedBy: ActionTakenUser;
  assignedToId?: string | null;
  assignedTo?: ActionTakenUser | null;
  actionDateTime: string;
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  // Only returned to IT Staff / Admin.
  revisions?: ActionTakenRevision[];
}

export interface CreateActionTakenInput {
  description: string;
  result: string;
  followUpRequired: boolean;
  followUpNote?: string;
  attachmentNotes?: string;
  actionDateTime?: string;
  assignedToId?: string;
}

export interface UpdateActionTakenInput {
  expectedUpdatedAt: string;
  description?: string;
  result?: string;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  actionDateTime?: string;
  assignedToId?: string | null;
}

async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  const errorData = await res.json().catch(() => null);
  return new ApiError(errorData?.error?.message || fallback, res.status, errorData?.error?.code);
}

export async function getActionsTaken(ticketId: number): Promise<{ data: ActionTaken[] }> {
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions-taken`, {
    credentials: "include",
    method: "GET",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw await toApiError(res, "Failed to fetch actions taken");
  return res.json();
}

export async function createActionTaken(
  ticketId: number,
  data: CreateActionTakenInput,
  idempotencyKey?: string
): Promise<{ message: string; data: ActionTaken }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${API_URL}/api/tickets/${ticketId}/actions-taken`, {
    credentials: "include",
    method: "POST",
    headers,
    body: JSON.stringify(data)
  });
  if (!res.ok) throw await toApiError(res, "Failed to record action taken");
  return res.json();
}

export async function updateActionTaken(
  actionId: number,
  data: UpdateActionTakenInput
): Promise<{ message: string; data: ActionTaken }> {
  const res = await fetch(`${API_URL}/api/actions-taken/${actionId}`, {
    credentials: "include",
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw await toApiError(res, "Failed to update action taken");
  return res.json();
}

// Lab 4: Dashboards (FR-13, FR-14)
export interface RequesterDashboardData {
  totalTickets: number;
  activeTickets: number;
  waitingForRequesterTickets: number;
  resolvedOrClosedTickets: number;
  recentTickets: Array<{
    id: number;
    ticketNumber: string;
    title: string;
    currentStatus: string;
    itPriority: string;
    updatedAt: string;
  }>;
}

export interface StaffDashboardData {
  unassignedTickets: number;
  myActiveTickets: number;
  ticketsRequiringFollowUp: number;
  criticalOrHighPriorityTickets: number;
  statusBreakdown: Record<string, number>;
  recentTickets: Array<{
    id: number;
    ticketNumber: string;
    title: string;
    currentStatus: string;
    itPriority: string;
    ownerId: string | null;
    updatedAt: string;
  }>;
  currentUserActions: Array<{
    id: number;
    ticketId: number;
    ticketNumber: string;
    description: string;
    result: string;
    actionDateTime: string;
    followUpRequired: boolean;
  }>;
}

export async function getRequesterDashboard(): Promise<{ data: RequesterDashboardData }> {
  const res = await fetch(`${API_URL}/api/dashboard/requester`, { credentials: "include" });
  if (!res.ok) throw await toApiError(res, "Failed to load requester dashboard");
  return res.json();
}

export async function getStaffDashboard(): Promise<{ data: StaffDashboardData }> {
  const res = await fetch(`${API_URL}/api/dashboard/staff`, { credentials: "include" });
  if (!res.ok) throw await toApiError(res, "Failed to load staff dashboard");
  return res.json();
}
