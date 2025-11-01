import { Layout } from '../layout/Layout';
import { useData } from '../lib/data';
import { useMemo, useState } from 'react';
import React from 'react';
import { KPICard } from '../components/ui/KPICard';
import { MultiSelect } from '../components/ui/MultiSelect';
import { fmtNum } from '../utils/formatters';

type Row = {
  jk: string;
  room_label: string;
  price_min?: number; 
  price_avg?: number; 
  price_max?: number;
  area_min?: number; 
  area_avg?: number; 
  area_max?: number;
  lot_price_min?: number;
  lot_price_avg?: number;
  lot_price_max?: number;
  mort_min?: number; 
  mort_avg?: number; 
  mort_max?: number;
};

type Parameter = 'sqm' | 'lot' | 'area' | 'mortgage';

export default function MarketPage(){
  const { data } = useData();
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

  const roomOptions = useMemo(() => [
    { value: 'studio', label: 'Студия' },
    { value: '1-room', label: '1-к' },
    { value: '2-room', label: '2-к' },
    { value: '3-room', label: '3-к' },
    { value: '4plus', label: '4+-к' },
  ], []);

  // Формируем строки таблицы для всех проектов
  const rows = useMemo<Row[]>(() => {
    if (!data?.projects) return [];
    
    const allRows: Row[] = [];
    const projects = selectedJKs.length === 0
      ? data.projects 
      : data.projects.filter((p: any) => selectedJKs.includes(p.jk_name));

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type ?? {};
      const allTypes: {key:string; label:string}[] = [];
      
      if (t['studio'] || t['Studio']) allTypes.push({ key: t['studio'] ? 'studio' : 'Studio', label:'Студия' });
      if (t['1-room']) allTypes.push({ key:'1-room', label:'1' });
      if (t['2-room']) allTypes.push({ key:'2-room', label:'2' });
      if (t['3-room']) allTypes.push({ key:'3-room', label:'3' });
      if (t['4plus'] || t['4+-room']) allTypes.push({ key: t['4plus'] ? '4plus' : '4+-room', label:'4+' });
      
      const filtered = roomFilters.length === 0 
        ? allTypes 
        : allTypes.filter(x => {
            const normalizedKey = x.key === 'Studio' ? 'studio' : (x.key === '4+-room' ? '4plus' : x.key);
            return roomFilters.includes(normalizedKey);
          });
      
      filtered.forEach(({key, label}) => {
        const cm = t[key]?.current_metrics || {};
        const mort = t[key]?.mortgage_calculation || {};
        
        allRows.push({
          jk: p.jk_name,
          room_label: label,
          price_min: cm.min_sqm_price_ths,
          price_avg: cm.average_sqm_price_ths,
          price_max: cm.max_sqm_price_ths,
          area_min: cm.min_area,
          area_avg: cm.average_area,
          area_max: cm.max_area,
          lot_price_min: cm.min_lot_price_mln,
          lot_price_avg: cm.average_lot_price_mln,
          lot_price_max: cm.max_lot_price_mln,
          mort_min: mort.min_monthly_payment_ths ?? undefined,
          mort_avg: mort.current_monthly_payment_ths ?? undefined,
          mort_max: mort.max_monthly_payment_ths ?? undefined,
        });
      });
    });
    
    return allRows;
  }, [data, selectedJKs, roomFilters, finishFilter]);

  // KPI: вычисляем агрегированные значения по всем строкам
  const kpi = useMemo(() => {
    const collect = (getter: (r: Row) => number | undefined) => {
      return rows.map(getter).filter((v): v is number => typeof v === 'number');
    };

    const priceVals = collect(r => r.price_avg);
    const lotPriceVals = collect(r => r.lot_price_avg);
    const areaVals = collect(r => r.area_avg);
    const mortVals = collect(r => r.mort_avg);
    
    const allPriceVals = collect(r => r.price_min).concat(collect(r => r.price_max));
    const allAreaVals = collect(r => r.area_min).concat(collect(r => r.area_max));
    const allLotPriceVals = collect(r => r.lot_price_min).concat(collect(r => r.lot_price_max));
    
    // Всего лотов и площадь (сумма)
    let totalLots = 0;
    let totalArea = 0;
    const projects = selectedJKs.length === 0
      ? (data?.projects || []) 
      : (data?.projects || []).filter((p: any) => selectedJKs.includes(p.jk_name));
    
    projects.forEach((p: any) => {
      const t = p?.apartments_by_type ?? {};
      Object.keys(t).forEach((key) => {
        const cm = t[key]?.current_metrics || {};
        const count = cm.apartment_count;
        const avgArea = cm.average_area;
        if (typeof count === 'number') totalLots += count;
        if (typeof count === 'number' && typeof avgArea === 'number') {
          totalArea += count * avgArea;
        }
      });
    });

    return {
      price: {
        min: allPriceVals.length ? Math.min(...allPriceVals) : undefined,
        avg: priceVals.length ? priceVals.reduce((a, b) => a + b, 0) / priceVals.length : undefined,
        max: allPriceVals.length ? Math.max(...allPriceVals) : undefined,
      },
      lot_price: {
        min: allLotPriceVals.length ? Math.min(...allLotPriceVals) : undefined,
        avg: lotPriceVals.length ? lotPriceVals.reduce((a, b) => a + b, 0) / lotPriceVals.length : undefined,
        max: allLotPriceVals.length ? Math.max(...allLotPriceVals) : undefined,
      },
      area: {
        min: allAreaVals.length ? Math.min(...allAreaVals) : undefined,
        avg: areaVals.length ? areaVals.reduce((a, b) => a + b, 0) / areaVals.length : undefined,
        max: allAreaVals.length ? Math.max(...allAreaVals) : undefined,
      },
      mortgage: {
        avg: mortVals.length ? mortVals.reduce((a, b) => a + b, 0) / mortVals.length : undefined,
      },
      totalLots,
      totalArea: totalArea / 1000, // в тысячах кв.м.
    };
  }, [rows, data, selectedJKs]);

  // Вычисляем MIN/MAX для каждой колонки для градиента
  const columnStats = useMemo(() => {
    const stats: Record<string, { min: number; max: number }> = {};
    
    // Числовые колонки для градиента
    const numericColumns = [
      'price_min', 'price_avg', 'price_max',
      'area_min', 'area_avg', 'area_max',
      'lot_price_min', 'lot_price_avg', 'lot_price_max',
      'mort_min', 'mort_avg', 'mort_max'
    ];
    
    numericColumns.forEach((colKey) => {
      const values = rows
        .map(r => (r as any)[colKey])
        .filter((v): v is number => typeof v === 'number');
      
      if (values.length > 0) {
        stats[colKey] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });
    
    return stats;
  }, [rows]);

  const columns = useMemo(() => {
    // Функция для вычисления градиента
    const getGradient = (value: number | undefined, columnKey: string) => {
      if (typeof value !== 'number') return null;
      
      const stats = columnStats[columnKey];
      if (!stats || stats.min === stats.max) {
        return {
          backgroundColor: 'rgba(26, 115, 232, 0.1)',
          color: '#202124'
        };
      }
      
      const op = Math.max(0.1, Math.min(1, (value - stats.min) / (stats.max - stats.min)));
      return {
        backgroundColor: `rgba(26, 115, 232, ${op})`,
        color: op > 0.7 ? 'white' : '#202124'
      };
    };

    // Рендер функция для числовых ячеек с градиентом
    const renderGradientCell = (columnKey: string) => (value: number | undefined) => {
      const gradient = getGradient(value, columnKey);
      if (!gradient) {
        return <span>—</span>;
      }
      
      return (
        <span 
          style={{
            ...gradient,
            borderRadius: '4px',
            padding: '8px',
            display: 'block',
            margin: '-10px -12px', // Компенсируем padding ячейки td
            textAlign: 'right',
            fontFeatureSettings: '"tnum" 1, "lnum" 1',
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {fmtNum(value, 2)}
        </span>
      );
    };

    return ([
    { key: 'jk', title: 'ЖК', align: 'left' as const },
    { key: 'room_label', title: 'Комнат', align: 'left' as const },
    { 
      key: 'price_min', 
      title: 'Мин. цена тыс', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('price_min')
    },
    { 
      key: 'price_avg', 
      title: 'Сред. цена тыс', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('price_avg')
    },
    { 
      key: 'price_max', 
      title: 'Макс. цена тыс', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('price_max')
    },
    { 
      key: 'area_min', 
      title: 'Мин. площадь м²', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('area_min')
    },
    { 
      key: 'area_avg', 
      title: 'Сред. площадь м²', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('area_avg')
    },
    { 
      key: 'area_max', 
      title: 'Макс. площадь м²', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('area_max')
    },
    { 
      key: 'lot_price_min', 
      title: 'Мин. лот', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('lot_price_min')
    },
    { 
      key: 'lot_price_avg', 
      title: 'Сред. лот', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('lot_price_avg')
    },
    { 
      key: 'lot_price_max', 
      title: 'Макс. лот', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('lot_price_max')
    },
    { 
      key: 'mort_min', 
      title: 'Мин. ипотека', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('mort_min')
    },
    { 
      key: 'mort_avg', 
      title: 'Сред. ипотека', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('mort_avg')
    },
    { 
      key: 'mort_max', 
      title: 'Макс. ипотека', 
      align: 'right' as const, 
      highlightMinMax: false,
      render: renderGradientCell('mort_max')
    },
    ]);
  }, [columnStats]);


  return (
    <Layout title="2. Минимальные, средние, максимальные значения: цена кв.м., цена лота, площадь лота, ипотечный платёж">
      {/* Фильтры */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16}}>
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
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Отделка</label>
          <select 
            value={finishFilter} 
            onChange={(e)=> setFinishFilter(e.target.value as any)} 
            className="filter-select"
          >
            <option value="all">Все</option>
            <option value="clean">Чистовая</option>
            <option value="rough">Черновая</option>
            <option value="white">White box</option>
          </select>
        </div>
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Параметр</label>
          <select 
            value={param} 
            onChange={(e)=> setParam(e.target.value as Parameter)} 
            className="filter-select"
          >
            <option value="sqm">Цена кв.м., тыс. руб.</option>
            <option value="lot">Цена лота, млн. руб.</option>
            <option value="area">Площадь, м²</option>
            <option value="mortgage">Ипотечные платежи, тыс. руб.</option>
          </select>
        </div>
      </div>

      {/* KPI карточки */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        {param === 'sqm' && kpi.price.min != null && (
          <KPICard 
            title="Мин. цена кв.м., тыс. руб." 
            value={fmtNum(kpi.price.min, 2)} 
          />
        )}
        {param === 'sqm' && kpi.price.avg != null && (
          <KPICard 
            title="Сред цена кв.м., тыс. руб." 
            value={fmtNum(kpi.price.avg, 2)} 
          />
        )}
        {param === 'sqm' && kpi.price.max != null && (
          <KPICard 
            title="Макс. цена 1 кв.м." 
            value={fmtNum(kpi.price.max, 2)} 
          />
        )}
        {kpi.mortgage.avg != null && (
          <KPICard 
            title="Сред. ипотечный платеж, тыс. руб." 
            value={fmtNum(kpi.mortgage.avg, 2)} 
          />
        )}
        <KPICard 
          title="Всего лотов, шт." 
          value={fmtNum(kpi.totalLots, 0)} 
        />
        <KPICard 
          title="Всего площадь, тыс. кв.м." 
          value={fmtNum(kpi.totalArea, 2)} 
        />
      </div>

      {/* Таблица с группировкой по ЖК */}
      <div>
        <GroupedTable rows={rows} columns={columns} expandedJK={expandedJK} setExpandedJK={setExpandedJK} />
      </div>
    </Layout>
  )
}

// Компонент таблицы с группировкой
interface GroupedTableProps {
  rows: Row[];
  columns: Array<{
    key: string;
    title: string;
    align?: 'left' | 'right' | 'center';
    format?: (v: any, row?: Row) => string;
    highlightMinMax?: boolean;
    render?: (v: any, row: Row) => React.ReactNode;
  }>;
  expandedJK: Set<string>;
  setExpandedJK: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
}

function GroupedTable({ rows, columns, expandedJK, setExpandedJK }: GroupedTableProps) {
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

  const renderCell = (column: typeof columns[0], row: Row) => {
    const raw = (row as any)[column.key];
    
    if (column.render) {
      return column.render(raw, row);
    }
    
    if (column.format) {
      const formatted = column.format(raw, row);
      return formatted;
    }
    
    return raw ?? '—';
  };

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.title}</th>
            ))}
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
                  <td colSpan={columns.length} style={{ padding: '12px' }}>
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
                  <tr key={`${jk}-${row.room_label}-${idx}`}>
                    {columns.map((column) => {
                      const content = renderCell(column, row);
                      // Для детальных строк: jk скрываем или делаем пустым, room_label с отступом
                      if (column.key === 'jk') {
                        return (
                          <td key={column.key} style={{ paddingLeft: '32px' }}>
                            {/* Пустая ячейка для выравнивания */}
                          </td>
                        );
                      }
                      return (
                        <td 
                          key={column.key} 
                          className="num"
                          style={{ 
                            textAlign: column.align || 'left',
                            paddingLeft: column.key === 'room_label' ? '32px' : undefined
                          }}
                        >
                          {content}
                        </td>
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
  );
}
