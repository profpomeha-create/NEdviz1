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

type ForecastRow = {
  jk: string;
  roomType: string;
  roomTypeKey: string;
  predictions: Array<{
    month: string;
    monthLabel: string;
    lotPrice: number;
    lotPricePessimistic: number;
    lotPriceOptimistic: number;
    sqmPrice: number;
    sqmPricePessimistic: number;
    sqmPriceOptimistic: number;
    growthPercent: number;
    accuracyPercent: number;
  }>;
};

export default function ForecastPage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [roomFilter, setRoomFilter] = useState<'all'|RoomType>('all');
  // Инициализируем все ЖК как свернутые
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Формируем строки таблицы с прогнозами
  const forecastRows = useMemo<ForecastRow[]>(() => {
    const projects = data?.projects ?? [];
    const rows: ForecastRow[] = [];

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilter !== 'all' && normalizedKey !== roomFilter) return;

        const prediction = t[key]?.price_prediction;
        if (prediction && typeof prediction === 'object') {
          const predictions: ForecastRow['predictions'] = [];
          
          Object.keys(prediction).forEach((monthKey) => {
            const monthData = prediction[monthKey];
            if (monthData && typeof monthData === 'object') {
              predictions.push({
                month: monthKey,
                monthLabel: monthData.month_label || monthKey,
                lotPrice: monthData.average_predicted_lot_price_mln ?? 0,
                lotPricePessimistic: monthData.predicted_lot_price_range_mln?.pessimistic ?? 0,
                lotPriceOptimistic: monthData.predicted_lot_price_range_mln?.optimistic ?? 0,
                sqmPrice: monthData.average_predicted_sqm_price_ths ?? 0,
                sqmPricePessimistic: monthData.predicted_sqm_price_range_ths?.pessimistic ?? 0,
                sqmPriceOptimistic: monthData.predicted_sqm_price_range_ths?.optimistic ?? 0,
                growthPercent: monthData.expected_growth_percent ?? 0,
                accuracyPercent: monthData.prediction_accuracy_percent ?? 0,
              });
            }
          });

          if (predictions.length > 0) {
            const roomLabel = normalizedKey === 'studio' ? 'Студия' : 
                            normalizedKey === '1-room' ? '1-к' :
                            normalizedKey === '2-room' ? '2-к' :
                            normalizedKey === '3-room' ? '3-к' :
                            normalizedKey === '4plus' ? '4+-к' : normalizedKey;

            rows.push({
              jk: p.jk_name,
              roomType: roomLabel,
              roomTypeKey: normalizedKey,
              predictions: predictions.sort((a, b) => a.month.localeCompare(b.month)),
            });
          }
        }
      });
    });

    return rows.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      const order: Record<string, number> = { studio: 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.roomTypeKey] ?? 999) - (order[b.roomTypeKey] ?? 999);
    });
  }, [data, selectedJK, roomFilter]);

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

  // Получаем последние 3 месяца для упрощенной таблицы
  const recentMonths = useMemo(() => {
    const months = new Set<string>();
    forecastRows.forEach(row => {
      row.predictions.forEach(p => months.add(p.month));
    });
    const sorted = Array.from(months).sort().reverse();
    return sorted.slice(0, 3).reverse(); // Последние 3 месяца
  }, [forecastRows]);

  // Группируем по ЖК
  const groupedByJK = useMemo(() => {
    const groups: Record<string, ForecastRow[]> = {};
    forecastRows.forEach((row) => {
      if (!groups[row.jk]) {
        groups[row.jk] = [];
      }
      groups[row.jk].push(row);
    });
    return groups;
  }, [forecastRows]);

  // Данные для графика прогноза цен (только для выбранного ЖК или средние)
  const chartData = useMemo(() => {
    const labels: string[] = [];
    const lotPriceData: number[] = [];
    const sqmPriceData: number[] = [];

    // Берем все месяцы
    const allMonths = new Set<string>();
    forecastRows.forEach(row => {
      row.predictions.forEach(p => allMonths.add(p.month));
    });
    const sortedMonths = Array.from(allMonths).sort();

    sortedMonths.forEach(month => {
      const row = forecastRows.find(r => r.predictions.some(p => p.month === month));
      const label = row?.predictions.find(p => p.month === month)?.monthLabel || month;
      labels.push(label);

      // Считаем средние значения для этого месяца
      let totalLotPrice = 0;
      let totalSqmPrice = 0;
      let count = 0;

      forecastRows.forEach(r => {
        const pred = r.predictions.find(p => p.month === month);
        if (pred) {
          totalLotPrice += pred.lotPrice;
          totalSqmPrice += pred.sqmPrice;
          count++;
        }
      });

      lotPriceData.push(count > 0 ? totalLotPrice / count : 0);
      sqmPriceData.push(count > 0 ? totalSqmPrice / count : 0);
    });

    return {
      labels,
      datasets: [
        {
          label: 'Средняя цена лота, млн. руб.',
          data: lotPriceData,
          borderColor: '#1a73e8',
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          yAxisID: 'y',
          pointRadius: 4,
          tension: 0.4,
        },
        {
          label: 'Средняя цена кв.м., тыс. руб.',
          data: sqmPriceData,
          borderColor: '#34a853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          yAxisID: 'y1',
          pointRadius: 4,
          tension: 0.4,
        },
      ],
    };
  }, [forecastRows]);

  // KPI: средние значения прогнозов
  const kpi = useMemo(() => {
    let totalLotPrice = 0;
    let totalSqmPrice = 0;
    let totalGrowth = 0;
    let totalAccuracy = 0;
    let count = 0;

    forecastRows.forEach(row => {
      row.predictions.forEach(pred => {
        totalLotPrice += pred.lotPrice;
        totalSqmPrice += pred.sqmPrice;
        totalGrowth += pred.growthPercent;
        totalAccuracy += pred.accuracyPercent;
        count++;
      });
    });

    return {
      avgLotPrice: count > 0 ? totalLotPrice / count : 0,
      avgSqmPrice: count > 0 ? totalSqmPrice / count : 0,
      avgGrowth: count > 0 ? totalGrowth / count : 0,
      avgAccuracy: count > 0 ? totalAccuracy / count : 0,
    };
  }, [forecastRows]);

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
    <Layout title="8. Перспектива">
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
      </div>

      {/* KPI карточки */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        <KPICard 
          title="Сред. прогноз цены лота, млн. руб." 
          value={fmtNum(kpi.avgLotPrice, 2)} 
        />
        <KPICard 
          title="Сред. прогноз цены кв.м., тыс. руб." 
          value={fmtNum(kpi.avgSqmPrice, 2)} 
        />
        <KPICard 
          title="Сред. ожидаемый рост, %" 
          value={`${kpi.avgGrowth > 0 ? '+' : ''}${fmtNum(kpi.avgGrowth, 2)}`} 
        />
        <KPICard 
          title="Сред. точность прогноза, %" 
          value={fmtNum(kpi.avgAccuracy, 1)} 
        />
      </div>

      {/* Таблица с группировкой по ЖК - показываем последние 3 месяца */}
      {Object.keys(groupedByJK).length > 0 && (
        <div style={{marginBottom:24}}>
          <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Прогноз цен (последние 3 месяца):</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{textAlign:'left'}}>ЖК</th>
                  <th rowSpan={2}>Тип</th>
                  {recentMonths.map((month) => {
                    const row = forecastRows.find(r => r.predictions.some(p => p.month === month));
                    const label = row?.predictions.find(p => p.month === month)?.monthLabel || month;
                    return <th key={month} colSpan={4}>{label}</th>;
                  })}
                </tr>
                <tr>
                  {recentMonths.map((month) => (
                    <React.Fragment key={month}>
                      <th>Цена лота</th>
                      <th>Цена м²</th>
                      <th>Рост, %</th>
                      <th>Точность, %</th>
                    </React.Fragment>
                  ))}
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
                        <td colSpan={1 + recentMonths.length * 4} style={{ padding: '12px' }}>
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
                          {recentMonths.map((month) => {
                            const pred = row.predictions.find(p => p.month === month);
                            if (!pred) {
                              return (
                                <React.Fragment key={month}>
                                  <td></td><td></td><td></td><td></td>
                                </React.Fragment>
                              );
                            }
                            return (
                              <React.Fragment key={month}>
                                <td className="num" style={{textAlign:'right'}}>{fmtNum(pred.lotPrice, 2)}</td>
                                <td className="num" style={{textAlign:'right'}}>{fmtNum(pred.sqmPrice, 2)}</td>
                                <td className="num" style={{textAlign:'right', color: pred.growthPercent >= 0 ? '#34a853' : '#ea4335'}}>
                                  {pred.growthPercent > 0 ? '+' : ''}{fmtNum(pred.growthPercent, 2)}
                                </td>
                                <td className="num" style={{textAlign:'right'}}>{fmtNum(pred.accuracyPercent, 1)}</td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* График прогнозов */}
      <div>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Средний прогноз цен:</h3>
        <div className="card">
          <ChartWrapper 
            type="line" 
            data={chartData} 
            height={280}
            options={{
              scales: {
                y: {
                  type: 'linear',
                  position: 'left',
                  title: { display: true, text: 'Цена лота, млн. руб.' },
                },
                y1: {
                  type: 'linear',
                  position: 'right',
                  title: { display: true, text: 'Цена кв.м., тыс. руб.' },
                  grid: { drawOnChartArea: false },
                },
              },
            }}
          />
        </div>
      </div>
    </Layout>
  )
}
