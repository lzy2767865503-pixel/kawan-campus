const ADMIN_API_ROOT = '/api/admin'
const CSRF_COOKIE_NAME = 'kawan_admin_csrf'

export class AdminApiError extends Error {
  constructor(message, { status = 0, code = '', details = null } = {}) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

function readCookie(name) {
  if (typeof document === 'undefined') return ''

  const prefix = `${encodeURIComponent(name)}=`
  const item = document.cookie
    .split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix))

  if (!item) return ''

  try {
    return decodeURIComponent(item.slice(prefix.length))
  } catch {
    return item.slice(prefix.length)
  }
}

function withQuery(path, query) {
  const params = new URLSearchParams()

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  })

  const search = params.toString()
  return search ? `${path}?${search}` : path
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => '')

  if (!response.ok) {
    const error = data?.error
    const message = typeof error === 'string'
      ? error
      : error?.message || data?.message || `Request failed (${response.status})`

    throw new AdminApiError(message, {
      status: response.status,
      code: error?.code || data?.code || '',
      details: error?.details || data?.details || null,
    })
  }

  return response.status === 204 ? null : data
}

async function adminRequest(path, {
  method = 'GET',
  body,
  signal,
  query,
} = {}) {
  const normalizedMethod = method.toUpperCase()
  const headers = {
    accept: 'application/json',
  }

  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  if (!['GET', 'HEAD'].includes(normalizedMethod)) {
    const csrfToken = readCookie(CSRF_COOKIE_NAME)
    if (csrfToken) headers['x-kawan-csrf'] = csrfToken
  }

  const response = await fetch(withQuery(`${ADMIN_API_ROOT}${path}`, query), {
    method: normalizedMethod,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  return parseResponse(response)
}

export function getAdminSession(options = {}) {
  return adminRequest('/session', options)
}

export function createAdminSession(credentials, options = {}) {
  return adminRequest('/session', {
    ...options,
    method: 'POST',
    body: credentials,
  })
}

export function deleteAdminSession(options = {}) {
  return adminRequest('/session', {
    ...options,
    method: 'DELETE',
  })
}

export function getAdminOverview(options = {}) {
  return adminRequest('/overview', options)
}

export function getAdminPosts(query = {}, options = {}) {
  return adminRequest('/posts', {
    ...options,
    query,
  })
}

export function getAdminReports(query = {}, options = {}) {
  return adminRequest('/reports', {
    ...options,
    query,
  })
}

export function getAdminClubs(query = {}, options = {}) {
  return adminRequest('/clubs', {
    ...options,
    query,
  })
}

export function getAdminAuditLogs(query = {}, options = {}) {
  return adminRequest('/audit-logs', {
    ...options,
    query,
  })
}

export function updateAdminPostStatus(postId, {
  status,
  reason,
  expectedVersion,
}, options = {}) {
  return adminRequest(`/posts/${encodeURIComponent(postId)}/status`, {
    ...options,
    method: 'PATCH',
    body: {
      status,
      reason,
      expectedVersion,
      version: expectedVersion,
    },
  })
}

export function resolveAdminReport(reportId, {
  action,
  note,
  expectedVersion,
}, options = {}) {
  return adminRequest(`/reports/${encodeURIComponent(reportId)}/resolve`, {
    ...options,
    method: 'POST',
    body: {
      action,
      note,
      expectedVersion,
      version: expectedVersion,
    },
  })
}

export function decideAdminClubApplication(applicationId, {
  decision,
  note,
  version,
  clubSlug,
}, options = {}) {
  return adminRequest(`/club-applications/${encodeURIComponent(applicationId)}/decision`, {
    ...options,
    method: 'POST',
    body: {
      decision,
      note,
      ...(version === undefined ? {} : { version }),
      ...(clubSlug ? { clubSlug } : {}),
    },
  })
}

export function updateAdminClubStatus(clubSlug, {
  status,
  reason,
  version,
  expectedVersion,
}, options = {}) {
  return adminRequest(`/clubs/${encodeURIComponent(clubSlug)}/status`, {
    ...options,
    method: 'PATCH',
    body: {
      status,
      reason,
      ...(version === undefined && expectedVersion === undefined
        ? {}
        : {
            version: version ?? expectedVersion,
            expectedVersion: expectedVersion ?? version,
          }),
    },
  })
}

export function rotateAdminClubKey(clubSlug, {
  version,
  expectedVersion,
  reason,
  ...options
} = {}) {
  return adminRequest(`/clubs/${encodeURIComponent(clubSlug)}/rotate-key`, {
    ...options,
    method: 'POST',
    body: {
      reason,
      ...(version === undefined && expectedVersion === undefined
        ? {}
        : {
            version: version ?? expectedVersion,
            expectedVersion: expectedVersion ?? version,
          }),
    },
  })
}
