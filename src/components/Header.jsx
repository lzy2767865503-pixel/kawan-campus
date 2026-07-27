import { CalendarDays, ChevronDown, ChevronRight, Circle, Globe2, Plus, Wrench } from 'lucide-react'

export default function Header({ lang, setLang, online, onPost, onEvents }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Kawan Campus home">
        <img className="brand-symbol" src="/favicon.svg" alt="" aria-hidden="true" />
        <span className="brand-name">Kawan Campus</span>
        <span className="ukm-badge">UKM</span>
      </a>

      <nav className="main-nav" aria-label="Primary navigation">
        <a href="#discover">{lang === 'zh' ? '校园动态' : 'Campus feed'}</a>
        <button type="button" onClick={onEvents}>
          <CalendarDays size={15} />
          {lang === 'zh' ? '活动' : 'Events'}
        </button>
        <details className="nav-tools">
          <summary>
            <Wrench size={15} />
            {lang === 'zh' ? '功能' : 'Tools'}
            <span>2</span>
            <ChevronDown size={14} />
          </summary>
          <div>
            <a href="https://lrobotform.com/tools/#service" target="_blank" rel="noopener noreferrer">
              <strong>{lang === 'zh' ? '论文数据机器人' : 'Thesis Data Robot'}</strong>
              <small>{lang === 'zh' ? '问卷、论文与数据分析' : 'Survey, thesis and data analysis'}</small>
            </a>
            <a href="https://lrobotform.com/resume/" target="_blank" rel="noopener noreferrer">
              <strong>{lang === 'zh' ? '简历项目' : 'Resume Project'}</strong>
              <small>{lang === 'zh' ? '简历优化与求职材料' : 'CV and application materials'}</small>
            </a>
          </div>
        </details>
      </nav>

      <div className="header-actions">
        <span className="online-pill" title={lang === 'zh' ? '过去 3 分钟内活跃' : 'Active in the last 3 minutes'}>
          <Circle size={8} fill="currentColor" />
          <strong>{online}</strong>
          {lang === 'zh' ? '人在线' : ' online'}
        </span>
        <div className="language-switch" aria-label="Language">
          <Globe2 size={14} />
          <button type="button" className={lang === 'zh' ? 'active' : ''} onClick={() => setLang('zh')}>中</button>
          <span>/</span>
          <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>EN</button>
        </div>
        <button className="header-post" type="button" onClick={onPost}>
          <Plus size={17} />
          <span>{lang === 'zh' ? '发布' : 'Post'}</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </header>
  )
}
