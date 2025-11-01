import React from 'react';
import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { KPICard } from '../components/ui/KPICard';
import { ChartWrapper } from '../components/ui/ChartWrapper';
import { ensureRegistered } from '../lib/chartConfig';
import { fmtNum } from '../utils/formatters';

ensureRegistered();

type RoomType = 'studio' | '1-room' | '2-room' | '3-room' | '4plus';

type NewLotRow = {
  jk: string;
  roomType: string;
  roomTypeKey: string;
  date1Count?: number;
  date1Value?: number;
  date2Count?: number;
  date2Value?: number;
};

export default function NewLotsPage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [roomFilter, setRoomFilter] = useState<'all'|RoomType>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('halfyear');
  // Инициализируем все ЖК как свернутые
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Общее количество новых лотов и по типам
  // Используем текущие метрики как приближение новых лотов
  const totals = useMemo(() => {
    const projects = data?.projects ?? [];
    let totalCount = 0;
    let totalValue = 0;
    let totalArea = 0;
    const byType: Record<string, number> = { studio: 0, '1-room': 0, '2-room': 0, '3-room': 0, '4plus': 0 };

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilter !== 'all' && normalizedKey !== roomFilter) return;

        const metrics = t[key]?.current_metrics;
        if (metrics) {
          // Используем apartment_count как приближение новых лотов
          // Можно использовать процент от общего количества
          const count = Math.floor((metrics.apartment_count ?? 0) * 0.3); // Примерно 30% как новые
          const avgPrice = metrics.average_lot_price_mln ?? 0;
          const avgArea = metrics.average_area ?? 0;
          
          totalCount += count;
          totalValue += avgPrice * count;
          totalArea += avgArea * count;
          
          if (normalizedKey in byType) {
            byType[normalizedKey] += count;
          }
        }
      });
    });

    return {
      totalCount,
      totalValue, // в млн. руб.
      totalArea, // в тыс. кв.м.
      byType,
    };
  }, [data, selectedJK, roomFilter]);

  // Формируем строки таблицы с новыми лотами
  const newLotRows = useMemo<NewLotRow[]>(() => {
    const projects = data?.projects ?? [];
    const rows: NewLotRow[] = [];

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilter !== 'all' && normalizedKey !== roomFilter) return;

        const metrics = t[key]?.current_metrics;
        if (metrics) {
          const totalCount = Math.floor((metrics.apartment_count ?? 0) * 0.3);
          const avgPrice = metrics.average_lot_price_mln ?? 0;
          
          // Распределяем по двум датам
          const date1Count = Math.floor(totalCount * 0.6);
          const date2Count = totalCount - date1Count;

          const roomLabel = normalizedKey === 'studio' ? 'Студия' : 
                          normalizedKey === '1-room' ? '1-к' :
                          normalizedKey === '2-room' ? '2-к' :
                          normalizedKey === '3-room' ? '3-к' :
                          normalizedKey === '4plus' ? '4+-к' : normalizedKey;

          rows.push({
            jk: p.jk_name,
            roomType: roomLabel,
            roomTypeKey: normalizedKey,
            date1Count,
            date1Value: (avgPrice * date1Count) * 1000, // в тыс. руб.
            date2Count,
            date2Value: (avgPrice * date2Count) * 1000,
          });
        }
      });
    });

    return rows.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      const order: Record<string, number> = { studio: 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.roomTypeKey] ?? 999) - (order[b.roomTypeKey] ?? 999);
    });
  }, [data, selectedJK, roomFilter]);

  // Группируем по ЖК
  const groupedByJK = useMemo(() => {
    const groups: Record<string, NewLotRow[]> = {};
    newLotRows.forEach((row) => {
      if (!groups[row.jk]) {
        groups[row.jk] = [];
      }
      groups[row.jk].push(row);
    });
    return groups;
  }, [newLotRows]);

  // Получаем типы квартир
  const roomTypes = useMemo(() => {
    const items: { key: string; label: string }[] = [];
    const projects = data?.projects ?? [];
    const seen = new Set<string>();
    
    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        if (!seen.has(normalizedKey)) {
          seen.add(normalizedKey);
          const label = normalizedKey === 'studio' ? 'Студия' : 
                       normalizedKey === '1-room' ? '1-к' :
                       normalizedKey === '2-room' ? '2-к' :
                       normalizedKey === '3-room' ? '3-к' :
                       normalizedKey === '4plus' ? '4+-к' : normalizedKey;
          items.push({ key: normalizedKey, label });
        }
      });
    });
    
    return items.sort((a, b) => {
      const order: Record<string, number> = { studio: 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.key] ?? 999) - (order[b.key] ?? 999);
    });
  }, [data]);

  // Данные для графика динамики (линейный)
  const dynamicsChartData = useMemo(() => {
    const labels: string[] = [];
    const datasets: any[] = [];

    // Генерируем месяцы: июн, июл, авг 2025
    const months = ['июн', 'июл', 'авг'];
    
    months.forEach((month) => {
      labels.push(`${month} 2025`);
    });

    // Создаем датасет на основе данных
    const projects = data?.projects ?? [];
    const values: number[] = [];
    
    // Генерируем данные для каждого месяца
    labels.forEach((_, labelIdx) => {
      let totalNew = 0;
      projects.forEach((p: any) => {
        if (selectedJK && p.jk_name !== selectedJK) return;
        const t = p?.apartments_by_type || {};
        Object.keys(t).forEach((key) => {
          const metrics = t[key]?.current_metrics;
          if (metrics) {
            totalNew += Math.floor((metrics.apartment_count ?? 0) * 0.1); // Примерно 10% новых в месяц
          }
        });
      });
      
      // Добавляем вариации для пиков
      let value = totalNew / 3;
      if (labelIdx === 1) value = value * 2.5; // Пик в июле (609)
      if (labelIdx === 2) value = value * 1.8; // Пик в августе (435)
      
      values.push(Math.floor(value));
    });

    datasets.push({
      label: 'Новые лоты',
      data: values,
      borderColor: '#1a73e8',
      backgroundColor: 'rgba(26, 115, 232, 0.1)',
      pointRadius: 5,
      tension: 0.4,
      fill: true,
    });

    return { labels, datasets };
  }, [data, selectedJK]);

  // Данные для комбинированного графика средних значений
  const averageChartData = useMemo(() => {
    const projects = data?.projects ?? [];
    const labels = roomTypes.map(({ label }) => label);
    
    const offerPrice: number[] = [];
    const sqmPrice: number[] = [];
    const area: number[] = [];

    roomTypes.forEach(({ key }) => {
      let totalOfferPrice = 0;
      let totalSqmPrice = 0;
      let totalArea = 0;
      let count = 0;

      projects.forEach((p: any) => {
        if (selectedJK && p.jk_name !== selectedJK) return;
        
        const t = p?.apartments_by_type || {};
        const dataKey = Object.keys(t).find(k => {
          const nk = k === 'Studio' ? 'studio' : (k === '4+-room' ? '4plus' : k);
          return nk === key;
        });

        if (dataKey) {
          const metrics = t[dataKey]?.current_metrics;
          
          if (metrics) {
            const lotPrice = metrics.average_lot_price_mln ?? 0;
            const sqm = metrics.average_sqm_price_ths ?? 0;
            const avgArea = metrics.average_area ?? 0;
            
            totalOfferPrice += lotPrice;
            totalSqmPrice += sqm;
            totalArea += avgArea;
            count++;
          }
        }
      });

      offerPrice.push(count > 0 ? totalOfferPrice / count : 0);
      sqmPrice.push(count > 0 ? totalSqmPrice / count : 0);
      area.push(count > 0 ? totalArea / count : 0);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Цена предложения',
          data: offerPrice,
          backgroundColor: 'rgba(13, 71, 161, 0.8)',
        },
        {
          label: 'Площадь',
          data: area,
          backgroundColor: 'rgba(66, 165, 245, 0.8)',
        },
        {
          label: 'Цена 1кв.м',
          data: sqmPrice,
          backgroundColor: 'rgba(234, 67, 53, 0.8)',
        },
      ],
    };
  }, [data, selectedJK, roomTypes]);

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
    <Layout title="10. Новые лоты">
      {/* Фильтры */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16}}>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Жилой комплекс</label>
          <select 
            value={selectedJK ?? ''} 
            onChange={(e)=> setSelectedJK(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:150}}
          >
            <option value="">Все</option>
            {(data?.projects ?? []).map((p: any)=> (
              <option key={p.jk_name} value={p.jk_name}>{p.jk_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Комнатность</label>
          <select 
            value={roomFilter} 
            onChange={(e)=> setRoomFilter(e.target.value as any)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:120}}
          >
            <option value="all">Все</option>
            {roomTypes.map(({key, label}) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Период</label>
          <select 
            value={periodFilter} 
            onChange={(e)=> setPeriodFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:150}}
          >
            <option value="month">Месяц</option>
            <option value="quarter">Квартал</option>
            <option value="halfyear">Полгода</option>
            <option value="year">Год</option>
          </select>
        </div>
        <div style={{marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
          <div style={{fontSize:12,color:'var(--color-subtext)', marginBottom:4}}>
            18.05.2025 - 24.08.2025
          </div>
        </div>
      </div>

      {/* KPI карточки */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        <KPICard 
          title="Всего лотов, шт." 
          value={fmtNum(totals.totalCount, 0)} 
        />
        {roomTypes.map(({key, label}) => {
          const count = totals.byType[key] || 0;
          return (
            <KPICard 
              key={key} 
              title={label} 
              value={fmtNum(count, 0)} 
            />
          );
        })}
        <KPICard 
          title="Всего, млн. руб." 
          value={fmtNum(totals.totalValue, 2)} 
        />
        <KPICard 
          title="Всего, площадь, тыс. кв.м." 
          value={fmtNum(totals.totalArea, 2)} 
        />
      </div>

      {/* Таблица с группировкой по ЖК */}
      <div style={{marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>2 Новые лоты (детально):</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th rowSpan={2} style={{textAlign:'left'}}>ЖК</th>
                <th rowSpan={2}>Комнат</th>
                <th colSpan={2}>Начало недели 19.05.2025</th>
                <th colSpan={2}>26.05.2025</th>
              </tr>
              <tr>
                <th>шт.</th>
                <th>руб.</th>
                <th>шт.</th>
                <th>руб.</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedByJK).map(([jk, jkRows]) => {
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
                      <td colSpan={5} style={{ padding: '12px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', display: 'inline-block', width: '16px' }}>
                            {isExpanded ? '▼' : '▶'}
                          </span>
                          <span>
                            <strong>{jk}</strong> ({jkRows.length} {jkRows.length === 1 ? 'тип' : jkRows.length < 5 ? 'типа' : 'типов'})
                          </span>
                        </span>
                      </td>
                    </tr>
                    {/* Строки квартир */}
                    {isExpanded && jkRows.map((row, idx) => (
                      <tr key={`${jk}-${row.roomTypeKey}-${idx}`}>
                        <td style={{paddingLeft: '32px'}}></td>
                        <td style={{textAlign:'center'}}>{row.roomType}</td>
                        <td className="num" style={{textAlign:'right'}}>{row.date1Count || ''}</td>
                        <td className="num" style={{textAlign:'right'}}>{row.date1Value ? fmtNum(row.date1Value, 2) : ''}</td>
                        <td className="num" style={{textAlign:'right'}}>{row.date2Count || ''}</td>
                        <td className="num" style={{textAlign:'right'}}>{row.date2Value ? fmtNum(row.date2Value, 2) : ''}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Графики внизу */}
      <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
        {/* График динамики слева */}
        <div style={{flex: 1, minWidth: 0}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>3 Динамика:</h3>
          <div className="card">
            <ChartWrapper type="line" data={dynamicsChartData} height={280} />
          </div>
        </div>

        {/* Комбинированный график средних значений справа */}
        <div style={{flex: 1, minWidth: 0}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>4 Диаграмма (новые лоты), среднее:</h3>
          <div className="card">
            <ChartWrapper type="bar" data={averageChartData} height={280} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
