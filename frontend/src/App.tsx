import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';

const Grid = WidthProvider(Responsive);
type Priority = '상' | '중' | '하';
type Category = '이직' | '공부' | '프로젝트' | '개인';
type Task = { id: string; title: string; category: Category; priority: Priority; done: boolean; today: boolean };
type EventItem = { id: string; title: string; category: Category; date: string; detail: string };
type WidgetKey = 'today' | 'tasks' | 'upcoming' | 'notes';
type WidgetLayout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number; maxW?: number };
type LayoutMap = Record<string, WidgetLayout[]>;

const STORAGE = {
  layout: 'osis-tempo:layout:v1',
  tasks: 'osis-tempo:tasks:v1',
  notes: 'osis-tempo:notes:v1',
};

const DEFAULT_LAYOUT: LayoutMap = {
  lg: [
    { i: 'today', x: 0, y: 0, w: 10, h: 4, minW: 4, minH: 3 },
    { i: 'tasks', x: 0, y: 4, w: 4, h: 7, minW: 3, minH: 4 },
    { i: 'upcoming', x: 4, y: 4, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'notes', x: 0, y: 11, w: 10, h: 4, minW: 3, minH: 3 },
  ],
  md: [
    { i: 'today', x: 0, y: 0, w: 10, h: 4, minW: 4, minH: 3 },
    { i: 'tasks', x: 0, y: 4, w: 4, h: 7, minW: 3, minH: 4 },
    { i: 'upcoming', x: 4, y: 4, w: 6, h: 7, minW: 3, minH: 4 },
    { i: 'notes', x: 0, y: 11, w: 10, h: 4, minW: 3, minH: 3 },
  ],
  sm: [
    { i: 'today', x: 0, y: 0, w: 1, h: 4, minW: 1, maxW: 1, minH: 3 },
    { i: 'tasks', x: 0, y: 4, w: 1, h: 7, minW: 1, maxW: 1, minH: 4 },
    { i: 'upcoming', x: 0, y: 11, w: 1, h: 7, minW: 1, maxW: 1, minH: 4 },
    { i: 'notes', x: 0, y: 18, w: 1, h: 4, minW: 1, maxW: 1, minH: 3 },
  ],
  xs: [
    { i: 'today', x: 0, y: 0, w: 1, h: 4, minW: 1, maxW: 1, minH: 3 },
    { i: 'tasks', x: 0, y: 4, w: 1, h: 7, minW: 1, maxW: 1, minH: 4 },
    { i: 'upcoming', x: 0, y: 11, w: 1, h: 7, minW: 1, maxW: 1, minH: 4 },
    { i: 'notes', x: 0, y: 18, w: 1, h: 4, minW: 1, maxW: 1, minH: 3 },
  ],
};
const widgetKeys: WidgetKey[] = ['today', 'tasks', 'upcoming', 'notes'];
const seedTasks: Task[] = [
  { id: 'sample-1', title: 'Java / Spring Boot 학습', category: '공부', priority: '상', done: false, today: true },
  { id: 'sample-2', title: 'GitHub 프로젝트 정리', category: '프로젝트', priority: '중', done: false, today: true },
  { id: 'sample-3', title: '포트폴리오 상세 내용 작성', category: '이직', priority: '상', done: false, today: true },
  { id: 'sample-4', title: '독서 30분', category: '개인', priority: '하', done: true, today: true },
  { id: 'sample-5', title: 'OSIS.Tempo 프론트엔드 검토', category: '프로젝트', priority: '중', done: false, today: false },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const text = localStorage.getItem(key);
    return text ? JSON.parse(text) as T : fallback;
  } catch {
    return fallback;
  }
}
function loadLayouts(): LayoutMap {
  const saved = loadJson<unknown>(STORAGE.layout, null);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return structuredClone(DEFAULT_LAYOUT);
  for (const size of Object.keys(DEFAULT_LAYOUT)) {
    const items = (saved as Record<string, unknown>)[size];
    if (!Array.isArray(items) || items.length !== 4) return structuredClone(DEFAULT_LAYOUT);
    const ids = items.map(item => (item && typeof item === 'object' ? (item as { i?: unknown }).i : null));
    if (new Set(ids).size !== 4 || widgetKeys.some(key => !ids.includes(key))) return structuredClone(DEFAULT_LAYOUT);
    if (items.some(item => !item || typeof item !== 'object' ||
      ['x', 'y', 'w', 'h'].some(field => {
        const value = (item as Record<string, unknown>)[field];
        return typeof value !== 'number' || !Number.isInteger(value) ||
          value < (field === 'w' || field === 'h' ? 1 : 0);
      }))) return structuredClone(DEFAULT_LAYOUT);
  }
  return saved as LayoutMap;
}
function plusDays(days: number): string {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(date);
}
function dDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((target.getTime() - base.getTime()) / 86_400_000);
  return days === 0 ? 'D-DAY' : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
}
function Widget({ name, subtitle, editing, children, action }: {
  name: string; subtitle?: string; editing: boolean; children: ReactNode; action?: ReactNode;
}) {
  return <section className="tempo-widget">
    <header className={`widget-heading ${editing ? 'widget-handle' : ''}`}>
      <div className="widget-title-line">
        {editing && <span className="drag-grip" aria-hidden="true">⠿</span>}
        <div><h2>{name}</h2>{subtitle && <p>{subtitle}</p>}</div>
      </div>
      {action && <div className="widget-action" onPointerDown={event => event.stopPropagation()}>{action}</div>}
    </header>
    <div className="widget-body">{children}</div>
  </section>;
}

export default function App() {
  const [editing, setEditing] = useState(false);
  const [layouts, setLayouts] = useState<LayoutMap>(loadLayouts);
  const [tasks, setTasks] = useState<Task[]>(() => {
    const initial = loadJson<unknown>(STORAGE.tasks, seedTasks);
    return Array.isArray(initial) && initial.every(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.done === 'boolean')
      ? initial as Task[] : seedTasks;
  });
  const [notes, setNotes] = useState(() => loadJson<string>(STORAGE.notes, '오늘의 계획, 학습 기록, 아이디어를 자유롭게 작성하세요.'));
  const [newTask, setNewTask] = useState('');
  const [filter, setFilter] = useState<'전체' | Category>('전체');
  const [showForm, setShowForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const events: EventItem[] = useMemo(() => [
    { id: 'sample-event-1', title: '포트폴리오 검토', category: '이직', date: plusDays(2), detail: '프로젝트 소개 및 기술 스택 점검' },
    { id: 'sample-event-2', title: 'OSIS.Tempo 설계 정리', category: '프로젝트', date: plusDays(4), detail: '프론트엔드 화면과 데이터 흐름' },
    { id: 'sample-event-3', title: '학습 내용 복습', category: '공부', date: plusDays(7), detail: 'Spring Boot / TypeScript' },
    { id: 'sample-event-4', title: '개인 일정 확인', category: '개인', date: plusDays(12), detail: '준비물 및 시간 확인' },
  ], []);
  const todayTasks = tasks.filter(task => task.today);
  const doneCount = todayTasks.filter(task => task.done).length;
  const completion = todayTasks.length ? Math.round(doneCount / todayTasks.length * 100) : 0;
  const visibleTasks = filter === '전체' ? tasks : tasks.filter(task => task.category === filter);

  useEffect(() => { localStorage.setItem(STORAGE.layout, JSON.stringify(layouts)); }, [layouts]);
  useEffect(() => { localStorage.setItem(STORAGE.tasks, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem(STORAGE.notes, JSON.stringify(notes)); }, [notes]);

  function toggleTask(id: string) {
    setTasks(current => current.map(task => task.id === id ? { ...task, done: !task.done } : task));
  }
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newTask.trim();
    if (!title) return;
    setTasks(items => [...items, {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title,
      category: filter === '전체' ? '프로젝트' : filter, priority: '중', done: false, today: true,
    }]);
    setNewTask('');
    setShowForm(false);
  }
  function resetLayout() {
    if (!window.confirm('위젯 배치를 기본값으로 되돌리시겠습니까? 일정과 메모 데이터는 유지됩니다.')) return;
    setLayouts(structuredClone(DEFAULT_LAYOUT));
  }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand"><span className="brand-symbol">◩</span><span>OSIS.<em>Tempo</em></span></div>
      <div className="nav-section-label">WORKSPACE</div>
      <nav aria-label="메인 메뉴">
        <a href="#dashboard" className="nav-link active" onClick={() => setSidebarOpen(false)}>▦ <span>기록일지</span></a>
        <a href="#today" className="nav-link" onClick={() => setSidebarOpen(false)}>◉ <span>Today</span></a>
        <a href="#tasks" className="nav-link" onClick={() => setSidebarOpen(false)}>☑ <span>Tasks</span></a>
        <a href="#upcoming" className="nav-link" onClick={() => setSidebarOpen(false)}>▤ <span>Upcoming</span></a>
        <a href="#notes" className="nav-link" onClick={() => setSidebarOpen(false)}>▣ <span>Notes</span></a>
      </nav>
      <div className="sidebar-divider" />
      <div className="nav-section-label">내 분류</div>
      <div className="category-list">{(['이직', '공부', '프로젝트', '개인'] as Category[]).map(category =>
        <span key={category}><i className={`dot ${category}`}/>{category}</span>)}</div>
      <p className="sidebar-caption">나만의 일정을 한눈에.<br/>지금은 프론트엔드 데모입니다.</p>
    </aside>

    <div className="workspace" id="dashboard">
      <header className="topbar">
        <button type="button" className="menu-toggle" aria-label="메뉴 열기" onClick={() => setSidebarOpen(x => !x)}>☰</button>
        <div><strong>기록일지</strong><span className="topbar-divider">/</span><span>대시보드</span></div>
        <span className="topbar-tag">OSIS.Tempo · Preview</span>
      </header>
      <main className="main-content">
        <div className="page-intro">
          <div>
            <p className="eyebrow">MY DAILY WORKSPACE</p>
            <h1>오늘도 차근차근, 나의 템포대로.</h1>
            <p className="intro-subtitle">{formatDate(new Date())} · 할 일과 예정된 일정을 한눈에 확인하세요.</p>
          </div>
          <div className="toolbar">
            {editing && <button type="button" className="secondary-button" onClick={resetLayout}>↺ 기본 배치</button>}
            <button type="button" className={`primary-button ${editing ? 'editing' : ''}`} onClick={() => setEditing(x => !x)}>
              {editing ? '✓ 배치 저장' : '⠿ 레이아웃 편집'}
            </button>
          </div>
        </div>

        <div className="summary-row" aria-label="작업 요약">
          <div className="summary-item"><span>오늘 할 일</span><strong>{todayTasks.length}<small>건</small></strong></div>
          <div className="summary-item"><span>오늘 완료</span><strong>{doneCount}<small>건</small></strong></div>
          <div className="summary-item"><span>다가오는 일정</span><strong>{events.length}<small>건</small></strong></div>
          <div className="summary-item"><span>오늘 달성률</span><strong>{completion}<small>%</small></strong></div>
        </div>
        {editing && <div className="edit-banner" role="status">⠿ 위젯 제목을 잡아 이동하고, 오른쪽 아래 모서리에서 크기를 조절하세요. '배치 저장'을 누르면 편집을 종료합니다.</div>}

        <Grid
          className={`tempo-grid ${editing ? 'grid-editing' : ''}`}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 850, sm: 600, xs: 0 }}
          cols={{ lg: 10, md: 10, sm: 1, xs: 1 }}
          rowHeight={60}
          margin={[16, 16]}
          containerPadding={[0, 0]}
          draggableHandle=".widget-handle"
          isDraggable={editing}
          isResizable={editing}
          resizeHandles={['se']}
          onLayoutChange={(_current, next) => { if (editing) setLayouts(next); }}
        >
          <div key="today" id="today">
            <Widget name="Today" subtitle="오늘 해야 할 일" editing={editing} action={<span className="count-pill">{doneCount} / {todayTasks.length} 완료</span>}>
              <div className="today-grid">
                {todayTasks.length === 0 && <p className="empty-hint">오늘 할 일이 없습니다. Tasks에서 추가해 보세요.</p>}
                {todayTasks.map(task => <label key={task.id} className={`today-task ${task.done ? 'completed' : ''}`}>
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)}/>
                  <span className="today-task-title">{task.title}</span>
                  <span className={`category-chip ${task.category}`}>{task.category}</span>
                  <span className={`priority-chip priority-${task.priority}`}>{task.priority}</span>
                </label>)}
              </div>
              <div className="progress-wrap"><span>오늘 진행률</span><div className="progress-track"><div style={{ width: `${completion}%` }}/></div><strong>{completion}%</strong></div>
            </Widget>
          </div>

          <div key="tasks" id="tasks">
            <Widget name="Tasks" subtitle="분류별 할 일 · 작업 목록" editing={editing} action={
              <button type="button" className="small-button" onClick={() => setShowForm(value => !value)}>+ 작업</button>
            }>
              <div className="filter-strip">
                {(['전체', '이직', '공부', '프로젝트', '개인'] as const).map(item =>
                  <button type="button" key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}
              </div>
              {showForm && <form className="quick-add" onSubmit={addTask}>
                <input aria-label="새 작업 제목" value={newTask} onChange={event => setNewTask(event.target.value)} placeholder="새 작업 내용을 입력하세요" maxLength={100} autoFocus/>
                <button type="submit">추가</button>
              </form>}
              <div className="task-list">
                {visibleTasks.map(task => <label key={task.id} className={`task-row ${task.done ? 'completed' : ''}`}>
                  <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)}/>
                  <span className="task-row-main"><strong>{task.title}</strong><small>{task.category}</small></span>
                  <span className={`priority-chip priority-${task.priority}`}>{task.priority}</span>
                </label>)}
                {visibleTasks.length === 0 && <p className="empty-hint">해당 분류의 작업이 없습니다.</p>}
              </div>
            </Widget>
          </div>

          <div key="upcoming" id="upcoming">
            <Widget name="Upcoming" subtitle="다가오는 일정 · 주요 기한" editing={editing} action={<span className="count-pill">{events.length}건</span>}>
              <div className="upcoming-list">
                {events.map(event => <article className="upcoming-row" key={event.id}>
                  <div className="event-date"><strong>{event.date.slice(5)}</strong><small>{event.date.slice(0, 4)}</small></div>
                  <div className="event-details"><strong>{event.title}</strong><p>{event.detail}</p></div>
                  <span className={`category-chip ${event.category}`}>{event.category}</span>
                  <span className="dday-chip">{dDay(event.date)}</span>
                </article>)}
              </div>
              <p className="event-footnote">* 위 일정은 레이아웃 확인을 위한 샘플 데이터입니다.</p>
            </Widget>
          </div>

          <div key="notes" id="notes">
            <Widget name="Notes" subtitle="하루 기록 · 자유 메모" editing={editing} action={<span className="autosave-label">● 이 브라우저에 자동 저장</span>}>
              <textarea className="notes-input" aria-label="메모 입력" value={notes} onChange={event => setNotes(event.target.value)} placeholder="오늘의 기록을 작성해 보세요..." maxLength={10000}/>
            </Widget>
          </div>
        </Grid>
        <footer className="app-footer">OSIS.Tempo — 사용자 정의 대시보드 프로토타입 · 데이터는 현재 브라우저에만 보관됩니다.</footer>
      </main>
    </div>
  </div>;
}
