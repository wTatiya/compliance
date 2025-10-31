import {
  ChangeEvent,
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';

if (typeof window !== 'undefined') {
  ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);
}

const DoughnutChart = dynamic(() => import('react-chartjs-2').then((module) => module.Doughnut), { ssr: false });
const BarChart = dynamic(() => import('react-chartjs-2').then((module) => module.Bar), { ssr: false });

type Role = 'Owner' | 'Reviewer' | 'Observer';

type DirectoryAssignee = {
  id: string;
  name: string;
  email: string;
  wards: string[];
};

type DepartmentAssignee = {
  id: string;
  role: Role;
};

type StatusSummary = {
  onTrack: number;
  atRisk: number;
  blocked: number;
  completed: number;
};

type DepartmentRecord = {
  id: string;
  name: string;
  ward: string;
  description: string;
  statusSummary: StatusSummary;
  assignees: DepartmentAssignee[];
};

type TaskStatus = 'onTrack' | 'atRisk' | 'blocked' | 'completed';

type Task = {
  id: string;
  departmentId: string;
  title: string;
  summary: string;
  dueDate: string;
  progress: number;
  status: TaskStatus;
  icon: string;
};

type DepartmentFormState = {
  name: string;
  ward: string;
  description: string;
  onTrack: number;
  atRisk: number;
  blocked: number;
  completed: number;
};

type AssignmentDraft = Record<
  string,
  {
    active: boolean;
    role: Role;
  }
>;

type DashboardRole = 'admin' | 'manager';

type ComplianceStatusKey = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'CLOSED';

type DashboardMetrics = {
  generatedAt: string;
  totals: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
  };
  statusBreakdown: { status: ComplianceStatusKey; count: number }[];
  departmentSummaries: Array<{
    departmentId: string;
    name: string;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
  }>;
  overdueByDepartment: Array<{ departmentId: string; name: string; overdueTasks: number }>;
  monthlyTrends: Array<{
    label: string;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    closed: number;
  }>;
};

type ExportCategory = 'tasks' | 'departments' | 'overdue';
type ReportFormat = 'pdf' | 'xlsx';

type ManagerProfile = {
  id: string;
  name: string;
  departmentIds: string[];
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const EXPORT_CATEGORIES: Array<{ id: ExportCategory; label: string; description: string }> = [
  { id: 'tasks', label: 'Task performance', description: 'Status counts and completion totals for the selected scope.' },
  {
    id: 'departments',
    label: 'Department performance',
    description: 'Completion rates and overdue exposure across departments.'
  },
  { id: 'overdue', label: 'Overdue exposure', description: 'Departments with outstanding or late compliance work.' }
];

const EXPORT_FORMAT_LABELS: Record<ReportFormat, string> = {
  pdf: 'PDF document',
  xlsx: 'Excel workbook (.xlsx)'
};

const STATUS_LABELS: Record<ComplianceStatusKey, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  CLOSED: 'Closed'
};

const defaultDepartmentForm: DepartmentFormState = {
  name: '',
  ward: '',
  description: '',
  onTrack: 0,
  atRisk: 0,
  blocked: 0,
  completed: 0
};

const DIRECTORY: DirectoryAssignee[] = [
  { id: 'a-1', name: 'Alex Morgan', email: 'alex.morgan@example.com', wards: ['North', 'Central'] },
  { id: 'a-2', name: 'Priya Desai', email: 'priya.desai@example.com', wards: ['Central'] },
  { id: 'a-3', name: 'Mateo Rodriguez', email: 'mateo.rodriguez@example.com', wards: ['South', 'Central'] },
  { id: 'a-4', name: 'Amina Hassan', email: 'amina.hassan@example.com', wards: ['North'] },
  { id: 'a-5', name: 'Jordan Lee', email: 'jordan.lee@example.com', wards: ['South'] }
];

const INITIAL_DEPARTMENTS: DepartmentRecord[] = [
  {
    id: 'dept-01',
    name: 'Information Security',
    ward: 'North',
    description: 'Access certification, data protection, and privileged account reviews across the hospital.',
    statusSummary: { onTrack: 7, atRisk: 2, blocked: 1, completed: 12 },
    assignees: [
      { id: 'a-1', role: 'Owner' },
      { id: 'a-4', role: 'Reviewer' }
    ]
  },
  {
    id: 'dept-02',
    name: 'Pharmacy Compliance',
    ward: 'Central',
    description: 'Medication dispensing controls, cold chain validation, and DEA reporting oversight.',
    statusSummary: { onTrack: 5, atRisk: 1, blocked: 0, completed: 9 },
    assignees: [
      { id: 'a-2', role: 'Owner' },
      { id: 'a-3', role: 'Reviewer' }
    ]
  },
  {
    id: 'dept-03',
    name: 'Surgical Services',
    ward: 'South',
    description: 'OR readiness, sterilization cycles, and implant traceability for surgical teams.',
    statusSummary: { onTrack: 3, atRisk: 1, blocked: 1, completed: 6 },
    assignees: [
      { id: 'a-3', role: 'Owner' },
      { id: 'a-5', role: 'Observer' }
    ]
  }
];

const TASKS_DATA: Task[] = [
  {
    id: 'task-01',
    departmentId: 'dept-01',
    title: 'Badge access sweep',
    summary: 'Confirm that high-risk system badges are current.',
    dueDate: '2024-07-18',
    progress: 70,
    status: 'onTrack',
    icon: '🛡️'
  },
  {
    id: 'task-02',
    departmentId: 'dept-01',
    title: 'Data vault check',
    summary: 'Spot-check overnight backups for gaps.',
    dueDate: '2024-07-10',
    progress: 45,
    status: 'atRisk',
    icon: '💾'
  },
  {
    id: 'task-03',
    departmentId: 'dept-02',
    title: 'Cold chain log upload',
    summary: 'Gather freezer temp slips for audit upload.',
    dueDate: '2024-07-08',
    progress: 30,
    status: 'blocked',
    icon: '🧊'
  },
  {
    id: 'task-04',
    departmentId: 'dept-02',
    title: 'DEA filing review',
    summary: 'Quick review before the monthly filing.',
    dueDate: '2024-07-20',
    progress: 85,
    status: 'onTrack',
    icon: '📦'
  },
  {
    id: 'task-05',
    departmentId: 'dept-03',
    title: 'Tray trace upload',
    summary: 'Add implant tracking slips for last week.',
    dueDate: '2024-07-12',
    progress: 60,
    status: 'onTrack',
    icon: '🗂️'
  },
  {
    id: 'task-06',
    departmentId: 'dept-03',
    title: 'Sterilizer reset',
    summary: 'Flag the unit waiting on vendor sign-off.',
    dueDate: '2024-07-05',
    progress: 100,
    status: 'completed',
    icon: '🧼'
  }
];

const TASK_STATUS_META: Record<
  TaskStatus,
  {
    label: string;
    badgeClass: string;
    progressClass: string;
    icon: string;
  }
> = {
  onTrack: {
    label: 'On track',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    progressClass: 'bg-emerald-500',
    icon: '✅'
  },
  atRisk: {
    label: 'At risk',
    badgeClass: 'bg-amber-100 text-amber-800',
    progressClass: 'bg-amber-500',
    icon: '⚠️'
  },
  blocked: {
    label: 'Blocked',
    badgeClass: 'bg-rose-100 text-rose-800',
    progressClass: 'bg-rose-500',
    icon: '⛔'
  },
  completed: {
    label: 'Complete',
    badgeClass: 'bg-slate-200 text-slate-800',
    progressClass: 'bg-slate-500',
    icon: '🏁'
  }
};

export default function DepartmentOverview() {
  const [departments, setDepartments] = useState<DepartmentRecord[]>(INITIAL_DEPARTMENTS);
  const [searchTerm, setSearchTerm] = useState('');
  const [wardFilter, setWardFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [currentRole, setCurrentRole] = useState<DashboardRole>('admin');
  const [activeManagerId, setActiveManagerId] = useState<string | null>(null);
  const [selectedMetricsDepartmentId, setSelectedMetricsDepartmentId] = useState<string>('');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(defaultDepartmentForm);
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<AssignmentDraft>({});

  const [exportCategories, setExportCategories] = useState<ExportCategory[]>(['tasks', 'departments']);
  const [exportFormat, setExportFormat] = useState<ReportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const managerProfiles = useMemo<ManagerProfile[]>(() => {
    const profileMap = new Map<string, ManagerProfile>();

    departments.forEach((department) => {
      department.assignees
        .filter((assignment) => assignment.role === 'Owner')
        .forEach((assignment) => {
          const existing = profileMap.get(assignment.id);
          const directoryEntry = DIRECTORY.find((assignee) => assignee.id === assignment.id);
          const displayName = directoryEntry?.name ?? assignment.id;

          if (existing) {
            if (!existing.departmentIds.includes(department.id)) {
              existing.departmentIds.push(department.id);
            }
          } else {
            profileMap.set(assignment.id, {
              id: assignment.id,
              name: displayName,
              departmentIds: [department.id]
            });
          }
        });
    });

    return Array.from(profileMap.values())
      .map((profile) => ({
        ...profile,
        departmentIds: [...profile.departmentIds]
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [departments]);

  const scopedDepartments = useMemo(() => {
    if (currentRole === 'admin') {
      return departments;
    }

    const profile = managerProfiles.find((item) => item.id === activeManagerId);
    if (!profile) {
      return [] as DepartmentRecord[];
    }

    return departments.filter((department) => profile.departmentIds.includes(department.id));
  }, [departments, currentRole, managerProfiles, activeManagerId]);

  const wards = useMemo(
    () => Array.from(new Set(scopedDepartments.map((dept) => dept.ward))).sort(),
    [scopedDepartments]
  );

  const assigneeOptions = useMemo(() => DIRECTORY.map((assignee) => ({ value: assignee.id, label: assignee.name })), []);

  const metricsDepartmentOptions = useMemo(() => {
    if (currentRole === 'admin') {
      return [
        { value: '', label: 'All departments' },
        ...departments.map((department) => ({ value: department.id, label: department.name }))
      ];
    }

    const profile = managerProfiles.find((item) => item.id === activeManagerId);
    if (!profile) {
      return [] as Array<{ value: string; label: string }>;
    }

    return profile.departmentIds
      .map((departmentId) => {
        const match = departments.find((department) => department.id === departmentId);
        return match ? { value: match.id, label: match.name } : null;
      })
      .filter((option): option is { value: string; label: string } => option !== null);
  }, [currentRole, departments, managerProfiles, activeManagerId]);

  const activeDepartment = useMemo(
    () => (activeDepartmentId ? departments.find((dept) => dept.id === activeDepartmentId) ?? null : null),
    [activeDepartmentId, departments]
  );

  const selectedManagerProfile = useMemo(
    () => (activeManagerId ? managerProfiles.find((profile) => profile.id === activeManagerId) ?? null : null),
    [activeManagerId, managerProfiles]
  );

  const visibleDepartmentIds = useMemo(
    () => new Set(scopedDepartments.map((department) => department.id)),
    [scopedDepartments]
  );

  const scopedTaskCount = useMemo(
    () => tasks.filter((task) => visibleDepartmentIds.has(task.departmentId)).length,
    [tasks, visibleDepartmentIds]
  );

  const metricsScopeLabel = useMemo(() => {
    if (!selectedMetricsDepartmentId) {
      return 'All departments';
    }

    const match = metricsDepartmentOptions.find((option) => option.value === selectedMetricsDepartmentId);
    return match?.label ?? 'Selected department';
  }, [selectedMetricsDepartmentId, metricsDepartmentOptions]);

  const metricsTimestamp = useMemo(() => {
    if (!metrics) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(metrics.generatedAt));
    } catch (error) {
      return new Date(metrics.generatedAt).toLocaleString();
    }
  }, [metrics]);

  useEffect(() => {
    if (currentRole === 'manager') {
      if (managerProfiles.length === 0) {
        setActiveManagerId(null);
        return;
      }

      setActiveManagerId((previous) => {
        if (previous && managerProfiles.some((profile) => profile.id === previous)) {
          return previous;
        }
        return managerProfiles[0]?.id ?? null;
      });
    } else {
      setActiveManagerId(null);
    }
  }, [currentRole, managerProfiles]);

  useEffect(() => {
    if (currentRole === 'admin') {
      setSelectedMetricsDepartmentId('');
      return;
    }

    const profile = managerProfiles.find((item) => item.id === activeManagerId);
    if (!profile) {
      setSelectedMetricsDepartmentId('');
      return;
    }

    setSelectedMetricsDepartmentId((previous) => {
      if (previous && profile.departmentIds.includes(previous)) {
        return previous;
      }
      return profile.departmentIds[0] ?? '';
    });
  }, [currentRole, activeManagerId, managerProfiles]);

  const computeLocalMetrics = useCallback(
    (departmentId?: string): DashboardMetrics => {
      const now = new Date();
      const departmentScope =
        departmentId && departmentId.length > 0
          ? departments.filter((department) => department.id === departmentId)
          : currentRole === 'admin'
          ? departments
          : scopedDepartments;

      const scopedTasks = tasks.filter((task) =>
        departmentId && departmentId.length > 0
          ? task.departmentId === departmentId
          : departmentScope.some((department) => department.id === task.departmentId)
      );

      const statusCounts: Record<ComplianceStatusKey, number> = {
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        SKIPPED: 0,
        CLOSED: 0
      };

      scopedTasks.forEach((task) => {
        switch (task.status) {
          case 'completed':
            statusCounts.COMPLETED += 1;
            break;
          case 'blocked':
            statusCounts.IN_PROGRESS += 1;
            break;
          case 'atRisk':
            statusCounts.IN_PROGRESS += 1;
            break;
          case 'onTrack':
          default:
            statusCounts.PENDING += 1;
            break;
        }
      });

      const overdueTasksTotal = scopedTasks.filter(
        (task) => new Date(task.dueDate).getTime() < now.getTime() && task.status !== 'completed'
      ).length;

      const departmentSummaries = departmentScope.map((department) => {
        const totalTasks =
          department.statusSummary.onTrack +
          department.statusSummary.atRisk +
          department.statusSummary.blocked +
          department.statusSummary.completed;
        const completedTasks = department.statusSummary.completed;
        const departmentTasks = scopedTasks.filter((task) => task.departmentId === department.id);
        const overdueTasks = departmentTasks.filter(
          (task) => new Date(task.dueDate).getTime() < now.getTime() && task.status !== 'completed'
        ).length;

        return {
          departmentId: department.id,
          name: department.name,
          totalTasks,
          completedTasks,
          completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0,
          overdueTasks
        };
      });

      const monthlyTrendMap = new Map<string, DashboardMetrics['monthlyTrends'][number]>();
      scopedTasks.forEach((task) => {
        const due = new Date(task.dueDate);
        const key = `${due.getUTCFullYear()}-${String(due.getUTCMonth() + 1).padStart(2, '0')}`;
        const label = due.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        const trend =
          monthlyTrendMap.get(key) ?? { label, pending: 0, inProgress: 0, completed: 0, skipped: 0, closed: 0 };

        switch (task.status) {
          case 'completed':
            trend.completed += 1;
            trend.closed += 1;
            break;
          case 'blocked':
            trend.inProgress += 1;
            break;
          case 'atRisk':
            trend.inProgress += 1;
            break;
          default:
            trend.pending += 1;
            break;
        }

        monthlyTrendMap.set(key, trend);
      });

      const totalTaskCount =
        statusCounts.PENDING + statusCounts.IN_PROGRESS + statusCounts.COMPLETED + statusCounts.SKIPPED + statusCounts.CLOSED;

      return {
        generatedAt: new Date().toISOString(),
        totals: {
          totalTasks: totalTaskCount,
          completedTasks: statusCounts.COMPLETED,
          completionRate: totalTaskCount ? Math.round((statusCounts.COMPLETED / totalTaskCount) * 1000) / 10 : 0,
          overdueTasks: overdueTasksTotal
        },
        statusBreakdown: (Object.entries(statusCounts) as Array<[ComplianceStatusKey, number]>).map(([status, count]) => ({
          status,
          count
        })),
        departmentSummaries: departmentSummaries.sort((a, b) => a.name.localeCompare(b.name)),
        overdueByDepartment: departmentSummaries
          .filter((summary) => summary.overdueTasks > 0)
          .map((summary) => ({
            departmentId: summary.departmentId,
            name: summary.name,
            overdueTasks: summary.overdueTasks
          }))
          .sort((a, b) => b.overdueTasks - a.overdueTasks),
        monthlyTrends: Array.from(monthlyTrendMap.entries())
          .sort(([aKey], [bKey]) => (aKey < bKey ? -1 : aKey > bKey ? 1 : 0))
          .map(([, value]) => value)
      };
    },
    [departments, tasks, currentRole, scopedDepartments]
  );

  useEffect(() => {
    if (currentRole === 'manager' && !selectedMetricsDepartmentId) {
      setMetrics(computeLocalMetrics());
      setMetricsError(null);
      setIsLoadingMetrics(false);
      return;
    }

    let isActive = true;
    const controller = new AbortController();

    const loadMetrics = async () => {
      setIsLoadingMetrics(true);
      setMetricsError(null);

      const departmentId = selectedMetricsDepartmentId || undefined;

      try {
        const url = new URL('/dashboard/metrics', API_BASE_URL);
        if (departmentId) {
          url.searchParams.set('departmentId', departmentId);
        }

        const response = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = (await response.json()) as DashboardMetrics;

        if (isActive) {
          setMetrics(data);
        }
      } catch (error) {
        if (isActive) {
          setMetricsError('Unable to reach the analytics service. Showing local estimates instead.');
          setMetrics(computeLocalMetrics(selectedMetricsDepartmentId || undefined));
        }
      } finally {
        if (isActive) {
          setIsLoadingMetrics(false);
        }
      }
    };

    loadMetrics();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [selectedMetricsDepartmentId, currentRole, computeLocalMetrics]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setTasks(TASKS_DATA);
      setIsLoadingTasks(false);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, []);

  const canManageDepartments = currentRole === 'admin';

  const handleRoleChange = (role: DashboardRole) => {
    setCurrentRole(role);
    setMetricsError(null);
  };

  const handleManagerChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setActiveManagerId(event.target.value || null);
  };

  const filteredDepartments = useMemo(() => {
    return scopedDepartments.filter((department) => {
      const matchesSearch = department.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesWard = wardFilter ? department.ward === wardFilter : true;
      const matchesAssignee = assigneeFilter
        ? department.assignees.some((assignee) => assignee.id === assigneeFilter)
        : true;
      const matchesStatus = statusFilter ? getDominantStatus(department.statusSummary) === statusFilter : true;

      return matchesSearch && matchesWard && matchesAssignee && matchesStatus;
    });
  }, [scopedDepartments, searchTerm, wardFilter, assigneeFilter, statusFilter]);

  const dominantStatus = activeDepartment ? getDominantStatus(activeDepartment.statusSummary) : '';

  const tasksByDepartment = useMemo(
    () =>
      tasks.reduce<Record<string, Task[]>>((acc, task) => {
        if (!acc[task.departmentId]) {
          acc[task.departmentId] = [];
        }

        acc[task.departmentId].push(task);
        return acc;
      }, {}),
    [tasks]
  );

  const handleTaskFocus = (taskId: string) => {
    setFocusedTaskId((prev) => (prev === taskId ? null : taskId));
  };

  const handleTaskAction = (action: 'view' | 'upload' | 'complete', task: Task) => {
    setFocusedTaskId(task.id);
    console.info(`${action} task`, task.title);
  };

  const handleOpenAddDepartment = () => {
    if (!canManageDepartments) {
      return;
    }

    setDepartmentForm(defaultDepartmentForm);
    setIsAddOpen(true);
  };

  const handleOpenEditDepartment = (department: DepartmentRecord) => {
    if (!canManageDepartments) {
      return;
    }

    setActiveDepartmentId(department.id);
    setDepartmentForm({
      name: department.name,
      ward: department.ward,
      description: department.description,
      onTrack: department.statusSummary.onTrack,
      atRisk: department.statusSummary.atRisk,
      blocked: department.statusSummary.blocked,
      completed: department.statusSummary.completed
    });
    setIsEditOpen(true);
  };

  const handleOpenAssignmentManager = (department: DepartmentRecord) => {
    if (!canManageDepartments) {
      return;
    }

    setActiveDepartmentId(department.id);
    const draft: AssignmentDraft = {};

    DIRECTORY.forEach((assignee) => {
      const existing = department.assignees.find((item) => item.id === assignee.id);
      draft[assignee.id] = {
        active: Boolean(existing),
        role: existing?.role ?? 'Reviewer'
      };
    });

    setAssignmentDraft(draft);
    setIsAssignmentOpen(true);
  };

  const handleOpenExportModal = () => {
    setExportError(null);
    setIsExportOpen(true);
  };

  const handleCloseExportModal = () => {
    setIsExportOpen(false);
    setIsExporting(false);
    setExportError(null);
  };

  const handleExportCategoryToggle = (category: ExportCategory) => {
    setExportCategories((previous) =>
      previous.includes(category)
        ? previous.filter((item) => item !== category)
        : [...previous, category]
    );
  };

  const handleExportFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    setExportFormat(event.target.value as ReportFormat);
  };

  const handleExportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (exportCategories.length === 0) {
      setExportError('Select at least one category to include in the report.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/reports/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: selectedMetricsDepartmentId || undefined,
          categories: exportCategories,
          format: exportFormat
        })
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = response.headers.get('content-disposition');
      const filename = disposition
        ? extractFilenameFromDisposition(disposition)
        : `compliance-report.${exportFormat}`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setIsExportOpen(false);
    } catch (error) {
      console.error('Failed to export report', error);
      setExportError('Failed to export report. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDepartmentFieldChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;

    setDepartmentForm((prev) => {
      if (['onTrack', 'atRisk', 'blocked', 'completed'].includes(name)) {
        const parsed = Number.parseInt(value, 10);
        return { ...prev, [name]: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) } as DepartmentFormState;
      }

      return { ...prev, [name]: value } as DepartmentFormState;
    });
  };

  const handleCreateDepartment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = departmentForm.name.trim();
    const trimmedWard = departmentForm.ward.trim();

    if (!trimmedName || !trimmedWard) {
      return;
    }

    const newDepartment: DepartmentRecord = {
      id: `dept-${Date.now()}`,
      name: trimmedName,
      ward: trimmedWard,
      description: departmentForm.description.trim(),
      statusSummary: {
        onTrack: departmentForm.onTrack,
        atRisk: departmentForm.atRisk,
        blocked: departmentForm.blocked,
        completed: departmentForm.completed
      },
      assignees: []
    };

    setDepartments((prev) => [newDepartment, ...prev]);
    setIsAddOpen(false);
  };

  const handleUpdateDepartment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeDepartmentId) {
      return;
    }

    setDepartments((prev) =>
      prev.map((department) =>
        department.id === activeDepartmentId
          ? {
              ...department,
              name: departmentForm.name.trim(),
              ward: departmentForm.ward.trim(),
              description: departmentForm.description.trim(),
              statusSummary: {
                onTrack: departmentForm.onTrack,
                atRisk: departmentForm.atRisk,
                blocked: departmentForm.blocked,
                completed: departmentForm.completed
              }
            }
          : department
      )
    );

    setIsEditOpen(false);
  };

  const handleAssignmentToggle = (assigneeId: string) => {
    setAssignmentDraft((prev) => {
      const current = prev[assigneeId];
      return {
        ...prev,
        [assigneeId]: {
          active: !current?.active,
          role: current?.role ?? 'Reviewer'
        }
      };
    });
  };

  const handleAssignmentRoleChange = (assigneeId: string, role: Role) => {
    setAssignmentDraft((prev) => ({
      ...prev,
      [assigneeId]: {
        active: prev[assigneeId]?.active ?? false,
        role
      }
    }));
  };

  const handleAssignmentsSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeDepartmentId) {
      return;
    }

    const selectedAssignees: DepartmentAssignee[] = Object.entries(assignmentDraft)
      .filter(([, info]) => info.active)
      .map(([assigneeId, info]) => ({ id: assigneeId, role: info.role }));

    setDepartments((prev) =>
      prev.map((department) =>
        department.id === activeDepartmentId
          ? {
              ...department,
              assignees: selectedAssignees
            }
          : department
      )
    );

    setIsAssignmentOpen(false);
  };

  const handleDialogClose = () => {
    setIsAddOpen(false);
    setIsEditOpen(false);
    setIsAssignmentOpen(false);
    setActiveDepartmentId(null);
  };

  const totalDepartments = scopedDepartments.length;
  const totalAssigned = scopedDepartments.reduce((acc, department) => acc + department.assignees.length, 0);

  return (
    <>
      <Head>
        <title>Department Compliance Overview</title>
        <meta
          name="description"
          content="Monitor department compliance, manage assignees, and keep status updates organized."
        />
      </Head>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-6 rounded-2xl bg-white p-6 shadow-md lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Department compliance</h1>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Review department status summaries, keep track of assignee responsibilities, and quickly launch updates.
              </p>
            </div>
            <div className="flex flex-col gap-4 text-sm text-slate-600 sm:items-end">
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Viewing as</span>
                  <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('admin')}
                      className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        currentRole === 'admin'
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRoleChange('manager')}
                      className={`rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                        currentRole === 'manager'
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Department manager
                    </button>
                  </div>
                </div>
                {currentRole === 'manager' && managerProfiles.length > 0 ? (
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:flex-row sm:items-center sm:gap-2">
                    <span>Manager</span>
                    <select
                      value={activeManagerId ?? ''}
                      onChange={handleManagerChange}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      {managerProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              {currentRole === 'manager' && !selectedManagerProfile ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  No manager assignments available yet. Administrators can assign owners to departments to enable this view.
                </p>
              ) : null}
              <div className="flex flex-col gap-4 text-right sm:flex-row sm:items-center sm:justify-end sm:gap-8">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Departments</span>
                  <span className="text-2xl font-semibold text-slate-900">{totalDepartments}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Assignees mapped</span>
                  <span className="text-2xl font-semibold text-slate-900">{totalAssigned}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Visible tasks</span>
                  <span className="text-2xl font-semibold text-slate-900">{scopedTaskCount}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenAddDepartment()}
                  disabled={!canManageDepartments}
                  className={`inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                    canManageDepartments
                      ? 'bg-emerald-600 text-white shadow hover:bg-emerald-500'
                      : 'cursor-not-allowed bg-emerald-200 text-emerald-800'
                  }`}
                >
                  <span aria-hidden="true" className="mr-2 text-lg">
                    +
                  </span>
                  New department
                </button>
                {currentRole === 'admin' ? (
                  <button
                    type="button"
                    onClick={handleOpenExportModal}
                    className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                  >
                    <span aria-hidden="true" className="mr-2">
                      📄
                    </span>
                    Export compliance report
                  </button>
                ) : null}
              </div>
            </div>
          </header>

          <section aria-label="Compliance analytics" className="grid gap-6 rounded-2xl bg-white p-6 shadow-md">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                  <span aria-hidden="true">📈</span>
                  Analytics overview
                </h2>
                <p className="text-sm text-slate-600">Aggregated metrics for {metricsScopeLabel}.</p>
              </div>
              <div className="flex flex-col items-start gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-end sm:gap-6">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>Focus area</span>
                  <select
                    value={selectedMetricsDepartmentId}
                    onChange={(event) => setSelectedMetricsDepartmentId(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    disabled={metricsDepartmentOptions.length === 0}
                  >
                    {metricsDepartmentOptions.length === 0 ? (
                      <option value="">No departments available</option>
                    ) : (
                      metricsDepartmentOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {metricsTimestamp ? (
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Updated {metricsTimestamp}</span>
                ) : null}
              </div>
            </header>
            {metricsError ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{metricsError}</p>
            ) : null}
            {isLoadingMetrics && !metrics ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : metrics ? (
              <div className="grid gap-6">
                <MetricsSummaryCards metrics={metrics} scopeLabel={metricsScopeLabel} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <StatusBreakdownChart breakdown={metrics.statusBreakdown} isLoading={isLoadingMetrics} />
                  <TrendChart trends={metrics.monthlyTrends} isLoading={isLoadingMetrics} />
                </div>
                <DepartmentPerformanceTable summaries={metrics.departmentSummaries} />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Metrics unavailable for the selected scope.
              </p>
            )}
          </section>

          <section aria-label="Department filters" className="grid gap-4 rounded-2xl bg-white p-6 shadow-md">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-semibold">Search</span>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by department name"
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-semibold">Ward</span>
                <select
                  value={wardFilter}
                  onChange={(event) => setWardFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">All wards</option>
                  {wards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-semibold">Assignee</span>
                <select
                  value={assigneeFilter}
                  onChange={(event) => setAssigneeFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">All assignees</option>
                  {assigneeOptions.map((assignee) => (
                    <option key={assignee.value} value={assignee.value}>
                      {assignee.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                <span className="font-semibold">Dominant status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">All statuses</option>
                  <option value="onTrack">On track</option>
                  <option value="atRisk">At risk</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>
          </section>

          <section aria-label="Assigned tasks" className="grid gap-6 rounded-2xl bg-white p-6 shadow-md">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                  <span aria-hidden="true" className="text-emerald-500">
                    📋
                  </span>
                  Assigned tasks
                </h2>
                <p className="text-sm text-slate-600 sm:text-base">
                  Quick-glance cards by department help teams act fast while on the move.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                <span aria-hidden="true">🧑‍🤝‍🧑</span>
                {scopedTaskCount} tasks
              </div>
            </header>

            {isLoadingTasks ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((placeholder) => (
                  <div
                    key={placeholder}
                    className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : scopedTaskCount === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                No tasks assigned yet.
              </p>
            ) : (
              <div className="grid gap-8">
                {scopedDepartments.map((department) => {
                  const departmentTasks = tasksByDepartment[department.id] ?? [];
                  if (departmentTasks.length === 0) {
                    return null;
                  }

                  return (
                    <div key={department.id} className="space-y-4">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                          <span aria-hidden="true">🏥</span>
                          {department.name}
                        </h3>
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                          <span aria-hidden="true">📍</span>
                          {department.ward} ward
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {departmentTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            isFocused={focusedTaskId === task.id}
                            onFocus={() => handleTaskFocus(task.id)}
                            onView={() => handleTaskAction('view', task)}
                            onUpload={() => handleTaskAction('upload', task)}
                            onComplete={() => handleTaskAction('complete', task)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDepartments.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                No departments match the selected filters.
              </div>
            ) : (
              filteredDepartments.map((department) => {
                const assignees = department.assignees
                  .map((assignment) => {
                    const match = DIRECTORY.find((assignee) => assignee.id === assignment.id);
                    return match ? { ...match, role: assignment.role } : null;
                  })
                  .filter((item): item is DirectoryAssignee & { role: Role } => item !== null);

                const departmentDominantStatus = getDominantStatus(department.statusSummary);

                return (
                  <article
                    key={department.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-emerald-600"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900">{department.name}</h2>
                          <p className="text-sm text-slate-600">{department.description}</p>
                        </div>
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          Ward: {department.ward}
                        </span>
                      </div>

                      <StatusSummaryList summary={department.statusSummary} dominantKey={departmentDominantStatus} />

                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Assigned team</h3>
                        {assignees.length === 0 ? (
                          <p className="text-sm text-slate-500">No assignees assigned yet.</p>
                        ) : (
                          <ul className="flex flex-wrap gap-2">
                            {assignees.map((assignee) => (
                              <li
                                key={assignee.id}
                                className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                              >
                                <span className="font-semibold">{assignee.name}</span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                                  {assignee.role}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEditDepartment(department)}
                        disabled={!canManageDepartments}
                        className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${
                          canManageDepartments
                            ? 'border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900'
                            : 'cursor-not-allowed border-slate-200 text-slate-400'
                        }`}
                      >
                        Edit department
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAssignmentManager(department)}
                        disabled={!canManageDepartments}
                        className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                          canManageDepartments
                            ? 'bg-slate-900 text-white hover:bg-slate-700'
                            : 'cursor-not-allowed bg-slate-200 text-slate-500'
                        }`}
                      >
                        Manage assignees & roles
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <footer className="py-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Meridian Compliance Automation. Built to help teams stay audit ready.
          </footer>
        </section>

        {isAddOpen && (
          <Dialog onClose={handleDialogClose} title="Add department" description="Capture a new department and record its compliance summary." variant="create">
            <DepartmentForm
              formState={departmentForm}
              onChange={handleDepartmentFieldChange}
              onSubmit={handleCreateDepartment}
              submitLabel="Create department"
              onCancel={handleDialogClose}
            />
          </Dialog>
        )}

        {isEditOpen && activeDepartment && (
          <Dialog
            onClose={handleDialogClose}
            title={`Edit ${activeDepartment.name}`}
            description={`Update the ${activeDepartment.ward} ward department details and status summary.`}
            variant={dominantStatus}
          >
            <DepartmentForm
              formState={departmentForm}
              onChange={handleDepartmentFieldChange}
              onSubmit={handleUpdateDepartment}
              submitLabel="Save changes"
              onCancel={handleDialogClose}
            />
          </Dialog>
        )}

        {isAssignmentOpen && activeDepartment && (
          <Dialog
            onClose={handleDialogClose}
            title={`Manage assignees for ${activeDepartment.name}`}
            description="Select the team responsible for this department and configure their roles."
            variant="assign"
          >
            <form className="flex flex-col gap-6" onSubmit={handleAssignmentsSubmit}>
              <div className="space-y-4">
                {DIRECTORY.map((assignee) => {
                  const draft = assignmentDraft[assignee.id];

                  return (
                    <div key={assignee.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{assignee.name}</h4>
                          <p className="text-xs text-slate-500">{assignee.email}</p>
                          <p className="text-xs text-slate-400">Wards: {assignee.wards.join(', ')}</p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            checked={draft?.active ?? false}
                            onChange={() => handleAssignmentToggle(assignee.id)}
                            aria-label={`Assign ${assignee.name} to ${activeDepartment.name}`}
                          />
                          Assigned
                        </label>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor={`role-${assignee.id}`}>
                          Role
                        </label>
                        <select
                          id={`role-${assignee.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                          value={draft?.role ?? 'Reviewer'}
                          onChange={(event) => handleAssignmentRoleChange(assignee.id, event.target.value as Role)}
                          disabled={!draft?.active}
                        >
                          <option value="Owner">Owner</option>
                          <option value="Reviewer">Reviewer</option>
                          <option value="Observer">Observer</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleDialogClose}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                >
                  Save assignments
                </button>
              </div>
            </form>
          </Dialog>
        )}

        {isExportOpen && (
          <Dialog
            onClose={handleCloseExportModal}
            title="Export compliance report"
            description="Select the data to include and download a shareable report for leadership."
            variant="export"
          >
            <form className="flex flex-col gap-6" onSubmit={handleExportSubmit}>
              <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Compliance categories
                </legend>
                {EXPORT_CATEGORIES.map((category) => {
                  const isChecked = exportCategories.includes(category.id);

                  return (
                    <label
                      key={category.id}
                      className={`flex items-start gap-3 rounded-lg border px-3 py-2 transition ${
                        isChecked ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleExportCategoryToggle(category.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>
                        <span className="block font-semibold text-slate-800">{category.label}</span>
                        <span className="block text-sm text-slate-500">{category.description}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4">
                <legend className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Format</legend>
                {(Object.keys(EXPORT_FORMAT_LABELS) as ReportFormat[]).map((format) => (
                  <label key={format} className="flex items-center gap-3 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="export-format"
                      value={format}
                      checked={exportFormat === format}
                      onChange={handleExportFormatChange}
                      className="h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-medium text-slate-800">{EXPORT_FORMAT_LABELS[format]}</span>
                  </label>
                ))}
              </fieldset>

              {exportError ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{exportError}</p>
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCloseExportModal}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExporting}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {isExporting ? 'Exporting…' : 'Download report'}
                </button>
              </div>
            </form>
          </Dialog>
        )}
      </main>
    </>
  );
}

type TaskCardProps = {
  task: Task;
  isFocused: boolean;
  onFocus: () => void;
  onView: () => void;
  onUpload: () => void;
  onComplete: () => void;
};

type MetricsSummaryCardsProps = {
  metrics: DashboardMetrics;
  scopeLabel: string;
};

function MetricsSummaryCards({ metrics, scopeLabel }: MetricsSummaryCardsProps) {
  const cards = [
    {
      label: 'Total tasks',
      value: metrics.totals.totalTasks.toLocaleString(),
      icon: '🗂️',
      tone: 'dark' as const,
      description: 'Tracked within this scope'
    },
    {
      label: 'Completion rate',
      value: `${metrics.totals.completionRate}%`,
      icon: '✅',
      tone: 'emerald' as const,
      description: 'Completed tasks versus total'
    },
    {
      label: 'Overdue tasks',
      value: metrics.totals.overdueTasks.toLocaleString(),
      icon: '⏳',
      tone: 'amber' as const,
      description: 'Tasks past their due date'
    },
    {
      label: 'Scope',
      value: scopeLabel,
      icon: '📍',
      tone: 'slate' as const,
      description: 'Context for these metrics'
    }
  ];

  const toneClasses: Record<typeof cards[number]['tone'], { container: string; label: string; description: string; value: string }> = {
    dark: {
      container: 'border-slate-900 bg-slate-900 text-white',
      label: 'text-slate-200',
      description: 'text-slate-300',
      value: 'text-white'
    },
    emerald: {
      container: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      label: 'text-emerald-600',
      description: 'text-emerald-500',
      value: 'text-emerald-700'
    },
    amber: {
      container: 'border-amber-200 bg-amber-50 text-amber-700',
      label: 'text-amber-600',
      description: 'text-amber-500',
      value: 'text-amber-700'
    },
    slate: {
      container: 'border-slate-200 bg-slate-50 text-slate-700',
      label: 'text-slate-500',
      description: 'text-slate-500',
      value: 'text-slate-700'
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const tone = toneClasses[card.tone];
        return (
          <div
            key={card.label}
            className={`flex h-full flex-col justify-between gap-2 rounded-xl border p-4 shadow-sm ${tone.container}`}
          >
            <span className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${tone.label}`}>
              <span aria-hidden="true">{card.icon}</span>
              {card.label}
            </span>
            <span className={`text-3xl font-bold ${tone.value}`}>{card.value}</span>
            <span className={`text-xs ${tone.description}`}>{card.description}</span>
          </div>
        );
      })}
    </div>
  );
}

type StatusBreakdownChartProps = {
  breakdown: DashboardMetrics['statusBreakdown'];
  isLoading: boolean;
};

function StatusBreakdownChart({ breakdown, isLoading }: StatusBreakdownChartProps) {
  const total = breakdown.reduce((acc, item) => acc + item.count, 0);

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 shadow-sm">
        No task status data available yet.
      </div>
    );
  }

  const data = {
    labels: breakdown.map((item) => STATUS_LABELS[item.status]),
    datasets: [
      {
        label: 'Tasks',
        data: breakdown.map((item) => item.count),
        backgroundColor: ['#0f172a', '#6366f1', '#22c55e', '#f59e0b', '#f87171'],
        borderWidth: 0
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true
        }
      }
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Status distribution</h3>
        {isLoading ? <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Refreshing…</span> : null}
      </div>
      <div className="h-64">
        <DoughnutChart data={data} options={options} />
      </div>
    </div>
  );
}

type TrendChartProps = {
  trends: DashboardMetrics['monthlyTrends'];
  isLoading: boolean;
};

function TrendChart({ trends, isLoading }: TrendChartProps) {
  if (trends.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 shadow-sm">
        No historical task data available to plot.
      </div>
    );
  }

  const labels = trends.map((item) => item.label);
  const inProgressSeries = trends.map((item) => item.pending + item.inProgress);
  const closedSeries = trends.map((item) => item.closed + item.skipped);

  const data = {
    labels,
    datasets: [
      {
        label: 'Completed',
        data: trends.map((item) => item.completed),
        backgroundColor: '#10b981'
      },
      {
        label: 'In progress',
        data: inProgressSeries,
        backgroundColor: '#6366f1'
      },
      {
        label: 'Closed/Skipped',
        data: closedSeries,
        backgroundColor: '#f59e0b'
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true
        }
      }
    },
    scales: {
      x: {
        stacked: true
      },
      y: {
        stacked: true,
        beginAtZero: true
      }
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-800">Monthly throughput</h3>
        {isLoading ? <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Refreshing…</span> : null}
      </div>
      <div className="h-64">
        <BarChart data={data} options={options} />
      </div>
    </div>
  );
}

type DepartmentPerformanceTableProps = {
  summaries: DashboardMetrics['departmentSummaries'];
};

function DepartmentPerformanceTable({ summaries }: DepartmentPerformanceTableProps) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 shadow-sm">
        No department-level metrics available yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
        <thead className="bg-slate-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-500">
              Department
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
              Total tasks
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
              Completion rate
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold uppercase tracking-wide text-slate-500">
              Overdue tasks
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {summaries.map((summary) => (
            <tr key={summary.departmentId}>
              <td className="px-4 py-3 font-medium text-slate-900">{summary.name}</td>
              <td className="px-4 py-3 text-right font-semibold">{summary.totalTasks.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-semibold">
                {summary.completionRate}%
              </td>
              <td className="px-4 py-3 text-right font-semibold text-amber-600">
                {summary.overdueTasks.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskCard({ task, isFocused, onFocus, onView, onUpload, onComplete }: TaskCardProps) {
  const statusMeta = TASK_STATUS_META[task.status];

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onFocus();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onFocus}
      onKeyDown={handleKeyDown}
      aria-pressed={isFocused}
      className={`flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        isFocused ? 'ring-emerald-500 ring-offset-2' : 'hover:-translate-y-0.5 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl"
          >
            {task.icon}
          </span>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
            <p className="text-sm text-slate-600">{task.summary}</p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusMeta.badgeClass}`}
        >
          <span aria-hidden="true">{statusMeta.icon}</span>
          {statusMeta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
          <span aria-hidden="true">⏰</span>
          Due {formatDueDate(task.dueDate)}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
          <span aria-hidden="true">📊</span>
          {task.progress}%
        </span>
      </div>

      <ProgressBar value={task.progress} accentClass={statusMeta.progressClass} />

      <div className="flex flex-wrap gap-2 pt-1">
        <CardActionButton label="View details" icon="👁️" tone="neutral" onClick={onView} />
        <CardActionButton label="Upload docs" icon="⬆️" tone="highlight" onClick={onUpload} />
        <CardActionButton label="Mark complete" icon="✅" tone="success" onClick={onComplete} />
      </div>
    </article>
  );
}

type CardActionButtonTone = 'neutral' | 'highlight' | 'success';

type CardActionButtonProps = {
  label: string;
  icon: string;
  tone: CardActionButtonTone;
  onClick: () => void;
};

function CardActionButton({ label, icon, tone, onClick }: CardActionButtonProps) {
  const toneClass: Record<CardActionButtonTone, string> = {
    neutral: 'bg-slate-900 text-white hover:bg-slate-700',
    highlight: 'bg-amber-500 text-white hover:bg-amber-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500'
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${toneClass[tone]}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

type ProgressBarProps = {
  value: number;
  accentClass: string;
};

function ProgressBar({ value, accentClass }: ProgressBarProps) {
  return (
    <div className="space-y-2" aria-label="Task progress">
      <div
        className="h-2 w-full rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function formatDueDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function extractFilenameFromDisposition(disposition: string) {
  const filenameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);

  if (filenameMatch && filenameMatch[1]) {
    const rawValue = filenameMatch[1].replace(/"/g, '');
    try {
      return decodeURIComponent(rawValue);
    } catch (error) {
      return rawValue;
    }
  }

  return 'compliance-report';
}

type DialogProps = {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  variant?: string;
};

function Dialog({ title, description, onClose, children, variant }: DialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{variantLabel(variant)}</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
            aria-label="Close dialog"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

type DepartmentFormProps = {
  formState: DepartmentFormState;
  onChange: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel: string;
  onCancel: () => void;
};

function DepartmentForm({ formState, onChange, onSubmit, submitLabel, onCancel }: DepartmentFormProps) {
  return (
    <form className="flex flex-col gap-6" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-700" htmlFor="department-name">
          <span className="font-semibold">Department name</span>
          <input
            id="department-name"
            name="name"
            value={formState.name}
            onChange={onChange}
            placeholder="e.g., Health Records"
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-700" htmlFor="department-ward">
          <span className="font-semibold">Ward</span>
          <input
            id="department-ward"
            name="ward"
            value={formState.ward}
            onChange={onChange}
            placeholder="e.g., Central"
            className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
            required
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm text-slate-700" htmlFor="department-description">
        <span className="font-semibold">Description</span>
        <textarea
          id="department-description"
          name="description"
          value={formState.description}
          onChange={onChange}
          placeholder="Summarize the department's compliance focus areas"
          className="min-h-[100px] rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </label>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 p-4">
        <legend className="px-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Status summary</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="department-onTrack"
            name="onTrack"
            label="On track"
            value={formState.onTrack}
            onChange={onChange}
          />
          <NumberField id="department-atRisk" name="atRisk" label="At risk" value={formState.atRisk} onChange={onChange} />
          <NumberField id="department-blocked" name="blocked" label="Blocked" value={formState.blocked} onChange={onChange} />
          <NumberField
            id="department-completed"
            name="completed"
            label="Completed"
            value={formState.completed}
            onChange={onChange}
          />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

type NumberFieldProps = {
  id: string;
  name: keyof Pick<DepartmentFormState, 'onTrack' | 'atRisk' | 'blocked' | 'completed'>;
  label: string;
  value: number;
  onChange: ChangeEventHandler<HTMLInputElement>;
};

function NumberField({ id, name, label, value, onChange }: NumberFieldProps) {
  return (
    <label className="flex flex-col gap-2 text-sm text-slate-700" htmlFor={id}>
      <span className="font-semibold">{label}</span>
      <input
        id={id}
        name={name}
        type="number"
        min={0}
        value={value}
        onChange={onChange}
        className="rounded-lg border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
    </label>
  );
}

type StatusSummaryListProps = {
  summary: StatusSummary;
  dominantKey: string;
};

function StatusSummaryList({ summary, dominantKey }: StatusSummaryListProps) {
  const items: Array<{
    key: keyof StatusSummary;
    label: string;
    count: number;
    accentClass: string;
  }> = [
    { key: 'onTrack', label: 'On track', count: summary.onTrack, accentClass: 'bg-emerald-100 text-emerald-700' },
    { key: 'atRisk', label: 'At risk', count: summary.atRisk, accentClass: 'bg-amber-100 text-amber-700' },
    { key: 'blocked', label: 'Blocked', count: summary.blocked, accentClass: 'bg-rose-100 text-rose-700' },
    { key: 'completed', label: 'Completed', count: summary.completed, accentClass: 'bg-slate-200 text-slate-700' }
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm transition ${
            dominantKey === item.key ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-700'
          }`}
        >
          <div>
            <dt className="font-semibold">{item.label}</dt>
            <dd className="text-xs text-slate-400">{dominantKey === item.key ? 'Primary focus' : 'Tasks'}</dd>
          </div>
          <span
            className={`inline-flex min-w-[2.5rem] justify-center rounded-full px-3 py-1 text-sm font-semibold ${
              dominantKey === item.key ? 'bg-white/10 text-white' : item.accentClass
            }`}
          >
            {item.count}
          </span>
        </div>
      ))}
    </dl>
  );
}

function getDominantStatus(summary: StatusSummary): keyof StatusSummary {
  const entries: Array<[keyof StatusSummary, number]> = [
    ['onTrack', summary.onTrack],
    ['atRisk', summary.atRisk],
    ['blocked', summary.blocked],
    ['completed', summary.completed]
  ];

  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

function variantLabel(variant?: string) {
  switch (variant) {
    case 'onTrack':
      return 'On track department';
    case 'atRisk':
      return 'At risk department';
    case 'blocked':
      return 'Blocked department';
    case 'completed':
      return 'Completed department';
    case 'assign':
      return 'Assignee management';
    case 'create':
      return 'New department';
    case 'export':
      return 'Report export';
    default:
      return 'Department update';
  }
}
