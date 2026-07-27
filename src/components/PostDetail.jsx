import {
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flag,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'

function copyFor(post, key, lang) {
  if (lang === 'zh') return post[`${key}Zh`] || post[key]
  return post[`${key}En`] || post[key]
}

export default function PostDetail({ post, category, lang, canDelete, onDelete, onReport, onClose, onToast }) {
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  useEffect(() => setActiveImageIndex(0), [post?.id])
  if (!post) return null
  const imageUrls = [...new Set([
    ...(post.imageUrls || []),
    post.imageUrl,
  ].filter(Boolean))]
  if (!imageUrls.length) imageUrls.push(category.fallbackImage)
  const activeImage = imageUrls[Math.min(activeImageIndex, imageUrls.length - 1)]
  const eventDate = post.eventAt && new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(post.eventAt)))

  const contactHref = post.contactType === 'WhatsApp'
    ? `https://wa.me/${String(post.contact).replace(/\D/g, '')}`
    : post.contactType === 'Phone'
      ? `tel:${String(post.contact).replace(/[^\d+]/g, '')}`
      : ''

  const copyContact = async () => {
    await navigator.clipboard.writeText(post.contact)
    onToast(lang === 'zh' ? '联系方式已复制' : 'Contact copied')
  }

  const submitReport = async () => {
    await onReport(post.id, reason)
    setReporting(false)
    setReason('')
  }

  return (
    <div className="modal-layer detail-layer" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <article className="post-detail" role="dialog" aria-modal="true">
        <button type="button" className="detail-close" onClick={onClose}><X size={20} /></button>
        <div className="detail-gallery">
          <div className="detail-image">
            <img src={activeImage} alt={copyFor(post, 'title', lang)} decoding="async" />
            {post.isDemo && <span className="demo-label">{lang === 'zh' ? '页面示例 · 并非真实帖子' : 'Page demo · Not a real post'}</span>}
            {imageUrls.length > 1 && <span className="detail-image-position">{activeImageIndex + 1} / {imageUrls.length}</span>}
          </div>
          {imageUrls.length > 1 && (
            <div className="detail-thumbnails" aria-label={lang === 'zh' ? '帖子图片' : 'Post images'}>
              {imageUrls.map((imageUrl, index) => (
                <button
                  className={activeImageIndex === index ? 'active' : ''}
                  type="button"
                  key={imageUrl}
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={lang === 'zh' ? `查看第 ${index + 1} 张图片` : `View image ${index + 1}`}
                >
                  <img src={imageUrl} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="detail-body">
          <div className="post-kicker-row">
            <span className="post-kicker" style={{ '--category': category.color, '--category-tint': category.tint }}>
              {lang === 'zh' ? category.zh : category.en}
            </span>
            {post.verifiedClub && <span className="club-verified"><ShieldCheck size={14} /> {lang === 'zh' ? '已验证社团' : 'Verified club'}</span>}
          </div>
          <h2>{copyFor(post, 'title', lang)}</h2>
          <div className="detail-meta">
            <span><MapPin size={15} /> {post.area}</span>
            {eventDate && <span><CalendarClock size={15} /> {eventDate}</span>}
          </div>
          {post.venue && <p className="detail-venue"><strong>{lang === 'zh' ? '地点：' : 'Venue: '}</strong>{post.venue}</p>}
          {post.clubName && <p className="detail-club"><CheckCircle2 size={15} /> {post.clubName}</p>}
          {post.price && <strong className="detail-price">{post.price}</strong>}
          <p className="detail-description">{copyFor(post, 'description', lang)}</p>

          <section className="public-contact-panel">
            <div>
              <strong>{lang === 'zh' ? '公开联系方式' : 'Public contact'}</strong>
              <span>{lang === 'zh' ? '请先说明你从 Kawan Campus 看到帖子' : 'Mention that you found this on Kawan Campus'}</span>
            </div>
            <div className="contact-value">
              <small>{post.contactType}</small>
              <strong>{post.contact}</strong>
              {!post.isDemo && (
                <>
                  <button type="button" onClick={copyContact} aria-label="Copy contact"><Copy size={17} /></button>
                  {contactHref && <a href={contactHref} target="_blank" rel="noreferrer"><ExternalLink size={17} /></a>}
                </>
              )}
            </div>
            {post.isDemo && <p>{lang === 'zh' ? '这是虚构示例，没有真实联系人，也不能用于交易。' : 'This is fictional demo content with no real contact or transaction.'}</p>}
          </section>

          <div className="safety-note">
            <ShieldAlert size={18} />
            <span>{lang === 'zh' ? '平台不担保交易。租房请实地看房，二手交易请当面验货，不要提前支付不明押金。' : 'The platform does not guarantee transactions. View rentals and inspect goods in person; never send suspicious deposits.'}</span>
          </div>

          {reporting ? (
            <div className="report-box">
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                <option value="">{lang === 'zh' ? '选择原因' : 'Choose a reason'}</option>
                <option value="疑似诈骗 / Suspected scam">{lang === 'zh' ? '疑似诈骗' : 'Suspected scam'}</option>
                <option value="信息不实 / Misleading information">{lang === 'zh' ? '信息不实' : 'Misleading information'}</option>
                <option value="不当内容 / Inappropriate content">{lang === 'zh' ? '不当内容' : 'Inappropriate content'}</option>
              </select>
              <button type="button" onClick={submitReport} disabled={!reason}>{lang === 'zh' ? '提交举报' : 'Submit'}</button>
            </div>
          ) : (
            !post.isDemo && <button className="report-action" type="button" onClick={() => setReporting(true)}><Flag size={14} /> {lang === 'zh' ? '举报这条内容' : 'Report this post'}</button>
          )}

          {canDelete && !post.isDemo && (
            <button className="delete-own-post" type="button" onClick={() => onDelete(post.id)}>
              <Trash2 size={15} />
              {lang === 'zh' ? '删除我发布的帖子' : 'Delete my post'}
            </button>
          )}
        </div>
      </article>
    </div>
  )
}
