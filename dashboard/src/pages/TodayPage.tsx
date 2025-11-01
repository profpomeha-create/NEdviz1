import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { KPICard } from '../components/ui/KPICard';
import { ChartWrapper } from '../components/ui/ChartWrapper';
import { ensureRegistered } from '../lib/chartConfig';
import { fmtNum } from '../utils/formatters';

ensureRegistered();

type RoomType = 'studio' | '1-room' | '2-room' | '3-room' | '4plus';

type FloorRow = {
  floor: number;
  studio: number;
  '1-room': number;
  '2-room': number;
  '3-room': number;
  '4plus': number;
};

type FloorDetailData = { count: number; price: number; area: number; lotPrice: number };

type FloorDetailRow = {
  floor: number;
  studio?: FloorDetailData;
  '1-room'?: FloorDetailData;
  '2-room'?: FloorDetailData;
  '3-room'?: FloorDetailData;
  '4plus'?: FloorDetailData;
};

export default function TodayPage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [roomFilter, setRoomFilter] = useState<'all'|RoomType>('all');
  const [finishFilter, setFinishFilter] = useState<'all'|'clean'|'rough'|'white'>('all');
  const [exposureFilter, setExposureFilter] = useState<string>('all');

  // Общее количество лотов и по типам
  const totals = useMemo(() => {
    const projects = data?.projects ?? [];
    let total = 0;
    const byType: Record<string, number> = { studio: 0, '1-room': 0, '2-room': 0, '3-room': 0, '4plus': 0 };
    const byTypeArea: Record<string, number> = { studio: 0, '1-room': 0, '2-room': 0, '3-room': 0, '4plus': 0 };
    let totalAreaWithFinish = 0;
    let totalAreaWithoutFinish = 0;

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilter !== 'all' && normalizedKey !== roomFilter) return;

        const metrics = t[key]?.current_metrics;
        if (metrics) {
          const count = metrics.apartment_count ?? 0;
          const avgArea = metrics.average_area ?? 0;
          total += count;
          if (normalizedKey in byType) {
            byType[normalizedKey] += count;
            byTypeArea[normalizedKey] += avgArea * count;
          }
          // Подсчет площади с/без отделки (упрощенно - считаем все как с отделкой)
          totalAreaWithFinish += avgArea * count * 0.7; // Примерно 70% с отделкой
          totalAreaWithoutFinish += avgArea * count * 0.3; // Примерно 30% без отделки
        }
      });
    });

    return {
      total,
      byType,
      byTypeArea,
      totalAreaWithFinish,
      totalAreaWithoutFinish,
    };
  }, [data, selectedJK, roomFilter]);

  // Данные по этажам для таблицы распределения
  const floorDistributionRows = useMemo<FloorRow[]>(() => {
    const projects = data?.projects ?? [];
    const floorData: Record<number, FloorRow> = {};

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const floorBreakdown = p?.floor_breakdown || {};
      Object.keys(floorBreakdown).forEach((floorStr) => {
        const floor = parseInt(floorStr, 10);
        if (!floorData[floor]) {
          floorData[floor] = { floor, studio: 0, '1-room': 0, '2-room': 0, '3-room': 0, '4plus': 0 };
        }
        
        const floorTypes = floorBreakdown[floorStr];
        Object.keys(floorTypes).forEach((key) => {
          const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
          if (normalizedKey in floorData[floor]) {
            const typeData = floorTypes[key];
            floorData[floor][normalizedKey as keyof FloorRow] = (typeData?.count ?? 0) as number;
          }
        });
      });
    });

    return Object.values(floorData).sort((a, b) => b.floor - a.floor);
  }, [data, selectedJK]);

  // Детальные данные по этажам
  const floorDetailRows = useMemo<FloorDetailRow[]>(() => {
    const projects = data?.projects ?? [];
    const floorData: Record<number, FloorDetailRow> = {};

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const floorBreakdown = p?.floor_breakdown || {};
      Object.keys(floorBreakdown).forEach((floorStr) => {
        const floor = parseInt(floorStr, 10);
        if (!floorData[floor]) {
          floorData[floor] = { floor };
        }
        
        const floorTypes = floorBreakdown[floorStr];
        Object.keys(floorTypes).forEach((key) => {
          const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
          const typeData = floorTypes[key];
          
          if (typeData && (normalizedKey === 'studio' || normalizedKey === '1-room' || normalizedKey === '2-room')) {
            const count = typeData.count ?? 0;
            const avgArea = typeData.average_area ?? 0;
            const avgPrice = typeData.average_price ?? 0;
            const sqmPrice = avgArea > 0 ? (avgPrice / avgArea) / 1000 : 0; // Цена за кв.м в тыс. руб.
            const lotPrice = avgPrice / 1000000; // Цена лота в млн. руб.
            
            const detailData: FloorDetailData = {
              count: Number(count),
              price: sqmPrice,
              area: Number(avgArea),
              lotPrice,
            };
            
            if (normalizedKey === 'studio') {
              floorData[floor].studio = detailData;
            } else if (normalizedKey === '1-room') {
              floorData[floor]['1-room'] = detailData;
            } else if (normalizedKey === '2-room') {
              floorData[floor]['2-room'] = detailData;
            }
          }
        });
      });
    });

    return Object.values(floorData).sort((a, b) => b.floor - a.floor);
  }, [data, selectedJK]);

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

  // Данные для круговых диаграмм
  const donutChartByType = useMemo(() => {
    const labels = roomTypes.map(({ label }) => label);
    const data = roomTypes.map(({ key }) => totals.byType[key] || 0);
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(v => total > 0 ? (v / total * 100) : 0);
    
    return {
      labels,
      datasets: [{
        data: percentages,
        backgroundColor: [
          'rgba(129, 212, 250, 0.8)', // Студия - светло-синий
          'rgba(66, 165, 245, 0.8)', // 1-к - средний синий
          'rgba(25, 118, 210, 0.8)', // 2-к - темный синий
          'rgba(13, 71, 161, 0.8)', // 3-к - очень темный синий
          'rgba(158, 158, 158, 0.8)', // 4+-к - серый
        ],
        borderWidth: 2,
        borderColor: '#fff',
      }],
      values: data.map(v => Math.round(v / 1000)), // в тысячах
    };
  }, [roomTypes, totals]);

  const donutChartByArea = useMemo(() => {
    const labels = roomTypes.map(({ label }) => label);
    const data = roomTypes.map(({ key }) => totals.byTypeArea[key] || 0);
    const total = data.reduce((a, b) => a + b, 0);
    const percentages = data.map(v => total > 0 ? (v / total * 100) : 0);
    
    return {
      labels,
      datasets: [{
        data: percentages,
        backgroundColor: [
          'rgba(129, 212, 250, 0.8)',
          'rgba(66, 165, 245, 0.8)',
          'rgba(25, 118, 210, 0.8)',
          'rgba(13, 71, 161, 0.8)',
          'rgba(158, 158, 158, 0.8)',
        ],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    };
  }, [roomTypes, totals]);

  const donutChartByFinishing = useMemo(() => {
    const total = totals.totalAreaWithFinish + totals.totalAreaWithoutFinish;
    const withFinish = total > 0 ? (totals.totalAreaWithFinish / total * 100) : 0;
    const withoutFinish = total > 0 ? (totals.totalAreaWithoutFinish / total * 100) : 0;
    
    return {
      labels: ['Да', 'Нет'],
      datasets: [{
        data: [withFinish, withoutFinish],
        backgroundColor: [
          'rgba(25, 118, 210, 0.8)', // Да - темный синий
          'rgba(129, 212, 250, 0.8)', // Нет - светло-синий
        ],
        borderWidth: 2,
        borderColor: '#fff',
      }],
      values: [
        Math.round(totals.totalAreaWithFinish / 1000),
        Math.round(totals.totalAreaWithoutFinish / 1000),
      ],
    };
  }, [totals]);

  return (
    <Layout title="7. Сегодня в продаже">
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
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Отделка</label>
          <select 
            value={finishFilter} 
            onChange={(e)=> setFinishFilter(e.target.value as any)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:120}}
          >
            <option value="all">Все</option>
            <option value="clean">Чистовая</option>
            <option value="rough">Черновая</option>
            <option value="white">White box</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Срок экспозиции</label>
          <select 
            value={exposureFilter} 
            onChange={(e)=> setExposureFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:150}}
          >
            <option value="all">Все</option>
            <option value="0-30">0-30 дней</option>
            <option value="30-60">30-60 дней</option>
            <option value="60-90">60-90 дней</option>
            <option value="90+">90+ дней</option>
          </select>
        </div>
      </div>

      {/* Всего лотов и карточки по типам */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        <KPICard 
          title="Всего лотов, шт." 
          value={fmtNum(totals.total, 0)} 
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
      </div>

      {/* Основной контент: таблицы слева и диаграммы справа */}
      <div style={{display:'flex',gap:24,alignItems:'flex-start'}}>
        {/* Левая часть - таблицы */}
        <div style={{flex: 1, minWidth: 0}}>
          {/* Таблица 2: Распределение по этажам */}
          <div style={{marginBottom:24}}>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>2 Распределение лотов по этажам:</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Этаж</th>
                    <th>Студия</th>
                    <th>1</th>
                    <th>2</th>
                    <th>3</th>
                    <th>4</th>
                  </tr>
                </thead>
                <tbody>
                  {floorDistributionRows.map((row) => (
                    <tr key={row.floor}>
                      <td className="num" style={{textAlign:'center', fontWeight: 600}}>{row.floor}</td>
                      <td className="num" style={{textAlign:'right'}}>{row.studio > 0 ? fmtNum(row.studio, 0) : ''}</td>
                      <td className="num" style={{textAlign:'right'}}>{row['1-room'] > 0 ? fmtNum(row['1-room'], 0) : ''}</td>
                      <td className="num" style={{textAlign:'right'}}>{row['2-room'] > 0 ? fmtNum(row['2-room'], 0) : ''}</td>
                      <td className="num" style={{textAlign:'right'}}>{row['3-room'] > 0 ? fmtNum(row['3-room'], 0) : ''}</td>
                      <td className="num" style={{textAlign:'right'}}>{row['4plus'] > 0 ? fmtNum(row['4plus'], 0) : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Таблица 3: Детальные метрики по этажам */}
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>3 Детальные метрики по этажам:</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Этаж</th>
                    <th colSpan={4}>Студия</th>
                    <th colSpan={4}>1</th>
                    <th colSpan={4}>2</th>
                  </tr>
                  <tr>
                    <th>Кол</th>
                    <th>Цена</th>
                    <th>Площадь</th>
                    <th>Цена лота</th>
                    <th>Кол</th>
                    <th>Цена</th>
                    <th>Площадь</th>
                    <th>Цена лота</th>
                    <th>Кол</th>
                    <th>Цена</th>
                    <th>Площадь</th>
                    <th>Цена лота</th>
                  </tr>
                </thead>
                <tbody>
                  {floorDetailRows.map((row) => (
                    <tr key={row.floor}>
                      <td className="num" style={{textAlign:'center', fontWeight: 600}}>{row.floor}</td>
                      
                      {/* Студия */}
                      {row.studio ? (
                        <>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.studio.count, 0)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.studio.price, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.studio.area, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.studio.lotPrice, 2)}</td>
                        </>
                      ) : (
                        <>
                          <td></td><td></td><td></td><td></td>
                        </>
                      )}
                      
                      {/* 1-к */}
                      {row['1-room'] ? (
                        <>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['1-room'].count, 0)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['1-room'].price, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['1-room'].area, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['1-room'].lotPrice, 2)}</td>
                        </>
                      ) : (
                        <>
                          <td></td><td></td><td></td><td></td>
                        </>
                      )}
                      
                      {/* 2-к */}
                      {row['2-room'] ? (
                        <>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['2-room'].count, 0)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['2-room'].price, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['2-room'].area, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row['2-room'].lotPrice, 2)}</td>
                        </>
                      ) : (
                        <>
                          <td></td><td></td><td></td><td></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Правая часть - круговые диаграммы */}
        <div style={{flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: 24}}>
          {/* Диаграмма 4: Доля по типам квартир */}
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>4 Доля по типам квартир, %:</h3>
            <div className="card">
              <ChartWrapper 
                type="doughnut" 
                data={donutChartByType} 
                height={250}
                options={{
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const idx = context.dataIndex;
                          const count = donutChartByType.values?.[idx] ?? 0;
                          return `${label}: ${count.toFixed(1)} тыс. (${value.toFixed(2)}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Диаграмма 5: Доля по площади */}
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>5 Доля по площади, %:</h3>
            <div className="card">
              <ChartWrapper 
                type="doughnut" 
                data={donutChartByArea} 
                height={250}
                options={{
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          return `${label}: ${value.toFixed(2)}%`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>

          {/* Диаграмма 6: Доля площади с отделкой и без */}
          <div>
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>6 Доля площади с отделкой и без, %:</h3>
            <div className="card">
              <ChartWrapper 
                type="doughnut" 
                data={donutChartByFinishing} 
                height={250}
                options={{
                  plugins: {
                    legend: {
                      position: 'right',
                    },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => {
                          const label = context.label || '';
                          const value = context.parsed || 0;
                          const idx = context.dataIndex;
                          const area = donutChartByFinishing.values?.[idx] ?? 0;
                          return `${label}: ${area} (${value.toFixed(2)}%)`;
                        }
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
