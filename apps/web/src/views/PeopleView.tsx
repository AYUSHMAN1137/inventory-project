import { useMemo, useState } from 'react';
import { FolderKanban, Loader2, Plus, UserPlus, Users } from 'lucide-react';
import { useLab } from '../context/LabContext';
import { managementApi } from '../lib/api';
import { Badge, Callout, LoadingState, Modal } from '../components/common/ui';

function AddUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { refresh } = useLab();
  const [collegeId, setCollegeId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (collegeId.trim().length < 3 || name.trim().length < 2 || password.length < 10) {
      setError('College ID (3+), name (2+) and a temporary password of at least 10 characters are required.');
      return;
    }
    setBusy(true);
    try {
      await managementApi.createUser({
        collegeId: collegeId.trim(),
        name: name.trim(),
        email: email.trim() || null,
        role,
        temporaryPassword: password,
      });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Provision New Account"
      subtitle="The user will be asked to change this password on first login."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} Create account
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="new-user-college-id">
              College ID
            </label>
            <input
              id="new-user-college-id"
              className="input mono"
              placeholder="2024BCSE099"
              value={collegeId}
              onChange={(e) => setCollegeId(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="label" htmlFor="new-user-role">
              Role
            </label>
            <select id="new-user-role" className="select" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="STUDENT">Student</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="new-user-name">
            Full name
          </label>
          <input id="new-user-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="new-user-email">
            Email (optional)
          </label>
          <input
            id="new-user-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="new-user-password">
            Temporary password (min 10 characters)
          </label>
          <input
            id="new-user-password"
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

function AddProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { users, refresh } = useLab();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const studentList = users.filter((u) => u.role === 'STUDENT');

  async function submit() {
    setError(null);
    if (name.trim().length < 3) {
      setError('Project name must be at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      await managementApi.createProject({ name: name.trim(), description: description.trim() || undefined, memberIds });
      await refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Project / Team"
      subtitle="The first member selected becomes the team leader."
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create project
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="new-project-name">
            Project name
          </label>
          <input id="new-project-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="new-project-description">
            Description
          </label>
          <textarea
            id="new-project-description"
            className="textarea"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Team members</label>
          <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border p-2">
            {studentList.length === 0 ? (
              <p className="p-2 text-sm text-[var(--text-muted)]">No student accounts available.</p>
            ) : (
              studentList.map((u) => {
                const checked = memberIds.includes(u.id);
                return (
                  <label key={u.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-[var(--bg-subtle)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setMemberIds((prev) => (checked ? prev.filter((id) => id !== u.id) : [...prev, u.id]))
                      }
                    />
                    <span className="text-sm text-[var(--text-strong)]">{u.name}</span>
                    <span className="mono ml-auto text-xs text-[var(--text-muted)]">{u.collegeId}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    </Modal>
  );
}

export function PeopleView() {
  const { users, projects, loading } = useLab();
  const [tab, setTab] = useState<'users' | 'projects'>('users');
  const [showUser, setShowUser] = useState(false);
  const [showProject, setShowProject] = useState(false);

  const stats = useMemo(
    () => ({
      admins: users.filter((u) => u.role === 'ADMIN').length,
      students: users.filter((u) => u.role === 'STUDENT').length,
    }),
    [users],
  );

  if (loading) return <LoadingState label="Loading accounts…" />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users & Projects</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {stats.admins} admin · {stats.students} students · {projects.length} projects
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => (tab === 'users' ? setShowUser(true) : setShowProject(true))}>
          {tab === 'users' ? <UserPlus size={15} /> : <Plus size={15} />}
          {tab === 'users' ? 'Provision account' : 'Create project'}
        </button>
      </div>

      <div className="mb-5 flex rounded-lg border bg-white p-0.5">
        <button className={`btn btn-sm ${tab === 'users' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setTab('users')}>
          <Users size={14} /> Users ({users.length})
        </button>
        <button className={`btn btn-sm ${tab === 'projects' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setTab('projects')}>
          <FolderKanban size={14} /> Projects ({projects.length})
        </button>
      </div>

      {tab === 'users' ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>College ID</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-[var(--text-strong)]">{u.name}</td>
                    <td className="mono text-xs">{u.collegeId}</td>
                    <td className="text-xs text-[var(--text-muted)]">{u.email ?? '—'}</td>
                    <td>
                      <Badge tone={u.role === 'ADMIN' ? 'accent' : 'neutral'}>{u.role}</Badge>
                    </td>
                    <td>
                      <Badge tone={u.status === 'ACTIVE' ? 'ok' : 'danger'}>{u.status.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.length === 0 ? (
            <div className="card p-6 text-center text-sm text-[var(--text-muted)]">No projects created yet.</div>
          ) : (
            projects.map((p) => (
              <div key={p.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-strong)]">{p.name}</h3>
                  <Badge tone="neutral">{p._count?.requests ?? 0} requests</Badge>
                </div>
                {p.description && <p className="mt-1 text-xs text-[var(--text-muted)]">{p.description}</p>}
                <div className="mt-3 space-y-1.5">
                  {p.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-md bg-[var(--bg-subtle)] px-3 py-1.5">
                      <span className="text-xs text-[var(--text-body)]">{m.user.name}</span>
                      <span className="mono text-[11px] text-[var(--text-muted)]">
                        {m.user.collegeId} · {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AddUserModal open={showUser} onClose={() => setShowUser(false)} />
      <AddProjectModal open={showProject} onClose={() => setShowProject(false)} />
    </div>
  );
}
