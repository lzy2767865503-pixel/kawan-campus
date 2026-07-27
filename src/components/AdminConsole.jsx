import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  FileText,
  Flag,
  KeyRound,
  Languages,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  UserRoundCog,
  X,
  XCircle,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  AdminApiError,
  createAdminSession,
  decideAdminClubApplication,
  deleteAdminSession,
  getAdminAuditLogs,
  getAdminClubs,
  getAdminOverview,
  getAdminPosts,
  getAdminReports,
  getAdminSession,
  resolveAdminReport,
  rotateAdminClubKey,
  updateAdminClubStatus,
  updateAdminPostStatus,
} from '../api/adminApi.js'
import '../admin.css'

const LANGUAGE_KEY = 'kawan-admin-language'

const translations = {
  zh: {
    product: 'Kawan Campus',
    console: '管理控制台',
    localOnly: '最高权限后台',
    overview: '总览',
    posts: '内容管理',
    reports: '举报审核',
    clubs: '社团权限',
    settings: '平台设置',
    audit: '管理员与审计',
    signOut: '退出登录',
    signOutFailed: '退出失败，当前安全会话仍然有效。请检查网络后重试。',
    language: '切换到 English',
    refresh: '刷新',
    loading: '正在读取服务器数据…',
    retry: '重新加载',
    empty: '当前没有需要显示的记录',
    emptyHint: '这里仅展示服务器中的真实数据。',
    requestFailed: '无法读取管理数据',
    checkingSession: '正在验证管理员会话…',
    loginTitle: '管理员安全登录',
    loginSubtitle: '登录后才可下架内容、处理举报和管理社团发布权限。',
    email: '管理员邮箱',
    emailPlaceholder: 'owner@kawancampus.local',
    password: '管理员访问密钥',
    passwordPlaceholder: '输入后台访问密钥',
    login: '进入管理控制台',
    signingIn: '正在安全登录…',
    loginSecurity: '身份与权限由服务器验证，浏览器不会保存管理员密码。',
    allSystems: '后台连接正常',
    operator: '当前管理员',
    noEmail: '已验证会话',
    overviewTitle: '今天最需要处理的事项',
    overviewSubtitle: '每个指标都可以直接进入对应工作队列。',
    pendingReports: '待处理举报',
    pendingReportsHint: '进入举报队列',
    livePosts: '公开帖子',
    livePostsHint: '管理公开内容',
    pendingClubs: '待审社团',
    pendingClubsHint: '审批发布权限',
    restrictedItems: '已限制内容',
    restrictedItemsHint: '检查或恢复',
    attention: '优先处理',
    attentionHint: '按风险与等待时间处理，不遗漏举报或授权申请。',
    recentActivity: '最近管理操作',
    recentActivityHint: '每一次敏感操作都由服务器记录。',
    goReports: '处理举报',
    goClubs: '审批社团',
    goPosts: '查看已下架内容',
    postTitle: '公开内容与下架记录',
    postSubtitle: '例如：发现“宿舍转租诈骗”时，点击下架后帖子会立即从前台消失。',
    searchPosts: '搜索标题、社团或帖子编号',
    statusAll: '全部状态',
    statusVisible: '公开中',
    statusHidden: '已下架',
    title: '内容',
    publisher: '发布者',
    category: '板块',
    status: '状态',
    reportsCount: '举报',
    updated: '最近更新',
    actions: '操作',
    takeDown: '立即下架',
    restore: '恢复公开',
    hidden: '已下架',
    visible: '公开中',
    operationFailed: '操作失败，服务器未保存变更。',
    postHidden: '帖子已下架，前台列表会立即移除。',
    postRestored: '帖子已恢复公开。',
    reportTitle: '举报审核队列',
    reportSubtitle: '例如：诈骗或隐私泄露举报可直接“下架并结案”，无效举报则驳回。',
    reportReason: '举报原因',
    reportedPost: '被举报内容',
    reporter: '举报来源',
    createdAt: '提交时间',
    hideResolve: '下架并结案',
    dismissReport: '驳回举报',
    resolved: '举报已结案。',
    reportDismissed: '举报已驳回，帖子保持原状态。',
    clubsTitle: '社团发布权限',
    clubsSubtitle: '例如：批准 UKM Chess Club 后生成一次性发布密钥；暂停后立即禁止继续发布。',
    pendingApplications: '待审申请',
    authorisedClubs: '已授权社团',
    applicant: '申请社团',
    contact: '负责人 / 联系方式',
    appliedAt: '申请时间',
    approve: '批准',
    reject: '拒绝',
    applicationApproved: '申请已批准。',
    applicationRejected: '申请已拒绝。',
    club: '社团',
    slug: '系统标识',
    lastActive: '最近活动',
    pause: '暂停权限',
    resume: '恢复权限',
    revoke: '撤销权限',
    rotateKey: '轮换密钥',
    active: '使用中',
    suspended: '已暂停',
    revoked: '已撤销',
    settingsTitle: '当前平台规则',
    settingsSubtitle: '例如：帖子保存期限、可发布板块和内容限制由服务器统一执行；此页面仅供核对。',
    readOnly: '只读',
    noRules: '服务器当前没有返回可展示的平台规则。',
    auditTitle: '管理员身份与不可变审计记录',
    auditSubtitle: '例如：谁在何时下架帖子、批准社团或轮换密钥，都能在这里追溯。',
    sessionSecurity: '当前会话',
    role: '角色',
    authenticatedAt: '验证时间',
    sessionExpires: '会话到期',
    auditTimeline: '操作时间线',
    actor: '操作者',
    target: '对象',
    confirmTitle: '确认高风险操作',
    confirmFallback: '此操作会立即改变平台权限或公开状态。',
    reason: '操作原因',
    reasonPlaceholder: '记录判断依据，便于后续审计',
    note: '审核备注',
    notePlaceholder: '可选：填写审批或驳回依据',
    cancel: '取消',
    confirm: '确认执行',
    requiredReason: '请先填写操作原因。',
    oneTimeKeyTitle: '一次性社团发布密钥',
    oneTimeKeyHint: '该密钥关闭窗口后不会再次显示。请通过安全渠道交给社团负责人。',
    copyKey: '复制密钥',
    copied: '已复制',
    closeAndForget: '我已保存，关闭并清除',
    rotateWarning: '轮换后旧密钥和旧会话将立即失效。',
    revokeWarning: '撤销后该社团将无法继续发布，现有会话同时失效。',
    pauseWarning: '暂停后该社团将立即无法发布新内容。',
    rejectWarning: '拒绝后申请不会获得发布权限。',
    hideWarning: '帖子将立即从公开信息流中消失。',
    unknown: '未知',
    records: '条记录',
    previousPage: '上一页',
    nextPage: '下一页',
    resultRange: '当前',
  },
  en: {
    product: 'Kawan Campus',
    console: 'Admin Console',
    localOnly: 'Privileged operations',
    overview: 'Overview',
    posts: 'Content',
    reports: 'Reports',
    clubs: 'Club access',
    settings: 'Platform settings',
    audit: 'Admins & audit',
    signOut: 'Sign out',
    signOutFailed: 'Sign-out failed and the secure session is still active. Check the network and try again.',
    language: '切换到中文',
    refresh: 'Refresh',
    loading: 'Loading live server data…',
    retry: 'Try again',
    empty: 'No records to display',
    emptyHint: 'Only real records returned by the server appear here.',
    requestFailed: 'Admin data could not be loaded',
    checkingSession: 'Verifying the admin session…',
    loginTitle: 'Secure admin sign-in',
    loginSubtitle: 'Sign in to moderate content, resolve reports and control club publishing access.',
    email: 'Admin email',
    emailPlaceholder: 'owner@kawancampus.local',
    password: 'Admin access key',
    passwordPlaceholder: 'Enter the admin access key',
    login: 'Open admin console',
    signingIn: 'Signing in securely…',
    loginSecurity: 'Identity and permissions are verified by the server. The browser never stores the password.',
    allSystems: 'Admin service connected',
    operator: 'Current administrator',
    noEmail: 'Verified session',
    overviewTitle: 'What needs action today',
    overviewSubtitle: 'Each metric opens the corresponding work queue.',
    pendingReports: 'Pending reports',
    pendingReportsHint: 'Open review queue',
    livePosts: 'Public posts',
    livePostsHint: 'Manage live content',
    pendingClubs: 'Club applications',
    pendingClubsHint: 'Review publishing access',
    restrictedItems: 'Restricted posts',
    restrictedItemsHint: 'Review or restore',
    attention: 'Priority queue',
    attentionHint: 'Work by risk and waiting time so reports and access requests are not missed.',
    recentActivity: 'Recent admin activity',
    recentActivityHint: 'Every sensitive operation is recorded by the server.',
    goReports: 'Review reports',
    goClubs: 'Review clubs',
    goPosts: 'View restricted posts',
    postTitle: 'Live content and takedown history',
    postSubtitle: 'Example: when a “hostel sublet scam” appears, one click removes it from the public feed.',
    searchPosts: 'Search title, club or post ID',
    statusAll: 'All statuses',
    statusVisible: 'Public',
    statusHidden: 'Taken down',
    title: 'Content',
    publisher: 'Publisher',
    category: 'Category',
    status: 'Status',
    reportsCount: 'Reports',
    updated: 'Last updated',
    actions: 'Action',
    takeDown: 'Take down now',
    restore: 'Restore',
    hidden: 'Taken down',
    visible: 'Public',
    operationFailed: 'The operation failed and was not saved.',
    postHidden: 'Post taken down and removed from the public feed.',
    postRestored: 'Post restored to the public feed.',
    reportTitle: 'Report review queue',
    reportSubtitle: 'Example: use “Take down & resolve” for scams or exposed private data; dismiss invalid reports.',
    reportReason: 'Reason',
    reportedPost: 'Reported content',
    reporter: 'Report source',
    createdAt: 'Submitted',
    hideResolve: 'Take down & resolve',
    dismissReport: 'Dismiss report',
    resolved: 'Report resolved.',
    reportDismissed: 'Report dismissed; the post remains unchanged.',
    clubsTitle: 'Club publishing access',
    clubsSubtitle: 'Example: approving UKM Chess Club creates a one-time key; pausing blocks new posts immediately.',
    pendingApplications: 'Pending applications',
    authorisedClubs: 'Authorised clubs',
    applicant: 'Applicant club',
    contact: 'Owner / contact',
    appliedAt: 'Applied',
    approve: 'Approve',
    reject: 'Reject',
    applicationApproved: 'Application approved.',
    applicationRejected: 'Application rejected.',
    club: 'Club',
    slug: 'System slug',
    lastActive: 'Last activity',
    pause: 'Pause access',
    resume: 'Resume access',
    revoke: 'Revoke access',
    rotateKey: 'Rotate key',
    active: 'Active',
    suspended: 'Suspended',
    revoked: 'Revoked',
    settingsTitle: 'Current platform rules',
    settingsSubtitle: 'Example: retention, permitted categories and content limits are enforced by the server; this page is read-only.',
    readOnly: 'Read only',
    noRules: 'The server did not return any displayable platform rules.',
    auditTitle: 'Admin identity and immutable audit trail',
    auditSubtitle: 'Example: see who took down a post, approved a club or rotated a key, and exactly when.',
    sessionSecurity: 'Current session',
    role: 'Role',
    authenticatedAt: 'Authenticated',
    sessionExpires: 'Session expires',
    auditTimeline: 'Audit timeline',
    actor: 'Actor',
    target: 'Target',
    confirmTitle: 'Confirm sensitive operation',
    confirmFallback: 'This operation immediately changes platform access or public content.',
    reason: 'Reason',
    reasonPlaceholder: 'Record the decision basis for the audit trail',
    note: 'Review note',
    notePlaceholder: 'Optional: add the approval or rejection basis',
    cancel: 'Cancel',
    confirm: 'Confirm operation',
    requiredReason: 'Enter a reason before continuing.',
    oneTimeKeyTitle: 'One-time club publishing key',
    oneTimeKeyHint: 'This key will not be shown again after the window closes. Share it through a secure channel.',
    copyKey: 'Copy key',
    copied: 'Copied',
    closeAndForget: 'Saved — close and clear',
    rotateWarning: 'The old key and existing sessions become invalid immediately.',
    revokeWarning: 'The club loses publishing access and all existing sessions immediately.',
    pauseWarning: 'The club will immediately be unable to publish new content.',
    rejectWarning: 'The application will not receive publishing access.',
    hideWarning: 'The post disappears from the public feed immediately.',
    unknown: 'Unknown',
    records: 'records',
    previousPage: 'Previous',
    nextPage: 'Next',
    resultRange: 'Showing',
  },
}

const navigation = [
  { id: 'overview', icon: LayoutDashboard, roles: ['owner', 'moderator', 'club_reviewer', 'analyst'] },
  { id: 'posts', icon: FileText, roles: ['owner', 'moderator', 'analyst'] },
  { id: 'reports', icon: Flag, roles: ['owner', 'moderator', 'analyst'] },
  { id: 'clubs', icon: Building2, roles: ['owner', 'club_reviewer', 'analyst'] },
  { id: 'settings', icon: Settings, roles: ['owner', 'moderator', 'club_reviewer', 'analyst'] },
  { id: 'audit', icon: UserRoundCog, roles: ['owner', 'analyst'] },
]

function getStoredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

function rootRecord(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : payload
}

function extractList(payload, keys) {
  if (Array.isArray(payload)) return payload
  const roots = [payload, payload?.data].filter(Boolean)

  for (const root of roots) {
    if (Array.isArray(root)) return root
    for (const key of keys) {
      if (Array.isArray(root?.[key])) return root[key]
    }
  }

  return []
}

function extractRecord(payload, keys = []) {
  const root = rootRecord(payload)
  for (const key of keys) {
    if (root?.[key] && typeof root[key] === 'object') return root[key]
  }
  return root
}

function firstDefined(record, keys, fallback = undefined) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record?.[key] !== null) return record[key]
  }
  return fallback
}

function formatDate(value, lang, withTime = true) {
  if (!value) return '—'
  const numeric = Number(value)
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value)

  if (Number.isNaN(date.getTime())) return String(value)

  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date)
}

function postStatus(post) {
  return String(firstDefined(post, ['status', 'visibility'], 'visible')).toLowerCase()
}

function isPostHidden(post) {
  return ['hidden', 'removed', 'unpublished', 'blocked'].includes(postStatus(post))
}

function humanStatus(status, t) {
  const value = String(status || '').toLowerCase()
  if (['hidden', 'removed', 'unpublished', 'blocked'].includes(value)) return t.hidden
  if (['active', 'approved'].includes(value)) return t.active
  if (['suspended', 'paused'].includes(value)) return t.suspended
  if (['revoked', 'rejected'].includes(value)) return t.revoked
  return t.visible
}

function ResourceState({ state, t, onRetry, children }) {
  if (state.loading) {
    return (
      <div className="kc-admin-state" role="status">
        <LoaderCircle className="kc-admin-spin" size={24} />
        <strong>{t.loading}</strong>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="kc-admin-state kc-admin-state-error" role="alert">
        <AlertTriangle size={25} />
        <strong>{t.requestFailed}</strong>
        <p>{state.error}</p>
        <button type="button" className="kc-admin-button kc-admin-button-secondary" onClick={onRetry}>
          <RefreshCw size={16} />
          {t.retry}
        </button>
      </div>
    )
  }

  return children
}

function EmptyState({ t, label }) {
  return (
    <div className="kc-admin-empty">
      <CheckCircle2 size={28} />
      <strong>{label || t.empty}</strong>
      <p>{t.emptyHint}</p>
    </div>
  )
}

function Pagination({ payload, t, onPage }) {
  const root = rootRecord(payload)
  const total = Number(root.total ?? 0)
  const limit = Math.max(1, Number(root.limit ?? 50))
  const offset = Math.max(0, Number(root.offset ?? 0))
  if (!Number.isFinite(total) || total <= limit && offset === 0) return null

  const first = total ? offset + 1 : 0
  const last = Math.min(total, offset + limit)
  return (
    <nav className="kc-admin-pagination" aria-label={`${t.resultRange} ${first}-${last}`}>
      <span>{t.resultRange} {first}–{last} / {total}</span>
      <div>
        <button type="button" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>
          <ChevronLeft size={16} />
          {t.previousPage}
        </button>
        <button type="button" disabled={offset + limit >= total} onClick={() => onPage(offset + limit)}>
          {t.nextPage}
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  )
}

function BrandMark() {
  return <img className="kc-admin-brand-mark" src="/favicon.svg" alt="" aria-hidden="true" />
}

function StatusBadge({ value, t }) {
  const normalized = String(value || 'visible').toLowerCase()
  return (
    <span className={`kc-admin-status kc-admin-status-${normalized}`}>
      {humanStatus(normalized, t)}
    </span>
  )
}

function PageHeading({ title, subtitle, badge }) {
  return (
    <div className="kc-admin-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {badge ? <span className="kc-admin-readonly">{badge}</span> : null}
    </div>
  )
}

function useDialogFocus(containerRef, identity, onEscape) {
  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape

  useEffect(() => {
    if (!identity || !containerRef.current) return undefined
    const previousFocus = document.activeElement
    const container = containerRef.current
    const focusableSelector = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(container.querySelectorAll(focusableSelector))
    const initialFocus = container.querySelector('[data-dialog-autofocus]') || focusables()[0]
    const focusFrame = window.requestAnimationFrame(() => initialFocus?.focus())

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault()
        escapeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        event.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [containerRef, identity])
}

function ActionDialog({
  action,
  t,
  onCancel,
  onConfirm,
}) {
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState('')
  const dialogRef = useRef(null)
  const requiresReason = action?.requiresReason !== false
  useDialogFocus(dialogRef, action?.id, () => {
    if (!action?.busy) onCancel()
  })

  if (!action) return null

  const submit = (event) => {
    event.preventDefault()
    if (requiresReason && !note.trim()) {
      setValidation(t.requiredReason)
      return
    }
    onConfirm(note.trim())
  }

  return (
    <div className="kc-admin-modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !action.busy) onCancel()
    }}>
      <form ref={dialogRef} className="kc-admin-dialog" role="dialog" aria-modal="true" aria-labelledby="kc-admin-confirm-title" onSubmit={submit}>
        <div className={`kc-admin-dialog-icon ${action.danger ? 'danger' : ''}`}>
          {action.danger ? <AlertTriangle size={23} /> : <ShieldCheck size={23} />}
        </div>
        <h2 id="kc-admin-confirm-title">{action.title || t.confirmTitle}</h2>
        <p>{action.description || t.confirmFallback}</p>
        <label className="kc-admin-field">
          <span>{action.noteLabel || (requiresReason ? t.reason : t.note)}</span>
          <textarea
            autoFocus
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
              setValidation('')
            }}
            placeholder={action.placeholder || (requiresReason ? t.reasonPlaceholder : t.notePlaceholder)}
            rows={3}
          />
        </label>
        {validation ? <p className="kc-admin-inline-error">{validation}</p> : null}
        <div className="kc-admin-dialog-actions">
          <button type="button" className="kc-admin-button kc-admin-button-secondary" onClick={onCancel} disabled={action.busy}>
            {t.cancel}
          </button>
          <button type="submit" className={`kc-admin-button ${action.danger ? 'kc-admin-button-danger' : 'kc-admin-button-primary'}`} disabled={action.busy}>
            {action.busy ? <LoaderCircle className="kc-admin-spin" size={17} /> : action.icon}
            {action.confirmLabel || t.confirm}
          </button>
        </div>
      </form>
    </div>
  )
}

function OneTimeKeyDialog({ credential, t, onClose, onToast }) {
  const [copied, setCopied] = useState(false)
  const dialogRef = useRef(null)
  useDialogFocus(dialogRef, credential?.id, null)
  if (!credential) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(credential.key)
      setCopied(true)
      onToast(t.copied)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="kc-admin-modal-layer" role="presentation">
      <section ref={dialogRef} className="kc-admin-dialog kc-admin-key-dialog" role="dialog" aria-modal="true" aria-labelledby="kc-admin-key-title">
        <div className="kc-admin-dialog-icon">
          <KeyRound size={23} />
        </div>
        <h2 id="kc-admin-key-title">{t.oneTimeKeyTitle}</h2>
        <p>{t.oneTimeKeyHint}</p>
        <div className="kc-admin-secret" aria-label={t.oneTimeKeyTitle}>
          <code>{credential.key}</code>
        </div>
        <div className="kc-admin-dialog-actions kc-admin-dialog-actions-stack">
          <button type="button" className="kc-admin-button kc-admin-button-secondary" data-dialog-autofocus onClick={copy}>
            {copied ? <Check size={17} /> : <Clipboard size={17} />}
            {copied ? t.copied : t.copyKey}
          </button>
          <button type="button" className="kc-admin-button kc-admin-button-primary" onClick={onClose}>
            {t.closeAndForget}
          </button>
        </div>
      </section>
    </div>
  )
}

function LoginScreen({ lang, setLang, t, onAuthenticated }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const response = await createAdminSession({ email: email.trim(), accessKey: password })
      onAuthenticated(extractRecord(response, ['session', 'admin']))
      setPassword('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="kc-admin-login">
      <section className="kc-admin-login-panel">
        <div className="kc-admin-login-brand">
          <BrandMark />
          <div>
            <strong>{t.product}</strong>
            <span>{t.console}</span>
          </div>
        </div>
        <button type="button" className="kc-admin-language-button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          <Languages size={18} />
          {t.language}
        </button>

        <div className="kc-admin-login-icon">
          <LockKeyhole size={28} />
        </div>
        <h1>{t.loginTitle}</h1>
        <p>{t.loginSubtitle}</p>

        <form onSubmit={submit}>
          <label className="kc-admin-field">
            <span>{t.email}</span>
            <input
              required
              type="email"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t.emailPlaceholder}
            />
          </label>
          <label className="kc-admin-field">
            <span>{t.password}</span>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t.passwordPlaceholder}
            />
          </label>
          {error ? <p className="kc-admin-login-error" role="alert">{error}</p> : null}
          <button type="submit" className="kc-admin-button kc-admin-button-primary kc-admin-login-submit" disabled={busy}>
            {busy ? <LoaderCircle className="kc-admin-spin" size={18} /> : <ShieldCheck size={18} />}
            {busy ? t.signingIn : t.login}
          </button>
        </form>

        <div className="kc-admin-login-security">
          <ShieldCheck size={18} />
          <span>{t.loginSecurity}</span>
        </div>
      </section>
    </div>
  )
}

function AdminSidebar({ active, setActive, items, t, onLogout }) {
  return (
    <aside className="kc-admin-sidebar">
      <div className="kc-admin-sidebar-brand">
        <BrandMark />
        <div>
          <strong>{t.product}</strong>
          <span>{t.console}</span>
        </div>
      </div>
      <nav aria-label={t.console}>
        {items.map(({ id, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={active === id ? 'active' : ''}
            onClick={() => setActive(id)}
            aria-current={active === id ? 'page' : undefined}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{t[id]}</span>
            {active === id ? <ChevronRight className="kc-admin-nav-chevron" size={16} /> : null}
          </button>
        ))}
      </nav>
      <div className="kc-admin-sidebar-security">
        <ShieldCheck size={18} />
        <div>
          <strong>{t.localOnly}</strong>
          <span>{t.allSystems}</span>
        </div>
      </div>
      <button type="button" className="kc-admin-signout" onClick={onLogout}>
        <LogOut size={18} />
        {t.signOut}
      </button>
    </aside>
  )
}

function AdminTopbar({ active, setActive, items, lang, setLang, t, session, refreshing, onRefresh, onLogout }) {
  const email = firstDefined(session, ['email', 'actorEmail', 'adminEmail'], t.noEmail)
  const role = firstDefined(session, ['role', 'adminRole'], 'Admin')

  return (
    <header className="kc-admin-topbar">
      <div className="kc-admin-mobile-brand">
        <BrandMark />
        <strong>{t.product}</strong>
      </div>
      <label className="kc-admin-mobile-nav">
        <span className="kc-admin-visually-hidden">{t.console}</span>
        <select value={active} onChange={(event) => setActive(event.target.value)}>
          {items.map(({ id }) => <option key={id} value={id}>{t[id]}</option>)}
        </select>
      </label>
      <div className="kc-admin-connection">
        <Activity size={17} />
        <span>{t.allSystems}</span>
      </div>
      <div className="kc-admin-top-actions">
        <button type="button" className="kc-admin-icon-button" onClick={onRefresh} aria-label={t.refresh} title={t.refresh} disabled={refreshing}>
          <RefreshCw className={refreshing ? 'kc-admin-spin' : ''} size={18} />
        </button>
        <button type="button" className="kc-admin-language-button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
          <Languages size={17} />
          <span>{lang === 'zh' ? 'EN' : '中文'}</span>
        </button>
        <button type="button" className="kc-admin-icon-button kc-admin-mobile-signout" onClick={onLogout} aria-label={t.signOut} title={t.signOut}>
          <LogOut size={18} />
        </button>
        <div className="kc-admin-identity">
          <span>{String(email).slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{email}</strong>
            <small>{role}</small>
          </div>
        </div>
      </div>
    </header>
  )
}

function OverviewPage({ state, t, lang, navigate, availableIds, onRetry }) {
  const overviewRoot = extractRecord(state.data, ['overview'])
  const overview = extractRecord(overviewRoot, ['metrics'])
  const audit = extractList(state.audit, ['auditLogs', 'logs', 'items']).slice(0, 6)

  const cards = [
    {
      key: 'pendingReports',
      icon: Flag,
      value: firstDefined(overview, ['pendingReports', 'pendingReportCount', 'reportsPending']),
      title: t.pendingReports,
      hint: t.pendingReportsHint,
      target: 'reports',
      tone: 'danger',
    },
    {
      key: 'livePosts',
      icon: FileText,
      value: firstDefined(overview, ['livePosts', 'publishedPosts', 'visiblePosts', 'totalPublishedPosts']),
      title: t.livePosts,
      hint: t.livePostsHint,
      target: 'posts',
      tone: 'green',
    },
    {
      key: 'pendingClubs',
      icon: Building2,
      value: firstDefined(overview, ['pendingClubs', 'pendingClubApplications', 'clubApplicationsPending']),
      title: t.pendingClubs,
      hint: t.pendingClubsHint,
      target: 'clubs',
      tone: 'amber',
    },
    {
      key: 'restrictedItems',
      icon: Ban,
      value: firstDefined(overview, ['hiddenPosts', 'restrictedPosts', 'takenDownPosts']),
      title: t.restrictedItems,
      hint: t.restrictedItemsHint,
      target: 'posts',
      tone: 'slate',
    },
  ]

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.overviewTitle} subtitle={t.overviewSubtitle} />
      <div className="kc-admin-kpi-grid">
        {cards.filter(({ target }) => availableIds.has(target)).map(({ key, icon: Icon, value, title, hint, target, tone }) => (
          <button type="button" className={`kc-admin-kpi kc-admin-kpi-${tone}`} key={key} onClick={() => navigate(target)}>
            <span className="kc-admin-kpi-icon"><Icon size={21} /></span>
            <span className="kc-admin-kpi-value">{value ?? '—'}</span>
            <strong>{title}</strong>
            <small>{hint}</small>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      <div className="kc-admin-overview-grid">
        <section className="kc-admin-panel">
          <div className="kc-admin-panel-heading">
            <div>
              <h2>{t.attention}</h2>
              <p>{t.attentionHint}</p>
            </div>
          </div>
          <div className="kc-admin-action-list">
            {availableIds.has('reports') ? <button type="button" onClick={() => navigate('reports')}>
              <span className="danger"><Flag size={18} /></span>
              <div><strong>{t.pendingReports}</strong><small>{firstDefined(overview, ['pendingReports', 'pendingReportCount', 'reportsPending'], '—')}</small></div>
              <span>{t.goReports}</span>
              <ChevronRight size={17} />
            </button> : null}
            {availableIds.has('clubs') ? <button type="button" onClick={() => navigate('clubs')}>
              <span className="amber"><Building2 size={18} /></span>
              <div><strong>{t.pendingClubs}</strong><small>{firstDefined(overview, ['pendingClubs', 'pendingClubApplications', 'clubApplicationsPending'], '—')}</small></div>
              <span>{t.goClubs}</span>
              <ChevronRight size={17} />
            </button> : null}
            {availableIds.has('posts') ? <button type="button" onClick={() => navigate('posts')}>
              <span><Ban size={18} /></span>
              <div><strong>{t.restrictedItems}</strong><small>{firstDefined(overview, ['hiddenPosts', 'restrictedPosts', 'takenDownPosts'], '—')}</small></div>
              <span>{t.goPosts}</span>
              <ChevronRight size={17} />
            </button> : null}
          </div>
        </section>
        <section className="kc-admin-panel">
          <div className="kc-admin-panel-heading">
            <div>
              <h2>{t.recentActivity}</h2>
              <p>{t.recentActivityHint}</p>
            </div>
          </div>
          {audit.length ? (
            <div className="kc-admin-mini-audit">
              {audit.map((item, index) => (
                <div key={firstDefined(item, ['id', 'requestId'], index)}>
                  <span />
                  <div>
                    <strong>{firstDefined(item, ['action', 'event', 'type'], t.unknown)}</strong>
                    <small>{firstDefined(item, ['actorEmail', 'actor', 'adminEmail', 'actorUserId', 'actorRole'], t.unknown)} · {formatDate(firstDefined(item, ['createdAt', 'timestamp', 'time']), lang)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState t={t} />}
        </section>
      </div>
    </ResourceState>
  )
}

function PostsPage({
  state,
  setState,
  t,
  lang,
  search,
  onSearch,
  filter,
  onFilter,
  onRetry,
  onToast,
  onUnauthorized,
  onPage,
}) {
  const [busyId, setBusyId] = useState('')
  const posts = extractList(state.data, ['posts', 'items'])

  const updateLocalPost = (postId, update) => {
    setState((current) => {
      const root = rootRecord(current.data)
      const key = Array.isArray(root.posts) ? 'posts' : Array.isArray(root.items) ? 'items' : 'posts'
      const currentList = extractList(current.data, ['posts', 'items'])
      return {
        ...current,
        data: {
          ...root,
          [key]: currentList.map((post) => String(firstDefined(post, ['id', 'postId'])) === String(postId)
            ? { ...post, ...update }
            : post),
        },
      }
    })
  }

  const changeStatus = async (post) => {
    const postId = firstDefined(post, ['id', 'postId'])
    const oldStatus = postStatus(post)
    const nextStatus = isPostHidden(post) ? 'published' : 'hidden'
    setBusyId(String(postId))
    updateLocalPost(postId, { status: nextStatus })

    try {
      const response = await updateAdminPostStatus(postId, {
        status: nextStatus,
        reason: nextStatus === 'hidden' ? 'Admin quick takedown' : 'Admin restored content',
        expectedVersion: firstDefined(post, ['version', 'rowVersion', 'updatedAt']),
      })
      const updated = extractRecord(response, ['post'])
      updateLocalPost(postId, Object.keys(updated).length ? updated : { status: nextStatus })
      onToast(nextStatus === 'hidden' ? t.postHidden : t.postRestored)
    } catch (error) {
      updateLocalPost(postId, { status: oldStatus })
      if (error instanceof AdminApiError && error.status === 401) onUnauthorized()
      onToast(error.message || t.operationFailed, 'error')
    } finally {
      setBusyId('')
    }
  }

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.postTitle} subtitle={t.postSubtitle} />
      <section className="kc-admin-panel kc-admin-table-panel">
        <div className="kc-admin-toolbar">
          <label className="kc-admin-search">
            <Search size={17} />
            <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t.searchPosts} />
          </label>
          <label className="kc-admin-filter">
            <span className="kc-admin-visually-hidden">{t.status}</span>
            <select value={filter} onChange={(event) => onFilter(event.target.value)}>
              <option value="all">{t.statusAll}</option>
              <option value="visible">{t.statusVisible}</option>
              <option value="hidden">{t.statusHidden}</option>
            </select>
          </label>
          <span className="kc-admin-record-count">{posts.length} / {Number(rootRecord(state.data).total ?? posts.length)} {t.records}</span>
        </div>
        {posts.length ? (
          <div className="kc-admin-table-scroll">
            <table className="kc-admin-table">
              <thead>
                <tr>
                  <th>{t.title}</th>
                  <th>{t.publisher}</th>
                  <th>{t.category}</th>
                  <th>{t.status}</th>
                  <th>{t.reportsCount}</th>
                  <th>{t.updated}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post, index) => {
                  const postId = firstDefined(post, ['id', 'postId'], index)
                  const hidden = isPostHidden(post)
                  return (
                    <tr key={postId}>
                      <td data-label={t.title}>
                        <strong className="kc-admin-primary-cell">{firstDefined(post, ['title', 'titleZh', 'titleEn'], t.unknown)}</strong>
                        <small>{postId}</small>
                      </td>
                      <td data-label={t.publisher}>{firstDefined(post, ['clubName', 'publisherName', 'publisher', 'author'], '—')}</td>
                      <td data-label={t.category}>{firstDefined(post, ['category', 'categoryName'], '—')}</td>
                      <td data-label={t.status}><StatusBadge value={postStatus(post)} t={t} /></td>
                      <td data-label={t.reportsCount}>{firstDefined(post, ['reportCount', 'reportsCount'], '—')}</td>
                      <td data-label={t.updated}>{formatDate(firstDefined(post, ['moderatedAt', 'updatedAt', 'createdAt']), lang)}</td>
                      <td data-label={t.actions}>
                        <button
                          type="button"
                          className={`kc-admin-row-action ${hidden ? '' : 'danger'}`}
                          disabled={busyId === String(postId)}
                          onClick={() => changeStatus(post)}
                          title={hidden ? t.restore : t.hideWarning}
                        >
                          {busyId === String(postId)
                            ? <LoaderCircle className="kc-admin-spin" size={16} />
                            : hidden ? <RotateCcw size={16} /> : <Ban size={16} />}
                          {hidden ? t.restore : t.takeDown}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState t={t} />}
        <Pagination payload={state.data} t={t} onPage={onPage} />
      </section>
    </ResourceState>
  )
}

function ReportsPage({ state, setState, t, lang, onRetry, onToast, onUnauthorized, onPage }) {
  const [busyId, setBusyId] = useState('')
  const reports = extractList(state.data, ['reports', 'items']).filter((report) => {
    const status = String(firstDefined(report, ['status'], 'pending')).toLowerCase()
    return !['resolved', 'dismissed', 'closed'].includes(status)
  })

  const removeReport = (reportId) => {
    setState((current) => {
      const root = rootRecord(current.data)
      const key = Array.isArray(root.reports) ? 'reports' : Array.isArray(root.items) ? 'items' : 'reports'
      return {
        ...current,
        data: {
          ...root,
          [key]: extractList(current.data, ['reports', 'items'])
            .filter((item) => String(firstDefined(item, ['id', 'reportId'])) !== String(reportId)),
          total: Math.max(0, Number(root.total ?? 1) - 1),
        },
      }
    })
  }

  const resolve = async (report, action) => {
    const reportId = firstDefined(report, ['id', 'reportId'])
    setBusyId(String(reportId))
    try {
      await resolveAdminReport(reportId, {
        action,
        note: action === 'hide_post' ? 'Admin takedown after report review' : 'Report dismissed after review',
        expectedVersion: firstDefined(report, ['version', 'rowVersion', 'updatedAt']),
      })
      removeReport(reportId)
      onToast(action === 'hide_post' ? t.resolved : t.reportDismissed)
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) onUnauthorized()
      onToast(error.message || t.operationFailed, 'error')
    } finally {
      setBusyId('')
    }
  }

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.reportTitle} subtitle={t.reportSubtitle} />
      <div className="kc-admin-review-list">
        {reports.length ? reports.map((report, index) => {
            const reportId = firstDefined(report, ['id', 'reportId'], index)
            const post = firstDefined(report, ['post'], {}) || {}
            const previewImages = Array.isArray(post.imageUrls) ? post.imageUrls.filter(Boolean) : []
            return (
              <article className="kc-admin-review-card" key={reportId}>
                <div className="kc-admin-review-risk">
                  <Flag size={19} />
                  <span>{t.reportReason}</span>
                  <strong>{firstDefined(report, ['reason', 'reasonLabel', 'category'], t.unknown)}</strong>
                </div>
                <div className={`kc-admin-review-content ${previewImages[0] ? 'has-image' : ''}`}>
                  {previewImages[0] ? (
                    <img src={previewImages[0]} alt="" loading="lazy" />
                  ) : null}
                  <div className="kc-admin-review-copy">
                    <span>{t.reportedPost}</span>
                    <h2>{firstDefined(report, ['postTitle', 'title'], firstDefined(post, ['title', 'titleZh', 'titleEn'], t.unknown))}</h2>
                    {firstDefined(post, ['description']) ? <p>{firstDefined(post, ['description'])}</p> : null}
                    <div>
                      <span>{t.reporter}: {firstDefined(report, ['reporter', 'source', 'reporterHash'], '—')}</span>
                      <span>{t.createdAt}: {formatDate(firstDefined(report, ['createdAt', 'reportedAt']), lang)}</span>
                      {firstDefined(post, ['area']) ? <span>{firstDefined(post, ['area'])}</span> : null}
                      {firstDefined(post, ['contact']) ? (
                        <span>{firstDefined(post, ['contactType'], t.contact)}: {firstDefined(post, ['contact'])}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="kc-admin-review-actions">
                  <button
                    type="button"
                    className="kc-admin-button kc-admin-button-danger"
                    disabled={busyId === String(reportId)}
                    onClick={() => resolve(report, 'hide_post')}
                  >
                    {busyId === String(reportId) ? <LoaderCircle className="kc-admin-spin" size={17} /> : <Ban size={17} />}
                    {t.hideResolve}
                  </button>
                  <button
                    type="button"
                    className="kc-admin-button kc-admin-button-secondary"
                    disabled={busyId === String(reportId)}
                    onClick={() => resolve(report, 'dismiss')}
                  >
                    <XCircle size={17} />
                    {t.dismissReport}
                  </button>
                </div>
              </article>
            )
        }) : <EmptyState t={t} />}
        <Pagination payload={state.data} t={t} onPage={onPage} />
      </div>
    </ResourceState>
  )
}

function ClubsPage({
  state,
  setState,
  t,
  lang,
  onRetry,
  onToast,
  onUnauthorized,
  onCredential,
  requestAction,
}) {
  const [busyId, setBusyId] = useState('')
  const applications = extractList(state.data, ['applications', 'clubApplications', 'pendingApplications'])
    .filter((application) => String(firstDefined(application, ['status'], 'pending')).toLowerCase() === 'pending')
  const clubs = extractList(state.data, ['clubs', 'accounts', 'items'])

  const removeApplication = (applicationId) => {
    setState((current) => {
      const root = rootRecord(current.data)
      const key = Array.isArray(root.applications)
        ? 'applications'
        : Array.isArray(root.clubApplications)
          ? 'clubApplications'
          : 'pendingApplications'
      return {
        ...current,
        data: {
          ...root,
          [key]: applications.filter((item) => String(firstDefined(item, ['id', 'applicationId'])) !== String(applicationId)),
        },
      }
    })
  }

  const updateLocalClub = (slug, update) => {
    setState((current) => {
      const root = rootRecord(current.data)
      const key = Array.isArray(root.clubs) ? 'clubs' : Array.isArray(root.accounts) ? 'accounts' : 'items'
      return {
        ...current,
        data: {
          ...root,
          [key]: extractList(current.data, ['clubs', 'accounts', 'items']).map((club) => (
            String(firstDefined(club, ['slug', 'clubSlug', 'id'])) === String(slug)
              ? { ...club, ...update }
              : club
          )),
        },
      }
    })
  }

  const addLocalClub = (club) => {
    if (!club || !firstDefined(club, ['slug', 'clubSlug', 'id'])) return
    const slug = firstDefined(club, ['slug', 'clubSlug', 'id'])
    setState((current) => {
      const root = rootRecord(current.data)
      const key = Array.isArray(root.clubs) ? 'clubs' : Array.isArray(root.accounts) ? 'accounts' : 'items'
      const currentClubs = extractList(current.data, ['clubs', 'accounts', 'items'])
      const exists = currentClubs.some((item) => String(firstDefined(item, ['slug', 'clubSlug', 'id'])) === String(slug))
      return {
        ...current,
        data: {
          ...root,
          [key]: exists
            ? currentClubs.map((item) => String(firstDefined(item, ['slug', 'clubSlug', 'id'])) === String(slug)
              ? { ...item, ...club }
              : item)
            : [club, ...currentClubs],
        },
      }
    })
  }

  const decideApplication = (application, decision) => {
    const applicationId = firstDefined(application, ['id', 'applicationId'])
    const danger = decision === 'reject'
    requestAction({
      danger,
      title: decision === 'approve' ? t.approve : t.reject,
      description: danger ? t.rejectWarning : t.oneTimeKeyHint,
      confirmLabel: decision === 'approve' ? t.approve : t.reject,
      icon: decision === 'approve' ? <CheckCircle2 size={17} /> : <XCircle size={17} />,
      requiresReason: false,
      async run(note) {
        setBusyId(String(applicationId))
        try {
          const response = await decideAdminClubApplication(applicationId, {
            decision,
            note,
            version: firstDefined(application, ['version', 'rowVersion']),
            clubSlug: firstDefined(application, ['clubSlug', 'slug']),
          })
          removeApplication(applicationId)
          const approvedClub = extractRecord(response, ['club'])
          if (decision === 'approve' && firstDefined(approvedClub, ['slug', 'clubSlug', 'id'])) {
            addLocalClub(approvedClub)
          }
          const credential = extractCredential(response)
          if (credential) onCredential({
            key: credential,
            label: firstDefined(application, ['clubName', 'name', 'slug'], ''),
          })
          onToast(decision === 'approve' ? t.applicationApproved : t.applicationRejected)
        } catch (error) {
          if (error instanceof AdminApiError && error.status === 401) onUnauthorized()
          onToast(error.message || t.operationFailed, 'error')
          throw error
        } finally {
          setBusyId('')
        }
      },
    })
  }

  const changeClubStatus = (club, nextStatus) => {
    const slug = firstDefined(club, ['slug', 'clubSlug', 'id'])
    const previousStatus = firstDefined(club, ['status'], 'active')
    const danger = ['suspended', 'revoked'].includes(nextStatus)
    const description = nextStatus === 'revoked'
      ? t.revokeWarning
      : nextStatus === 'suspended'
        ? t.pauseWarning
        : t.confirmFallback

    requestAction({
      danger,
      description,
      confirmLabel: nextStatus === 'revoked' ? t.revoke : nextStatus === 'suspended' ? t.pause : t.resume,
      icon: nextStatus === 'revoked'
        ? <Ban size={17} />
        : nextStatus === 'suspended'
          ? <PauseCircle size={17} />
          : <PlayCircle size={17} />,
      requiresReason: danger,
      async run(reason) {
        setBusyId(String(slug))
        updateLocalClub(slug, { status: nextStatus })
        try {
          const response = await updateAdminClubStatus(slug, {
            status: nextStatus,
            reason,
            version: firstDefined(club, ['version', 'rowVersion']),
          })
          const updated = extractRecord(response, ['club'])
          if (Object.keys(updated).length) updateLocalClub(slug, updated)
          onToast(`${firstDefined(club, ['name', 'clubName'], slug)} · ${humanStatus(nextStatus, t)}`)
        } catch (error) {
          updateLocalClub(slug, { status: previousStatus })
          if (error instanceof AdminApiError && error.status === 401) onUnauthorized()
          onToast(error.message || t.operationFailed, 'error')
          throw error
        } finally {
          setBusyId('')
        }
      },
    })
  }

  const rotateKey = (club) => {
    const slug = firstDefined(club, ['slug', 'clubSlug', 'id'])
    requestAction({
      danger: true,
      description: t.rotateWarning,
      confirmLabel: t.rotateKey,
      icon: <KeyRound size={17} />,
      requiresReason: true,
      async run(reason) {
        setBusyId(String(slug))
        try {
          const response = await rotateAdminClubKey(slug, {
            version: firstDefined(club, ['version', 'rowVersion']),
            reason,
          })
          const credential = extractCredential(response)
          if (!credential) throw new Error(t.operationFailed)
          const updated = extractRecord(response, ['club'])
          if (Object.keys(updated).length) updateLocalClub(slug, updated)
          onCredential({ key: credential, label: firstDefined(club, ['name', 'clubName'], slug) })
        } catch (error) {
          if (error instanceof AdminApiError && error.status === 401) onUnauthorized()
          onToast(error.message || t.operationFailed, 'error')
          throw error
        } finally {
          setBusyId('')
        }
      },
    })
  }

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.clubsTitle} subtitle={t.clubsSubtitle} />
      <section className="kc-admin-panel kc-admin-club-section">
        <div className="kc-admin-panel-heading">
          <div>
            <h2>{t.pendingApplications}</h2>
            <p>{applications.length} {t.records}</p>
          </div>
        </div>
        {applications.length ? (
          <div className="kc-admin-table-scroll">
            <table className="kc-admin-table">
              <thead>
                <tr>
                  <th>{t.applicant}</th>
                  <th>{t.contact}</th>
                  <th>{t.appliedAt}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((application, index) => {
                  const applicationId = firstDefined(application, ['id', 'applicationId'], index)
                  return (
                    <tr key={applicationId}>
                      <td data-label={t.applicant}>
                        <strong className="kc-admin-primary-cell">{firstDefined(application, ['clubName', 'name'], t.unknown)}</strong>
                        <small>{firstDefined(application, ['clubSlug', 'slug'], '')}</small>
                      </td>
                      <td data-label={t.contact}>
                        {firstDefined(application, ['contactName', 'ownerName', 'contact'], '—')}
                        <small>{firstDefined(application, ['ukmEmail', 'email', 'contactEmail'], '')}</small>
                        {firstDefined(application, ['note']) ? <small className="kc-admin-application-note">{firstDefined(application, ['note'])}</small> : null}
                      </td>
                      <td data-label={t.appliedAt}>{formatDate(firstDefined(application, ['createdAt', 'appliedAt']), lang)}</td>
                      <td data-label={t.actions}>
                        <div className="kc-admin-inline-actions">
                          <button type="button" className="kc-admin-row-action" disabled={busyId === String(applicationId)} onClick={() => decideApplication(application, 'approve')}>
                            <CheckCircle2 size={16} />
                            {t.approve}
                          </button>
                          <button type="button" className="kc-admin-row-action danger-subtle" disabled={busyId === String(applicationId)} onClick={() => decideApplication(application, 'reject')}>
                            <XCircle size={16} />
                            {t.reject}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState t={t} />}
      </section>

      <section className="kc-admin-panel kc-admin-club-section">
        <div className="kc-admin-panel-heading">
          <div>
            <h2>{t.authorisedClubs}</h2>
            <p>{clubs.length} {t.records}</p>
          </div>
        </div>
        {clubs.length ? (
          <div className="kc-admin-table-scroll">
            <table className="kc-admin-table">
              <thead>
                <tr>
                  <th>{t.club}</th>
                  <th>{t.slug}</th>
                  <th>{t.status}</th>
                  <th>{t.lastActive}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((club, index) => {
                  const slug = firstDefined(club, ['slug', 'clubSlug', 'id'], index)
                  const status = String(firstDefined(club, ['status'], 'active')).toLowerCase()
                  return (
                    <tr key={slug}>
                      <td data-label={t.club}><strong className="kc-admin-primary-cell">{firstDefined(club, ['name', 'clubName'], slug)}</strong></td>
                      <td data-label={t.slug}><code className="kc-admin-inline-code">{slug}</code></td>
                      <td data-label={t.status}><StatusBadge value={status} t={t} /></td>
                      <td data-label={t.lastActive}>{formatDate(firstDefined(club, ['lastVerifiedAt', 'lastActiveAt', 'updatedAt', 'lastLoginAt']), lang)}</td>
                      <td data-label={t.actions}>
                        <div className="kc-admin-inline-actions">
                          {status === 'suspended' ? (
                            <button type="button" className="kc-admin-row-action" disabled={busyId === String(slug)} onClick={() => changeClubStatus(club, 'active')}>
                              <PlayCircle size={16} />{t.resume}
                            </button>
                          ) : status !== 'revoked' ? (
                            <button type="button" className="kc-admin-row-action warning" disabled={busyId === String(slug)} onClick={() => changeClubStatus(club, 'suspended')}>
                              <PauseCircle size={16} />{t.pause}
                            </button>
                          ) : null}
                          {status !== 'revoked' ? (
                            <>
                              <button type="button" className="kc-admin-row-action" disabled={busyId === String(slug)} onClick={() => rotateKey(club)}>
                                <KeyRound size={16} />{t.rotateKey}
                              </button>
                              <button type="button" className="kc-admin-row-action danger-subtle" disabled={busyId === String(slug)} onClick={() => changeClubStatus(club, 'revoked')}>
                                <Ban size={16} />{t.revoke}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState t={t} />}
      </section>
    </ResourceState>
  )
}

function extractCredential(payload) {
  const record = extractRecord(payload, ['credential', 'club', 'result'])
  return firstDefined(record, ['accessKey', 'key', 'activationKey', 'secret', 'oneTimeKey'])
    || firstDefined(rootRecord(payload), ['accessKey', 'key', 'activationKey', 'secret', 'oneTimeKey'])
}

function SettingsPage({ state, t, onRetry }) {
  const overview = extractRecord(state.data, ['overview'])
  const rawRules = firstDefined(overview, ['rules', 'platformRules', 'settings'], [])
  const rules = Array.isArray(rawRules)
    ? rawRules
    : rawRules && typeof rawRules === 'object'
      ? Object.entries(rawRules).map(([key, value]) => ({ key, label: key, value }))
      : []

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.settingsTitle} subtitle={t.settingsSubtitle} badge={t.readOnly} />
      {rules.length ? (
        <section className="kc-admin-rules">
          {rules.map((rule, index) => (
            <div key={firstDefined(rule, ['id', 'key', 'name'], index)}>
              <span><Settings size={18} /></span>
              <div>
                <strong>{firstDefined(rule, ['label', 'name', 'title', 'key'], t.unknown)}</strong>
                <p>{String(firstDefined(rule, ['value', 'description', 'summary'], '—'))}</p>
              </div>
              <LockKeyhole size={16} />
            </div>
          ))}
        </section>
      ) : <EmptyState t={t} label={t.noRules} />}
    </ResourceState>
  )
}

function AuditPage({ state, t, lang, session, onRetry, onPage }) {
  const logs = extractList(state.data, ['auditLogs', 'logs', 'items'])
  const role = firstDefined(session, ['role', 'adminRole'], 'Admin')

  return (
    <ResourceState state={state} t={t} onRetry={onRetry}>
      <PageHeading title={t.auditTitle} subtitle={t.auditSubtitle} />
      <div className="kc-admin-audit-layout">
        <section className="kc-admin-session-card">
          <ShieldCheck size={23} />
          <h2>{t.sessionSecurity}</h2>
          <dl>
            <div><dt>{t.operator}</dt><dd>{firstDefined(session, ['email', 'actorEmail', 'adminEmail'], t.noEmail)}</dd></div>
            <div><dt>{t.role}</dt><dd>{role}</dd></div>
            <div><dt>{t.authenticatedAt}</dt><dd>{formatDate(firstDefined(session, ['authenticatedAt', 'createdAt', 'issuedAt']), lang)}</dd></div>
            <div><dt>{t.sessionExpires}</dt><dd>{formatDate(firstDefined(session, ['expiresAt', 'expiry']), lang)}</dd></div>
          </dl>
        </section>
        <section className="kc-admin-panel kc-admin-audit-panel">
          <div className="kc-admin-panel-heading">
            <div>
              <h2>{t.auditTimeline}</h2>
              <p>{logs.length} {t.records}</p>
            </div>
          </div>
          <>
            {logs.length ? (
              <div className="kc-admin-audit-timeline">
                {logs.map((log, index) => (
                  <article key={firstDefined(log, ['id', 'requestId'], index)}>
                    <span className="kc-admin-audit-dot"><Activity size={14} /></span>
                    <div>
                      <time>{formatDate(firstDefined(log, ['createdAt', 'timestamp', 'time']), lang)}</time>
                      <h3>{firstDefined(log, ['action', 'event', 'type'], t.unknown)}</h3>
                      <p><strong>{t.actor}:</strong> {firstDefined(log, ['actorEmail', 'actor', 'adminEmail', 'actorUserId', 'actorRole'], t.unknown)}</p>
                      <p><strong>{t.target}:</strong> {firstDefined(log, ['target', 'targetId', 'resource'], '—')}</p>
                      {firstDefined(log, ['reason', 'note', 'summary'], firstDefined(log.metadata, ['reason', 'note', 'summary'])) ? (
                        <blockquote>{firstDefined(log, ['reason', 'note', 'summary'], firstDefined(log.metadata, ['reason', 'note', 'summary']))}</blockquote>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState t={t} />}
            <Pagination payload={state.data} t={t} onPage={onPage} />
          </>
        </section>
      </div>
    </ResourceState>
  )
}

function initialResource() {
  return { loading: false, error: '', data: null }
}

export default function AdminConsole({ onExit }) {
  const [lang, setLangState] = useState(getStoredLanguage)
  const [auth, setAuth] = useState({ status: 'checking', session: null })
  const [active, setActive] = useState('overview')
  const [resources, setResources] = useState({
    overview: initialResource(),
    posts: initialResource(),
    reports: initialResource(),
    clubs: initialResource(),
    settings: initialResource(),
    audit: initialResource(),
  })
  const [pageOffsets, setPageOffsets] = useState({ posts: 0, reports: 0, audit: 0 })
  const [postSearch, setPostSearch] = useState('')
  const [postFilter, setPostFilter] = useState('all')
  const [refreshToken, setRefreshToken] = useState(0)
  const [toast, setToast] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [credential, setCredential] = useState(null)
  const toastTimer = useRef(null)
  const t = translations[lang]
  const activeOffset = pageOffsets[active] || 0
  const deferredPostSearch = useDeferredValue(postSearch.trim())
  const role = firstDefined(auth.session, ['role', 'adminRole'], 'owner')
  const availableNavigation = useMemo(
    () => navigation.filter((item) => item.roles.includes(role)),
    [role],
  )
  const availableIds = useMemo(
    () => new Set(availableNavigation.map((item) => item.id)),
    [availableNavigation],
  )

  const setLang = (next) => {
    setLangState(next)
    try {
      localStorage.setItem(LANGUAGE_KEY, next)
    } catch {
      // Language persistence is optional.
    }
  }

  const showToast = (message, tone = 'success') => {
    window.clearTimeout(toastTimer.current)
    setToast({ message, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), 4200)
  }

  const signedOut = () => {
    setAuth({ status: 'signedOut', session: null })
    setCredential(null)
    setPendingAction(null)
  }

  useEffect(() => {
    const controller = new AbortController()
    getAdminSession({ signal: controller.signal })
      .then((response) => {
        const root = rootRecord(response)
        if (root.authenticated === false) {
          signedOut()
          return
        }
        setAuth({ status: 'signedIn', session: extractRecord(response, ['session', 'admin']) })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        if (error instanceof AdminApiError && [401, 403].includes(error.status)) {
          signedOut()
          return
        }
        signedOut()
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (auth.status !== 'signedIn') return undefined
    const controller = new AbortController()
    let cancelled = false

    const setLoading = (id) => {
      setResources((current) => ({
        ...current,
        [id]: { ...current[id], loading: true, error: '' },
      }))
    }

    const setResult = (id, data, extra = {}) => {
      if (cancelled) return
      setResources((current) => ({
        ...current,
        [id]: { loading: false, error: '', data, ...extra },
      }))
    }

    const setFailure = (id, error) => {
      if (cancelled || error.name === 'AbortError') return
      if (error instanceof AdminApiError && error.status === 401) {
        signedOut()
        return
      }
      setResources((current) => ({
        ...current,
        [id]: { ...current[id], loading: false, error: error.message || t.requestFailed },
      }))
    }

    const load = async () => {
      if (active === 'overview') {
        setLoading('overview')
        try {
          const [overview, audit] = await Promise.all([
            getAdminOverview({ signal: controller.signal }),
            availableIds.has('audit')
              ? getAdminAuditLogs({ limit: 6 }, { signal: controller.signal })
              : Promise.resolve({ auditLogs: [] }),
          ])
          setResult('overview', overview, { audit })
        } catch (error) {
          setFailure('overview', error)
        }
        return
      }

      if (active === 'settings') {
        setLoading('settings')
        try {
          setResult('settings', await getAdminOverview({ signal: controller.signal }))
        } catch (error) {
          setFailure('settings', error)
        }
        return
      }

      const loaders = {
        posts: () => getAdminPosts({
          limit: 50,
          offset: activeOffset,
          q: deferredPostSearch,
          status: postFilter === 'visible'
            ? 'published'
            : postFilter === 'hidden'
              ? 'hidden'
              : undefined,
        }, { signal: controller.signal }),
        reports: () => getAdminReports({ status: 'pending', limit: 50, offset: activeOffset }, { signal: controller.signal }),
        clubs: () => getAdminClubs({ limit: 100 }, { signal: controller.signal }),
        audit: () => getAdminAuditLogs({ limit: 50, offset: activeOffset }, { signal: controller.signal }),
      }

      setLoading(active)
      try {
        setResult(active, await loaders[active]())
      } catch (error) {
        setFailure(active, error)
      }
    }

    load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    active,
    activeOffset,
    auth.status,
    availableIds,
    deferredPostSearch,
    postFilter,
    refreshToken,
  ])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  useEffect(() => {
    if (auth.status === 'signedIn' && !availableIds.has(active)) setActive('overview')
  }, [active, auth.status, availableIds])

  const logout = async () => {
    try {
      await deleteAdminSession()
      signedOut()
      if (onExit) onExit()
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        signedOut()
        if (onExit) onExit()
        return
      }
      showToast(error.message || t.signOutFailed, 'error')
    }
  }

  const requestAction = (action) => setPendingAction({
    ...action,
    id: crypto.randomUUID(),
    busy: false,
  })

  const confirmAction = async (note) => {
    const action = pendingAction
    if (!action) return
    setPendingAction((current) => ({ ...current, busy: true }))
    try {
      await action.run(note)
      setPendingAction(null)
    } catch {
      setPendingAction((current) => current ? { ...current, busy: false } : null)
    }
  }

  if (auth.status === 'checking') {
    return (
      <div className="kc-admin-session-check" role="status">
        <BrandMark />
        <LoaderCircle className="kc-admin-spin" size={24} />
        <strong>{t.checkingSession}</strong>
      </div>
    )
  }

  if (auth.status !== 'signedIn') {
    return (
      <LoginScreen
        lang={lang}
        setLang={setLang}
        t={t}
        onAuthenticated={(session) => setAuth({ status: 'signedIn', session })}
      />
    )
  }

  const resource = resources[active]
  const setActiveResource = (updater) => {
    setResources((current) => ({
      ...current,
      [active]: typeof updater === 'function' ? updater(current[active]) : updater,
    }))
  }
  const retry = () => setRefreshToken((value) => value + 1)
  const setPage = (resourceId, offset) => {
    setPageOffsets((current) => ({ ...current, [resourceId]: Math.max(0, offset) }))
  }

  return (
    <div className="kc-admin-shell">
      <AdminSidebar active={active} setActive={setActive} items={availableNavigation} t={t} onLogout={logout} />
      <div className="kc-admin-workspace">
        <AdminTopbar
          active={active}
          setActive={setActive}
          items={availableNavigation}
          lang={lang}
          setLang={setLang}
          t={t}
          session={auth.session || {}}
          refreshing={resource.loading}
          onRefresh={retry}
          onLogout={logout}
        />
        <main className="kc-admin-main">
          {active === 'overview' ? (
            <OverviewPage state={resource} t={t} lang={lang} navigate={setActive} availableIds={availableIds} onRetry={retry} />
          ) : null}
          {active === 'posts' ? (
            <PostsPage
              state={resource}
              setState={setActiveResource}
              t={t}
              lang={lang}
              search={postSearch}
              onSearch={(value) => {
                setPostSearch(value)
                setPage('posts', 0)
              }}
              filter={postFilter}
              onFilter={(value) => {
                setPostFilter(value)
                setPage('posts', 0)
              }}
              onRetry={retry}
              onToast={showToast}
              onUnauthorized={signedOut}
              onPage={(offset) => setPage('posts', offset)}
            />
          ) : null}
          {active === 'reports' ? (
            <ReportsPage state={resource} setState={setActiveResource} t={t} lang={lang} onRetry={retry} onToast={showToast} onUnauthorized={signedOut} onPage={(offset) => setPage('reports', offset)} />
          ) : null}
          {active === 'clubs' ? (
            <ClubsPage
              state={resource}
              setState={setActiveResource}
              t={t}
              lang={lang}
              onRetry={retry}
              onToast={showToast}
              onUnauthorized={signedOut}
              onCredential={(value) => setCredential(value ? { ...value, id: crypto.randomUUID() } : null)}
              requestAction={requestAction}
            />
          ) : null}
          {active === 'settings' ? (
            <SettingsPage state={resource} t={t} onRetry={retry} />
          ) : null}
          {active === 'audit' ? (
            <AuditPage state={resource} t={t} lang={lang} session={auth.session || {}} onRetry={retry} onPage={(offset) => setPage('audit', offset)} />
          ) : null}
        </main>
      </div>

      {toast ? (
        <div className={`kc-admin-toast kc-admin-toast-${toast.tone}`} role="status">
          {toast.tone === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label={t.cancel}><X size={16} /></button>
        </div>
      ) : null}

      <ActionDialog key={pendingAction?.id || 'no-action'} action={pendingAction} t={t} onCancel={() => !pendingAction?.busy && setPendingAction(null)} onConfirm={confirmAction} />
      <OneTimeKeyDialog key={credential?.id || 'no-credential'} credential={credential} t={t} onToast={showToast} onClose={() => setCredential(null)} />
    </div>
  )
}
