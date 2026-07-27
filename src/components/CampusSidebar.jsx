import { ArrowUpRight, CalendarDays, KeyRound, MapPin, ShieldCheck } from 'lucide-react'

function eventDate(timestamp, lang) {
  if (!timestamp) return ''
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-MY', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(Number(timestamp)))
}

export default function CampusSidebar({ t, lang, eventPosts, areas, onOpenPost, onApplyClub, onArea }) {
  return (
    <aside className="campus-sidebar">
      <section className="sidebar-card events-card">
        <div className="sidebar-heading">
          <span><CalendarDays size={17} /></span>
          <div>
            <small>UKM EVENTS</small>
            <h2>{t.thisWeek}</h2>
          </div>
        </div>
        <div className="week-events">
          {eventPosts.slice(0, 3).map((post) => (
            <button key={post.id} type="button" onClick={() => onOpenPost(post)}>
              <time>{eventDate(post.eventAt, lang)}</time>
              <strong>{lang === 'zh' ? (post.titleZh || post.title) : (post.titleEn || post.title)}</strong>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
      </section>

      <section className="sidebar-card area-card">
        <div className="sidebar-heading">
          <span><MapPin size={17} /></span>
          <div>
            <small>AROUND CAMPUS</small>
            <h2>{t.hotspots}</h2>
          </div>
        </div>
        <div className="hotspot-list">
          {areas.slice(0, 4).map((area, index) => (
            <button key={area.id} type="button" onClick={() => onArea(area.id)}>
              <b>0{index + 1}</b>
              <span>
                <strong>{lang === 'zh' ? area.zh : area.en}</strong>
                <small>{lang === 'zh' ? area.noteZh : area.noteEn}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="club-access-card">
        <ShieldCheck size={24} />
        <h3>{t.clubOnly}</h3>
        <p>{t.clubOnlySub}</p>
        <button type="button" onClick={onApplyClub}>
          <KeyRound size={16} />
          {t.applyClub}
        </button>
      </section>
    </aside>
  )
}
