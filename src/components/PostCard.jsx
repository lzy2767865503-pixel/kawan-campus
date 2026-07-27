import { CalendarClock, CheckCircle2, Clock3, MapPin, ShieldCheck } from 'lucide-react'

function titleFor(post, lang) {
  return lang === 'zh' ? (post.titleZh || post.title) : (post.titleEn || post.title)
}

function timeAgo(timestamp, lang) {
  const minutes = Math.max(1, Math.floor((Date.now() - Number(timestamp)) / 60000))
  if (minutes < 60) return lang === 'zh' ? `${minutes} 分钟前` : `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return lang === 'zh' ? `${hours} 小时前` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return lang === 'zh' ? `${days} 天前` : `${days}d ago`
}

function eventDate(timestamp, lang) {
  if (!timestamp) return null
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(Number(timestamp)))
}

export default function PostCard({ post, category, lang, onOpen }) {
  const imageCount = post.imageUrls?.length || (post.imageUrl ? 1 : 0)
  return (
    <article
      className={`post-card post-${post.category}`}
      style={{ '--category': category.color, '--category-tint': category.tint }}
    >
      <button className="post-card-main" type="button" onClick={() => onOpen(post)}>
        <div className="post-image-wrap">
          <img src={post.imageUrl || category.fallbackImage} alt="" loading="lazy" decoding="async" />
          {post.isDemo && <span className="demo-label">{lang === 'zh' ? '页面示例 · 非真实' : 'Demo · Not real'}</span>}
          {!post.isDemo && imageCount > 1 && (
            <span className="post-image-count">{imageCount} {lang === 'zh' ? '张' : 'photos'}</span>
          )}
        </div>
        <div className="post-card-copy">
          <div className="post-kicker-row">
            <span className="post-kicker">{lang === 'zh' ? category.zh : category.en}</span>
            {post.verifiedClub && (
              <span className="club-verified"><ShieldCheck size={13} /> {lang === 'zh' ? '已验证社团' : 'Verified club'}</span>
            )}
          </div>
          <h3>{titleFor(post, lang)}</h3>
          <div className="post-meta">
            <span><MapPin size={14} /> {post.area}</span>
            {post.eventAt ? (
              <span><CalendarClock size={14} /> {eventDate(post.eventAt, lang)}</span>
            ) : (
              <span><Clock3 size={14} /> {timeAgo(post.createdAt, lang)}</span>
            )}
          </div>
          <p>{lang === 'zh' ? (post.descriptionZh || post.description) : (post.descriptionEn || post.description)}</p>
          {post.clubName && <span className="club-by"><CheckCircle2 size={13} /> {post.clubName}</span>}
        </div>
        <div className="post-card-price">
          <strong>{post.price || (lang === 'zh' ? '联系发布者' : 'Contact')}</strong>
          <span>{lang === 'zh' ? '查看详情' : 'View details'} →</span>
        </div>
      </button>
    </article>
  )
}
