import {
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  KeyRound,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPost, uploadPostImage, verifyClub } from '../api/kawanApi.js'

function initialForm(category) {
  return {
    category: category === 'all' ? 'housing' : category,
    title: '',
    area: '',
    description: '',
    price: '',
    contactType: 'WhatsApp',
    contact: '',
    eventAt: '',
  }
}

const locationCopy = {
  events: {
    zh: '活动地点 *',
    en: 'Event location *',
    placeholderZh: '例如 Pusanika、DECTAR 或完整集合地点',
    placeholderEn: 'e.g. Pusanika, DECTAR or a clear meeting point',
  },
  housing: {
    zh: '小区 / 地址范围 *',
    en: 'Neighbourhood / location *',
    placeholderZh: '例如 Evo Soho, Block A, 12 楼（不要写房号）',
    placeholderEn: 'e.g. Evo Soho, Block A, Level 12 (no unit number)',
  },
  marketplace: {
    zh: '交易 / 自取地点 *',
    en: 'Meet-up / pickup location *',
    placeholderZh: '例如 UKM Pusanika 门口',
    placeholderEn: 'e.g. UKM Pusanika entrance',
  },
  meetups: {
    zh: '集合地点 *',
    en: 'Meeting point *',
    placeholderZh: '例如 UKM Stadium 羽毛球馆',
    placeholderEn: 'e.g. UKM Stadium badminton hall',
  },
  carpool: {
    zh: '上车地点 / 路线 *',
    en: 'Pickup / route *',
    placeholderZh: '例如 UKM → KL Sentral，Pusanika 上车',
    placeholderEn: 'e.g. UKM → KL Sentral, pickup at Pusanika',
  },
  vehicles: {
    zh: '看车地点 *',
    en: 'Viewing location *',
    placeholderZh: '例如 Bandar Baru Bangi，周末可看车',
    placeholderEn: 'e.g. Bandar Baru Bangi, weekend viewing',
  },
}

const formGuidance = {
  events: {
    titleZh: '例如：UKM 国际文化夜｜周五 7PM｜DECTAR',
    titleEn: 'e.g. International Culture Night | Fri 7 PM | DECTAR',
    detailsZh: '例如：免费入场，6:30 开始签到；请携带 UKM 学生证。',
    detailsEn: 'e.g. Free entry, check-in starts at 6:30 PM; bring your UKM student card.',
    imagesZh: '例如：活动海报或主办方现场照',
    imagesEn: 'e.g. event poster or organiser photo',
  },
  housing: {
    titleZh: '例如：Evo Soho 次卧招女生室友｜8 月入住',
    titleEn: 'e.g. Female roommate for Evo Soho room | Move in August',
    detailsZh: '例如：RM650/月，水电平分；限女生，不吸烟，可步行到 KTM。',
    detailsEn: 'e.g. RM650/month plus shared utilities; female, non-smoker, walkable to KTM.',
    imagesZh: '例如：卧室、书桌和公共区域',
    imagesEn: 'e.g. bedroom, desk and shared area',
  },
  marketplace: {
    titleZh: '例如：九成新 IKEA 书桌｜RM80｜Pusanika 自取',
    titleEn: 'e.g. IKEA desk, like new | RM80 | Pusanika pickup',
    detailsZh: '例如：使用 6 个月，无明显划痕；周一至周五 5PM 后可取。',
    detailsEn: 'e.g. Used for 6 months, no obvious scratches; pickup after 5 PM on weekdays.',
    imagesZh: '例如：正面、细节和瑕疵位置',
    imagesEn: 'e.g. front, details and any defects',
  },
  meetups: {
    titleZh: '例如：周三晚 UKM Stadium 羽毛球｜还差 2 人',
    titleEn: 'e.g. Wednesday badminton at UKM Stadium | 2 spots left',
    detailsZh: '例如：7–9PM，新手友好；球拍自带，场地费大家平分。',
    detailsEn: 'e.g. 7–9 PM, beginners welcome; bring a racket and split the court fee.',
    imagesZh: '例如：场地照片或活动说明图',
    imagesEn: 'e.g. venue photo or activity guide',
  },
  carpool: {
    titleZh: '例如：周五 6PM UKM → KL Sentral｜2 个空位',
    titleEn: 'e.g. Fri 6 PM UKM → KL Sentral | 2 seats',
    detailsZh: '例如：Pusanika 上车，预计 7PM 到；每人 RM15，只带小件行李。',
    detailsEn: 'e.g. Pusanika pickup, arrive around 7 PM; RM15 each, small bags only.',
    imagesZh: '例如：车辆外观或路线截图',
    imagesEn: 'e.g. vehicle photo or route screenshot',
  },
  vehicles: {
    titleZh: '例如：2020 Proton X50 1.5T｜RM65,000｜Bangi 看车',
    titleEn: 'e.g. 2020 Proton X50 1.5T | RM65,000 | View in Bangi',
    detailsZh: '例如：一手车，52,000km，定期保养；可预约周末试驾。',
    detailsEn: 'e.g. One owner, 52,000 km, regularly serviced; weekend test drive available.',
    imagesZh: '例如：四面外观、内饰和里程表',
    imagesEn: 'e.g. exterior, interior and odometer',
  },
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES_PER_POST = 12
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export default function PostModal({
  open,
  lang,
  categories,
  areas,
  initialCategory,
  clubSession,
  onClubSession,
  onClose,
  onPublished,
  onApplyClub,
}) {
  const [form, setForm] = useState(() => initialForm(initialCategory))
  const [images, setImages] = useState([])
  const [clubSlug, setClubSlug] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initialForm(initialCategory))
    setImages([])
    setUploadProgress(0)
    setError('')
    setAccepted(false)
  }, [initialCategory, open])

  useEffect(() => {
    if (!open) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.body.classList.add('modal-open')
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [busy, onClose, open])

  const previewItems = useMemo(() => images.map((image) => ({
    image,
    url: URL.createObjectURL(image),
  })), [images])
  useEffect(() => () => {
    previewItems.forEach((item) => URL.revokeObjectURL(item.url))
  }, [previewItems])

  if (!open) return null

  const selectedCategory = categories.find((category) => category.id === form.category) || categories[0]
  const isEvent = form.category === 'events'
  const hasDate = isEvent || form.category === 'carpool'
  const hasPrice = ['housing', 'marketplace', 'carpool', 'vehicles'].includes(form.category)
  const canSubmit = accepted && (!isEvent || clubSession)
  const selectedLocationCopy = locationCopy[form.category] || locationCopy.marketplace
  const selectedGuidance = formGuidance[form.category] || formGuidance.marketplace
  const pricePlaceholder = {
    housing: 'RM 650 / 月',
    marketplace: 'RM 80',
    carpool: 'RM 15 / 人',
    vehicles: 'RM 65,000',
  }[form.category] || 'RM 80'

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const handleVerify = async () => {
    setVerifying(true)
    setError('')
    try {
      const result = await verifyClub(clubSlug, accessKey)
      onClubSession(result.club)
      setAccessKey('')
    } catch (verificationError) {
      setError(verificationError.message)
    } finally {
      setVerifying(false)
    }
  }

  const addImages = (event) => {
    const selected = Array.from(event.target.files || [])
    event.target.value = ''
    const invalid = selected.find((image) => (
      !ALLOWED_IMAGE_TYPES.has(image.type) || image.size > MAX_IMAGE_BYTES
    ))
    if (invalid) {
      setError(lang === 'zh'
        ? `${invalid.name} 无法添加：只支持 JPG、PNG、WebP，且单张不超过 5MB。`
        : `${invalid.name} was not added. Use JPG, PNG or WebP up to 5MB each.`)
    }
    const validCandidates = selected.filter((image) => (
      ALLOWED_IMAGE_TYPES.has(image.type) && image.size <= MAX_IMAGE_BYTES
    ))
    const remainingSlots = Math.max(0, MAX_IMAGES_PER_POST - images.length)
    const valid = validCandidates.slice(0, remainingSlots)
    if (validCandidates.length > remainingSlots) {
      setError(lang === 'zh'
        ? `每条帖子最多上传 ${MAX_IMAGES_PER_POST} 张图片。`
        : `Each post can include up to ${MAX_IMAGES_PER_POST} images.`)
    }
    if (valid.length) {
      setImages((current) => [...current, ...valid])
      if (!invalid && validCandidates.length <= remainingSlots) setError('')
    }
  }

  const removeImage = (index) => {
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setUploadProgress(0)
    setError('')
    try {
      const uploadSession = images.length ? crypto.randomUUID() : ''
      for (let index = 0; index < images.length; index += 1) {
        await uploadPostImage(images[index], uploadSession, index)
        setUploadProgress(index + 1)
      }
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'eventAt' && value) payload.set(key, new Date(value).toISOString())
        else payload.set(key, value)
      })
      if (uploadSession) payload.set('uploadSession', uploadSession)
      const result = await createPost(payload)
      onPublished(result.post, result.ownerToken)
      onClose()
    } catch (submissionError) {
      setError(submissionError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section className="post-modal" role="dialog" aria-modal="true" aria-labelledby="post-modal-title">
        <header className="post-modal-header">
          <div>
            <h2 id="post-modal-title">{lang === 'zh' ? '发布到 UKM' : 'Post to UKM'}</h2>
            <p>{lang === 'zh' ? '选择板块，照着例子填写即可。' : 'Choose a category and follow the examples.'}</p>
          </div>
          <button className="icon-close" type="button" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={21} />
          </button>
        </header>

        <form className="quick-post-form" onSubmit={handleSubmit}>
          <fieldset className="category-choice">
            <legend>{lang === 'zh' ? '1. 选择板块，例如「房间室友」' : '1. Choose a category, e.g. “Housing”'}</legend>
            <div>
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={form.category === category.id ? 'selected' : ''}
                  style={{ '--category': category.color, '--category-tint': category.tint }}
                >
                  <input
                    type="radio"
                    name="category-choice"
                    value={category.id}
                    checked={form.category === category.id}
                    onChange={() => update('category', category.id)}
                  />
                  <span>{lang === 'zh' ? category.zh : category.en}</span>
                  {category.id === 'events' && <LockKeyhole size={12} />}
                </label>
              ))}
            </div>
          </fieldset>

          {isEvent && (
            <section className={`club-verification ${clubSession ? 'verified' : ''}`}>
              {clubSession ? (
                <>
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>{clubSession.name}</strong>
                    <span>{lang === 'zh' ? '社团账号已验证，本设备 7 天内可发布活动。' : 'Club verified. This device can publish events for 7 days.'}</span>
                  </div>
                  <ShieldCheck size={20} />
                </>
              ) : (
                <>
                  <KeyRound size={23} />
                  <div className="club-verify-copy">
                    <strong>{lang === 'zh' ? '活动只允许 UKM 社团发布' : 'Events are for UKM clubs only'}</strong>
                    <span>{lang === 'zh' ? '第一次输入社团账号和密钥，验证后授权 7 天。密钥不会保存在浏览器里。' : 'Enter the club account and key once for a 7-day secure session. The key is not stored in the browser.'}</span>
                    <div className="club-key-fields">
                      <input
                        value={clubSlug}
                        onChange={(event) => setClubSlug(event.target.value)}
                        placeholder={lang === 'zh' ? '社团账号，例如 ukm-example-club' : 'Club account, e.g. ukm-example-club'}
                        autoComplete="username"
                      />
                      <input
                        type="password"
                        value={accessKey}
                        onChange={(event) => setAccessKey(event.target.value)}
                        placeholder={lang === 'zh' ? '发布密钥' : 'Publishing key'}
                        autoComplete="current-password"
                      />
                      <button type="button" onClick={handleVerify} disabled={verifying || !clubSlug || !accessKey}>
                        {verifying ? (lang === 'zh' ? '验证中…' : 'Checking…') : (lang === 'zh' ? '验证' : 'Verify')}
                      </button>
                    </div>
                    <button className="text-action" type="button" onClick={onApplyClub}>
                      {lang === 'zh' ? '还没有权限？提交社团申请 →' : 'Need access? Submit a club application →'}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          <div className="form-section-title">
            <strong>{lang === 'zh' ? '2. 按例子写关键信息' : '2. Follow the examples'}</strong>
          </div>

          <div className="form-grid">
            <label className="form-field field-wide">
              <span>{lang === 'zh' ? '标题 *' : 'Title *'}</span>
              <input
                required
                minLength={4}
                maxLength={80}
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                placeholder={lang === 'zh' ? selectedGuidance.titleZh : selectedGuidance.titleEn}
              />
            </label>

            <label className="form-field">
              <span><MapPin size={14} /> {lang === 'zh' ? selectedLocationCopy.zh : selectedLocationCopy.en}</span>
              <input
                required
                minLength={2}
                maxLength={160}
                list="ukm-location-suggestions"
                value={form.area}
                onChange={(event) => update('area', event.target.value)}
                placeholder={lang === 'zh' ? selectedLocationCopy.placeholderZh : selectedLocationCopy.placeholderEn}
              />
              <datalist id="ukm-location-suggestions">
                {areas.map((area) => <option key={area.id} value={area.id}>{lang === 'zh' ? area.noteZh : area.noteEn}</option>)}
              </datalist>
            </label>

            {hasPrice && (
              <label className="form-field">
                <span>{lang === 'zh' ? '价格 / 费用' : 'Price / cost'}</span>
                <input
                  value={form.price}
                  onChange={(event) => update('price', event.target.value)}
                  placeholder={pricePlaceholder}
                />
              </label>
            )}

            {hasDate && (
              <label className="form-field">
                <span><CalendarClock size={14} /> {isEvent ? (lang === 'zh' ? '活动时间 *' : 'Event time *') : (lang === 'zh' ? '出发时间 *' : 'Departure *')}</span>
                <input
                  type="datetime-local"
                  required
                  value={form.eventAt}
                  onChange={(event) => update('eventAt', event.target.value)}
                />
              </label>
            )}

            <label className="form-field field-wide">
              <span>{lang === 'zh' ? '具体说明 *' : 'Details *'}</span>
              <textarea
                required
                minLength={12}
                maxLength={1200}
                rows={3}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder={lang === 'zh' ? selectedGuidance.detailsZh : selectedGuidance.detailsEn}
              />
              <small>{form.description.length}/1200</small>
            </label>
          </div>

          <div className="contact-upload-row">
            <section className="contact-fields">
              <strong>{lang === 'zh' ? '3. 联系方式，例如 WhatsApp +60 12-345 6789' : '3. Contact, e.g. WhatsApp +60 12-345 6789'}</strong>
              <div>
                <select value={form.contactType} onChange={(event) => update('contactType', event.target.value)}>
                  <option>WhatsApp</option>
                  <option>WeChat</option>
                  <option>Phone</option>
                  <option>Telegram</option>
                </select>
                <input
                  required
                  value={form.contact}
                  onChange={(event) => update('contact', event.target.value)}
                  placeholder={form.contactType === 'WeChat' ? 'WeChat ID' : '+60 12-345 6789'}
                />
              </div>
            </section>

            <section className="image-upload-panel">
              <div className="image-upload-heading">
                <div>
                  <strong>{lang === 'zh' ? '4. 图片（可选）' : '4. Images (optional)'}</strong>
                  <span>
                    {lang === 'zh'
                      ? `${selectedGuidance.imagesZh} · 最多 ${MAX_IMAGES_PER_POST} 张 · 单张 ≤ 5MB`
                      : `${selectedGuidance.imagesEn} · up to ${MAX_IMAGES_PER_POST} · 5MB each`}
                  </span>
                </div>
                {images.length > 0 && <b>{images.length}</b>}
              </div>
              <div className="image-preview-grid">
                {previewItems.map((item, index) => (
                  <div className="image-preview-item" key={`${item.image.name}-${item.image.size}-${item.image.lastModified}-${index}`}>
                    <img src={item.url} alt={`${lang === 'zh' ? '待上传图片' : 'Selected image'} ${index + 1}`} />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={busy}
                      aria-label={lang === 'zh' ? `移除第 ${index + 1} 张图片` : `Remove image ${index + 1}`}
                    >
                      <X size={14} />
                    </button>
                    <span>{index + 1}</span>
                  </div>
                ))}
                <label className="image-upload">
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={addImages}
                    disabled={busy || images.length >= MAX_IMAGES_PER_POST}
                  />
                  <ImagePlus size={22} />
                  <strong>{images.length ? (lang === 'zh' ? '继续添加' : 'Add more') : (lang === 'zh' ? '选择图片' : 'Choose images')}</strong>
                  <small>JPG / PNG / WebP</small>
                </label>
              </div>
              {busy && images.length > 0 && (
                <p className="upload-progress">
                  <Upload size={14} />
                  {lang === 'zh'
                    ? `正在逐张上传 ${uploadProgress}/${images.length}`
                    : `Uploading images ${uploadProgress}/${images.length}`}
                </p>
              )}
            </section>
          </div>

          <section className="publish-rule-box">
            <label>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>{lang === 'zh'
                ? '我确认：联系方式会公开；租房不写具体房号；活动和拼车按时间下架，其余内容 30 天后下架。'
                : 'I confirm: contact details are public; rentals omit unit numbers; events and rides expire by date, all other posts after 30 days.'}
              </span>
            </label>
          </section>

          {error && <div className="form-error" role="alert">{error}</div>}

          <footer className="post-modal-footer">
            <button type="submit" className="publish-button" disabled={!canSubmit || busy}>
              {busy
                ? (lang === 'zh' ? '发布中…' : 'Publishing…')
                : (lang === 'zh' ? `发布「${selectedCategory.zh}」` : `Publish ${selectedCategory.en}`)}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
