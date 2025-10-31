import { FormEvent, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';

type TemplateRecord = {
  id: string;
  name: string;
  description?: string | null;
  dueDay: number;
  forms?: string[] | null;
  requiredDocs?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
};

type TaskRecord = {
  id: string;
  title: string;
  details?: string | null;
  month: number;
  year: number;
  dueDate: string;
  status: string;
  manualOverride: boolean;
  template: Pick<TemplateRecord, 'id' | 'name' | 'dueDay' | 'forms' | 'requiredDocs'>;
};

type ApiError = {
  message?: string;
  error?: string;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const defaultTemplate = {
  name: '',
  description: '',
  dueDay: 1,
  forms: '',
  requiredDocs: ''
};

export default function Home() {
  const [departmentId, setDepartmentId] = useState('');
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState(defaultTemplate);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(defaultTemplate);

  const hasDepartment = useMemo(() => departmentId.trim().length > 0, [departmentId]);

  useEffect(() => {
    setTemplates([]);
    setTasks([]);
    setMessage(null);
    setError(null);
  }, [departmentId]);

  const loadData = async () => {
    if (!hasDepartment) {
      setError('Enter a department ID to load templates and tasks.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await Promise.all([refreshTemplates(departmentId), refreshTasks(departmentId)]);
      setMessage('Department data loaded.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const refreshTemplates = async (deptId: string) => {
    const response = await fetch(`${API_BASE_URL}/departments/${deptId}/templates`);

    if (!response.ok) {
      throw new Error(await extractError(response));
    }

    const data = (await response.json()) as TemplateRecord[];
    setTemplates(data);
  };

  const refreshTasks = async (deptId: string) => {
    const response = await fetch(`${API_BASE_URL}/departments/${deptId}/tasks`);

    if (!response.ok) {
      throw new Error(await extractError(response));
    }

    const data = (await response.json()) as TaskRecord[];
    setTasks(data);
  };

  const handleCreateTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasDepartment) {
      setError('Select a department before creating templates.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = buildTemplatePayload(newTemplate);
      const response = await fetch(`${API_BASE_URL}/departments/${departmentId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      setNewTemplate(defaultTemplate);
      setMessage('Template created successfully.');
      await refreshTemplates(departmentId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (template: TemplateRecord) => {
    setEditingTemplateId(template.id);
    setEditingTemplate({
      name: template.name,
      description: template.description ?? '',
      dueDay: template.dueDay,
      forms: (template.forms ?? []).join('\n'),
      requiredDocs: (template.requiredDocs ?? []).join('\n')
    });
  };

  const handleUpdateTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingTemplateId) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload = buildTemplatePayload(editingTemplate, true);
      const response = await fetch(`${API_BASE_URL}/departments/${departmentId}/templates/${editingTemplateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      setMessage('Template updated successfully.');
      setEditingTemplateId(null);
      setEditingTemplate(defaultTemplate);
      await refreshTemplates(departmentId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template? Generated tasks will remain for auditing.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/departments/${departmentId}/templates/${templateId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      setMessage('Template deleted successfully.');
      await refreshTemplates(departmentId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (templateId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/departments/${departmentId}/templates/${templateId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      setMessage('Monthly task regenerated.');
      await Promise.all([refreshTemplates(departmentId), refreshTasks(departmentId)]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: 'skip' | 'close' | 'reopen') => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/departments/${departmentId}/tasks/${taskId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(await extractError(response));
      }

      const actionLabel =
        action === 'reopen' ? 'Task reopened.' : action === 'skip' ? 'Task skipped.' : 'Task closed.';
      setMessage(actionLabel);
      await refreshTasks(departmentId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Compliance Automation Console</title>
        <meta name="description" content="Manage monthly compliance templates and generated tasks" />
      </Head>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12">
          <header className="flex flex-col gap-4">
            <h1 className="text-4xl font-bold">Compliance Automation Console</h1>
            <p className="text-slate-700">
              Maintain monthly compliance templates, regenerate tasks on demand, and track overrides applied to
              automatically generated assignments.
            </p>
            <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow">
              <label className="text-sm font-semibold uppercase tracking-wide text-slate-600" htmlFor="department-id">
                Department ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="department-id"
                  type="text"
                  className="w-full rounded border border-slate-300 px-3 py-2"
                  placeholder="Enter department UUID"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                />
                <button
                  type="button"
                  onClick={loadData}
                  className="rounded bg-slate-900 px-4 py-2 font-semibold text-white shadow hover:bg-slate-700"
                  disabled={loading}
                >
                  Load data
                </button>
              </div>
              {message && <p className="text-sm text-emerald-600">{message}</p>}
              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </header>

          <section className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-2xl font-semibold">Create monthly template</h2>
            <p className="mb-4 text-sm text-slate-600">
              Capture forms, evidence requirements, and due dates that should automatically produce tasks at the start of
              each month.
            </p>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateTemplate}>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="template-name">
                  Template name
                </label>
                <input
                  id="template-name"
                  className="rounded border border-slate-300 px-3 py-2"
                  value={newTemplate.name}
                  onChange={(event) => setNewTemplate((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g., Monthly Access Review"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="template-dueDay">
                  Due day (1-31)
                </label>
                <input
                  id="template-dueDay"
                  type="number"
                  min={1}
                  max={31}
                  className="rounded border border-slate-300 px-3 py-2"
                  value={newTemplate.dueDay}
                  onChange={(event) =>
                    setNewTemplate((prev) => ({ ...prev, dueDay: Number.parseInt(event.target.value, 10) || 1 }))
                  }
                  required
                />
              </div>
              <div className="md:col-span-2 flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="template-description">
                  Description
                </label>
                <textarea
                  id="template-description"
                  className="min-h-[80px] rounded border border-slate-300 px-3 py-2"
                  value={newTemplate.description}
                  onChange={(event) => setNewTemplate((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Summarize the compliance objective"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="template-forms">
                  Forms (one per line)
                </label>
                <textarea
                  id="template-forms"
                  className="min-h-[100px] rounded border border-slate-300 px-3 py-2"
                  value={newTemplate.forms}
                  onChange={(event) => setNewTemplate((prev) => ({ ...prev, forms: event.target.value }))}
                  placeholder={'Access review checklist\nException approval form'}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="template-requiredDocs">
                  Required documents (one per line)
                </label>
                <textarea
                  id="template-requiredDocs"
                  className="min-h-[100px] rounded border border-slate-300 px-3 py-2"
                  value={newTemplate.requiredDocs}
                  onChange={(event) => setNewTemplate((prev) => ({ ...prev, requiredDocs: event.target.value }))}
                  placeholder={'access-review-report.pdf\nexception-approvals.zip'}
                />
              </div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-70"
                  disabled={loading}
                >
                  Save template
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Templates</h2>
              <span className="text-sm text-slate-500">{templates.length} configured</span>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-600">No templates found for this department.</p>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => {
                  const isEditing = editingTemplateId === template.id;
                  return (
                    <article key={template.id} className="rounded border border-slate-200 p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{template.name}</h3>
                          <p className="text-sm text-slate-600">
                            Due on day <span className="font-semibold">{template.dueDay}</span> of each month
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                            onClick={() => handleRegenerate(template.id)}
                            disabled={loading}
                          >
                            Generate current month
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                            onClick={() => handleStartEdit(template)}
                            disabled={loading}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteTemplate(template.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {template.description && (
                        <p className="mt-3 text-sm text-slate-700">{template.description}</p>
                      )}

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Forms</h4>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {(template.forms ?? []).length > 0 ? (
                              (template.forms ?? []).map((item) => <li key={item}>{item}</li>)
                            ) : (
                              <li className="italic text-slate-400">None specified</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Required documents</h4>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                            {(template.requiredDocs ?? []).length > 0 ? (
                              (template.requiredDocs ?? []).map((item) => <li key={item}>{item}</li>)
                            ) : (
                              <li className="italic text-slate-400">None specified</li>
                            )}
                          </ul>
                        </div>
                      </div>

                      {isEditing && (
                        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleUpdateTemplate}>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={`edit-name-${template.id}`}>
                              Template name
                            </label>
                            <input
                              id={`edit-name-${template.id}`}
                              className="rounded border border-slate-300 px-3 py-2"
                              value={editingTemplate.name}
                              onChange={(event) =>
                                setEditingTemplate((prev) => ({ ...prev, name: event.target.value }))
                              }
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={`edit-due-${template.id}`}>
                              Due day (1-31)
                            </label>
                            <input
                              id={`edit-due-${template.id}`}
                              type="number"
                              min={1}
                              max={31}
                              className="rounded border border-slate-300 px-3 py-2"
                              value={editingTemplate.dueDay}
                              onChange={(event) =>
                                setEditingTemplate((prev) => ({
                                  ...prev,
                                  dueDay: Number.parseInt(event.target.value, 10) || template.dueDay
                                }))
                              }
                              required
                            />
                          </div>
                          <div className="md:col-span-2 flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={`edit-description-${template.id}`}>
                              Description
                            </label>
                            <textarea
                              id={`edit-description-${template.id}`}
                              className="min-h-[80px] rounded border border-slate-300 px-3 py-2"
                              value={editingTemplate.description}
                              onChange={(event) =>
                                setEditingTemplate((prev) => ({ ...prev, description: event.target.value }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={`edit-forms-${template.id}`}>
                              Forms (one per line)
                            </label>
                            <textarea
                              id={`edit-forms-${template.id}`}
                              className="min-h-[100px] rounded border border-slate-300 px-3 py-2"
                              value={editingTemplate.forms}
                              onChange={(event) =>
                                setEditingTemplate((prev) => ({ ...prev, forms: event.target.value }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-slate-700" htmlFor={`edit-docs-${template.id}`}>
                              Required documents (one per line)
                            </label>
                            <textarea
                              id={`edit-docs-${template.id}`}
                              className="min-h-[100px] rounded border border-slate-300 px-3 py-2"
                              value={editingTemplate.requiredDocs}
                              onChange={(event) =>
                                setEditingTemplate((prev) => ({ ...prev, requiredDocs: event.target.value }))
                              }
                            />
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            <button
                              type="submit"
                              className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                              disabled={loading}
                            >
                              Save changes
                            </button>
                            <button
                              type="button"
                              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => {
                                setEditingTemplateId(null);
                                setEditingTemplate(defaultTemplate);
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Monthly compliance tasks</h2>
              <span className="text-sm text-slate-500">{tasks.length} generated</span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-600">No generated tasks to display.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-left text-sm uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Task</th>
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3">Due date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Manual override</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {tasks.map((task) => (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{task.title}</div>
                          {task.details && <div className="text-xs text-slate-600">{task.details}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{task.template.name}</div>
                          <div className="text-xs text-slate-500">Due day: {task.template.dueDay}</div>
                        </td>
                        <td className="px-4 py-3">{formatDate(task.dueDate)}</td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-900 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {task.manualOverride ? (
                            <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Yes</span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => handleTaskAction(task.id, 'reopen')}
                              disabled={loading}
                            >
                              Reopen
                            </button>
                            <button
                              type="button"
                              className="rounded border border-amber-300 px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              onClick={() => handleTaskAction(task.id, 'skip')}
                              disabled={loading}
                            >
                              Skip
                            </button>
                            <button
                              type="button"
                              className="rounded border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              onClick={() => handleTaskAction(task.id, 'close')}
                              disabled={loading}
                            >
                              Close
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}

function buildTemplatePayload(
  data: { name: string; description?: string; dueDay: number; forms?: string; requiredDocs?: string },
  partial = false
) {
  const formsArray = splitMultiline(data.forms ?? '');
  const docsArray = splitMultiline(data.requiredDocs ?? '');

  if (partial) {
    return {
      ...(data.name ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(Number.isFinite(data.dueDay) ? { dueDay: data.dueDay } : {}),
      ...(data.forms !== undefined ? { forms: formsArray } : {}),
      ...(data.requiredDocs !== undefined ? { requiredDocs: docsArray } : {})
    };
  }

  return {
    name: data.name,
    description: data.description ?? null,
    dueDay: data.dueDay,
    forms: formsArray,
    requiredDocs: docsArray
  };
}

function splitMultiline(value: string) {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return entries;
}

async function extractError(response: Response) {
  try {
    const payload = (await response.json()) as ApiError;
    return payload.message ?? payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unexpected error occurred';
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
