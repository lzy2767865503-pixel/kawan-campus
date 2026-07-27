const INDEX_PATH = '/index.html'
const DAY = 24 * 60 * 60 * 1000
const SESSION_DAYS = 7
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const MAX_REQUEST_BYTES = 6 * 1024 * 1024
const MAX_JSON_BYTES = 64 * 1024
const PENDING_UPLOAD_HOURS = 6
const MAX_POST_IMAGES = 12
const ADMIN_SESSION_HOURS = 8

const CATEGORIES = new Set(['events', 'housing', 'marketplace', 'meetups', 'carpool', 'vehicles'])
const CONTACT_TYPES = new Set(['WhatsApp', 'WeChat', 'Phone', 'Telegram'])
const ADMIN_ROLES = new Set(['owner', 'moderator', 'club_reviewer', 'analyst'])
const POST_STATUSES = new Set(['published', 'hidden'])
const CLUB_STATUSES = new Set(['active', 'suspended', 'revoked'])
const RATE_POLICIES = Object.freeze({
  admin_login: { limit: 5, windowMs: 15 * 60 * 1000 },
  club_verify: { limit: 10, windowMs: 15 * 60 * 1000 },
  upload_image: { limit: 30, windowMs: 10 * 60 * 1000 },
  create_post: { limit: 10, windowMs: 10 * 60 * 1000 },
  club_apply: { limit: 5, windowMs: DAY },
  report_post: { limit: 20, windowMs: 60 * 60 * 1000 },
})
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])

function json(data, init = {}) {
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json; charset=utf-8')
  headers.set('cache-control', 'no-store')
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-frame-options', 'DENY')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function fail(message, status = 400, code = 'bad_request', headers) {
  return json({ ok: false, error: { code, message } }, { status, headers })
}

function clean(value, maxLength = 500) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function parseCookies(request) {
  const result = {}
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (!rawKey) continue
    try {
      result[rawKey] = decodeURIComponent(rest.join('='))
    } catch {
      result[rawKey] = ''
    }
  }
  return result
}

function randomToken(bytes = 24) {
  const values = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('')
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clientAddress(request) {
  const cloudflareAddress = clean(request.headers.get('cf-connecting-ip'), 80)
  if (cloudflareAddress) return cloudflareAddress
  const forwardedAddress = clean(
    (request.headers.get('x-forwarded-for') || '').split(',')[0],
    80,
  )
  return forwardedAddress || 'unknown'
}

async function consumeRateLimit(request, env, action) {
  const policy = RATE_POLICIES[action]
  if (!policy || !env.DB?.prepare) return { ok: true, keyHash: '' }
  const now = Date.now()
  const windowStart = Math.floor(now / policy.windowMs) * policy.windowMs
  const expiresAt = windowStart + policy.windowMs
  const salt = String(
    env.KAWAN_RATE_LIMIT_SALT
      || env.KAWAN_ADMIN_ACCESS_KEY
      || 'kawan-campus-rate-limit-v1',
  )
  const keyHash = await sha256(`${salt}:${clientAddress(request)}`)
  const counter = await env.DB.prepare(
    `INSERT INTO rate_limits (key_hash, action, window_start, count, expires_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(key_hash, action, window_start)
     DO UPDATE SET
       count = rate_limits.count + 1,
       expires_at = excluded.expires_at
     RETURNING count`,
  ).bind(keyHash, action, windowStart, expiresAt).first()
  await env.DB.prepare(
    'DELETE FROM rate_limits WHERE expires_at <= ?',
  ).bind(now).run()
  const count = Number(counter?.count || 1)
  if (count > policy.limit) {
    const retryAfter = Math.max(1, Math.ceil((expiresAt - now) / 1000))
    return {
      ok: false,
      keyHash,
      response: fail(
        '请求过于频繁，请稍后再试。',
        429,
        'rate_limited',
        { 'retry-after': String(retryAfter) },
      ),
    }
  }
  return { ok: true, keyHash }
}

function auditText(value, maxLength = 300) {
  return clean(value, maxLength)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\b(?:sk-|kawan_club_)[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[redacted-phone]')
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return difference === 0
}

function sameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

function requireSameOrigin(request) {
  return sameOrigin(request)
    ? null
    : fail('请求来源无法验证，请刷新页面后重试。', 403, 'invalid_origin')
}

function integerParam(value, fallback, minimum, maximum) {
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed)) return fallback
  return Math.min(maximum, Math.max(minimum, parsed))
}

function escapeLike(value) {
  return value.replace(/[!%_]/g, (character) => `!${character}`)
}

async function boundedFormData(request, maximumBytes, tooLargeMessage, invalidMessage) {
  const declaredHeader = request.headers.get('content-length')
  if (declaredHeader) {
    const declaredLength = Number(declaredHeader)
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return { error: fail(invalidMessage) }
    }
    if (declaredLength > maximumBytes) {
      return { error: fail(tooLargeMessage, 413, 'payload_too_large') }
    }
  }
  if (!request.body) return { error: fail(invalidMessage) }

  const reader = request.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel()
        return { error: fail(tooLargeMessage, 413, 'payload_too_large') }
      }
      chunks.push(value)
    }
  } catch {
    return { error: fail(invalidMessage) }
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
    return { form: await boundedRequest.formData() }
  } catch {
    return { error: fail(invalidMessage) }
  }
}

async function readBoundedJson(request, maximumBytes = MAX_JSON_BYTES) {
  const invalidResponse = () => fail(
    '请求内容必须是有效的 JSON 对象。',
    400,
    'invalid_json',
  )
  const declaredHeader = request.headers.get('content-length')
  if (declaredHeader) {
    const declaredLength = Number(declaredHeader)
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return { error: invalidResponse() }
    }
    if (declaredLength > maximumBytes) {
      return {
        error: fail(
          'JSON 请求内容不能超过 64 KB。',
          413,
          'payload_too_large',
        ),
      }
    }
  }
  if (!request.body) return { error: invalidResponse() }

  const reader = request.body.getReader()
  const chunks = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel()
        return {
          error: fail(
            'JSON 请求内容不能超过 64 KB。',
            413,
            'payload_too_large',
          ),
        }
      }
      chunks.push(value)
    }
  } catch {
    return { error: invalidResponse() }
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { error: invalidResponse() }
    }
    return { payload }
  } catch {
    return { error: invalidResponse() }
  }
}

function auditInsert(env, {
  actor,
  action,
  targetType,
  targetId,
  metadata = null,
  guardSql = '',
  guardValues = [],
  now = Date.now(),
}) {
  const statement = guardSql
    ? `INSERT INTO audit_logs (
        id, actor_user_id, actor_role, action, target_type, target_id, metadata_json, created_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (${guardSql})`
    : `INSERT INTO audit_logs (
        id, actor_user_id, actor_role, action, target_type, target_id, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  return env.DB.prepare(statement).bind(
    `audit_${crypto.randomUUID()}`,
    actor.id,
    actor.role,
    action,
    targetType,
    targetId,
    metadata ? JSON.stringify(metadata) : null,
    now,
    ...guardValues,
  )
}

function isDocumentRequest(request, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('text/html') || !url.pathname.split('/').pop()?.includes('.')
}

function secureAssetResponse(response) {
  const headers = new Headers(response.headers)
  const contentType = headers.get('content-type') || ''
  headers.set('x-content-type-options', 'nosniff')
  headers.set('x-frame-options', 'DENY')
  headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains')
  if (contentType.includes('text/html')) {
    headers.set(
      'content-security-policy',
      "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    )
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function fetchIndex(request, env) {
  const indexUrl = new URL(INDEX_PATH, request.url)
  const indexRequest = new Request(indexUrl, request)
  const response = await env.ASSETS.fetch(indexRequest)

  if (response.status === 404) {
    return new Response('Kawan Campus is temporarily unavailable.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  return response
}

function mediaUrl(key) {
  return key ? `/media/${encodeURIComponent(key)}` : ''
}

function adminMediaUrl(key) {
  return key ? `/api/admin/media?key=${encodeURIComponent(key)}` : ''
}

function rowToPost(row, imageKeys = []) {
  const uniqueImageKeys = [...new Set([
    ...imageKeys,
    row.image_key,
  ].filter(Boolean))]
  const imageUrls = uniqueImageKeys.map(mediaUrl)
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    area: row.area,
    price: row.price || '',
    contactType: row.contact_type,
    contact: row.contact,
    imageUrl: imageUrls[0] || '',
    imageUrls,
    eventAt: row.event_at,
    venue: row.venue || '',
    clubSlug: row.club_slug || '',
    clubName: row.club_name || '',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedClub: Boolean(row.club_slug),
    isDemo: false,
  }
}

function parseClubRegistry(raw) {
  try {
    const registry = JSON.parse(raw || '{}')
    if (!registry || Array.isArray(registry) || typeof registry !== 'object') return {}
    return registry
  } catch {
    return {}
  }
}

async function getClubSession(request, env) {
  if (!env.DB) return null
  const token = parseCookies(request).kawan_club_session
  if (!token) return null
  const tokenHash = await sha256(token)
  const now = Date.now()
  return env.DB.prepare(
    `SELECT sessions.club_slug, accounts.name AS club_name, sessions.expires_at
     FROM club_sessions AS sessions
     INNER JOIN club_accounts AS accounts ON accounts.slug = sessions.club_slug
     WHERE sessions.token_hash = ?
       AND sessions.expires_at > ?
       AND sessions.revoked_at IS NULL
       AND accounts.status = 'active'
     LIMIT 1`,
  ).bind(tokenHash, now).first()
}

function expirationFor(category, eventAt, now) {
  if (category === 'events') return eventAt + (2 * DAY)
  if (category === 'carpool' && eventAt) return eventAt + DAY
  return now + (30 * DAY)
}

function hasExactUnitNumber(value) {
  return /(?:\b(?:unit|room|house|apartment|door)\s*(?:no\.?|number)?|门牌(?:号)?|房号|房间号|室号)\s*[:#-]?\s*[a-z0-9-]{1,16}/i.test(value)
    || /(?:^|\s)#\s*[a-z]?\d{1,4}(?:-\d{1,4})?\b/i.test(value)
    || /\bno\.?\s*\d+[a-z]?(?:-\d+)?\b/i.test(value)
    || /\d+\s*(?:室|号房)/.test(value)
}

function validateContact(type, value) {
  if (!CONTACT_TYPES.has(type)) return false
  if (type === 'WhatsApp' || type === 'Phone') return /^[+()\d\s-]{8,24}$/.test(value)
  return value.length >= 4 && value.length <= 50
}

async function imageRowsForPosts(env, postIds) {
  if (!postIds.length) return []
  const placeholders = postIds.map(() => '?').join(', ')
  const result = await env.DB.prepare(
    `SELECT post_id, image_key, position FROM post_images
     WHERE post_id IN (${placeholders})
     ORDER BY post_id, position, created_at`,
  ).bind(...postIds).all()
  return result.results || []
}

function imageMapForRows(rows) {
  const imageMap = new Map()
  for (const row of rows) {
    const current = imageMap.get(row.post_id) || []
    current.push(row.image_key)
    imageMap.set(row.post_id, current)
  }
  return imageMap
}

async function deleteObjectKeys(bucket, keys) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))]
  for (let index = 0; index < uniqueKeys.length; index += 500) {
    await bucket.delete(uniqueKeys.slice(index, index + 500))
  }
}

async function promotePendingImages(env, pendingImages, postId, now) {
  if (!pendingImages.length || !env.UPLOADS) return pendingImages
  const promoted = []
  try {
    for (const pendingImage of pendingImages) {
      const source = await env.UPLOADS.get(pendingImage.image_key)
      if (!source) throw new Error('Pending image is unavailable')
      const extensionMatch = String(pendingImage.image_key).match(/\.([a-z0-9]{2,5})$/i)
      const extension = extensionMatch?.[1]?.toLowerCase() || 'bin'
      const liveKey = `posts/live/${new Date(now).toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`
      const metadataHeaders = new Headers()
      source.writeHttpMetadata?.(metadataHeaders)
      await env.UPLOADS.put(liveKey, source.body, {
        httpMetadata: {
          contentType: metadataHeaders.get('content-type') || 'application/octet-stream',
          cacheControl: 'no-store',
        },
        customMetadata: { source: 'kawan-campus-post', postId },
      })
      promoted.push({ ...pendingImage, image_key: liveKey })
    }
    return promoted
  } catch (error) {
    await deleteObjectKeys(env.UPLOADS, promoted.map((image) => image.image_key))
    throw error
  }
}

async function cleanupPendingUploads(env, now) {
  const expired = await env.DB.prepare(
    'SELECT id, image_key FROM pending_uploads WHERE expires_at <= ? LIMIT 30',
  ).bind(now).all()
  const rows = expired.results || []
  if (!rows.length) return
  if (env.UPLOADS) {
    await deleteObjectKeys(env.UPLOADS, rows.map((row) => row.image_key))
  }
  await env.DB.batch(rows.map((row) => (
    env.DB.prepare('DELETE FROM pending_uploads WHERE id = ?').bind(row.id)
  )))
}

async function cleanupExpiredPosts(env, now) {
  const expired = await env.DB.prepare(
    'SELECT id, image_key FROM posts WHERE expires_at <= ? LIMIT 20',
  ).bind(now).all()
  const rows = expired.results || []
  if (!rows.length) return
  const postIds = rows.map((row) => row.id)
  const imageRows = await imageRowsForPosts(env, postIds)
  if (env.UPLOADS) {
    await deleteObjectKeys(env.UPLOADS, [
      ...rows.map((row) => row.image_key),
      ...imageRows.map((row) => row.image_key),
    ])
  }
  await env.DB.batch([
    ...postIds.map((postId) => env.DB.prepare('DELETE FROM post_images WHERE post_id = ?').bind(postId)),
    ...postIds.map((postId) => env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId)),
  ])
}

async function listPosts(request, env) {
  if (!env.DB) return json({ ok: true, posts: [], storageReady: false })
  const url = new URL(request.url)
  const category = clean(url.searchParams.get('category'), 30)
  const now = Date.now()
  await cleanupExpiredPosts(env, now)
  const statement = category && CATEGORIES.has(category)
    ? env.DB.prepare(
      'SELECT * FROM posts WHERE status = ? AND expires_at > ? AND category = ? ORDER BY created_at DESC LIMIT 80',
    ).bind('published', now, category)
    : env.DB.prepare(
      'SELECT * FROM posts WHERE status = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 80',
    ).bind('published', now)
  const result = await statement.all()
  const rows = result.results || []
  const imageMap = imageMapForRows(await imageRowsForPosts(env, rows.map((row) => row.id)))
  return json({
    ok: true,
    posts: rows.map((row) => rowToPost(row, imageMap.get(row.id))),
    storageReady: true,
  })
}

async function uploadImage(request, env) {
  if (!env.DB || !env.UPLOADS) {
    return fail('图片存储还未连接，请稍后再试。', 503, 'uploads_unavailable')
  }
  const rateLimit = await consumeRateLimit(request, env, 'upload_image')
  if (!rateLimit.ok) return rateLimit.response
  const parsed = await boundedFormData(
    request,
    MAX_REQUEST_BYTES,
    '单张图片不能超过 5MB。',
    '无法读取图片，请重新选择后再试。',
  )
  if (parsed.error) return parsed.error
  const form = parsed.form

  const uploadSession = clean(form.get('uploadSession'), 120)
  if (!/^[a-zA-Z0-9-]{16,120}$/.test(uploadSession)) return fail('无效的图片上传会话。')
  const positionRaw = clean(form.get('position'), 12)
  const position = Number(positionRaw)
  if (!Number.isSafeInteger(position) || position < 0) {
    return fail('无效的图片顺序。')
  }
  if (position >= MAX_POST_IMAGES) {
    return fail(`每个帖子最多上传 ${MAX_POST_IMAGES} 张图片。`, 409, 'image_limit_reached')
  }

  const image = form.get('image')
  if (!image || typeof image !== 'object' || typeof image.arrayBuffer !== 'function' || image.size <= 0) {
    return fail('请选择需要上传的图片。')
  }
  if (image.size > MAX_UPLOAD_BYTES) return fail('单张图片不能超过 5MB。', 413, 'image_too_large')
  const extension = IMAGE_TYPES.get(image.type)
  if (!extension) return fail('只支持 JPG、PNG 或 WebP 图片。')

  const now = Date.now()
  await cleanupPendingUploads(env, now)
  const sessionHash = await sha256(uploadSession)
  const currentCount = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM pending_uploads WHERE session_hash = ? AND expires_at > ?',
  ).bind(sessionHash, now).first('count')
  if (Number(currentCount || 0) >= MAX_POST_IMAGES) {
    return fail(`每个帖子最多上传 ${MAX_POST_IMAGES} 张图片。`, 409, 'image_limit_reached')
  }
  const uploadId = `upload_${crypto.randomUUID()}`
  const imageKey = `posts/pending/${new Date(now).toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`

  let reserved = false
  try {
    const insertResult = await env.DB.prepare(
      `INSERT INTO pending_uploads (
        id, image_key, session_hash, position, created_at, expires_at
      )
      SELECT ?, ?, ?, ?, ?, ?
      WHERE (
        SELECT COUNT(*)
        FROM pending_uploads
        WHERE session_hash = ? AND expires_at > ?
      ) < ?`,
    ).bind(
      uploadId,
      imageKey,
      sessionHash,
      position,
      now,
      now + (PENDING_UPLOAD_HOURS * 60 * 60 * 1000),
      sessionHash,
      now,
      MAX_POST_IMAGES,
    ).run()
    if (Number(insertResult?.meta?.changes ?? 1) === 0) {
      return fail(`每个帖子最多上传 ${MAX_POST_IMAGES} 张图片。`, 409, 'image_limit_reached')
    }
    reserved = true
  } catch (error) {
    if (String(error).toLowerCase().includes('unique')) {
      return fail('该图片顺序已经被占用，请重新选择图片。', 409, 'image_position_conflict')
    }
    throw error
  }

  try {
    await env.UPLOADS.put(imageKey, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type, cacheControl: 'no-store' },
      customMetadata: { source: 'kawan-campus-post' },
    })
  } catch (error) {
    if (reserved) {
      await env.DB.prepare('DELETE FROM pending_uploads WHERE id = ?').bind(uploadId).run()
    }
    await env.UPLOADS.delete(imageKey)
    throw error
  }

  return json({ ok: true, uploadId, position }, { status: 201 })
}

async function createPost(request, env) {
  if (!env.DB) return fail('帖子数据库还未连接，请稍后再试。', 503, 'storage_unavailable')
  const rateLimit = await consumeRateLimit(request, env, 'create_post')
  if (!rateLimit.ok) return rateLimit.response
  const parsed = await boundedFormData(
    request,
    MAX_REQUEST_BYTES,
    '发布内容不能超过 6MB。',
    '无法读取发布内容，请重新填写后再试。',
  )
  if (parsed.error) return parsed.error
  const form = parsed.form

  const category = clean(form.get('category'), 30)
  const title = clean(form.get('title'), 80)
  const description = clean(form.get('description'), 1200)
  const area = clean(form.get('area'), 160)
  const price = clean(form.get('price'), 40)
  const contactType = clean(form.get('contactType'), 20)
  const contact = clean(form.get('contact'), 60)
  const venue = clean(form.get('venue'), 100)
  const eventAtRaw = clean(form.get('eventAt'), 60)
  const uploadSession = clean(form.get('uploadSession'), 120)

  if (!CATEGORIES.has(category)) return fail('请选择有效的发布分类。')
  if (title.length < 4) return fail('标题至少需要 4 个字。')
  if (description.length < 12) return fail('请多写一点具体信息，至少 12 个字。')
  if (area.length < 2) return fail('请填写有效的地址或见面地点。')
  if (!validateContact(contactType, contact)) return fail('请填写有效的公开联系方式。')
  if (category === 'housing' && hasExactUnitNumber(`${title} ${description} ${area} ${venue}`)) {
    return fail('为了安全，租房内容不能写具体门牌号或房号；最多写到小区、楼栋和楼层范围。')
  }
  if (uploadSession && !/^[a-zA-Z0-9-]{16,120}$/.test(uploadSession)) {
    return fail('无效的图片上传会话。')
  }

  let eventAt = null
  if (eventAtRaw) {
    eventAt = Date.parse(eventAtRaw)
    if (!Number.isFinite(eventAt)) return fail('请选择有效的日期和时间。')
  }

  const now = Date.now()
  if ((category === 'events' || category === 'carpool') && (!eventAt || eventAt < now - (2 * 60 * 60 * 1000))) {
    return fail(category === 'events' ? '活动需要填写未来的开始时间。' : '拼车需要填写未来的出发时间。')
  }
  if (eventAt && eventAt > now + (370 * DAY)) return fail('日期不能超过未来一年。')
  let club = null
  if (category === 'events') {
    const originError = requireSameOrigin(request)
    if (originError) return originError
    club = await getClubSession(request, env)
    if (!club) return fail('只有已验证的 UKM 社团账号可以发布活动。', 403, 'club_required')
  }

  await cleanupPendingUploads(env, now)
  let pendingImages = []
  let uploadSessionHash = ''
  if (uploadSession) {
    uploadSessionHash = await sha256(uploadSession)
    const pending = await env.DB.prepare(
      `SELECT id, image_key, position, created_at FROM pending_uploads
       WHERE session_hash = ? AND expires_at > ?
       ORDER BY position, created_at
       LIMIT ${MAX_POST_IMAGES + 1}`,
    ).bind(uploadSessionHash, now).all()
    pendingImages = pending.results || []
    if (pendingImages.length > MAX_POST_IMAGES) {
      return fail(`每个帖子最多上传 ${MAX_POST_IMAGES} 张图片。`, 409, 'image_limit_reached')
    }
  }
  const id = `post_${crypto.randomUUID()}`
  const ownerToken = randomToken()
  const ownerTokenHash = await sha256(ownerToken)
  const expiresAt = expirationFor(category, eventAt, now)
  let postImages = pendingImages
  try {
    postImages = await promotePendingImages(env, pendingImages, id, now)
  } catch {
    return fail('图片暂时无法完成发布，请稍后重试。', 503, 'image_promotion_failed')
  }
  const imageKey = postImages[0]?.image_key || null

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO posts (
          id, category, title, description, area, price, contact_type, contact, image_key,
          event_at, venue, club_slug, club_name, status, owner_token_hash, created_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        category,
        title,
        description,
        area,
        price || null,
        contactType,
        contact,
        imageKey,
        eventAt,
        venue || null,
        club?.club_slug || null,
        club?.club_name || null,
        'published',
        ownerTokenHash,
        now,
        expiresAt,
      ),
      ...postImages.map((postImage, position) => (
        env.DB.prepare(
          'INSERT INTO post_images (id, post_id, image_key, position, created_at) VALUES (?, ?, ?, ?, ?)',
        ).bind(
          `post_image_${crypto.randomUUID()}`,
          id,
          postImage.image_key,
          position,
          now,
        )
      )),
      ...(uploadSessionHash ? [
        env.DB.prepare('DELETE FROM pending_uploads WHERE session_hash = ?').bind(uploadSessionHash),
      ] : []),
    ])
  } catch (error) {
    await deleteObjectKeys(
      env.UPLOADS,
      postImages
        .filter((image) => !pendingImages.some((pending) => pending.image_key === image.image_key))
        .map((image) => image.image_key),
    )
    throw error
  }
  if (postImages !== pendingImages) {
    try {
      await deleteObjectKeys(env.UPLOADS, pendingImages.map((image) => image.image_key))
    } catch (error) {
      console.error('Kawan Campus could not remove promoted pending media', {
        postId: id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const post = rowToPost({
    id,
    category,
    title,
    description,
    area,
    price,
    contact_type: contactType,
    contact,
    image_key: imageKey,
    event_at: eventAt,
    venue,
    club_slug: club?.club_slug,
    club_name: club?.club_name,
    created_at: now,
    expires_at: expiresAt,
  }, postImages.map((postImage) => postImage.image_key))
  return json({ ok: true, post, ownerToken }, { status: 201 })
}

async function deletePost(request, env, postId) {
  if (!env.DB) return fail('帖子数据库还未连接。', 503, 'storage_unavailable')
  const ownerToken = request.headers.get('x-kawan-delete-token') || ''
  if (!ownerToken) return fail('缺少删除凭证。', 401, 'owner_token_required')
  const post = await env.DB.prepare(
    'SELECT owner_token_hash, image_key FROM posts WHERE id = ? LIMIT 1',
  ).bind(postId).first()
  if (!post) return fail('帖子不存在或已经删除。', 404, 'not_found')
  const ownerTokenHash = await sha256(ownerToken)
  if (!safeEqual(ownerTokenHash, post.owner_token_hash)) return fail('删除凭证无效。', 403, 'forbidden')
  const imageRows = await imageRowsForPosts(env, [postId])
  if (env.UPLOADS) {
    await deleteObjectKeys(env.UPLOADS, [
      post.image_key,
      ...imageRows.map((row) => row.image_key),
    ])
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM post_images WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId),
  ])
  return json({ ok: true })
}

async function verifyClub(request, env) {
  if (!env.DB) return fail('社团验证服务还未连接。', 503, 'storage_unavailable')
  const originError = requireSameOrigin(request)
  if (originError) return originError
  const rateLimit = await consumeRateLimit(request, env, 'club_verify')
  if (!rateLimit.ok) return rateLimit.response
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const clubSlug = clean(payload.clubSlug, 60).toLowerCase()
  const accessKey = clean(payload.accessKey, 120)
  if (!clubSlug || !accessKey) return fail('请输入社团账号和发布密钥。')

  const submittedHash = await sha256(accessKey)
  const account = typeof env.DB.prepare === 'function'
    ? await env.DB.prepare(
      'SELECT slug, name, status, key_hash FROM club_accounts WHERE slug = ? LIMIT 1',
    ).bind(clubSlug).first()
    : null

  let clubName = ''
  let accountStatement
  if (account) {
    if (account.status !== 'active') {
      return fail('该社团的发布权限目前已停用。', 403, 'club_inactive')
    }
    clubName = clean(account.name, 100) || clubSlug
    if (account.key_hash) {
      if (!safeEqual(submittedHash, String(account.key_hash))) {
        return fail('社团账号或发布密钥不正确。', 401, 'invalid_club_key')
      }
      accountStatement = env.DB.prepare(
        `UPDATE club_accounts
         SET last_verified_at = ?, updated_at = ?
         WHERE slug = ? AND status = 'active'`,
      ).bind(Date.now(), Date.now(), clubSlug)
    } else {
      const legacyRecord = parseClubRegistry(env.UKM_CLUB_KEYS)[clubSlug]
      if (!legacyRecord?.keyHash
        || !safeEqual(submittedHash, String(legacyRecord.keyHash))) {
        return fail('社团账号或发布密钥不正确。', 401, 'invalid_club_key')
      }
      accountStatement = env.DB.prepare(
        `UPDATE club_accounts
         SET key_hash = ?,
             key_issued_at = ?,
             last_verified_at = ?,
             updated_at = ?
         WHERE slug = ? AND status = 'active' AND key_hash IS NULL`,
      ).bind(
        String(legacyRecord.keyHash),
        Date.now(),
        Date.now(),
        Date.now(),
        clubSlug,
      )
    }
  } else {
    const registry = parseClubRegistry(env.UKM_CLUB_KEYS)
    const record = registry[clubSlug]
    if (!record?.keyHash || !safeEqual(submittedHash, String(record.keyHash))) {
      return fail('社团账号或发布密钥不正确。', 401, 'invalid_club_key')
    }
    clubName = clean(record.name, 100) || clubSlug
    accountStatement = env.DB.prepare(
      `INSERT INTO club_accounts (
         slug, name, status, key_hash, key_issued_at, last_verified_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO NOTHING`,
    ).bind(
      clubSlug,
      clubName,
      'active',
      String(record.keyHash),
      Date.now(),
      Date.now(),
      Date.now(),
    )
  }

  const now = Date.now()
  const expiresAt = now + (SESSION_DAYS * DAY)
  const sessionToken = randomToken(32)
  const sessionHash = await sha256(sessionToken)
  await env.DB.batch([
    accountStatement,
    env.DB.prepare(
      'INSERT INTO club_sessions (token_hash, club_slug, club_name, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(sessionHash, clubSlug, clubName, now, expiresAt),
    env.DB.prepare('DELETE FROM club_sessions WHERE expires_at <= ?').bind(now),
  ])

  const headers = new Headers()
  headers.set(
    'set-cookie',
    `kawan_club_session=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
  )
  return json({ ok: true, club: { slug: clubSlug, name: clubName, expiresAt } }, { headers })
}

async function clubSession(request, env) {
  const session = await getClubSession(request, env)
  if (!session) return json({ ok: true, club: null })
  return json({
    ok: true,
    club: {
      slug: session.club_slug,
      name: session.club_name,
      expiresAt: session.expires_at,
    },
  })
}

async function applyForClub(request, env) {
  if (!env.DB) return fail('申请服务还未连接。', 503, 'storage_unavailable')
  const rateLimit = await consumeRateLimit(request, env, 'club_apply')
  if (!rateLimit.ok) return rateLimit.response
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const clubName = clean(payload.clubName, 100)
  const ukmEmail = clean(payload.ukmEmail, 120).toLowerCase()
  const contact = clean(payload.contact, 80)
  const note = clean(payload.note, 500)
  if (clubName.length < 3) return fail('请填写完整的社团名称。')
  if (!/@(?:siswa\.)?ukm\.edu\.my$/i.test(ukmEmail)) return fail('请使用 UKM 官方邮箱提交申请。')
  if (contact.length < 6) return fail('请填写可联系到社团负责人的方式。')

  const id = `club_apply_${crypto.randomUUID()}`
  await env.DB.prepare(
    'INSERT INTO club_applications (id, club_name, ukm_email, contact, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, clubName, ukmEmail, contact, note || null, 'pending', Date.now()).run()
  return json({ ok: true, applicationId: id }, { status: 201 })
}

async function pulsePresence(request, env) {
  if (!env.DB) return json({ ok: true, online: 1, storageReady: false })
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const sessionId = clean(payload.sessionId, 120)
  if (sessionId.length < 16) return fail('无效的在线会话。')
  const sessionHash = await sha256(sessionId)
  const now = Date.now()
  const cutoff = now - (3 * 60 * 1000)
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO presence_sessions (session_hash, updated_at) VALUES (?, ?)
       ON CONFLICT(session_hash) DO UPDATE SET updated_at = excluded.updated_at`,
    ).bind(sessionHash, now),
    env.DB.prepare('DELETE FROM presence_sessions WHERE updated_at < ?').bind(cutoff),
  ])
  const count = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM presence_sessions WHERE updated_at >= ?',
  ).bind(cutoff).first('count')
  return json({ ok: true, online: Number(count || 1), storageReady: true })
}

async function reportPost(request, env) {
  if (!env.DB) return fail('举报服务还未连接。', 503, 'storage_unavailable')
  const rateLimit = await consumeRateLimit(request, env, 'report_post')
  if (!rateLimit.ok) return rateLimit.response
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const postId = clean(payload.postId, 80)
  const reason = clean(payload.reason, 300)
  if (!postId || reason.length < 4) return fail('请选择举报原因。')
  const now = Date.now()
  const reportablePost = await env.DB.prepare(
    `SELECT id
     FROM posts
     WHERE id = ?
       AND status = 'published'
       AND expires_at > ?
     LIMIT 1`,
  ).bind(postId, now).first()
  if (!reportablePost) {
    return fail('帖子不存在或当前无法举报。', 404, 'post_not_reportable')
  }

  const duplicateAction = 'report_post_duplicate'
  const reporterPostHash = await sha256(`${rateLimit.keyHash}:${postId}`)
  await env.DB.prepare(
    `DELETE FROM rate_limits
     WHERE key_hash = ?
       AND action = ?
       AND expires_at <= ?`,
  ).bind(reporterPostHash, duplicateAction, now).run()
  const duplicateCounter = await env.DB.prepare(
    `INSERT INTO rate_limits (key_hash, action, window_start, count, expires_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(key_hash, action, window_start)
     DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
  ).bind(reporterPostHash, duplicateAction, 0, now + DAY).first()
  if (Number(duplicateCounter?.count || 1) > 1) {
    return fail('你已经举报过这个帖子，请勿重复提交。', 409, 'duplicate_report')
  }

  const id = `report_${crypto.randomUUID()}`
  await env.DB.prepare(
    'INSERT INTO reports (id, post_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, postId, reason, 'pending', now).run()
  return json({ ok: true }, { status: 201 })
}

function adminCookies(sessionToken, csrfToken) {
  const headers = new Headers()
  const maxAge = ADMIN_SESSION_HOURS * 60 * 60
  headers.append(
    'set-cookie',
    `kawan_admin_session=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`,
  )
  headers.append(
    'set-cookie',
    `kawan_admin_csrf=${encodeURIComponent(csrfToken)}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Strict`,
  )
  return headers
}

function expiredAdminCookies() {
  const headers = new Headers()
  headers.append(
    'set-cookie',
    'kawan_admin_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
  )
  headers.append(
    'set-cookie',
    'kawan_admin_csrf=; Path=/; Max-Age=0; Secure; SameSite=Strict',
  )
  return headers
}

async function getAdminSession(request, env) {
  if (!env.DB?.prepare) return null
  const token = parseCookies(request).kawan_admin_session
  if (!token) return null
  const tokenHash = await sha256(token)
  const now = Date.now()
  return env.DB.prepare(
    `SELECT
       users.id,
       users.email,
       users.role,
       sessions.csrf_hash,
       sessions.expires_at
     FROM admin_sessions AS sessions
     INNER JOIN admin_users AS users ON users.id = sessions.admin_user_id
     WHERE sessions.token_hash = ?
       AND sessions.expires_at > ?
       AND users.status = 'active'
     LIMIT 1`,
  ).bind(tokenHash, now).first()
}

async function requireAdmin(request, env, allowedRoles, write = false) {
  if (!env.DB?.prepare) {
    return { error: fail('管理数据库尚未连接。', 503, 'storage_unavailable') }
  }
  if (write) {
    const originError = requireSameOrigin(request)
    if (originError) return { error: originError }
  }
  const admin = await getAdminSession(request, env)
  if (!admin) return { error: fail('请先登录管理后台。', 401, 'admin_auth_required') }
  if (!ADMIN_ROLES.has(admin.role) || !allowedRoles.includes(admin.role)) {
    return { error: fail('当前账号没有执行此操作的权限。', 403, 'admin_forbidden') }
  }
  if (write) {
    const cookies = parseCookies(request)
    const cookieToken = cookies.kawan_admin_csrf || ''
    const headerToken = request.headers.get('x-kawan-csrf') || ''
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
      return { error: fail('安全校验已失效，请刷新页面后重试。', 403, 'invalid_csrf') }
    }
    const submittedHash = await sha256(headerToken)
    if (!safeEqual(submittedHash, String(admin.csrf_hash || ''))) {
      return { error: fail('安全校验已失效，请重新登录。', 403, 'invalid_csrf') }
    }
  }
  return {
    admin: {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      expiresAt: admin.expires_at,
    },
  }
}

async function createAdminSession(request, env) {
  if (!env.DB?.prepare) return fail('管理数据库尚未连接。', 503, 'storage_unavailable')
  const originError = requireSameOrigin(request)
  if (originError) return originError
  if (!env.KAWAN_ADMIN_EMAIL || !env.KAWAN_ADMIN_ACCESS_KEY) {
    return fail('管理后台尚未完成安全配置。', 503, 'admin_not_configured')
  }
  const rateLimit = await consumeRateLimit(request, env, 'admin_login')
  if (!rateLimit.ok) return rateLimit.response

  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const email = clean(payload.email, 160).toLowerCase()
  const accessKey = String(payload.accessKey ?? payload.password ?? '')
  if (!email || !accessKey || accessKey.length > 512) {
    return fail('请输入管理员邮箱和访问密钥。', 400, 'admin_credentials_required')
  }

  const [submittedEmailHash, configuredEmailHash, submittedKeyHash, configuredKeyHash] = await Promise.all([
    sha256(email),
    sha256(String(env.KAWAN_ADMIN_EMAIL).trim().toLowerCase()),
    sha256(accessKey),
    sha256(String(env.KAWAN_ADMIN_ACCESS_KEY)),
  ])
  if (!safeEqual(submittedEmailHash, configuredEmailHash)
    || !safeEqual(submittedKeyHash, configuredKeyHash)) {
    return fail('管理员邮箱或访问密钥不正确。', 401, 'invalid_admin_credentials')
  }

  const now = Date.now()
  const expiresAt = now + (ADMIN_SESSION_HOURS * 60 * 60 * 1000)
  const sessionToken = randomToken(32)
  const csrfToken = randomToken(24)
  const [tokenHash, csrfHash] = await Promise.all([
    sha256(sessionToken),
    sha256(csrfToken),
  ])
  const existingAdmin = await env.DB.prepare(
    'SELECT id FROM admin_users WHERE email = ? LIMIT 1',
  ).bind(email).first()
  const adminUserId = existingAdmin?.id || `admin_${configuredEmailHash.slice(0, 24)}`
  const actor = { id: adminUserId, role: 'owner' }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO admin_users (id, email, role, status, created_at, updated_at, version)
       VALUES (?, ?, 'owner', 'active', ?, ?, 1)
       ON CONFLICT(email) DO UPDATE SET
         role = 'owner',
         status = 'active',
         updated_at = excluded.updated_at`,
    ).bind(adminUserId, email, now, now),
    env.DB.prepare(
      `INSERT INTO admin_sessions (
        token_hash, admin_user_id, csrf_hash, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?)`,
    ).bind(tokenHash, adminUserId, csrfHash, now, expiresAt),
    env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
    auditInsert(env, {
      actor,
      action: 'admin.session_created',
      targetType: 'admin_user',
      targetId: adminUserId,
      now,
    }),
    env.DB.prepare(
      'DELETE FROM rate_limits WHERE key_hash = ? AND action = ?',
    ).bind(rateLimit.keyHash, 'admin_login'),
  ])

  return json({
    ok: true,
    admin: { id: adminUserId, email, role: 'owner', expiresAt },
  }, { headers: adminCookies(sessionToken, csrfToken) })
}

async function readAdminSession(request, env) {
  const auth = await requireAdmin(request, env, [...ADMIN_ROLES])
  if (auth.error) return auth.error
  return json({ ok: true, admin: auth.admin })
}

async function deleteAdminSession(request, env) {
  const auth = await requireAdmin(request, env, [...ADMIN_ROLES], true)
  if (auth.error) return auth.error
  const token = parseCookies(request).kawan_admin_session
  const tokenHash = await sha256(token)
  const now = Date.now()
  await env.DB.batch([
    auditInsert(env, {
      actor: auth.admin,
      action: 'admin.session_deleted',
      targetType: 'admin_user',
      targetId: auth.admin.id,
      now,
    }),
    env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(tokenHash),
  ])
  return json({ ok: true }, { headers: expiredAdminCookies() })
}

function adminPost(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    area: row.area,
    price: row.price || '',
    contactType: row.contact_type,
    contact: row.contact,
    eventAt: row.event_at,
    venue: row.venue || '',
    clubSlug: row.club_slug || '',
    clubName: row.club_name || '',
    status: row.status,
    moderationNote: row.moderation_note || '',
    moderatedBy: row.moderated_by || '',
    moderatedAt: row.moderated_at,
    version: Number(row.version || 1),
    reportCount: Number(row.report_count || 0),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }
}

async function adminOverview(request, env) {
  const auth = await requireAdmin(request, env, [...ADMIN_ROLES])
  if (auth.error) return auth.error
  const now = Date.now()
  const metrics = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM posts WHERE status = 'published' AND expires_at > ?) AS published_posts,
       (SELECT COUNT(*) FROM posts WHERE status = 'hidden') AS hidden_posts,
       (SELECT COUNT(*) FROM reports WHERE status = 'pending') AS pending_reports,
       (SELECT COUNT(*) FROM club_applications WHERE status = 'pending') AS pending_club_applications,
       (SELECT COUNT(*) FROM club_accounts WHERE status = 'active') AS active_clubs,
       (SELECT COUNT(*) FROM club_accounts WHERE status IN ('suspended', 'revoked')) AS restricted_clubs`,
  ).bind(now).first()
  return json({
    ok: true,
    metrics: {
      publishedPosts: Number(metrics?.published_posts || 0),
      hiddenPosts: Number(metrics?.hidden_posts || 0),
      pendingReports: Number(metrics?.pending_reports || 0),
      pendingClubApplications: Number(metrics?.pending_club_applications || 0),
      activeClubs: Number(metrics?.active_clubs || 0),
      restrictedClubs: Number(metrics?.restricted_clubs || 0),
    },
    rules: {
      maxImagesPerPost: MAX_POST_IMAGES,
      adminSessionHours: ADMIN_SESSION_HOURS,
      clubSessionDays: SESSION_DAYS,
      maxUploadBytes: MAX_UPLOAD_BYTES,
      postStatuses: [...POST_STATUSES],
      clubStatuses: [...CLUB_STATUSES],
    },
  })
}

async function adminListPosts(request, env) {
  const auth = await requireAdmin(request, env, ['owner', 'moderator', 'analyst'])
  if (auth.error) return auth.error
  const url = new URL(request.url)
  const limit = integerParam(url.searchParams.get('limit'), 50, 1, 100)
  const offset = integerParam(url.searchParams.get('offset'), 0, 0, 10_000)
  const status = clean(url.searchParams.get('status'), 20)
  const hasStatusFilter = POST_STATUSES.has(status)
  const query = clean(url.searchParams.get('q'), 120).toLowerCase()
  const conditions = []
  const bindings = []
  if (hasStatusFilter) {
    conditions.push('status = ?')
    bindings.push(status)
  }
  if (query) {
    conditions.push(`(
      LOWER(title) LIKE ? ESCAPE '!'
      OR LOWER(COALESCE(club_name, '')) LIKE ? ESCAPE '!'
      OR LOWER(id) LIKE ? ESCAPE '!'
      OR LOWER(area) LIKE ? ESCAPE '!'
    )`)
    const pattern = `%${escapeLike(query)}%`
    bindings.push(pattern, pattern, pattern, pattern)
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const statement = env.DB.prepare(
    `SELECT
       id, category, title, description, area, price, contact_type, contact,
       event_at, venue, club_slug, club_name, status, moderation_note,
       moderated_by, moderated_at, version, created_at, expires_at,
       (SELECT COUNT(*) FROM reports WHERE reports.post_id = posts.id) AS report_count
     FROM posts
     ${whereClause}
     ORDER BY COALESCE(moderated_at, created_at) DESC
     LIMIT ? OFFSET ?`,
  ).bind(...bindings, limit, offset)
  const totalPrepared = env.DB.prepare(
    `SELECT COUNT(*) AS count FROM posts ${whereClause}`,
  )
  const totalStatement = bindings.length ? totalPrepared.bind(...bindings) : totalPrepared
  const [result, totalRow] = await Promise.all([
    statement.all(),
    totalStatement.first(),
  ])
  return json({
    ok: true,
    posts: (result.results || []).map(adminPost),
    total: Number(totalRow?.count || 0),
    limit,
    offset,
  })
}

async function adminListReports(request, env) {
  const auth = await requireAdmin(request, env, ['owner', 'moderator', 'analyst'])
  if (auth.error) return auth.error
  const url = new URL(request.url)
  const limit = integerParam(url.searchParams.get('limit'), 50, 1, 100)
  const offset = integerParam(url.searchParams.get('offset'), 0, 0, 10_000)
  const status = clean(url.searchParams.get('status'), 20)
  const hasStatusFilter = ['pending', 'resolved'].includes(status)
  const reportSelect = `SELECT
       reports.id,
       reports.post_id,
       reports.reason,
       reports.status,
       reports.resolution,
       reports.resolved_by,
       reports.resolved_at,
       reports.version,
       reports.created_at,
       posts.title AS post_title,
       posts.category AS post_category,
       posts.description AS post_description,
       posts.area AS post_area,
       posts.contact_type AS post_contact_type,
       posts.contact AS post_contact,
       posts.image_key AS post_image_key,
       posts.status AS post_status
     FROM reports
     LEFT JOIN posts ON posts.id = reports.post_id
     ${hasStatusFilter ? 'WHERE reports.status = ?' : ''}
     ORDER BY
       CASE WHEN reports.status = 'pending' THEN 0 ELSE 1 END,
       reports.created_at DESC
     LIMIT ? OFFSET ?`
  const statement = hasStatusFilter
    ? env.DB.prepare(reportSelect).bind(status, limit, offset)
    : env.DB.prepare(reportSelect).bind(limit, offset)
  const [result, totalRow] = await Promise.all([
    statement.all(),
    hasStatusFilter
      ? env.DB.prepare('SELECT COUNT(*) AS count FROM reports WHERE status = ?').bind(status).first()
      : env.DB.prepare('SELECT COUNT(*) AS count FROM reports').first(),
  ])
  const rows = result.results || []
  const imageMap = imageMapForRows(await imageRowsForPosts(
    env,
    rows.map((row) => row.post_id).filter(Boolean),
  ))
  return json({
    ok: true,
    reports: rows.map((row) => {
      const imageKeys = [...new Set([
        ...(imageMap.get(row.post_id) || []),
        row.post_image_key,
      ].filter(Boolean))]
      return {
        id: row.id,
        postId: row.post_id,
        reason: row.reason,
        status: row.status,
        resolution: row.resolution || '',
        resolvedBy: row.resolved_by || '',
        resolvedAt: row.resolved_at,
        version: Number(row.version || 1),
        createdAt: row.created_at,
        post: {
          id: row.post_id,
          title: row.post_title || '',
          category: row.post_category || '',
          description: row.post_description || '',
          area: row.post_area || '',
          contactType: row.post_contact_type || '',
          contact: row.post_contact || '',
          imageUrls: imageKeys.map(adminMediaUrl),
          status: row.post_status || 'deleted',
        },
      }
    }),
    total: Number(totalRow?.count || 0),
    limit,
    offset,
  })
}

async function adminListClubs(request, env) {
  const auth = await requireAdmin(request, env, ['owner', 'club_reviewer', 'analyst'])
  if (auth.error) return auth.error
  const [clubsResult, applicationsResult, clubTotal, applicationTotal] = await Promise.all([
    env.DB.prepare(
      `SELECT
         slug, name, status, key_issued_at, last_verified_at, updated_at, version
       FROM club_accounts
       ORDER BY updated_at DESC, name`,
    ).all(),
    env.DB.prepare(
      `SELECT
         id, club_name, ukm_email, contact, note, status, club_slug,
         decision_note, reviewed_by, reviewed_at, version, created_at
       FROM club_applications
       ORDER BY
         CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 100`,
    ).all(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM club_accounts').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM club_applications').first(),
  ])
  return json({
    ok: true,
    clubs: (clubsResult.results || []).map((row) => ({
      slug: row.slug,
      name: row.name,
      status: row.status,
      keyIssuedAt: row.key_issued_at,
      lastVerifiedAt: row.last_verified_at,
      updatedAt: row.updated_at,
      version: Number(row.version || 1),
    })),
    applications: (applicationsResult.results || []).map((row) => ({
      id: row.id,
      clubName: row.club_name,
      ukmEmail: row.ukm_email,
      contact: row.contact,
      note: row.note || '',
      status: row.status,
      clubSlug: row.club_slug || '',
      decisionNote: row.decision_note || '',
      reviewedBy: row.reviewed_by || '',
      reviewedAt: row.reviewed_at,
      version: Number(row.version || 1),
      createdAt: row.created_at,
    })),
    totals: {
      clubs: Number(clubTotal?.count || 0),
      applications: Number(applicationTotal?.count || 0),
    },
  })
}

async function adminListAuditLogs(request, env) {
  const auth = await requireAdmin(request, env, ['owner', 'analyst'])
  if (auth.error) return auth.error
  const url = new URL(request.url)
  const limit = integerParam(url.searchParams.get('limit'), 50, 1, 100)
  const offset = integerParam(url.searchParams.get('offset'), 0, 0, 10_000)
  const [result, totalRow] = await Promise.all([
    env.DB.prepare(
    `SELECT
       audit_logs.id,
       audit_logs.actor_user_id,
       audit_logs.actor_role,
       audit_logs.action,
       audit_logs.target_type,
       audit_logs.target_id,
       audit_logs.metadata_json,
       audit_logs.created_at,
       admin_users.email AS actor_email
     FROM audit_logs
     LEFT JOIN admin_users ON admin_users.id = audit_logs.actor_user_id
     ORDER BY audit_logs.created_at DESC
     LIMIT ? OFFSET ?`,
    ).bind(limit, offset).all(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM audit_logs').first(),
  ])
  return json({
    ok: true,
    auditLogs: (result.results || []).map((row) => {
      let metadata = null
      try {
        metadata = row.metadata_json ? JSON.parse(row.metadata_json) : null
      } catch {
        metadata = null
      }
      return {
        id: row.id,
        actorUserId: row.actor_user_id,
        actorEmail: row.actor_email || '',
        actorRole: row.actor_role,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata,
        reason: metadata?.reason || metadata?.note || '',
        createdAt: row.created_at,
      }
    }),
    total: Number(totalRow?.count || 0),
    limit,
    offset,
  })
}

async function adminUpdatePostStatus(request, env, postId) {
  const auth = await requireAdmin(request, env, ['owner', 'moderator'], true)
  if (auth.error) return auth.error
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const status = clean(payload.status, 20)
  const version = Number(payload.version)
  const reason = clean(payload.reason, 300)
  if (!POST_STATUSES.has(status)) return fail('帖子状态必须是 published 或 hidden。')
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail('缺少有效的帖子版本。', 400, 'version_required')
  }

  const post = await env.DB.prepare(
    'SELECT id, status, version FROM posts WHERE id = ? LIMIT 1',
  ).bind(postId).first()
  if (!post) return fail('帖子不存在。', 404, 'not_found')
  if (Number(post.version || 1) !== version) {
    return fail('帖子已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }

  const now = Date.now()
  const results = await env.DB.batch([
    auditInsert(env, {
      actor: auth.admin,
      action: 'post.status_changed',
      targetType: 'post',
      targetId: postId,
      metadata: {
        fromStatus: post.status,
        toStatus: status,
        reason: auditText(reason) || null,
      },
      guardSql: 'SELECT 1 FROM posts WHERE id = ? AND version = ?',
      guardValues: [postId, version],
      now,
    }),
    env.DB.prepare(
      `UPDATE posts
       SET status = ?,
           moderation_note = ?,
           moderated_by = ?,
           moderated_at = ?,
           version = version + 1
       WHERE id = ? AND version = ?`,
    ).bind(status, reason || null, auth.admin.id, now, postId, version),
  ])
  if (Number(results?.[1]?.meta?.changes ?? 1) === 0) {
    return fail('帖子已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }
  return json({
    ok: true,
    post: {
      id: postId,
      status,
      version: version + 1,
      moderatedAt: now,
    },
  })
}

async function adminResolveReport(request, env, reportId) {
  const auth = await requireAdmin(request, env, ['owner', 'moderator'], true)
  if (auth.error) return auth.error
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const decision = clean(payload.decision ?? payload.action, 30)
  const version = Number(payload.version)
  const note = clean(payload.note, 300)
  if (!['hide_post', 'dismiss'].includes(decision)) {
    return fail('举报处理方式必须是 hide_post 或 dismiss。')
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail('缺少有效的举报版本。', 400, 'version_required')
  }

  const report = await env.DB.prepare(
    'SELECT id, post_id, status, version FROM reports WHERE id = ? LIMIT 1',
  ).bind(reportId).first()
  if (!report) return fail('举报不存在。', 404, 'not_found')
  if (report.status !== 'pending' || Number(report.version || 1) !== version) {
    return fail('举报已被其他管理员处理，请刷新后重试。', 409, 'version_conflict')
  }

  const now = Date.now()
  const statements = [
    auditInsert(env, {
      actor: auth.admin,
      action: 'report.resolved',
      targetType: 'report',
      targetId: reportId,
      metadata: {
        decision,
        postId: report.post_id,
        note: auditText(note) || null,
      },
      guardSql: `SELECT 1 FROM reports
                 WHERE id = ? AND version = ? AND status = 'pending'`,
      guardValues: [reportId, version],
      now,
    }),
    env.DB.prepare(
      `UPDATE reports
       SET status = 'resolved',
           resolution = ?,
           resolved_by = ?,
           resolved_at = ?,
           version = version + 1
       WHERE id = ? AND version = ? AND status = 'pending'`,
    ).bind(decision, auth.admin.id, now, reportId, version),
  ]
  if (decision === 'hide_post') {
    statements.push(
      env.DB.prepare(
        `UPDATE posts
         SET status = 'hidden',
             moderation_note = ?,
             moderated_by = ?,
             moderated_at = ?,
             version = version + 1
         WHERE id = ? AND status <> 'hidden'`,
      ).bind(note || 'Hidden after report review', auth.admin.id, now, report.post_id),
    )
  }
  const results = await env.DB.batch(statements)
  if (Number(results?.[1]?.meta?.changes ?? 1) === 0) {
    return fail('举报已被其他管理员处理，请刷新后重试。', 409, 'version_conflict')
  }
  return json({
    ok: true,
    report: {
      id: reportId,
      postId: report.post_id,
      status: 'resolved',
      resolution: decision,
      version: version + 1,
      resolvedAt: now,
    },
  })
}

function normalizeClubSlug(value, clubName) {
  const supplied = clean(value, 60).toLowerCase()
  const fromName = clean(clubName, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const candidate = supplied || fromName || `club-${randomToken(5)}`
  return /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(candidate) ? candidate : ''
}

async function adminDecideClubApplication(request, env, applicationId) {
  const auth = await requireAdmin(request, env, ['owner', 'club_reviewer'], true)
  if (auth.error) return auth.error
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const decision = clean(payload.decision, 20)
  const version = Number(payload.version)
  const note = clean(payload.note, 300)
  if (!['approve', 'reject'].includes(decision)) {
    return fail('申请处理方式必须是 approve 或 reject。')
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail('缺少有效的申请版本。', 400, 'version_required')
  }

  const application = await env.DB.prepare(
    `SELECT id, club_name, status, version
     FROM club_applications
     WHERE id = ?
     LIMIT 1`,
  ).bind(applicationId).first()
  if (!application) return fail('社团申请不存在。', 404, 'not_found')
  if (application.status !== 'pending' || Number(application.version || 1) !== version) {
    return fail('申请已被其他管理员处理，请刷新后重试。', 409, 'version_conflict')
  }

  const clubSlug = decision === 'approve'
    ? normalizeClubSlug(payload.clubSlug, application.club_name)
    : ''
  if (decision === 'approve' && !clubSlug) {
    return fail('请提供只包含小写字母、数字和连字符的社团标识。')
  }
  if (decision === 'approve') {
    const existing = await env.DB.prepare(
      'SELECT slug FROM club_accounts WHERE slug = ? LIMIT 1',
    ).bind(clubSlug).first()
    if (existing) return fail('该社团标识已被使用。', 409, 'club_slug_conflict')
  }

  const now = Date.now()
  let accessKey = null
  let keyHash = null
  if (decision === 'approve') {
    accessKey = `kawan_club_${randomToken(32)}`
    keyHash = await sha256(accessKey)
  }
  const statements = [
    auditInsert(env, {
      actor: auth.admin,
      action: decision === 'approve' ? 'club_application.approved' : 'club_application.rejected',
      targetType: 'club_application',
      targetId: applicationId,
      metadata: decision === 'approve'
        ? { decision, clubSlug, note: auditText(note) || null }
        : { decision, note: auditText(note) || null },
      guardSql: `SELECT 1 FROM club_applications
                 WHERE id = ? AND version = ? AND status = 'pending'`,
      guardValues: [applicationId, version],
      now,
    }),
    env.DB.prepare(
      `UPDATE club_applications
       SET status = ?,
           club_slug = ?,
           decision_note = ?,
           reviewed_by = ?,
           reviewed_at = ?,
           version = version + 1
       WHERE id = ? AND version = ? AND status = 'pending'`,
    ).bind(
      decision === 'approve' ? 'approved' : 'rejected',
      clubSlug || null,
      note || null,
      auth.admin.id,
      now,
      applicationId,
      version,
    ),
  ]
  if (decision === 'approve') {
    statements.push(
      env.DB.prepare(
        `INSERT INTO club_accounts (
          slug, name, status, key_hash, key_issued_at, approved_by,
          last_verified_at, updated_at, version
        ) VALUES (?, ?, 'active', ?, ?, ?, 0, ?, 1)`,
      ).bind(clubSlug, application.club_name, keyHash, now, auth.admin.id, now),
    )
  }

  const results = await env.DB.batch(statements)
  if (Number(results?.[1]?.meta?.changes ?? 1) === 0) {
    return fail('申请已被其他管理员处理，请刷新后重试。', 409, 'version_conflict')
  }
  return json({
    ok: true,
    application: {
      id: applicationId,
      status: decision === 'approve' ? 'approved' : 'rejected',
      clubSlug,
      version: version + 1,
      reviewedAt: now,
    },
    ...(accessKey ? {
      club: {
        slug: clubSlug,
        name: application.club_name,
        status: 'active',
        version: 1,
      },
      accessKey,
    } : {}),
  })
}

async function adminUpdateClubStatus(request, env, clubSlug) {
  const auth = await requireAdmin(request, env, ['owner', 'club_reviewer'], true)
  if (auth.error) return auth.error
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const status = clean(payload.status, 20)
  const version = Number(payload.version)
  const reason = clean(payload.reason, 300)
  if (!CLUB_STATUSES.has(status)) {
    return fail('社团状态必须是 active、suspended 或 revoked。')
  }
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail('缺少有效的社团版本。', 400, 'version_required')
  }

  const account = await env.DB.prepare(
    'SELECT slug, name, status, version FROM club_accounts WHERE slug = ? LIMIT 1',
  ).bind(clubSlug).first()
  if (!account) return fail('社团账号不存在。', 404, 'not_found')
  if (Number(account.version || 1) !== version) {
    return fail('社团账号已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }

  const now = Date.now()
  const results = await env.DB.batch([
    auditInsert(env, {
      actor: auth.admin,
      action: 'club.status_changed',
      targetType: 'club',
      targetId: clubSlug,
      metadata: {
        fromStatus: account.status,
        toStatus: status,
        reason: auditText(reason) || null,
      },
      guardSql: 'SELECT 1 FROM club_accounts WHERE slug = ? AND version = ?',
      guardValues: [clubSlug, version],
      now,
    }),
    env.DB.prepare(
      `UPDATE club_accounts
       SET status = ?,
           key_hash = CASE WHEN ? = 'revoked' THEN NULL ELSE key_hash END,
           updated_at = ?,
           version = version + 1
       WHERE slug = ? AND version = ?`,
    ).bind(status, status, now, clubSlug, version),
    env.DB.prepare('DELETE FROM club_sessions WHERE club_slug = ?').bind(clubSlug),
  ])
  if (Number(results?.[1]?.meta?.changes ?? 1) === 0) {
    return fail('社团账号已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }
  return json({
    ok: true,
    club: {
      slug: clubSlug,
      name: account.name,
      status,
      version: version + 1,
      updatedAt: now,
    },
  })
}

async function adminRotateClubKey(request, env, clubSlug) {
  const auth = await requireAdmin(request, env, ['owner', 'club_reviewer'], true)
  if (auth.error) return auth.error
  const parsed = await readBoundedJson(request)
  if (parsed.error) return parsed.error
  const payload = parsed.payload
  const version = Number(payload.version)
  const reason = clean(payload.reason, 300)
  if (!Number.isSafeInteger(version) || version < 1) {
    return fail('缺少有效的社团版本。', 400, 'version_required')
  }
  const account = await env.DB.prepare(
    'SELECT slug, name, status, version FROM club_accounts WHERE slug = ? LIMIT 1',
  ).bind(clubSlug).first()
  if (!account) return fail('社团账号不存在。', 404, 'not_found')
  if (account.status === 'revoked') {
    return fail('已撤销的社团账号不能轮换密钥。', 409, 'club_revoked')
  }
  if (Number(account.version || 1) !== version) {
    return fail('社团账号已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }

  const accessKey = `kawan_club_${randomToken(32)}`
  const keyHash = await sha256(accessKey)
  const now = Date.now()
  const results = await env.DB.batch([
    auditInsert(env, {
      actor: auth.admin,
      action: 'club.key_rotated',
      targetType: 'club',
      targetId: clubSlug,
      metadata: { reason: auditText(reason) || null },
      guardSql: 'SELECT 1 FROM club_accounts WHERE slug = ? AND version = ?',
      guardValues: [clubSlug, version],
      now,
    }),
    env.DB.prepare(
      `UPDATE club_accounts
       SET key_hash = ?,
           key_issued_at = ?,
           updated_at = ?,
           version = version + 1
       WHERE slug = ? AND version = ?`,
    ).bind(keyHash, now, now, clubSlug, version),
    env.DB.prepare('DELETE FROM club_sessions WHERE club_slug = ?').bind(clubSlug),
  ])
  if (Number(results?.[1]?.meta?.changes ?? 1) === 0) {
    return fail('社团账号已被其他管理员更新，请刷新后重试。', 409, 'version_conflict')
  }
  return json({
    ok: true,
    club: {
      slug: clubSlug,
      name: account.name,
      status: account.status,
      version: version + 1,
      keyIssuedAt: now,
    },
    accessKey,
  })
}

async function serveAdminMedia(request, env) {
  const auth = await requireAdmin(request, env, ['owner', 'moderator', 'analyst'])
  if (auth.error) return auth.error
  if (!env.UPLOADS) return new Response('Not found', { status: 404 })
  const key = new URL(request.url).searchParams.get('key') || ''
  if (!key.startsWith('posts/')) return new Response('Not found', { status: 404 })
  const linkedPost = await env.DB.prepare(
    `SELECT posts.id
     FROM posts
     WHERE posts.image_key = ?
       OR EXISTS (
         SELECT 1
         FROM post_images
         WHERE post_images.post_id = posts.id
           AND post_images.image_key = ?
       )
     LIMIT 1`,
  ).bind(key, key).first()
  if (!linkedPost) return new Response('Not found', { status: 404 })
  const object = await env.UPLOADS.get(key)
  if (!object) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'private, no-store')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(object.body, { headers })
}

async function serveMedia(request, env, key) {
  if (!env.DB?.prepare || !env.UPLOADS || !key.startsWith('posts/')) {
    return new Response('Not found', { status: 404 })
  }
  const visiblePost = await env.DB.prepare(
    `SELECT posts.id
     FROM posts
     WHERE posts.status = 'published'
       AND posts.expires_at > ?
       AND (
         posts.image_key = ?
         OR EXISTS (
           SELECT 1
           FROM post_images
           WHERE post_images.post_id = posts.id
             AND post_images.image_key = ?
         )
       )
     LIMIT 1`,
  ).bind(Date.now(), key, key).first()
  if (!visiblePost) return new Response('Not found', { status: 404 })
  const object = await env.UPLOADS.get(key)
  if (!object) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'private, no-store')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(object.body, { headers })
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({
      ok: true,
      service: 'kawan-campus-ukm',
      storage: { d1: Boolean(env.DB), r2: Boolean(env.UPLOADS) },
    })
  }
  if (url.pathname === '/api/admin/session' && request.method === 'POST') {
    return createAdminSession(request, env)
  }
  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    return readAdminSession(request, env)
  }
  if (url.pathname === '/api/admin/session' && request.method === 'DELETE') {
    return deleteAdminSession(request, env)
  }
  if (url.pathname === '/api/admin/overview' && request.method === 'GET') {
    return adminOverview(request, env)
  }
  if (url.pathname === '/api/admin/posts' && request.method === 'GET') {
    return adminListPosts(request, env)
  }
  if (url.pathname === '/api/admin/reports' && request.method === 'GET') {
    return adminListReports(request, env)
  }
  if (url.pathname === '/api/admin/clubs' && request.method === 'GET') {
    return adminListClubs(request, env)
  }
  if (url.pathname === '/api/admin/audit-logs' && request.method === 'GET') {
    return adminListAuditLogs(request, env)
  }
  if (url.pathname === '/api/admin/media' && request.method === 'GET') {
    return serveAdminMedia(request, env)
  }
  const adminPostStatus = url.pathname.match(/^\/api\/admin\/posts\/([^/]+)\/status$/)
  if (adminPostStatus && request.method === 'PATCH') {
    return adminUpdatePostStatus(request, env, decodeURIComponent(adminPostStatus[1]))
  }
  const adminReportResolve = url.pathname.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/)
  if (adminReportResolve && request.method === 'POST') {
    return adminResolveReport(request, env, decodeURIComponent(adminReportResolve[1]))
  }
  const adminApplicationDecision = url.pathname.match(
    /^\/api\/admin\/club-applications\/([^/]+)\/decision$/,
  )
  if (adminApplicationDecision && request.method === 'POST') {
    return adminDecideClubApplication(
      request,
      env,
      decodeURIComponent(adminApplicationDecision[1]),
    )
  }
  const adminClubStatus = url.pathname.match(/^\/api\/admin\/clubs\/([^/]+)\/status$/)
  if (adminClubStatus && request.method === 'PATCH') {
    return adminUpdateClubStatus(
      request,
      env,
      decodeURIComponent(adminClubStatus[1]).toLowerCase(),
    )
  }
  const adminClubRotate = url.pathname.match(/^\/api\/admin\/clubs\/([^/]+)\/rotate-key$/)
  if (adminClubRotate && request.method === 'POST') {
    return adminRotateClubKey(
      request,
      env,
      decodeURIComponent(adminClubRotate[1]).toLowerCase(),
    )
  }
  if (url.pathname === '/api/posts' && request.method === 'GET') return listPosts(request, env)
  if (url.pathname === '/api/posts' && request.method === 'POST') return createPost(request, env)
  if (url.pathname === '/api/uploads' && request.method === 'POST') return uploadImage(request, env)
  if (url.pathname.startsWith('/api/posts/') && request.method === 'DELETE') {
    return deletePost(request, env, decodeURIComponent(url.pathname.slice('/api/posts/'.length)))
  }
  if (url.pathname === '/api/clubs/verify' && request.method === 'POST') return verifyClub(request, env)
  if (url.pathname === '/api/clubs/session' && request.method === 'GET') return clubSession(request, env)
  if (url.pathname === '/api/clubs/apply' && request.method === 'POST') return applyForClub(request, env)
  if (url.pathname === '/api/presence' && request.method === 'POST') return pulsePresence(request, env)
  if (url.pathname === '/api/reports' && request.method === 'POST') return reportPost(request, env)
  return fail('接口不存在。', 404, 'not_found')
}

async function runScheduledCleanup(env) {
  if (!env.DB?.prepare) return
  const now = Date.now()
  await cleanupPendingUploads(env, now)
  await cleanupExpiredPosts(env, now)
  await env.DB.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now).run()
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(request, env, url)
      if (url.pathname.startsWith('/media/')) {
        return await serveMedia(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)))
      }

      if (!env?.ASSETS?.fetch) {
        return new Response('Static assets binding is unavailable.', {
          status: 503,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      }

      const response = await env.ASSETS.fetch(request)
      if (response.status !== 404 || !isDocumentRequest(request, url)) {
        return secureAssetResponse(response)
      }
      return secureAssetResponse(await fetchIndex(request, env))
    } catch (error) {
      console.error('Kawan Campus request failed', {
        path: url.pathname,
        method: request.method,
        error: error instanceof Error ? error.message : String(error),
      })
      if (url.pathname.startsWith('/api/')) {
        return fail('系统暂时无法处理这个请求，请稍后再试。', 500, 'internal_error')
      }
      return new Response('Kawan Campus is temporarily unavailable.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runScheduledCleanup(env))
  },
}
