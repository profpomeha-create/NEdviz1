import type { ReactNode } from 'react';
import { TopTabs } from './TopTabs';

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="page">
      <div className="page-layout">
        <aside className="page-sidebar">
          <TopTabs />
        </aside>
        <div className="page-main">
          <header className="page-header">
            <h1 className="page-title">{title}</h1>
          </header>
          <main className="page-content">
            <div className="card">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
