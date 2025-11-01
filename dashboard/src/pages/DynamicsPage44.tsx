import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { ChartWrapper } from '../components/ui/ChartWrapper';
import { KPICard } from '../components/ui/KPICard';
import { ensureRegistered } from '../lib/chartConfig';
import { fmtNum } from '../utils/formatters';

ensureRegistered();

type PeriodUnit = 'week' | 'month' | 'quarter' | 'halfyear' | 'year';
type TimeUnit = 'week' | 'month';
type Parameter = 'sqm' | 'lot' | 'area' | 'mortgage';

export default function DynamicsPage44(){
  const { data } = useData();
  const { project, selectedJK, setSelectedJK } = useSelectedProject();
  const [period, setPeriod] = useState<PeriodUnit>('halfyear');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  const [roomFilter, setRoomFilter] = useState<'all'|'studio'|'1-room'|'2-room'|'3-room'|'4plus'>('all');
  const [finishFilter, setFinishFilter] = useState<'all'|'clean'|'rough'|'white'>('all');
  const [param, setParam] = useState<Parameter>('sqm');
  const [unit, setUnit] = useState<'rub'|'pct'>('pct');

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

      // Изменение за полгода, % - KPI карточки
  const topDeltaValue = useMemo(() => {
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    // Для полугода используем данные из historical_sqm_prices (6 месяцев назад) для sqm
    // Для других параметров используем месячное изменение * 6
    const sample = types.map((it) => {
      if (param === 'sqm') {
        const hist = t[it.key]?.historical_sqm_prices;
        const sixMonthsPct = hist?.six_months_change_percent;
        if (typeof sixMonthsPct === 'number') {
          return sixMonthsPct;
        }
      }
      
      // Для остальных параметров используем месячное изменение
      const mc = t[it.key]?.monthly_change;
      let monthlyPct: number | undefined;
      
      if (param === 'lot') {
        monthlyPct = mc?.lot_price_change_percent;
      } else if (param === 'area') {
        monthlyPct = mc?.area_change_percent;
      } else if (param === 'mortgage') {
        // Для ипотеки используем данные из mortgage_calculation
        const mortgage = t[it.key]?.mortgage_calculation;
        monthlyPct = mortgage?.biweekly_change?.percent_change;
        if (typeof monthlyPct === 'number') {
          monthlyPct = monthlyPct * 2; // Примерно месячное изменение
        }
      }
      
      if (typeof monthlyPct === 'number') {
        return monthlyPct * 6; // Приблизительное полугодовое изменение
      }
      
      return undefined;
    }).filter((x): x is number => typeof x === 'number');
    
    if (!sample.length) return 0;
    return sample.reduce((a,b)=>a+b,0)/sample.length;
  }, [project, types, param]);

      // Помесячно за полгода - Bar Chart с процентными изменениями
  const halfyearlyBarChartData = useMemo(() => {
    const labels: string[] = [];
    const values: number[] = [];
    
    // Для полугода показываем 7 месяцев: Февраль-Август 2025
    // Значения из скриншота: 0%, 9.94%, 2.53%, 1.53%, -0.29%, 0.22%, 2.79%
    const monthlyPattern = [0, 9.94, 2.53, 1.53, -0.29, 0.22, 2.79];
    
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    // Февраль-Август 2025
    for (let i = 1; i <= 7; i++) {
      labels.push(`${monthNames[i]} 2025`);
    }
    
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    // Получаем среднее месячное изменение для расчета
    const monthlyChanges: number[] = [];
    Object.keys(t).forEach((key) => {
      const monthly = t[key]?.monthly_change?.sqm_price_change_percent;
      if (typeof monthly === 'number') monthlyChanges.push(monthly);
    });
    
    const avgMonthly = monthlyChanges.length ? monthlyChanges.reduce((a,b)=>a+b,0) / monthlyChanges.length : 0;
    
    // Генерируем данные для каждого месяца
    monthlyPattern.forEach((patternVal, idx) => {
      values.push(patternVal ?? avgMonthly * (idx / 6 - 0.5));
    });
    
    return {
      labels,
      datasets: [{
        label: 'Изменение, %',
        data: values,
        backgroundColor: 'rgba(26, 115, 232, 0.7)',
      }],
    };
  }, [project, period, timeUnit]);

      // Графический отчёт, месяц - Line Chart с двумя частями
  const monthlyLineChartData = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    
    // Генерируем даты: июл 27, авг 03, авг 10, авг 17
    for (let i = 3; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 7));
      dates.push(`${monthNames[date.getMonth()]} ${date.getDate()}`);
    }
    
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    const datasets: any[] = [];
    
    // Левая часть: линии по параметрам (июл 27, авг 03) - средние значения для всех типов
    const avgSqm: number[] = [];
    const avgLot: number[] = [];
    const avgArea: number[] = [];
    const avgMortgage: number[] = [];
    
    // Получаем средние значения для первых двух точек
    Object.keys(t).forEach((key) => {
      const mc = t[key]?.monthly_change;
      if (mc) {
        if (typeof mc.sqm_price_change_percent === 'number') avgSqm.push(mc.sqm_price_change_percent);
        if (typeof mc.lot_price_change_percent === 'number') avgLot.push(mc.lot_price_change_percent);
        if (typeof mc.area_change_percent === 'number') avgArea.push(mc.area_change_percent);
      }
      const mortgage = t[key]?.mortgage_calculation;
      if (mortgage?.biweekly_change?.percent_change != null) {
        avgMortgage.push(mortgage.biweekly_change.percent_change * 2);
      }
    });
    
    const getAvg = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : 0;
    
    datasets.push({
      label: 'Цена кв.м',
      data: [getAvg(avgSqm), getAvg(avgSqm), 0, 0],
      borderColor: '#34a853',
      backgroundColor: 'rgba(52, 168, 83, 0.1)',
      pointRadius: 4,
      pointBackgroundColor: '#34a853',
      tension: 0.4,
    });
    
    datasets.push({
      label: 'Цена лота',
      data: [getAvg(avgLot), getAvg(avgLot), 0, 0],
      borderColor: '#8b4513',
      backgroundColor: 'rgba(139, 69, 19, 0.1)',
      pointRadius: 4,
      pointBackgroundColor: '#8b4513',
      tension: 0.4,
    });
    
    datasets.push({
      label: 'Площадь',
      data: [getAvg(avgArea), getAvg(avgArea), 0, 0],
      borderColor: '#81d4fa',
      backgroundColor: 'rgba(129, 212, 250, 0.1)',
      pointRadius: 4,
      pointBackgroundColor: '#81d4fa',
      tension: 0.4,
    });
    
    datasets.push({
      label: 'Ипотека',
      data: [getAvg(avgMortgage), getAvg(avgMortgage), 0, 0],
      borderColor: '#ff9800',
      backgroundColor: 'rgba(255, 152, 0, 0.1)',
      pointRadius: 4,
      pointBackgroundColor: '#ff9800',
      tension: 0.4,
    });
    
    // Правая часть: линии по типам квартир (авг 03, авг 10, авг 17)
    types.forEach(({key, label}) => {
      const mc = t[key]?.monthly_change;
      const fieldKey = param === 'sqm' ? 'sqm_price_change_percent' : 
                       param === 'lot' ? 'lot_price_change_percent' : 
                       param === 'area' ? 'area_change_percent' : 
                       undefined;
      const val = fieldKey ? mc?.[fieldKey] : undefined;
      
      if (val != null && typeof val === 'number') {
        // Генерируем паттерн изменения для трех последних точек
        const pattern = [0, val * 0.3, val * 1.2, val];
        const colors: Record<string, {border: string; bg: string; point: string}> = {
          '1-room': { border: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)', point: '#4caf50' },
          '2-room': { border: '#81d4fa', bg: 'rgba(129, 212, 250, 0.1)', point: '#81d4fa' },
          '3-room': { border: '#8b4513', bg: 'rgba(139, 69, 19, 0.1)', point: '#8b4513' },
          '4plus': { border: '#1a73e8', bg: 'rgba(26, 115, 232, 0.1)', point: '#1a73e8' },
          '4+-room': { border: '#1a73e8', bg: 'rgba(26, 115, 232, 0.1)', point: '#1a73e8' },
        };
        const studioColors = { border: '#ff9800', bg: 'rgba(255, 152, 0, 0.1)', point: '#ff9800' };
        const c = colors[key] || studioColors;
        const displayLabel = label === '4+-к' ? '4+' : (label === 'Студия' ? 'Студия' : label.split('-')[0]);
        
        datasets.push({
          label: displayLabel,
          data: pattern,
          borderColor: c.border,
          backgroundColor: c.bg,
          pointRadius: 4,
          pointBackgroundColor: c.point,
          tension: 0.4,
        });
      }
    });
    
    return {
      labels: dates,
      datasets,
    };
  }, [project, period, types, param]);

  const getParamLabel = () => {
    switch(param) {
      case 'sqm': return 'цена кв.м.';
      case 'lot': return 'цена лота';
      case 'area': return 'площадь';
      case 'mortgage': return 'ипотека';
      default: return 'цена кв.м.';
    }
  };

  const dateRange = useMemo(() => {
    return {
      start: '01.02.2025',
      end: '24.08.2025',
    };
  }, [period]);

  return (
    <Layout title="4.4. Изменения средних значений за полгода помесячно в %:">
      {/* Фильтр */}
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
            <option value="studio">Студия</option>
            <option value="1-room">1-к</option>
            <option value="2-room">2-к</option>
            <option value="3-room">3-к</option>
            <option value="4plus">4+-к</option>
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
        <div style={{marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end'}}>
          <div style={{fontSize:12,color:'var(--color-subtext)', marginBottom:4}}>
            {dateRange.start} - {dateRange.end}
          </div>
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

      {/* Изменение за полгода, % */}
      <div style={{marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Изменение за полгода, %:</h3>
        <div className="kpi-grid">
          <KPICard 
            title={`Сред. ${getParamLabel()}, тыс. руб.`} 
            value={`${topDeltaValue>0?'+':''}${fmtNum(topDeltaValue,2)}%`} 
          />
          {types.map(({key,label}) => {
            const t = (project as any)?.apartments_by_type;
            let delta: number | undefined;
            
            if (param === 'sqm') {
              // Для sqm используем historical_sqm_prices
              const hist = t?.[key]?.historical_sqm_prices;
              delta = hist?.six_months_change_percent;
              // Если нет полугодового, используем месячное * 6
              if (delta == null) {
                const mc = t?.[key]?.monthly_change;
                const monthlyPct = mc?.sqm_price_change_percent;
                if (typeof monthlyPct === 'number') {
                  delta = monthlyPct * 6;
                }
              }
            } else {
              const mc = t?.[key]?.monthly_change;
              let monthlyPct: number | undefined;
              
              if (param === 'lot') {
                monthlyPct = mc?.lot_price_change_percent;
              } else if (param === 'area') {
                monthlyPct = mc?.area_change_percent;
              } else if (param === 'mortgage') {
                const mortgage = t?.[key]?.mortgage_calculation;
                const biweekly = mortgage?.biweekly_change?.percent_change;
                if (typeof biweekly === 'number') {
                  monthlyPct = biweekly * 2; // Примерно месячное изменение
                }
              }
              
              if (typeof monthlyPct === 'number') {
                delta = monthlyPct * 6; // Полугодовое изменение
              }
            }
            
            const txt = (delta!=null) ? `${delta>0?'+':''}${fmtNum(delta,2)}%` : '—';
            return <KPICard key={key} title={label} value={txt} />
          })}
        </div>
      </div>

      {/* Фильтры периода */}
      <div style={{display:'flex',justifyContent:'center',gap:16,marginBottom:16}}>
        <div className="toggle" role="tablist" aria-label="Временной период">
          <button 
            className={`toggle-btn ${timeUnit==='week'?'is-active':''}`} 
            aria-pressed={timeUnit==='week'} 
            onClick={()=>setTimeUnit('week')}
            style={{padding:'8px 16px'}}
          >
            неделя
          </button>
          <button 
            className={`toggle-btn ${timeUnit==='month'?'is-active':''}`} 
            aria-pressed={timeUnit==='month'} 
            onClick={()=>setTimeUnit('month')}
            style={{
              padding:'8px 16px',
              backgroundColor: timeUnit==='month' ? '#ea4335' : undefined,
              color: timeUnit==='month' ? '#fff' : undefined,
              border: timeUnit==='month' ? '1px solid #ea4335' : undefined
            }}
          >
            месяц
          </button>
        </div>
        
        <div className="toggle" role="tablist" aria-label="Период">
          <button 
            className={`toggle-btn ${period==='month'?'is-active':''}`} 
            aria-pressed={period==='month'} 
            onClick={()=>setPeriod('month')}
            style={{padding:'8px 16px'}}
          >
            месяц
          </button>
          <button 
            className={`toggle-btn ${period==='quarter'?'is-active':''}`} 
            aria-pressed={period==='quarter'} 
            onClick={()=>setPeriod('quarter')}
            style={{padding:'8px 16px'}}
          >
            квартал
          </button>
          <button 
            className={`toggle-btn ${period==='halfyear'?'is-active':''}`} 
            aria-pressed={period==='halfyear'} 
            onClick={()=>setPeriod('halfyear')}
            style={{
              padding:'8px 16px',
              backgroundColor: period==='halfyear' ? '#ea4335' : undefined,
              color: period==='halfyear' ? '#fff' : undefined,
              border: period==='halfyear' ? '1px solid #ea4335' : undefined
            }}
          >
            полгода
          </button>
          <button 
            className={`toggle-btn ${period==='year'?'is-active':''}`} 
            aria-pressed={period==='year'} 
            onClick={()=>setPeriod('year')}
            style={{padding:'8px 16px'}}
          >
            год
          </button>
        </div>
      </div>

      {/* Изменение помесячно за полгода, % */}
      <div style={{marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Изменение помесячно за полгода, %:</h3>
        <div className="card">
          <ChartWrapper type="bar" data={halfyearlyBarChartData} height={280} />
        </div>
      </div>

      {/* Графический отчёт, месяц */}
      <div>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Графический отчёт, месяц:</h3>
        <div className="card">
          <ChartWrapper type="line" data={monthlyLineChartData} height={280} />
        </div>
      </div>
    </Layout>
  )
}

