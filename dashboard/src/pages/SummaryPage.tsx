import { Layout } from '../layout/Layout';
import { KPICard } from '../components/ui/KPICard';
import { DataTable } from '../components/ui/DataTable';
import { MultiSelect } from '../components/ui/MultiSelect';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { fmtNum } from '../utils/formatters';


type Row = {
  label: string;
  ['Среднее значение']?: number;
  studio?: number; 
  ['1-к']?: number; 
  ['2-к']?: number; 
  ['3-к']?: number; 
  ['4+-к']?: number;
};

type Parameter = 'sqm' | 'lot' | 'area' | 'mortgage';

export default function SummaryPage() {
  const { data } = useData();
  const { project, selectedJK, setSelectedJK } = useSelectedProject();
  const [unit, setUnit] = useState<'rub'|'pct'>('rub');
  const [roomFilters, setRoomFilters] = useState<string[]>([]);
  const [param, setParam] = useState<Parameter>('sqm');

  // KPI по макету считаются далее, отдельная структура не требуется

  const types = useMemo(() => {
    const p = project as any;
    const t = p?.apartments_by_type || {};
    const items: { key:string; label:string }[] = [];
    if (t['Studio'] || t['studio']) items.push({ key: t['studio'] ? 'studio' : 'Studio', label: 'Студия' });
    if (t['1-room']) items.push({ key: '1-room', label: '1-к' });
    if (t['2-room']) items.push({ key: '2-room', label: '2-к' });
    if (t['3-room']) items.push({ key: '3-room', label: '3-к' });
    if (t['4plus'] || t['4+-room']) items.push({ key: t['4plus'] ? '4plus' : '4+-room', label: '4+-к' });
    return items;
  }, [project]);

  // Вычисляем среднее изменение за месяц для отображения в первой KPI-карточке
  const topDeltaValue = useMemo(() => {
    const p = project as any;
    const t = p?.apartments_by_type || {};
    const fields: Record<Parameter,{abs?: string; pct?: string}> = {
      sqm: { abs: 'sqm_price_change_ths', pct: 'sqm_price_change_percent' },
      lot: { abs: 'lot_price_change_mln', pct: 'lot_price_change_percent' },
      area: { abs: 'area_change', pct: 'area_change_percent' },
      mortgage: { abs: 'monthly_payment_change_ths', pct: 'monthly_payment_change_percent' },
    };
    const f = fields[param];
    const sample = types.map((it) => {
      const mc = t[it.key]?.monthly_change;
      const v = unit==='pct' ? mc?.[f.pct as string] : mc?.[f.abs as string];
      return typeof v === 'number' ? v : undefined;
    }).filter((x): x is number => typeof x === 'number');
    if (!sample.length) return 0;
    return sample.reduce((a,b)=>a+b,0)/sample.length;
  }, [project, types, param, unit]);

  // Первая таблица: средние значения по типам квартир
  const table = useMemo(() => {
    const p = project as any;
    const rows: Row[] = [];
    if (p) {
      const t = p.apartments_by_type as any;
      const get = (key: string, metric: string) => t[key]?.current_metrics?.[metric];
      const studioKey = t['studio'] ? 'studio' : (t['Studio'] ? 'Studio' : undefined);
      const r4Key = t['4plus'] ? '4plus' : (t['4+-room'] ? '4+-room' : undefined);
      
      const avgOf = (metric:string) => {
        const vals = [studioKey && get(studioKey,metric), get('1-room',metric), get('2-room',metric), get('3-room',metric), r4Key && get(r4Key,metric)]
          .filter((v:any)=>typeof v==='number') as number[];
        return vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : undefined;
      };
      
      // Цена кв.м., тыс. руб.
      rows.push({
        label: 'Цена кв.м., тыс. руб.',
        ['Среднее значение']: avgOf('average_sqm_price_ths'),
        studio: studioKey ? get(studioKey, 'average_sqm_price_ths') : undefined,
        ['1-к']: get('1-room','average_sqm_price_ths'),
        ['2-к']: get('2-room','average_sqm_price_ths'),
        ['3-к']: get('3-room','average_sqm_price_ths'),
        ['4+-к']: r4Key ? get(r4Key,'average_sqm_price_ths') : undefined,
      });
      
      // Цена лота, млн. руб.
      rows.push({
        label: 'Цена лота, млн. руб.',
        ['Среднее значение']: avgOf('average_lot_price_mln'),
        studio: studioKey ? get(studioKey, 'average_lot_price_mln') : undefined,
        ['1-к']: get('1-room','average_lot_price_mln'),
        ['2-к']: get('2-room','average_lot_price_mln'),
        ['3-к']: get('3-room','average_lot_price_mln'),
        ['4+-к']: r4Key ? get(r4Key,'average_lot_price_mln') : undefined,
      });
      
      // Площадь лота, кв.м. (название по макету)
      rows.push({
        label: 'Площадь лота, кв.м.',
        ['Среднее значение']: avgOf('average_area'),
        studio: studioKey ? get(studioKey, 'average_area') : undefined,
        ['1-к']: get('1-room','average_area'),
        ['2-к']: get('2-room','average_area'),
        ['3-к']: get('3-room','average_area'),
        ['4+-к']: r4Key ? get(r4Key,'average_area') : undefined,
      });
      
      // Ипотечные платежи
      const mget = (key:string) => t[key]?.mortgage_calculation?.current_monthly_payment_ths;
      const mAvg = () => {
        const vals = [studioKey && mget(studioKey), mget('1-room'), mget('2-room'), mget('3-room'), r4Key && mget(r4Key)].filter((v:any)=>typeof v==='number') as number[];
        return vals.length? vals.reduce((a,b)=>a+b,0)/vals.length : undefined;
      };
      rows.push({
        label: 'Ипотечные платежи, тыс. руб.',
        ['Среднее значение']: mAvg(),
        studio: studioKey ? mget(studioKey) : undefined,
        ['1-к']: mget('1-room'),
        ['2-к']: mget('2-room'),
        ['3-к']: mget('3-room'),
        ['4+-к']: r4Key ? mget(r4Key) : undefined,
      });
      
      // Сегодня в продаже, шт.
      const todayGet = (key: string) => {
        const count = t[key]?.current_metrics?.apartment_count;
        return typeof count === 'number' ? count : undefined;
      };
      const todayAvg = () => {
        const vals = [studioKey && todayGet(studioKey), todayGet('1-room'), todayGet('2-room'), todayGet('3-room'), r4Key && todayGet(r4Key)]
          .filter((v:any)=>typeof v==='number') as number[];
        return vals.length? vals.reduce((a,b)=>a+b,0) : undefined; // сумма, а не среднее
      };
      rows.push({
        label: 'Сегодня в продаже, шт.',
        ['Среднее значение']: todayAvg(),
        studio: studioKey ? todayGet(studioKey) : undefined,
        ['1-к']: todayGet('1-room'),
        ['2-к']: todayGet('2-room'),
        ['3-к']: todayGet('3-room'),
        ['4+-к']: r4Key ? todayGet(r4Key) : undefined,
      });
      
      // Вымываемость лотов, шт.
      const washoutGet = (key: string) => {
        const count = t[key]?.washout_analysis?.washed_out_count;
        return typeof count === 'number' ? count : undefined;
      };
      const washoutAvg = () => {
        const vals = [studioKey && washoutGet(studioKey), washoutGet('1-room'), washoutGet('2-room'), washoutGet('3-room'), r4Key && washoutGet(r4Key)]
          .filter((v:any)=>typeof v==='number') as number[];
        return vals.length? vals.reduce((a,b)=>a+b,0) : undefined; // сумма
      };
      rows.push({
        label: 'Вымываемость лотов, шт.',
        ['Среднее значение']: washoutAvg(),
        studio: studioKey ? washoutGet(studioKey) : undefined,
        ['1-к']: washoutGet('1-room'),
        ['2-к']: washoutGet('2-room'),
        ['3-к']: washoutGet('3-room'),
        ['4+-к']: r4Key ? washoutGet(r4Key) : undefined,
      });
      
      // Новые лоты, шт. (используем apartment_count как приближение, если нет отдельного поля)
      // Можно также попробовать найти в данных новые лоты отдельно
      const newLotsGet = (key: string) => {
        // Пока используем apartment_count, позже можно добавить отдельное поле для новых лотов
        const count = t[key]?.current_metrics?.apartment_count;
        return typeof count === 'number' ? count : undefined;
      };
      const newLotsAvg = () => {
        const vals = [studioKey && newLotsGet(studioKey), newLotsGet('1-room'), newLotsGet('2-room'), newLotsGet('3-room'), r4Key && newLotsGet(r4Key)]
          .filter((v:any)=>typeof v==='number') as number[];
        return vals.length? vals.reduce((a,b)=>a+b,0) : undefined; // сумма
      };
      rows.push({
        label: 'Новые лоты, шт.',
        ['Среднее значение']: newLotsAvg(),
        studio: studioKey ? newLotsGet(studioKey) : undefined,
        ['1-к']: newLotsGet('1-room'),
        ['2-к']: newLotsGet('2-room'),
        ['3-к']: newLotsGet('3-room'),
        ['4+-к']: r4Key ? newLotsGet(r4Key) : undefined,
      });
    }
    return rows;
  }, [project]);

  // Определяем, какие строки должны форматироваться как целые числа
  const integerRows = ['Сегодня в продаже, шт.', 'Вымываемость лотов, шт.', 'Новые лоты, шт.'];
  
  const columns = useMemo(() => ([
    { key: 'label', title: 'Параметр', align: 'left' as const },
    { 
      key: 'Среднее значение', 
      title: 'Среднее значение', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
    { 
      key: 'studio', 
      title: 'Студия', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
    { 
      key: '1-к', 
      title: '1-к', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
    { 
      key: '2-к', 
      title: '2-к', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
    { 
      key: '3-к', 
      title: '3-к', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
    { 
      key: '4+-к', 
      title: '4+-к', 
      align: 'right' as const, 
      highlightMinMax: true, 
      format: (v:number, row?: Row)=> {
        if (v == null) return '—';
        const isIntegerRow = row && integerRows.includes(row.label);
        return fmtNum(v, isIntegerRow ? 0 : 2);
      }
    },
  ]), []);

  // Таблица 2: Среднее / Минимум / Максимум / Итоги
  type Row2 = { 
    label: string; 
    avg?: number; 
    min?: number; 
    max?: number; 
    today?: number; 
    total_area?: number; 
    total_cost?: number; 
  };
  
  const rows2 = useMemo<Row2[]>(() => {
    const p = project as any;
    if (!p) return [];
    
    const t = p.apartments_by_type || {};
    const studioKey = t['studio'] ? 'studio' : (t['Studio'] ? 'Studio' : undefined);
    const r4Key = t['4plus'] ? '4plus' : (t['4+-room'] ? '4+-room' : undefined);
    const get = (key: string, metric: string) => t[key]?.current_metrics?.[metric];
    
    const collect = (metric: string) => [
      studioKey && get(studioKey, metric), 
      get('1-room', metric), 
      get('2-room', metric), 
      get('3-room', metric), 
      r4Key && get(r4Key, metric)
    ].filter((v:any)=>typeof v==='number') as number[];
    
    const avgOf = (metric:string) => { 
      const vals = collect(metric); 
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : undefined;
    };
    const minOf = (metric:string) => { 
      const vals = collect(metric); 
      return vals.length ? Math.min(...vals) : undefined;
    };
    const maxOf = (metric:string) => { 
      const vals = collect(metric); 
      return vals.length ? Math.max(...vals) : undefined;
    };
    
    // Вычисляем итоговые значения для колонок "Сегодня в продаже", "Всего площадь", "Всего стоимость"
    const todayGet = (key: string) => t[key]?.current_metrics?.apartment_count;
    const todayTotal = [
      studioKey && todayGet(studioKey), 
      todayGet('1-room'), 
      todayGet('2-room'), 
      todayGet('3-room'), 
      r4Key && todayGet(r4Key)
    ].filter((v:any)=>typeof v==='number') as number[];
    const todayValue = todayTotal.length ? todayTotal.reduce((a,b)=>a+b,0) : undefined;
    
    // Всего площадь (сумма площадей всех квартир)
    const areaGet = (key: string) => {
      const count = t[key]?.current_metrics?.apartment_count;
      const avgArea = t[key]?.current_metrics?.average_area;
      return (typeof count === 'number' && typeof avgArea === 'number') ? count * avgArea : undefined;
    };
    const areaTotal = [
      studioKey && areaGet(studioKey), 
      areaGet('1-room'), 
      areaGet('2-room'), 
      areaGet('3-room'), 
      r4Key && areaGet(r4Key)
    ].filter((v:any)=>typeof v==='number') as number[];
    const totalAreaValue = areaTotal.length ? areaTotal.reduce((a,b)=>a+b,0) / 1000 : undefined; // в тысячах кв.м.
    
    // Всего стоимость (сумма стоимостей всех квартир)
    const costGet = (key: string) => {
      const count = t[key]?.current_metrics?.apartment_count;
      const avgPrice = t[key]?.current_metrics?.average_lot_price_mln;
      return (typeof count === 'number' && typeof avgPrice === 'number') ? count * avgPrice : undefined;
    };
    const costTotal = [
      studioKey && costGet(studioKey), 
      costGet('1-room'), 
      costGet('2-room'), 
      costGet('3-room'), 
      r4Key && costGet(r4Key)
    ].filter((v:any)=>typeof v==='number') as number[];
    const totalCostValue = costTotal.length ? costTotal.reduce((a,b)=>a+b,0) : undefined; // в млн. руб.
    
    const out: Row2[] = [];
    
    // Цена кв.м., тыс. руб.
    out.push({ 
      label: 'Цена кв.м., тыс. руб.', 
      avg: avgOf('average_sqm_price_ths'), 
      min: minOf('min_sqm_price_ths'), 
      max: maxOf('max_sqm_price_ths'), 
      today: todayValue,
      total_area: totalAreaValue,
      total_cost: totalCostValue
    });
    
    // Цена лота, млн. руб.
    out.push({ 
      label: 'Цена лота, млн. руб.', 
      avg: avgOf('average_lot_price_mln'), 
      min: minOf('min_lot_price_mln'), 
      max: maxOf('max_lot_price_mln'),
      today: todayValue,
      total_area: totalAreaValue,
      total_cost: totalCostValue
    });
    
    // Площадь, кв.м.
    out.push({ 
      label: 'Площадь, кв.м.', 
      avg: avgOf('average_area'), 
      min: minOf('min_area'), 
      max: maxOf('max_area'),
      today: todayValue,
      total_area: totalAreaValue,
      total_cost: totalCostValue
    });
    
    // Ипотечные платежи: используем только среднее
    const mget = (key:string) => t[key]?.mortgage_calculation?.current_monthly_payment_ths;
    const mvals = [
      studioKey && mget(studioKey), 
      mget('1-room'), 
      mget('2-room'), 
      mget('3-room'), 
      r4Key && mget(r4Key)
    ].filter((v:any)=>typeof v==='number') as number[];
    const mavg = mvals.length ? mvals.reduce((a,b)=>a+b,0)/mvals.length : undefined;
    out.push({ 
      label: 'Ипотечный платеж, тыс. руб.', 
      avg: mavg, 
      min: undefined, 
      max: undefined,
      today: todayValue,
      total_area: totalAreaValue,
      total_cost: totalCostValue
    });
    
    return out;
  }, [project]);

  const columns2 = useMemo(() => ([
    { key: 'label', title: 'Параметр', align: 'left' as const },
    { key: 'avg', title: 'Среднее значение', align: 'right' as const, highlightMinMax: true, format: (v:number)=> v != null ? fmtNum(v, 2) : '—' },
    { key: 'min', title: 'Минимум', align: 'right' as const, highlightMinMax: true, format: (v:number)=> v != null ? fmtNum(v, 2) : '—' },
    { key: 'max', title: 'Максимум', align: 'right' as const, highlightMinMax: true, format: (v:number)=> v != null ? fmtNum(v, 2) : '—' },
    { key: 'today', title: 'Сегодня в продаже, шт.', align: 'right' as const, format: (v:number)=> v != null ? fmtNum(v, 0) : '—' },
    { key: 'total_area', title: 'Всего площадь лотов, тыс. кв.м.', align: 'right' as const, format: (v:number)=> v != null ? fmtNum(v, 2) : '—' },
    { key: 'total_cost', title: 'Всего стоимость лотов, млн. руб.', align: 'right' as const, format: (v:number)=> v != null ? fmtNum(v, 2) : '—' },
  ]), []);


  // Получаем название параметра для KPI-карточек
  const getParamLabel = () => {
    switch(param) {
      case 'sqm': return 'цена кв.м.';
      case 'lot': return 'цена лота';
      case 'area': return 'площадь';
      case 'mortgage': return 'ипотека';
      default: return 'цена кв.м.';
    }
  };

  const getUnitLabel = () => {
    return unit === 'pct' ? '%' : (param === 'sqm' ? 'тыс. руб.' : param === 'lot' ? 'млн. руб.' : param === 'area' ? 'м²' : 'тыс. руб.');
  };

  return (
    <Layout title="1. Сводный отчёт: средние данные по локации + по каждому ЖК">
      {/* Панель фильтров - порядок как на скриншоте */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end', marginBottom: 16}}>
        {/* Переключатель Руб/Процент - первым */}
        <div>
          <div className="toggle" role="tablist" aria-label="Единицы" style={{marginBottom: 0}}>
            <button 
              className={`toggle-btn ${unit==='rub'?'is-active':''}`} 
              aria-pressed={unit==='rub'} 
              onClick={()=>setUnit('rub')}
              style={{padding:'8px 16px'}}
            >
              Руб.
            </button>
            <button 
              className={`toggle-btn ${unit==='pct'?'is-active':''}`} 
              aria-pressed={unit==='pct'} 
              onClick={()=>setUnit('pct')}
              style={{padding:'8px 16px'}}
            >
              %
            </button>
          </div>
        </div>
        
        {/* Жилой комплекс */}
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Жилой комплекс</label>
          <select 
            value={selectedJK ?? ''} 
            onChange={(e)=> setSelectedJK(e.target.value)} 
            className="filter-select"
          >
            <option value="">Все</option>
            {(data?.projects ?? []).map((p)=> (
              <option key={(p as any).jk_name} value={(p as any).jk_name}>{(p as any).jk_name}</option>
            ))}
          </select>
        </div>
        
        {/* Комнатность */}
        <div className="filter-group">
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Комнатность</label>
          <MultiSelect
            options={[
              { value: 'studio', label: 'Студия' },
              { value: '1-room', label: '1-к' },
              { value: '2-room', label: '2-к' },
              { value: '3-room', label: '3-к' },
              { value: '4plus', label: '4+-к' },
            ]}
            value={roomFilters}
            onChange={setRoomFilters}
            placeholder="Все"
          />
        </div>
        
        {/* Параметр */}
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

      {/* KPI-карточки: изменение за месяц */}
      <div className="kpi-grid" style={{marginBottom:24}}>
        <KPICard 
          title={`Сред. ${getParamLabel()}, изм. за месяц (${getUnitLabel()})`} 
          value={`${topDeltaValue>0?'+':''}${fmtNum(topDeltaValue,2)}`} 
        />
        {types.filter(({key}) => {
            const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
            return roomFilters.length === 0 || roomFilters.includes(normalizedKey);
          }).map(({key,label}) => {
          const t = (project as any)?.apartments_by_type;
          const mc = t?.[key]?.monthly_change;
          const fields: Record<Parameter,{abs?: string; pct?: string}> = {
            sqm: { abs: 'sqm_price_change_ths', pct: 'sqm_price_change_percent' },
            lot: { abs: 'lot_price_change_mln', pct: 'lot_price_change_percent' },
            area: { abs: 'area_change', pct: 'area_change_percent' },
            mortgage: { abs: 'monthly_payment_change_ths', pct: 'monthly_payment_change_percent' },
          };
          const f = fields[param];
          const val = unit==='pct' ? mc?.[f.pct as string] : mc?.[f.abs as string];
          const delta = typeof val==='number' ? val : undefined;
          const txt = (delta!=null) ? `${delta>0?'+':''}${fmtNum(delta,2)}` : '—';
          return <KPICard key={key} title={label} value={txt} />
        })}
      </div>

      {/* Таблица 1: Средние значения по типам квартир */}
      <div style={{ marginBottom: 24 }}>
        <DataTable<Row> rows={table} columns={columns} rowKey={(r)=>r.label} />
      </div>

      {/* Таблица 2: Сводная с минимум/максимум и итогами */}
      <div>
        <DataTable<Row2> rows={rows2} columns={columns2 as any} rowKey={(r)=>r.label} />
      </div>
    </Layout>
  );
}
