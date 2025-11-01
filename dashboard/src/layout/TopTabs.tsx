import { NavLink } from 'react-router-dom';

const tabs = [
  ['/', '1. Сводный'],
  ['/market', '2. Параметры рынка'],
  ['/express', '3. Экспресс'],
  ['/dynamics', '4. Динамика'],
  ['/dynamics/4.1', '4.1. Динамика'],
  ['/dynamics/4.2', '4.2. Динамика'],
  ['/dynamics/4.3', '4.3. Динамика'],
  ['/dynamics/4.4', '4.4. Динамика'],
  ['/competitive', '5. Конкурентный анализ'],
  ['/mortgage', '6. Ипотека'],
  ['/today', '7. Сегодня в продаже'],
  ['/forecast', '8. Перспектива'],
  ['/washout', '9. Вымываемость'],
  ['/new', '10. Новые лоты'],
  ['/marketing', '11. Маркетинг'],
  ['/commercial', '12. Коммерческая'],
];

export function TopTabs() {
  return (
    <nav className="sidebar-nav" aria-label="Навигация по отчётам">
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
