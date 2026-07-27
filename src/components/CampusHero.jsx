import { ArrowRight, CalendarDays, CheckCircle2, Search, ShieldCheck } from 'lucide-react'

export default function CampusHero({ t, search, onSearch, onPost, onEvents }) {
  const ukmTitle = t.heroTitle.startsWith('UKM ')
    ? { prefix: 'UKM', rest: t.heroTitle.slice(4) }
    : null

  return (
    <section className="campus-hero" id="top">
      <div className="hero-copy">
        <span className="hero-eyebrow">{t.heroEyebrow}</span>
        <h1>
          {ukmTitle ? (
            <>
              <span className="hero-title-prefix">{ukmTitle.prefix}</span>{' '}
              <span className="hero-title-rest">{ukmTitle.rest}</span>
            </>
          ) : t.heroTitle}
        </h1>
        <p>{t.heroSubtitle}</p>
        <div className="hero-actions">
          <button className="primary-cta" type="button" onClick={onPost}>
            {t.heroCta}
            <ArrowRight size={18} />
          </button>
          <button className="secondary-cta" type="button" onClick={onEvents}>
            <CalendarDays size={17} />
            {t.heroEvents}
          </button>
        </div>
        <div className="hero-trust">
          <span><ShieldCheck size={15} /> UKM-only community</span>
          <span><CheckCircle2 size={15} /> 中文 / English</span>
        </div>
      </div>

      <div className="hero-visual" role="img" aria-label="UKM students on campus">
        <div className="hero-image" />
        <div className="hero-live-card">
          <span>UKM TODAY</span>
          <strong>一个校园，更快认识彼此</strong>
          <small>One campus. Easier connections.</small>
        </div>
      </div>

      <label className="hero-search">
        <Search size={20} />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t.searchPlaceholder}
        />
        <kbd>⌘ K</kbd>
      </label>
    </section>
  )
}
