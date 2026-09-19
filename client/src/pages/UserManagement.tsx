import React, { useState, useEffect } from "react";
import { getUsers, createUser, updateUser, resetUserPassword } from "../api";
import { useAuth } from "../contexts/AuthContext";

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({ name: "", email: "", role: "REQUESTER", password: "", isActive: true });

  const loadUsers = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await getUsers(search, roleFilter);
      setUsers(res.data);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      setErrorMsg("All fields are required");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await createUser(formData);
      setSuccessMsg("User created successfully");
      setShowCreateModal(false);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setErrorMsg("Name and email are required");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await updateUser(selectedUser.id, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive
      });
      setSuccessMsg("User updated successfully");
      setShowEditModal(false);
      loadUsers();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.password.trim()) {
      setErrorMsg("New password is required");
      return;
    }
    setSubmitting(true);
    setErrorMsg("");
    try {
      await resetUserPassword(selectedUser.id, formData.password);
      setSuccessMsg("Password reset successfully. The user must change it upon next login.");
      setShowResetModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (user: any) => {
    setErrorMsg("");
    setSuccessMsg("");
    setSelectedUser(user);
    setFormData({ name: user.fullName, email: user.email, role: user.role, password: "", isActive: user.isActive });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setFormData({ name: "", email: "", role: "REQUESTER", password: "", isActive: true });
    setShowCreateModal(true);
  };

  return (
    <div className="container py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
        <h2><i className="bi bi-people-fill me-2" style={{ color: "var(--color-primary)" }}></i>User Management</h2>
        <button className="btn btn-primary shadow-sm" onClick={openCreateModal}>
          <i className="bi bi-person-plus-fill me-2"></i>Create User
        </button>
      </div>

      {errorMsg && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {errorMsg}
          <button type="button" className="btn-close" onClick={() => setErrorMsg("")} aria-label="Close"></button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg("")} aria-label="Close"></button>
        </div>
      )}

      {/* Filters */}
      <div className="card shadow-sm mb-4 border-0" style={{ backgroundColor: "var(--color-pale-green)" }}>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-md-8">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search text-muted"></i></span>
                <input 
                  type="text" 
                  className="form-control border-start-0 ps-0" 
                  placeholder="Search by name or email..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>
            </div>
            <div className="col-12 col-md-4">
              <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                <option value="">All Roles</option>
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card shadow-sm border-0 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="py-3">Email</th>
                <th className="py-3">Role</th>
                <th className="py-3">Status</th>
                <th className="px-4 py-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    <div className="spinner-border text-primary" role="status"></div>
                    <div className="mt-2">Loading users...</div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className={u.isActive ? "" : "table-secondary"}>
                    <td className="px-4 fw-medium">{u.fullName} {u.id === currentUser?.id && <span className="badge bg-info ms-2">You</span>}</td>
                    <td className="text-muted">{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : u.role === 'IT_STAFF' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {u.isActive ? (
                        <span className="badge rounded-pill bg-success text-white"><i className="bi bi-check-circle me-1"></i>Active</span>
                      ) : (
                        <span className="badge rounded-pill bg-secondary text-white"><i className="bi bi-x-circle me-1"></i>Inactive</span>
                      )}
                    </td>
                    <td className="px-4 text-end">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => openEditModal(u)}>
                        <i className="bi bi-pencil-square me-1"></i>Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-0 shadow">
                <form onSubmit={handleCreateSubmit}>
                  <div className="modal-header bg-primary text-white border-0">
                    <h5 className="modal-title"><i className="bi bi-person-plus me-2"></i>Create New User</h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => setShowCreateModal(false)}></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Full Name</label>
                      <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Email Address</label>
                      <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Role</label>
                      <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                        <option value="REQUESTER">REQUESTER</option>
                        <option value="IT_STAFF">IT_STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Initial Password</label>
                      <input type="password" className="form-control" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={8} />
                      <div className="form-text">User will be required to change this upon first login.</div>
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button type="button" className="btn btn-light" onClick={() => setShowCreateModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
                      {submitting ? "Creating..." : "Create User"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <>
          <div className="modal-backdrop fade show"></div>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-0 shadow">
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-header bg-light border-bottom">
                    <h5 className="modal-title"><i className="bi bi-pencil-square me-2"></i>Edit User</h5>
                    <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="mb-3">
                      <label className="form-label fw-bold">Full Name</label>
                      <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Email Address</label>
                      <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">Role</label>
                      <select className="form-select" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                        <option value="REQUESTER">REQUESTER</option>
                        <option value="IT_STAFF">IT_STAFF</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <div className="form-check form-switch fs-5 mt-2">
                        <input className="form-check-input" type="checkbox" id="isActiveSwitch" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} />
                        <label className="form-check-label fs-6 mt-1 ms-2" htmlFor="isActiveSwitch">
                          Account is Active
                        </label>
                      </div>
                      {selectedUser.id === currentUser?.id && !formData.isActive && (
                        <div className="text-danger small mt-1"><i className="bi bi-exclamation-triangle me-1"></i>You cannot deactivate your own account.</div>
                      )}
                    </div>
                    
                    <hr className="my-4" />
                    
                    <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded">
                      <div>
                        <strong>Password Reset</strong>
                        <div className="small text-muted">Generate a new initial password.</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => {
                        setShowEditModal(false);
                        setFormData({ ...formData, password: "" });
                        setShowResetModal(true);
                      }}>
                        Set New Initial Password
                      </button>
                    </div>

                  </div>
                  <div className="modal-footer border-top bg-light">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary px-4" disabled={submitting}>
                      {submitting ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1060 }}></div>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog" style={{ zIndex: 1061 }}>
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-0 shadow">
                <form onSubmit={handleResetPassword}>
                  <div className="modal-header bg-danger text-white border-0">
                    <h5 className="modal-title"><i className="bi bi-key-fill me-2"></i>Reset Password</h5>
                    <button type="button" className="btn-close btn-close-white" onClick={() => {
                      setShowResetModal(false);
                      setShowEditModal(true);
                    }}></button>
                  </div>
                  <div className="modal-body p-4">
                    <div className="alert alert-warning">
                      <i className="bi bi-exclamation-triangle-fill me-2"></i>
                      You are setting a new initial password for <strong>{selectedUser.fullName}</strong>. They will be forced to change this password on their next login.
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold">New Initial Password</label>
                      <input type="password" className="form-control" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required minLength={8} />
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0">
                    <button type="button" className="btn btn-light" onClick={() => {
                      setShowResetModal(false);
                      setShowEditModal(true);
                    }}>Cancel</button>
                    <button type="submit" className="btn btn-danger px-4" disabled={submitting}>
                      {submitting ? "Resetting..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
