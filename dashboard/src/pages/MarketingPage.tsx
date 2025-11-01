import React from 'react';
import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { ChartWrapper } from '../components/ui/ChartWrapper';
import { ensureRegistered } from '../lib/chartConfig';

ensureRegistered();

type MarketingType = 'all' | 'Ипотека' | 'Рассрочка' | 'Акции' | 'Скидки' | 'Подарки';

type PromotionRow = {
  jk: string;
  type: string;
  description: string;
};

export default function MarketingPage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [developerFilter, setDeveloperFilter] = useState<string>('all');
  const [programFilter, setProgramFilter] = useState<MarketingType>('all');
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Получаем все программы маркетинга
  const allPromotions = useMemo<PromotionRow[]>(() => {
    const projects = data?.projects ?? [];
    const rows: PromotionRow[] = [];

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const promotions = p?.promotions || [];
      promotions.forEach((promo: any) => {
        if (programFilter !== 'all' && promo.type !== programFilter) return;
        
        rows.push({
          jk: p.jk_name,
          type: promo.type || 'Прочее',
          description: promo.description || '',
        });
      });
    });

    return rows;
  }, [data, selectedJK, programFilter]);

  // Получаем уникальных застройщиков (упрощенно - используем первые буквы ЖК)
  const developers = useMemo(() => {
    const projects = data?.projects ?? [];
    const devs = new Set<string>();
    projects.forEach((p: any) => {
      const jk = p.jk_name || '';
      // Извлекаем застройщика из названия (упрощенно)
      const parts = jk.split(' ');
      if (parts.length > 0) {
        devs.add(parts[0]);
      }
    });
    return Array.from(devs).sort();
  }, [data]);

  // Подсчитываем распределение по типам
  const marketingDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    let total = 0;

    allPromotions.forEach((promo) => {
      const type = promo.type || 'Прочее';
      distribution[type] = (distribution[type] || 0) + 1;
      total++;
    });

    const labels: string[] = [];
    const data: number[] = [];
    const percentages: number[] = [];

    Object.entries(distribution).forEach(([type, count]) => {
      labels.push(type);
      data.push(count);
      percentages.push(total > 0 ? (count / total) * 100 : 0);
    });

    return {
      labels,
      data,
      percentages,
      colors: [
        'rgba(26, 115, 232, 0.8)',
        'rgba(52, 168, 83, 0.8)',
        'rgba(234, 67, 53, 0.8)',
        'rgba(255, 152, 0, 0.8)',
        'rgba(156, 39, 176, 0.8)',
      ],
    };
  }, [allPromotions]);

  // Данные для круговой диаграммы маркетинговой активности
  const activityChartData = useMemo(() => {
    return {
      labels: marketingDistribution.labels,
      datasets: [{
        data: marketingDistribution.data,
        backgroundColor: marketingDistribution.colors.slice(0, marketingDistribution.labels.length),
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }, [marketingDistribution]);

  // Данные для радар-графика анализа активностей
  const radarChartData = useMemo(() => {
    const types = ['Акции', 'Ипотека', 'Подарки', 'Рассрочка', 'Скидки'];
    const values = types.map(type => {
      const count = allPromotions.filter(p => p.type === type).length;
      // Преобразуем в условные единицы трат бюджета (упрощенно)
      return count * 100; // Каждая активность = 100 условных единиц
    });

    return {
      labels: types,
      datasets: [{
        label: 'Траты маркет. бюджета',
        data: values,
        backgroundColor: 'rgba(26, 115, 232, 0.2)',
        borderColor: '#1a73e8',
        borderWidth: 2,
        pointBackgroundColor: '#1a73e8',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#1a73e8',
      }],
    };
  }, [allPromotions]);

  // Инициализируем все ЖК как свернутые (expandedJK остается пустым)

  // Фильтруем промо-акции для таблицы
  const filteredPromotions = useMemo(() => {
    let filtered = allPromotions;
    
    if (developerFilter !== 'all') {
      filtered = filtered.filter(p => {
        const parts = p.jk.split(' ');
        return parts.length > 0 && parts[0] === developerFilter;
      });
    }

    return filtered.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      return a.type.localeCompare(b.type);
    });
  }, [allPromotions, developerFilter]);

  // Группируем по ЖК
  const groupedByJK = useMemo(() => {
    const groups: Record<string, PromotionRow[]> = {};
    filteredPromotions.forEach((row) => {
      if (!groups[row.jk]) {
        groups[row.jk] = [];
      }
      groups[row.jk].push(row);
    });
    return groups;
  }, [filteredPromotions]);

  const toggleJK = (jk: string) => {
    setExpandedJK((prev) => {
      const next = new Set(prev);
      if (next.has(jk)) {
        next.delete(jk);
      } else {
        next.add(jk);
      }
      return next;
    });
  };

  return (
    <Layout title="11. Анализ маркетингового бюджета">
      {/* Вкладки программ маркетинга */}
      <div style={{marginBottom: 16}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:8,marginTop:0}}>1 Программы:</h3>
        <div className="toggle" role="tablist" aria-label="Программы маркетинга" style={{marginBottom: 16}}>
          <button 
            className={`toggle-btn ${programFilter === 'all' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'all'} 
            onClick={() => setProgramFilter('all')}
            style={{padding:'8px 16px'}}
          >
            Все
          </button>
          <button 
            className={`toggle-btn ${programFilter === 'Ипотека' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'Ипотека'} 
            onClick={() => setProgramFilter('Ипотека')}
            style={{padding:'8px 16px'}}
          >
            Ипотека
          </button>
          <button 
            className={`toggle-btn ${programFilter === 'Рассрочка' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'Рассрочка'} 
            onClick={() => setProgramFilter('Рассрочка')}
            style={{padding:'8px 16px'}}
          >
            Рассрочка
          </button>
          <button 
            className={`toggle-btn ${programFilter === 'Акции' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'Акции'} 
            onClick={() => setProgramFilter('Акции')}
            style={{padding:'8px 16px'}}
          >
            Акции
          </button>
          <button 
            className={`toggle-btn ${programFilter === 'Скидки' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'Скидки'} 
            onClick={() => setProgramFilter('Скидки')}
            style={{padding:'8px 16px'}}
          >
            Скидки
          </button>
          <button 
            className={`toggle-btn ${programFilter === 'Подарки' ? 'is-active' : ''}`} 
            aria-pressed={programFilter === 'Подарки'} 
            onClick={() => setProgramFilter('Подарки')}
            style={{padding:'8px 16px'}}
          >
            Подарки
          </button>
        </div>
      </div>

      {/* Фильтры */}
      <div className="filter-container">
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>5 Фильтр:</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <select 
              value={developerFilter} 
              onChange={(e)=> setDeveloperFilter(e.target.value)} 
              style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:150}}
            >
              <option value="all">Застройщик: Все</option>
              {developers.map((dev) => (
                <option key={dev} value={dev}>{dev}</option>
              ))}
            </select>
            <select 
              value={selectedJK ?? ''} 
              onChange={(e)=> setSelectedJK(e.target.value)} 
              style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:150}}
            >
              <option value="">Жилой комплекс: Все</option>
              {(data?.projects ?? []).map((p: any)=> (
                <option key={p.jk_name} value={p.jk_name}>{p.jk_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Графики */}
      <div style={{display:'flex',gap:24,alignItems:'flex-start',marginBottom:24}} className="page-content-flex-mobile">
        {/* Круговая диаграмма маркетинговой активности */}
        <div style={{flex: 1, minWidth: 0}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>2 Диаграмма - Маркетинговая активность:</h3>
          <div className="card">
            <ChartWrapper type="pie" data={activityChartData} height={280} />
          </div>
        </div>

        {/* Радар-график анализа активностей */}
        <div style={{flex: 1, minWidth: 0}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>3 Диаграмма - Анализ активностей:</h3>
          <div className="card">
            <ChartWrapper 
              type="radar" 
              data={radarChartData} 
              height={280}
              options={{
                scales: {
                  r: {
                    beginAtZero: true,
                    ticks: {
                      display: false,
                    },
                    grid: {
                      color: 'rgba(232, 234, 237, 0.5)',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Таблица программ маркетинга с группировкой по ЖК */}
      <div>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>4 Диаграмма - Программы маркетинга:</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{textAlign:'left'}}>Жилой комплекс</th>
                <th>Тип</th>
                <th style={{textAlign:'left'}}>Предложение</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedByJK).length > 0 ? (
                Object.entries(groupedByJK).map(([jk, jkRows]) => {
                  const isExpanded = expandedJK.has(jk);
                  return (
                    <React.Fragment key={jk}>
                      {/* Строка-заголовок ЖК */}
                      <tr 
                        style={{ 
                          backgroundColor: '#f0f0f0',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                        onClick={() => toggleJK(jk)}
                      >
                        <td colSpan={3} style={{ padding: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', display: 'inline-block', width: '16px' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span>
                              <strong>{jk}</strong> ({jkRows.length} {jkRows.length === 1 ? 'программа' : jkRows.length < 5 ? 'программы' : 'программ'})
                            </span>
                          </span>
                        </td>
                      </tr>
                      {/* Строки программ */}
                      {isExpanded && jkRows.map((row, idx) => (
                        <tr key={`${jk}-${idx}`}>
                          <td style={{paddingLeft: '32px'}}></td>
                          <td style={{textAlign:'center'}}>{row.type}</td>
                          <td style={{textAlign:'left'}}>{row.description}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} style={{textAlign:'center', padding: '20px', color: 'var(--color-subtext)'}}>
                    Нет данных для выбранных фильтров
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}
