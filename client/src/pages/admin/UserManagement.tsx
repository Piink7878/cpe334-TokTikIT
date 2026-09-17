import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminUsers, createAdminUser, updateAdminUser, resetAdminUserPassword, AdminUser } from '../../api';

export default function UserManagement() {
  const { user } = useAuth();
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  // filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  // Create Form
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState("REQUESTER");
  const [createError, setCreateError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  
  // Edit Form
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("REQUESTER");
  const [editActive, setEditActive] = useState(true);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, page]);

  async function fetchUsers() {
    setLoading(true);
    setErrorMsg("");
    try {
      const filters: any = { page, pageSize: 10 };
      if (search) filters.search = search;
      if (roleFilter) filters.role = roleFilter;
      
      const res = await getAdminUsers(filters);
      setUsers(res.data);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setTempPassword("");
    try {
      const res = await createAdminUser({ fullName: createName, email: createEmail, role: createRole });
      setTempPassword(res.tempPassword);
      fetchUsers();
    } catch (err: any) {
      setCreateError(err.message || "Failed to create user");
    }
  }

  function openEditModal(u: AdminUser) {
    setSelectedUser(u);
    setEditName(u.fullName);
    setEditRole(u.role);
    setEditActive(u.isActive);
    setShowEdit(true);
    setEditError("");
    setTempPassword("");
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError("");
    try {
      await updateAdminUser(selectedUser.id, {
        fullName: editName,
        role: editRole,
        isActive: editActive
      });
      setShowEdit(false);
      fetchUsers();
    } catch (err: any) {
      setEditError(err.message || "Failed to update user");
    }
  }

  async function handleResetPassword(u: AdminUser) {
    if (!window.confirm(`Are you sure you want to reset the password for ${u.email}?`)) return;
    try {
      const res = await resetAdminUserPassword(u.id);
      alert(`Password reset successfully. The new temporary password is:\n\n${res.tempPassword}\n\nPlease copy and save it.`);
    } catch (err: any) {
      alert(err.message || "Failed to reset password");
    }
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>User Management</h2>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setTempPassword(""); setCreateError(""); }}>Create User</button>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search by name or email..." 
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div className="col-md-4">
              <select className="form-select" value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
                <option value="">All Roles</option>
                <option value="REQUESTER">Requester</option>
                <option value="IT_STAFF">IT Staff</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-muted">No users found.</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? 'bg-danger' : u.role === 'IT_STAFF' ? 'bg-primary' : 'bg-secondary'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'bg-success' : 'bg-secondary'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openEditModal(u)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleResetPassword(u)}>Reset Password</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="card-footer d-flex justify-content-between align-items-center">
            <button className="btn btn-sm btn-outline-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="text-muted small">Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-outline-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleCreate}>
                <div className="modal-header">
                  <h5 className="modal-title">Create User</h5>
                  <button type="button" className="btn-close" onClick={() => setShowCreate(false)}></button>
                </div>
                <div className="modal-body">
                  {createError && <div className="alert alert-danger">{createError}</div>}
                  {tempPassword ? (
                    <div className="alert alert-success">
                      <strong>User created successfully!</strong>
                      <p className="mb-0 mt-2">Temporary Password: <code>{tempPassword}</code></p>
                      <p className="small text-muted mt-1">Please copy this password. It will not be shown again.</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label htmlFor="createName" className="form-label">Full Name</label>
                        <input id="createName" type="text" className="form-control" required value={createName} onChange={e => setCreateName(e.target.value)} />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="createEmail" className="form-label">Email</label>
                        <input id="createEmail" type="email" className="form-control" required value={createEmail} onChange={e => setCreateEmail(e.target.value)} />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="createRole" className="form-label">Role</label>
                        <select id="createRole" className="form-select" value={createRole} onChange={e => setCreateRole(e.target.value)}>
                          <option value="REQUESTER">Requester</option>
                          <option value="IT_STAFF">IT Staff</option>
                          <option value="ADMIN">Administrator</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Close</button>
                  {!tempPassword && <button type="submit" className="btn btn-primary">Create User</button>}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && selectedUser && (
        <div className="modal d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={handleEdit}>
                <div className="modal-header">
                  <h5 className="modal-title">Edit User</h5>
                  <button type="button" className="btn-close" onClick={() => setShowEdit(false)}></button>
                </div>
                <div className="modal-body">
                  {editError && <div className="alert alert-danger">{editError}</div>}
                  <div className="mb-3">
                    <label htmlFor="editEmail" className="form-label">Email (Read Only)</label>
                    <input id="editEmail" type="email" className="form-control" disabled value={selectedUser.email} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="editName" className="form-label">Full Name</label>
                    <input id="editName" type="text" className="form-control" required value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="editRole" className="form-label">Role</label>
                    <select 
                      id="editRole"
                      className="form-select" 
                      value={editRole} 
                      onChange={e => setEditRole(e.target.value)}
                      disabled={selectedUser.id === user?.id}
                    >
                      <option value="REQUESTER">Requester</option>
                      <option value="IT_STAFF">IT Staff</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                    {selectedUser.id === user?.id && <small className="text-muted">You cannot change your own role.</small>}
                  </div>
                  <div className="mb-3 form-check">
                    <input 
                      type="checkbox" 
                      className="form-check-input" 
                      id="isActiveCheck" 
                      checked={editActive} 
                      onChange={e => setEditActive(e.target.checked)}
                      disabled={selectedUser.id === user?.id}
                    />
                    <label className="form-check-label" htmlFor="isActiveCheck">Active Account</label>
                    {selectedUser.id === user?.id && <div className="small text-muted">You cannot deactivate your own account.</div>}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
