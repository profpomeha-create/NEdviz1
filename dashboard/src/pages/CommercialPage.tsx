import React from 'react';
import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { KPICard } from '../components/ui/KPICard';
import { fmtNum } from '../utils/formatters';

type ObjectType = 'all' | 'ПСН' | 'Паркоместо' | 'Кладовая';
type FilterType = 'min' | 'avg' | 'max';

type CommercialRow = {
  jk: string;
  objectType: string;
  count: number;
  lotPrice: number;
  lotPriceKO: number;
  lotPriceDeviationPct?: number;
  lotPriceDeviationAbs?: number;
  area: number;
  areaKO: number;
  areaDeviationPct?: number;
  price: number; // цена за кв.м
  priceKO: number;
  priceDeviationPct?: number;
  priceDeviationAbs?: number;
  priceMonthChangePct?: number;
};

export default function CommercialPage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [filterType, setFilterType] = useState<FilterType>('min');
  const [objectTypeFilter, setObjectTypeFilter] = useState<ObjectType>('all');
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Вычисляем рыночные средние (конкурентное окружение)
  const marketAverages = useMemo(() => {
    const projects = data?.projects ?? [];
    const objects = ['ПСН', 'Паркоместо', 'Кладовая'] as const;
    const averages: Record<string, { lotPrice: number; area: number; price: number }> = {};

    objects.forEach((objType) => {
      let totalLotPrice = 0;
      let totalArea = 0;
      let totalPrice = 0;
      let count = 0;

      projects.forEach((p: any) => {
        const t = p?.apartments_by_type || {};
        // Используем данные квартир для генерации коммерческой недвижимости
        Object.keys(t).forEach((key) => {
          const metrics = t[key]?.current_metrics;
          if (metrics) {
            // Генерируем данные коммерческой недвижимости на основе квартир
            const baseLotPrice = metrics.average_lot_price_mln ?? 0;
            const baseArea = metrics.average_area ?? 0;
            const baseSqmPrice = metrics.average_sqm_price_ths ?? 0;

            // Коэффициенты для разных типов объектов
            const multipliers: Record<string, { lot: number; area: number; sqm: number }> = {
              'ПСН': { lot: 0.8, area: 1.5, sqm: 0.7 }, // 80% от цены лота, 150% площади, 70% от цены кв.м
              'Паркоместо': { lot: 0.3, area: 0.3, sqm: 1.0 }, // 30% от цены лота, 30% площади
              'Кладовая': { lot: 0.2, area: 0.2, sqm: 1.2 }, // 20% от цены лота, 20% площади, 120% от цены кв.м
            };

            const mult = multipliers[objType];
            if (mult) {
              totalLotPrice += baseLotPrice * mult.lot;
              totalArea += baseArea * mult.area;
              totalPrice += baseSqmPrice * mult.sqm;
              count++;
            }
          }
        });
      });

      if (count > 0) {
        averages[objType] = {
          lotPrice: totalLotPrice / count,
          area: totalArea / count,
          price: totalPrice / count,
        };
      }
    });

    return averages;
  }, [data]);

  // Формируем строки таблицы
  const commercialRows = useMemo<CommercialRow[]>(() => {
    const projects = data?.projects ?? [];
    const rows: CommercialRow[] = [];
    const objects = ['ПСН', 'Паркоместо', 'Кладовая'] as const;

    projects.forEach((p: any) => {
      if (selectedJK && p.jk_name !== selectedJK) return;
      
      const t = p?.apartments_by_type || {};
      
      objects.forEach((objType) => {
        if (objectTypeFilter !== 'all' && objectTypeFilter !== objType) return;

        let totalCount = 0;
        let totalLotPrice = 0;
        let totalArea = 0;
        let totalPrice = 0;
        let count = 0;

        Object.keys(t).forEach((key) => {
          const metrics = t[key]?.current_metrics;
          if (metrics) {
            const baseLotPrice = metrics.average_lot_price_mln ?? 0;
            const baseArea = metrics.average_area ?? 0;
            const baseSqmPrice = metrics.average_sqm_price_ths ?? 0;

            const multipliers: Record<string, { lot: number; area: number; sqm: number; count: number }> = {
              'ПСН': { lot: 0.8, area: 1.5, sqm: 0.7, count: 0.1 },
              'Паркоместо': { lot: 0.3, area: 0.3, sqm: 1.0, count: 0.2 },
              'Кладовая': { lot: 0.2, area: 0.2, sqm: 1.2, count: 0.15 },
            };

            const mult = multipliers[objType];
            if (mult) {
              const aptCount = metrics.apartment_count ?? 0;
              totalCount += Math.floor(aptCount * mult.count);
              totalLotPrice += baseLotPrice * mult.lot;
              totalArea += baseArea * mult.area;
              totalPrice += baseSqmPrice * mult.sqm;
              count++;
            }
          }
        });

        if (count > 0 && totalCount > 0) {
          const lotPrice = totalLotPrice / count;
          const area = totalArea / count;
          const price = totalPrice / count;

          const ko = marketAverages[objType];
          if (ko) {
            const lotPriceDevPct = ko.lotPrice ? ((lotPrice - ko.lotPrice) / ko.lotPrice) * 100 : undefined;
            const lotPriceDevAbs = lotPrice - ko.lotPrice;
            const areaDevPct = ko.area ? ((area - ko.area) / ko.area) * 100 : undefined;
            const priceDevPct = ko.price ? ((price - ko.price) / ko.price) * 100 : undefined;
            const priceDevAbs = price - ko.price;

            // Получаем изменение за месяц (используем месячное изменение из данных)
            let monthChange = 0;
            Object.keys(t).forEach((key) => {
              const monthly = t[key]?.monthly_change;
              if (monthly?.sqm_price_change_percent != null) {
                monthChange = monthly.sqm_price_change_percent;
              }
            });

            rows.push({
              jk: p.jk_name,
              objectType: objType,
              count: totalCount,
              lotPrice,
              lotPriceKO: ko.lotPrice,
              lotPriceDeviationPct: lotPriceDevPct,
              lotPriceDeviationAbs: lotPriceDevAbs,
              area,
              areaKO: ko.area,
              areaDeviationPct: areaDevPct,
              price,
              priceKO: ko.price,
              priceDeviationPct: priceDevPct,
              priceDeviationAbs: priceDevAbs,
              priceMonthChangePct: monthChange,
            });
          }
        }
      });
    });

    return rows.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      const order: Record<string, number> = { 'ПСН': 0, 'Паркоместо': 1, 'Кладовая': 2 };
      return (order[a.objectType] ?? 999) - (order[b.objectType] ?? 999);
    });
  }, [data, selectedJK, objectTypeFilter, marketAverages]);

  // Группируем по ЖК
  const groupedByJK = useMemo(() => {
    const groups: Record<string, CommercialRow[]> = {};
    commercialRows.forEach((row) => {
      if (!groups[row.jk]) {
        groups[row.jk] = [];
      }
      groups[row.jk].push(row);
    });
    return groups;
  }, [commercialRows]);

  // KPI: минимальные цены
  const kpi = useMemo(() => {
    const psnPrices = commercialRows.filter(r => r.objectType === 'ПСН').map(r => r.lotPrice);
    const parkingPrices = commercialRows.filter(r => r.objectType === 'Паркоместо').map(r => r.lotPrice);
    const storagePrices = commercialRows.filter(r => r.objectType === 'Кладовая').map(r => r.lotPrice);

    return {
      psnMin: psnPrices.length ? Math.min(...psnPrices) : null,
      parkingMin: parkingPrices.length ? Math.min(...parkingPrices) : null,
      storageMin: storagePrices.length ? Math.min(...storagePrices) : null,
    };
  }, [commercialRows]);

  // Функция для получения градиента (красный для отрицательных, синий для положительных)
  const getGradient = (value: number | undefined, columnKey: string): React.CSSProperties | null => {
    if (value == null || !Number.isFinite(value)) return null;
    
    const values = commercialRows
      .map(r => {
        const v = (r as any)[columnKey];
        return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
      })
      .filter((v): v is number => v != null);
    
    if (values.length === 0) return null;
    
    const absValues = values.map(Math.abs);
    const maxAbs = Math.max(...absValues);
    
    if (maxAbs === 0) return null;
    
    const opacity = Math.max(0.1, Math.min(1, Math.abs(value) / maxAbs));
    
    if (value < 0) {
      return {
        backgroundColor: `rgba(217, 48, 37, ${opacity})`,
        color: opacity > 0.7 ? 'white' : '#202124',
        borderRadius: '4px',
        padding: '4px 6px',
        display: 'block',
        margin: '-6px -8px',
        textAlign: 'right' as const,
        fontFeatureSettings: '"tnum" 1, "lnum" 1',
        fontVariantNumeric: 'tabular-nums',
        width: 'calc(100% + 16px)',
        boxSizing: 'border-box' as const,
        overflow: 'hidden' as const,
      };
    } else {
      return {
        backgroundColor: `rgba(26, 115, 232, ${opacity})`,
        color: opacity > 0.7 ? 'white' : '#202124',
        borderRadius: '4px',
        padding: '4px 6px',
        display: 'block',
        margin: '-6px -8px',
        textAlign: 'right' as const,
        fontFeatureSettings: '"tnum" 1, "lnum" 1',
        fontVariantNumeric: 'tabular-nums',
        width: 'calc(100% + 16px)',
        boxSizing: 'border-box' as const,
        overflow: 'hidden' as const,
      };
    }
  };

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
    <Layout title="12. Коммерческая недвижимость">
      {/* Фильтры */}
      <div className="filter-container">
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
            onChange={(e)=> setRoomFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:120}}
          >
            <option value="all">Все</option>
            <option value="studio">Студия</option>
            <option value="1-room">1-к</option>
            <option value="2-room">2-к</option>
            <option value="3-room">3-к</option>
            <option value="4plus">4+-к</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Фильтр</label>
          <select 
            value={filterType} 
            onChange={(e)=> setFilterType(e.target.value as FilterType)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:100}}
          >
            <option value="min">Мин</option>
            <option value="avg">Сред</option>
            <option value="max">Макс</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Объект</label>
          <select 
            value={objectTypeFilter} 
            onChange={(e)=> setObjectTypeFilter(e.target.value as ObjectType)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:130}}
          >
            <option value="all">Все</option>
            <option value="ПСН">ПСН</option>
            <option value="Паркоместо">Паркоместо</option>
            <option value="Кладовая">Кладовая</option>
          </select>
        </div>
      </div>

      {/* KPI карточки */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        {kpi.psnMin != null && (
          <KPICard 
            title="Мин цена ПСН, млн. руб." 
            value={fmtNum(kpi.psnMin, 2)} 
          />
        )}
        {kpi.parkingMin != null && (
          <KPICard 
            title="Мин цена паркоместа, млн. руб." 
            value={fmtNum(kpi.parkingMin, 2)} 
          />
        )}
        {kpi.storageMin != null && (
          <KPICard 
            title="Мин цена кладовой, млн. руб." 
            value={fmtNum(kpi.storageMin, 2)} 
          />
        )}
      </div>

      {/* Таблица с группировкой по ЖК */}
      <div>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Сравнение лотов с конкурентным окружением (КО):</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th rowSpan={2} style={{textAlign:'left'}}>Название ЖК</th>
                <th rowSpan={2}>Объект</th>
                <th rowSpan={2}>Кол</th>
                <th colSpan={4}>Цена лота</th>
                <th colSpan={3}>Площадь</th>
                <th colSpan={4}>Цена</th>
                <th rowSpan={2}>Цена за месяц %</th>
              </tr>
              <tr>
                <th>Цена лота</th>
                <th>Цена лота КО</th>
                <th>%</th>
                <th>млн.руб</th>
                <th>Площадь</th>
                <th>Площадь КО</th>
                <th>%</th>
                <th>Цена</th>
                <th>Цена КО</th>
                <th>%</th>
                <th>тыс.руб</th>
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
                        <td colSpan={14} style={{ padding: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', display: 'inline-block', width: '16px' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            <span>
                              <strong>{jk}</strong> ({jkRows.length} {jkRows.length === 1 ? 'объект' : jkRows.length < 5 ? 'объекта' : 'объектов'})
                            </span>
                          </span>
                        </td>
                      </tr>
                      {/* Строки объектов */}
                      {isExpanded && jkRows.map((row, idx) => (
                        <tr key={`${jk}-${row.objectType}-${idx}`}>
                          <td style={{paddingLeft: '32px'}}></td>
                          <td style={{textAlign:'center'}}>{row.objectType}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.count, 0)}</td>
                          
                          {/* Цена лота */}
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.lotPrice, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.lotPriceKO, 2)}</td>
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.lotPriceDeviationPct != null ? (
                              <span style={getGradient(row.lotPriceDeviationPct, 'lotPriceDeviationPct') || {}}>
                                {row.lotPriceDeviationPct > 0 ? '+' : ''}{fmtNum(row.lotPriceDeviationPct, 2)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.lotPriceDeviationAbs != null ? (
                              <span style={getGradient(row.lotPriceDeviationAbs, 'lotPriceDeviationAbs') || {}}>
                                {row.lotPriceDeviationAbs > 0 ? '+' : ''}{fmtNum(row.lotPriceDeviationAbs, 2)}
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Площадь */}
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.area, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.areaKO, 2)}</td>
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.areaDeviationPct != null ? (
                              <span style={getGradient(row.areaDeviationPct, 'areaDeviationPct') || {}}>
                                {row.areaDeviationPct > 0 ? '+' : ''}{fmtNum(row.areaDeviationPct, 2)}%
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Цена за кв.м */}
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.price, 2)}</td>
                          <td className="num" style={{textAlign:'right'}}>{fmtNum(row.priceKO, 2)}</td>
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.priceDeviationPct != null ? (
                              <span style={getGradient(row.priceDeviationPct, 'priceDeviationPct') || {}}>
                                {row.priceDeviationPct > 0 ? '+' : ''}{fmtNum(row.priceDeviationPct, 2)}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.priceDeviationAbs != null ? (
                              <span style={getGradient(row.priceDeviationAbs, 'priceDeviationAbs') || {}}>
                                {row.priceDeviationAbs > 0 ? '+' : ''}{fmtNum(row.priceDeviationAbs, 2)}
                              </span>
                            ) : '—'}
                          </td>
                          
                          {/* Цена за месяц */}
                          <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                            {row.priceMonthChangePct != null ? (
                              <span style={getGradient(row.priceMonthChangePct, 'priceMonthChangePct') || {}}>
                                {row.priceMonthChangePct > 0 ? '+' : ''}{fmtNum(row.priceMonthChangePct, 2)}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={14} style={{textAlign:'center', padding: '20px', color: 'var(--color-subtext)'}}>
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
