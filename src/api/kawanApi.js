async function parseResponse(response) {
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error?.message || '请求失败，请稍后再试。')
  }
  return data
}

export async function fetchPosts() {
  return parseResponse(await fetch('/api/posts', {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  }))
}

export async function fetchClubSession() {
  return parseResponse(await fetch('/api/clubs/session', {
    headers: { accept: 'application/json' },
    credentials: 'same-origin',
  }))
}

export async function createPost(formData) {
  return parseResponse(await fetch('/api/posts', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  }))
}

export async function uploadPostImage(image, uploadSession, position) {
  const formData = new FormData()
  formData.set('uploadSession', uploadSession)
  formData.set('position', String(position))
  formData.set('image', image, image.name)
  return parseResponse(await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  }))
}

export async function deletePost(postId, ownerToken) {
  return parseResponse(await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    headers: { 'x-kawan-delete-token': ownerToken },
    credentials: 'same-origin',
  }))
}

export async function verifyClub(clubSlug, accessKey) {
  return parseResponse(await fetch('/api/clubs/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ clubSlug, accessKey }),
  }))
}

export async function applyForClub(payload) {
  return parseResponse(await fetch('/api/clubs/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  }))
}

export async function pulsePresence(sessionId) {
  return parseResponse(await fetch('/api/presence', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ sessionId }),
  }))
}

export async function reportPost(postId, reason) {
  return parseResponse(await fetch('/api/reports', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ postId, reason }),
  }))
}
