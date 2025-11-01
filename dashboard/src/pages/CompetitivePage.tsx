import React from 'react';
import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { KPICard } from '../components/ui/KPICard';
import { MultiSelect } from '../components/ui/MultiSelect';
import { fmtNum } from '../utils/formatters';

type Parameter = 'sqm' | 'lot' | 'area' | 'mortgage';

type Row = {
  jk: string;
  roomType: string;
  roomTypeKey: string;
  count: number;
  area: number;
  areaDeviationPct?: number;
  lotPrice: number;
  lotPriceDeviationPct?: number;
  sqmPrice: number;
  sqmPriceDeviationPct?: number;
  sqmDeviationAbs?: number;
  priceMonthAgo?: number;
  priceMonthAgoPct?: number;
  priceQuarterAgo?: number;
  priceQuarterAgoPct?: number;
  priceHalfyearAgo?: number;
  priceHalfyearAgoPct?: number;
};

export default function CompetitivePage(){
  const { data } = useData();
  const { selectedJK } = useSelectedProject();
  const [selectedJKs, setSelectedJKs] = useState<string[]>([]);
  const [roomFilters, setRoomFilters] = useState<string[]>([]);
  const [finishFilter, setFinishFilter] = useState<'all'|'clean'|'rough'|'white'>('all');
  const [param, setParam] = useState<Parameter>('sqm');
  // Инициализируем все ЖК как свернутые
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Получаем опции для мультиселектов
  const jkOptions = useMemo(() => {
    return (data?.projects ?? []).map((p: any) => ({
      value: p.jk_name,
      label: p.jk_name
    }));
  }, [data]);

  const roomOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const projects = data?.projects ?? [];
    const seen = new Set<string>();
    
    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        if (!seen.has(normalizedKey)) {
          seen.add(normalizedKey);
          const labels: Record<string, string> = {
            'studio': 'Студия',
            '1-room': '1-к',
            '2-room': '2-к',
            '3-room': '3-к',
            '4plus': '4+-к',
          };
          if (labels[normalizedKey]) {
            options.push({ value: normalizedKey, label: labels[normalizedKey] });
          }
        }
      });
    });
    
    return options.sort((a, b) => {
      const order: Record<string, number> = { 'studio': 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.value] ?? 999) - (order[b.value] ?? 999);
    });
  }, [data]);

  // Вычисляем средние значения для всех проектов (рыночные средние)
  const marketAverages = useMemo(() => {
    const projects = data?.projects ?? [];
    let totalArea = 0, totalLotPrice = 0, totalSqmPrice = 0, totalMortgage = 0;
    let countArea = 0, countLotPrice = 0, countSqmPrice = 0, countMortgage = 0;

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const metrics = t[key]?.current_metrics;
        if (metrics) {
          if (typeof metrics.average_area === 'number') {
            totalArea += metrics.average_area;
            countArea++;
          }
          if (typeof metrics.average_lot_price_mln === 'number') {
            totalLotPrice += metrics.average_lot_price_mln;
            countLotPrice++;
          }
          if (typeof metrics.average_sqm_price_ths === 'number') {
            totalSqmPrice += metrics.average_sqm_price_ths;
            countSqmPrice++;
          }
          const mortgage = t[key]?.mortgage_calculation;
          if (typeof mortgage?.current_monthly_payment_ths === 'number') {
            totalMortgage += mortgage.current_monthly_payment_ths;
            countMortgage++;
          }
        }
      });
    });

    return {
      area: countArea ? totalArea / countArea : 0,
      lotPrice: countLotPrice ? totalLotPrice / countLotPrice : 0,
      sqmPrice: countSqmPrice ? totalSqmPrice / countSqmPrice : 0,
      mortgage: countMortgage ? totalMortgage / countMortgage : 0,
    };
  }, [data]);

  // Средние значения по типам квартир
  const averagesByRoomType = useMemo(() => {
    const projects = data?.projects ?? [];
    const byType: Record<string, { area: number[]; lotPrice: number[]; sqmPrice: number[]; mortgage: number[] }> = {};

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        if (!byType[normalizedKey]) {
          byType[normalizedKey] = { area: [], lotPrice: [], sqmPrice: [], mortgage: [] };
        }
        const metrics = t[key]?.current_metrics;
        if (metrics) {
          if (typeof metrics.average_area === 'number') byType[normalizedKey].area.push(metrics.average_area);
          if (typeof metrics.average_lot_price_mln === 'number') byType[normalizedKey].lotPrice.push(metrics.average_lot_price_mln);
          if (typeof metrics.average_sqm_price_ths === 'number') byType[normalizedKey].sqmPrice.push(metrics.average_sqm_price_ths);
          const mortgage = t[key]?.mortgage_calculation;
          if (typeof mortgage?.current_monthly_payment_ths === 'number') {
            byType[normalizedKey].mortgage.push(mortgage.current_monthly_payment_ths);
          }
        }
      });
    });

    const result: Record<string, number> = { overall: marketAverages.sqmPrice };
    
    Object.keys(byType).forEach((key) => {
      const arr = byType[key].sqmPrice;
      if (arr.length) {
        result[key] = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    });

    return result;
  }, [data, marketAverages]);

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

  // Формируем строки таблицы
  const rows = useMemo<Row[]>(() => {
    const projects = data?.projects ?? [];
    const result: Row[] = [];

    const filteredProjects = selectedJKs.length === 0
      ? projects
      : projects.filter((p: any) => selectedJKs.includes(p.jk_name));

    filteredProjects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilters.length > 0 && !roomFilters.includes(normalizedKey)) return;

        const metrics = t[key]?.current_metrics;
        const hist = t[key]?.historical_sqm_prices;
        
        if (!metrics) return;

        const area = metrics.average_area ?? 0;
        const lotPrice = metrics.average_lot_price_mln ?? 0;
        const sqmPrice = metrics.average_sqm_price_ths ?? 0;
        
        const areaDev = marketAverages.area ? ((area - marketAverages.area) / marketAverages.area) * 100 : undefined;
        const lotPriceDev = marketAverages.lotPrice ? ((lotPrice - marketAverages.lotPrice) / marketAverages.lotPrice) * 100 : undefined;
        const sqmPriceDev = marketAverages.sqmPrice ? ((sqmPrice - marketAverages.sqmPrice) / marketAverages.sqmPrice) * 100 : undefined;
        const sqmDeviationAbs = sqmPriceDev != null ? sqmPrice - marketAverages.sqmPrice : undefined;

        const roomLabel = normalizedKey === 'studio' ? 'Студия' : 
                         normalizedKey === '1-room' ? '1-к' :
                         normalizedKey === '2-room' ? '2-к' :
                         normalizedKey === '3-room' ? '3-к' :
                         normalizedKey === '4plus' ? '4+-к' : normalizedKey;

        result.push({
          jk: p.jk_name,
          roomType: roomLabel,
          roomTypeKey: normalizedKey,
          count: metrics.apartment_count ?? 0,
          area,
          areaDeviationPct: areaDev,
          lotPrice,
          lotPriceDeviationPct: lotPriceDev,
          sqmPrice,
          sqmPriceDeviationPct: sqmPriceDev,
          sqmDeviationAbs,
          priceMonthAgo: hist?.one_month_ago_ths,
          priceMonthAgoPct: hist?.one_month_change_percent,
          priceQuarterAgo: hist?.three_months_ago_ths,
          priceQuarterAgoPct: hist?.three_months_change_percent,
          priceHalfyearAgo: hist?.six_months_ago_ths,
          priceHalfyearAgoPct: hist?.six_months_change_percent,
        });
      });
    });

    return result.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      const order: Record<string, number> = { studio: 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.roomTypeKey] ?? 999) - (order[b.roomTypeKey] ?? 999);
    });
  }, [data, marketAverages, roomFilters, selectedJKs]);

  // Функция для получения градиента (красный для отрицательных, синий для положительных)
  const getGradient = (value: number | undefined, columnKey: string): React.CSSProperties | null => {
    if (value == null || !Number.isFinite(value)) return null;
    
    // Находим min и max для этой колонки
    const values = rows
      .map(r => {
        const v = (r as any)[columnKey];
        return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
      })
      .filter((v): v is number => v != null);
    
    if (values.length === 0) return null;
    
    const absValues = values.map(Math.abs);
    const maxAbs = Math.max(...absValues);
    
    if (maxAbs === 0) return null;
    
    // Вычисляем opacity на основе абсолютного значения
    const opacity = Math.max(0.1, Math.min(1, Math.abs(value) / maxAbs));
    
    if (value < 0) {
      // Красный градиент для отрицательных значений (ниже рынка)
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
      // Синий градиент для положительных значений (выше рынка)
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

  const getParamLabel = () => {
    switch(param) {
      case 'sqm': return 'цена кв.м.';
      case 'lot': return 'цена лота';
      case 'area': return 'площадь';
      case 'mortgage': return 'ипотечный платёж';
      default: return 'цена кв.м.';
    }
  };

  return (
    <Layout title="5. Конкурентный анализ">
      {/* Фильтры */}
      <div className="filter-container">
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Жилой комплекс</label>
          <MultiSelect
            options={jkOptions}
            value={selectedJKs}
            onChange={setSelectedJKs}
            placeholder="Все"
          />
        </div>
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Комнатность</label>
          <MultiSelect
            options={roomOptions}
            value={roomFilters}
            onChange={setRoomFilters}
            placeholder="Все"
          />
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
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Параметр</label>
          <select 
            value={param} 
            onChange={(e)=> setParam(e.target.value as Parameter)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:180}}
          >
            <option value="sqm">Цена кв.м., тыс. руб.</option>
            <option value="lot">Цена лота, млн. руб.</option>
            <option value="area">Площадь, м²</option>
            <option value="mortgage">Ипотечные платежи, тыс. руб.</option>
          </select>
        </div>
      </div>

      {/* KPI карточки со средними значениями */}
      <div style={{marginBottom:24}}>
        <div className="kpi-grid">
          <KPICard 
            title={`Сред. ${getParamLabel()}, тыс. руб.`} 
            value={fmtNum(averagesByRoomType.overall, 2)} 
          />
          {roomTypes.map(({key, label}) => {
            const avg = averagesByRoomType[key];
            return (
              <KPICard 
                key={key} 
                title={label} 
                value={avg != null ? fmtNum(avg, 2) : '—'} 
              />
            );
          })}
        </div>
      </div>

      {/* Таблица с группировкой по ЖК */}
      <GroupedCompetitiveTable 
        rows={rows} 
        expandedJK={expandedJK} 
        setExpandedJK={setExpandedJK}
        selectedJK={selectedJK}
        getGradient={getGradient}
      />
    </Layout>
  )
}

// Компонент таблицы с группировкой по ЖК
interface GroupedCompetitiveTableProps {
  rows: Row[];
  expandedJK: Set<string>;
  setExpandedJK: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  selectedJK: string | null;
  getGradient: (value: number | undefined, columnKey: string) => React.CSSProperties | null;
}

function GroupedCompetitiveTable({ rows, expandedJK, setExpandedJK, selectedJK, getGradient }: GroupedCompetitiveTableProps) {
  // Группируем строки по ЖК
  const groupedByJK = useMemo(() => {
    const groups: Record<string, Row[]> = {};
    rows.forEach((row) => {
      if (!groups[row.jk]) {
        groups[row.jk] = [];
      }
      groups[row.jk].push(row);
    });
    return groups;
  }, [rows]);

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
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th rowSpan={2} style={{textAlign:'left'}}>ЖК</th>
            <th rowSpan={2}>Комнат</th>
            <th rowSpan={2}>Ко</th>
            <th colSpan={2}>Площадь м²</th>
            <th colSpan={2}>Цена лота, млн</th>
            <th colSpan={2}>Цена м², тыс</th>
            <th rowSpan={2}>Откл. тыс</th>
            <th colSpan={2}>Месяц назад</th>
            <th colSpan={2}>Квартал назад</th>
            <th colSpan={2}>Полгода назад</th>
          </tr>
          <tr>
            <th>КО м²</th>
            <th>%</th>
            <th>КО млн</th>
            <th>%</th>
            <th>КО тыс</th>
            <th>%</th>
            <th>Цена</th>
            <th>%</th>
            <th>Цена</th>
            <th>%</th>
            <th>Цена</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedByJK).map(([jk, jkRows]) => {
            const isExpanded = expandedJK.has(jk);
            const typeCount = jkRows.length;
            
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
                        <strong>{jk}</strong> ({typeCount} {typeCount === 1 ? 'тип' : typeCount < 5 ? 'типа' : 'типов'})
                      </span>
                    </span>
                  </td>
                </tr>
                {/* Строки квартир */}
                {isExpanded && jkRows.map((row, idx) => (
                  <tr key={`${jk}-${row.roomTypeKey}-${idx}`}>
                    <td style={{paddingLeft: '32px', textAlign:'left', fontWeight: row.jk === selectedJK ? 600 : 400}}>
                      {/* Пустая ячейка для выравнивания */}
                    </td>
                    <td style={{textAlign:'center'}}>{row.roomType}</td>
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.count, 0)}</td>
                    
                    {/* Площадь */}
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.area, 2)}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.areaDeviationPct != null ? (
                        <span style={getGradient(row.areaDeviationPct, 'areaDeviationPct') || {}}>
                          {row.areaDeviationPct > 0 ? '+' : ''}{fmtNum(row.areaDeviationPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Цена лота */}
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.lotPrice, 2)}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.lotPriceDeviationPct != null ? (
                        <span style={getGradient(row.lotPriceDeviationPct, 'lotPriceDeviationPct') || {}}>
                          {row.lotPriceDeviationPct > 0 ? '+' : ''}{fmtNum(row.lotPriceDeviationPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Цена кв.м. */}
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.sqmPrice, 2)}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.sqmPriceDeviationPct != null ? (
                        <span style={getGradient(row.sqmPriceDeviationPct, 'sqmPriceDeviationPct') || {}}>
                          {row.sqmPriceDeviationPct > 0 ? '+' : ''}{fmtNum(row.sqmPriceDeviationPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Абсолютное отклонение */}
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.sqmDeviationAbs != null ? (
                        <span style={getGradient(row.sqmDeviationAbs, 'sqmDeviationAbs') || {}}>
                          {row.sqmDeviationAbs > 0 ? '+' : ''}{fmtNum(row.sqmDeviationAbs, 2)}
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Месяц назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.priceMonthAgo != null ? fmtNum(row.priceMonthAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.priceMonthAgoPct != null ? (
                        <span style={getGradient(row.priceMonthAgoPct, 'priceMonthAgoPct') || {}}>
                          {row.priceMonthAgoPct > 0 ? '+' : ''}{fmtNum(row.priceMonthAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Квартал назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.priceQuarterAgo != null ? fmtNum(row.priceQuarterAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.priceQuarterAgoPct != null ? (
                        <span style={getGradient(row.priceQuarterAgoPct, 'priceQuarterAgoPct') || {}}>
                          {row.priceQuarterAgoPct > 0 ? '+' : ''}{fmtNum(row.priceQuarterAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Полгода назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.priceHalfyearAgo != null ? fmtNum(row.priceHalfyearAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.priceHalfyearAgoPct != null ? (
                        <span style={getGradient(row.priceHalfyearAgoPct, 'priceHalfyearAgoPct') || {}}>
                          {row.priceHalfyearAgoPct > 0 ? '+' : ''}{fmtNum(row.priceHalfyearAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
