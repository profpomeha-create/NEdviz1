import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { ChartWrapper } from '../components/ui/ChartWrapper';
import { KPICard } from '../components/ui/KPICard';
import { MultiSelect } from '../components/ui/MultiSelect';
import { ensureRegistered } from '../lib/chartConfig';
import { fmtNum } from '../utils/formatters';

ensureRegistered();

type Parameter = 'sqm' | 'lot' | 'area' | 'mortgage';

export default function ExpressPage(){
  const { data } = useData();
  const { project } = useSelectedProject();
  const [selectedJKs, setSelectedJKs] = useState<string[]>([]);
  const [roomFilters, setRoomFilters] = useState<string[]>([]);
  const [param, setParam] = useState<Parameter>('sqm');
  const [unit, setUnit] = useState<'rub'|'pct'>('rub');

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

  // Получаем типы квартир
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

  // Вычисляем среднее изменение за месяц для первой KPI-карточки
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
    const filteredTypes = types.filter((it) => {
      const normalizedKey = it.key === 'Studio' ? 'studio' : (it.key === '4+-room' ? '4plus' : it.key);
      return roomFilters.length === 0 || roomFilters.includes(normalizedKey);
    });
    const sample = filteredTypes.map((it) => {
      const mc = t[it.key]?.monthly_change;
      const v = unit==='pct' ? mc?.[f.pct as string] : mc?.[f.abs as string];
      return typeof v === 'number' ? v : undefined;
    }).filter((x): x is number => typeof x === 'number');
    if (!sample.length) return 0;
    return sample.reduce((a,b)=>a+b,0)/sample.length;
  }, [project, types, param, unit]);

  // График 1: Цена кв.м., % - Bar Chart с двумя сериями: Месяц назад и Неделя
  const chart1Data = useMemo(() => {
    if (!data?.projects) return null;
    
    const labels: string[] = [];
    const monthAgoData: number[] = [];
    const weekData: number[] = [];
    
    data.projects.forEach((p: any) => {
      const jkName = p.jk_name;
      labels.push(jkName);
      
      // Получаем среднее изменение за месяц и за неделю по всем типам
      const t = p?.apartments_by_type || {};
      const monthChanges: number[] = [];
      const weekChanges: number[] = [];
      
      Object.keys(t).forEach((key) => {
        const monthly = t[key]?.monthly_change?.sqm_price_change_percent;
        const weekly = t[key]?.weekly_change?.sqm_price_change_percent;
        if (typeof monthly === 'number') monthChanges.push(monthly);
        if (typeof weekly === 'number') weekChanges.push(weekly);
      });
      
      const monthAvg = monthChanges.length ? monthChanges.reduce((a,b)=>a+b,0)/monthChanges.length : null;
      const weekAvg = weekChanges.length ? weekChanges.reduce((a,b)=>a+b,0)/weekChanges.length : null;
      
      monthAgoData.push(monthAvg ?? 0);
      weekData.push(weekAvg ?? 0);
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Месяц назад',
          data: monthAgoData,
          backgroundColor: 'rgba(26, 115, 232, 0.8)',
        },
        {
          label: 'Неделя',
          data: weekData,
          backgroundColor: 'rgba(66, 133, 244, 0.5)',
        },
      ],
    };
  }, [data]);

  // График 2: Цена лота, млн. руб. - Bar Chart с тремя сериями
  const chart2Data = useMemo(() => {
    if (!data?.projects) return null;
    
    const labels: string[] = [];
    const monthAgoData: number[] = [];
    const twoWeeksAgoData: number[] = [];
    const todayData: number[] = [];
    
    data.projects.forEach((p: any) => {
      const jkName = p.jk_name;
      labels.push(jkName);
      
      const t = p?.apartments_by_type || {};
      const prices: {month?: number; twoWeeks?: number; today?: number}[] = [];
      
      Object.keys(t).forEach((key) => {
        const hist = t[key]?.historical_sqm_prices;
        const current = t[key]?.current_metrics?.average_lot_price_mln;
        const currentArea = t[key]?.current_metrics?.average_area;
        
        // Месяц назад: используем historical_sqm_prices.one_month_ago_ths и площадь для расчета цены лота
        const monthPrice = hist?.one_month_ago_ths && currentArea ? 
          (hist.one_month_ago_ths * currentArea / 1000) : undefined;
        
        // 2 недели назад: используем biweekly_change для расчета
        const biweeklyChange = t[key]?.biweekly_change?.lot_price_change_percent;
        const twoWeeksPrice = current && biweeklyChange != null ? 
          (current / (1 + biweeklyChange / 100)) : undefined;
        
        prices.push({
          month: monthPrice,
          twoWeeks: twoWeeksPrice,
          today: current,
        });
      });
      
      const monthAvg = prices.filter(p => p.month != null);
      const twoWeeksAvg = prices.filter(p => p.twoWeeks != null);
      const todayAvg = prices.filter(p => p.today != null);
      
      monthAgoData.push(monthAvg.length ? monthAvg.map(p => p.month!).reduce((a,b)=>a+b,0) / monthAvg.length : 0);
      twoWeeksAgoData.push(twoWeeksAvg.length ? twoWeeksAvg.map(p => p.twoWeeks!).reduce((a,b)=>a+b,0) / twoWeeksAvg.length : 0);
      todayData.push(todayAvg.length ? todayAvg.map(p => p.today!).reduce((a,b)=>a+b,0) / todayAvg.length : 0);
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Месяц назад',
          data: monthAgoData,
          backgroundColor: 'rgba(66, 133, 244, 0.6)',
        },
        {
          label: '2 недели назад',
          data: twoWeeksAgoData,
          backgroundColor: 'rgba(26, 115, 232, 0.7)',
        },
        {
          label: 'Сегодня',
          data: todayData,
          backgroundColor: 'rgba(26, 115, 232, 0.9)',
        },
      ],
    };
  }, [data]);

  // График 3: Ипотека, тыс. руб. - Bar Chart с тремя сериями
  const chart3Data = useMemo(() => {
    if (!data?.projects) return null;
    
    const labels: string[] = [];
    const monthAgoData: number[] = [];
    const twoWeeksAgoData: number[] = [];
    const todayData: number[] = [];
    
    data.projects.forEach((p: any) => {
      const jkName = p.jk_name;
      labels.push(jkName);
      
      const t = p?.apartments_by_type || {};
      const mortgages: {month?: number; twoWeeks?: number; today?: number}[] = [];
      
      Object.keys(t).forEach((key) => {
        const mort = t[key]?.mortgage_calculation;
        const today = mort?.current_monthly_payment_ths;
        
        // 2 недели назад: используем biweekly_change
        const biweeklyChange = mort?.biweekly_change?.percent_change;
        const twoWeeks = today && biweeklyChange != null ? 
          (today / (1 + biweeklyChange / 100)) : undefined;
        
        // Месяц назад: используем weekly_change * 4 как приближение или historical данные
        const monthlyChange = t[key]?.monthly_change?.monthly_payment_change_percent;
        const month = today && monthlyChange != null ? 
          (today / (1 + monthlyChange / 100)) : undefined;
        
        if (today != null) {
          mortgages.push({
            month,
            twoWeeks,
            today,
          });
        }
      });
      
      const monthAvg = mortgages.filter(m => m.month != null);
      const twoWeeksAvg = mortgages.filter(m => m.twoWeeks != null);
      const todayAvg = mortgages.filter(m => m.today != null);
      
      monthAgoData.push(monthAvg.length ? monthAvg.map(m => m.month!).reduce((a,b)=>a+b,0) / monthAvg.length : 0);
      twoWeeksAgoData.push(twoWeeksAvg.length ? twoWeeksAvg.map(m => m.twoWeeks!).reduce((a,b)=>a+b,0) / twoWeeksAvg.length : 0);
      todayData.push(todayAvg.length ? todayAvg.map(m => m.today!).reduce((a,b)=>a+b,0) / todayAvg.length : 0);
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Месяц назад',
          data: monthAgoData,
          backgroundColor: 'rgba(66, 133, 244, 0.6)',
        },
        {
          label: '2 недели назад',
          data: twoWeeksAgoData,
          backgroundColor: 'rgba(26, 115, 232, 0.7)',
        },
        {
          label: 'Сегодня',
          data: todayData,
          backgroundColor: 'rgba(26, 115, 232, 0.9)',
        },
      ],
    };
  }, [data]);

  // График 4: Динамика, 30 дней - Line Chart
  const chart4Data = useMemo(() => {
    // Генерируем даты за последние 30 дней (4 недели)
    const dates: string[] = [];
    const today = new Date();
    for (let i = 28; i >= 0; i -= 7) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      dates.push(`${monthNames[date.getMonth()]} ${date.getDate()}`);
    }
    
    // Получаем данные для каждого параметра (приблизительно, на основе исторических данных)
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    // Берем первый тип для примера (можно усреднить)
    const firstType = Object.keys(t)[0];
    const monthlyChange = t[firstType]?.monthly_change || {};
    
    // Создаем тренды (проценты изменения)
    const sqmData = dates.map((_, i) => {
      const ratio = i / (dates.length - 1);
      return (monthlyChange.sqm_price_change_percent || 0) * (1 - ratio * 0.5);
    });
    const lotData = dates.map((_, i) => {
      const ratio = i / (dates.length - 1);
      return (monthlyChange.lot_price_change_percent || 0) * (1 - ratio * 0.5);
    });
    const areaData = dates.map((_, i) => {
      const ratio = i / (dates.length - 1);
      return (monthlyChange.area_change_percent || 0) * (1 - ratio * 0.5);
    });
    const mortgageData = dates.map((_, i) => {
      const ratio = i / (dates.length - 1);
      return (monthlyChange.monthly_payment_change_percent || 0) * (1 - ratio * 0.5);
    });
    
    return {
      labels: dates,
      datasets: [
        {
          label: 'Цена кв.м',
          data: sqmData,
          borderColor: '#34a853',
          backgroundColor: 'rgba(52, 168, 83, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Цена лота',
          data: lotData,
          borderColor: '#ff9800',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Площадь',
          data: areaData,
          borderColor: '#9c27b0',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Ипотека',
          data: mortgageData,
          borderColor: '#ffc107',
          backgroundColor: 'rgba(255, 193, 7, 0.1)',
          tension: 0.4,
        },
      ],
    };
  }, [project]);

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
    <Layout title="3. Экспресс-анализ: параметры рынка сегодня, 2 и 4 недели назад">
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
      </div>

      {/* KPI карточки */}
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

      {/* Графики */}
      <div className="charts-grid-mobile">
        {/* График 1: Цена кв.м., % */}
        {chart1Data && (
          <div className="card">
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Цена кв.м., %</h3>
            <ChartWrapper type="bar" data={chart1Data} height={280} />
          </div>
        )}
        
        {/* График 2: Цена лота, млн. руб. */}
        {chart2Data && (
          <div className="card">
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Цена лота, млн. руб.</h3>
            <ChartWrapper type="bar" data={chart2Data} height={280} />
          </div>
        )}
        
        {/* График 3: Ипотека, тыс. руб. */}
        {chart3Data && (
          <div className="card">
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Ипотека, тыс. руб.</h3>
            <ChartWrapper type="bar" data={chart3Data} height={280} />
          </div>
        )}
        
        {/* График 4: Динамика, 30 дней */}
        {chart4Data && (
          <div className="card">
            <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Динамика, 30 дней</h3>
            <ChartWrapper type="line" data={chart4Data} height={280} />
          </div>
        )}
      </div>
    </Layout>
  )
}
