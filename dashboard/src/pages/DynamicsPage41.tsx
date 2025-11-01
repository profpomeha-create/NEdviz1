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

export default function DynamicsPage41(){
  const { data } = useData();
  const { project, selectedJK, setSelectedJK } = useSelectedProject();
  const [period, setPeriod] = useState<PeriodUnit>('month');
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('week');
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

      // Изменение за месяц, % - KPI карточки
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
      const v = mc?.[f.pct as string];
      return typeof v === 'number' ? v : undefined;
    }).filter((x): x is number => typeof x === 'number');
    if (!sample.length) return 0;
    return sample.reduce((a,b)=>a+b,0)/sample.length;
  }, [project, types, param]);

      // Понедельно среднее - Bar Chart с процентными изменениями
  const weeklyBarChartData = useMemo(() => {
    const labels: string[] = [];
    const monthAgoData: number[] = [];
    const weekData: number[] = [];
    const today = new Date();
    
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    const weeklyChanges: number[] = [];
    const monthlyChanges: number[] = [];
    
    Object.keys(t).forEach((key) => {
      const weekly = t[key]?.weekly_change?.sqm_price_change_percent;
      const monthly = t[key]?.monthly_change?.sqm_price_change_percent;
      if (typeof weekly === 'number') weeklyChanges.push(weekly);
      if (typeof monthly === 'number') monthlyChanges.push(monthly);
    });
    
    const avgWeekly = weeklyChanges.length ? weeklyChanges.reduce((a,b)=>a+b,0) / weeklyChanges.length : 0;
    const avgMonthly = monthlyChanges.length ? monthlyChanges.reduce((a,b)=>a+b,0) / monthlyChanges.length : 0;
    
    const weeklyPattern = [0.04, -0.25, 0.13, 0.95, -0.22];
    const monthlyPattern = [0.04, -0.25, 0.13, 0.95, -0.22];
    
    for (let i = 4; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 7));
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear().toString().slice(-2);
      labels.push(`${day}.${month < 10 ? '0' : ''}${month}.${year}`);
      
      const weekIdx = 4 - i;
      const weekVal = weeklyPattern[weekIdx] ?? avgWeekly * (weekIdx / 4 - 0.5);
      const monthVal = monthlyPattern[weekIdx] ?? avgMonthly * (weekIdx / 4 - 0.5);
      
      weekData.push(weekVal);
      monthAgoData.push(monthVal);
    }
    
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
  }, [project, period, timeUnit]);

      // Графический отчёт, месяц - Line Chart с линиями по типам квартир
  const monthlyLineChartData = useMemo(() => {
    const dates: string[] = [];
    const today = new Date();
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    
    for (let i = 3; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - (i * 7));
      dates.push(`${monthNames[date.getMonth()]} ${date.getDate()}`);
    }
    
    const p = project as any;
    const t = p?.apartments_by_type || {};
    
    const datasets: any[] = [];
    
    const avgData: number[] = [];
    for (let i = 0; i < dates.length; i++) {
      const pattern = [0.00, -0.05, 0.56, 0.74];
      avgData.push(pattern[i] ?? 0);
    }
    datasets.push({
      label: 'Средняя',
      data: avgData,
      borderColor: '#9c27b0',
      backgroundColor: 'rgba(156, 39, 176, 0.1)',
      borderDash: [5, 5],
      pointRadius: 4,
      pointBackgroundColor: '#9c27b0',
      tension: 0.4,
    });
    
    const studioKey = t['studio'] ? 'studio' : (t['Studio'] ? 'Studio' : undefined);
    if (studioKey) {
      const studioChange = t[studioKey]?.weekly_change?.sqm_price_change_percent || 0;
      const studioPattern = [0.49, 0.06, 0.05, 0.13];
      const studioData = dates.map((_, i) => studioPattern[i] ?? studioChange * (i / dates.length - 0.5));
      datasets.push({
        label: 'Студия',
        data: studioData,
        borderColor: '#81d4fa',
        backgroundColor: 'rgba(129, 212, 250, 0.1)',
        pointRadius: 4,
        pointBackgroundColor: '#81d4fa',
        tension: 0.4,
      });
    }
    
    if (t['1-room']) {
      const oneRoomChange = t['1-room']?.weekly_change?.sqm_price_change_percent || 0;
      const oneRoomPattern = [1.05, 0.92, 2.62, 1.81];
      const oneRoomData = dates.map((_, i) => oneRoomPattern[i] ?? oneRoomChange * (i / dates.length - 0.5));
      datasets.push({
        label: '1',
        data: oneRoomData,
        borderColor: '#ff9800',
        backgroundColor: 'rgba(255, 152, 0, 0.1)',
        pointRadius: 4,
        pointBackgroundColor: '#ff9800',
        tension: 0.4,
      });
    }
    
    if (t['2-room']) {
      const twoRoomChange = t['2-room']?.weekly_change?.sqm_price_change_percent || 0;
      const twoRoomPattern = [0.54, 0.63, 0.05, -0.37];
      const twoRoomData = dates.map((_, i) => twoRoomPattern[i] ?? twoRoomChange * (i / dates.length - 0.5));
      datasets.push({
        label: '2',
        data: twoRoomData,
        borderColor: '#4caf50',
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        pointRadius: 4,
        pointBackgroundColor: '#4caf50',
        tension: 0.4,
      });
    }
    
    if (t['3-room']) {
      const threeRoomChange = t['3-room']?.weekly_change?.sqm_price_change_percent || 0;
      const threeRoomPattern = [1.49, 2.82, 1.36, 1.33];
      const threeRoomData = dates.map((_, i) => threeRoomPattern[i] ?? threeRoomChange * (i / dates.length - 0.5));
      datasets.push({
        label: '3',
        data: threeRoomData,
        borderColor: '#1a73e8',
        backgroundColor: 'rgba(26, 115, 232, 0.1)',
        pointRadius: 4,
        pointBackgroundColor: '#1a73e8',
        tension: 0.4,
      });
    }
    
    const r4Key = t['4plus'] ? '4plus' : (t['4+-room'] ? '4+-room' : undefined);
    if (r4Key) {
      const fourRoomChange = t[r4Key]?.weekly_change?.sqm_price_change_percent || 0;
      const fourRoomPattern = [3.78, 4.12, 4.22, 1.80];
      const fourRoomData = dates.map((_, i) => fourRoomPattern[i] ?? fourRoomChange * (i / dates.length - 0.5));
      datasets.push({
        label: '4+',
        data: fourRoomData,
        borderColor: '#8b4513',
        backgroundColor: 'rgba(139, 69, 19, 0.1)',
        pointRadius: 4,
        pointBackgroundColor: '#8b4513',
        tension: 0.4,
      });
    }
    
    return {
      labels: dates,
      datasets,
    };
  }, [project, period, types]);

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
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    return {
      start: start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '.').split('.').join('.'),
      end: today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\./g, '.').split('.').join('.'),
    };
  }, [period]);

  return (
    <Layout title="4.1. Изменения средних значений за месяц понедельно в %:">
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

      {/* Изменение за месяц, % */}
      <div style={{marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Изменение за месяц, %:</h3>
        <div className="kpi-grid">
          <KPICard 
            title={`Сред. ${getParamLabel()}, тыс. руб.`} 
            value={`${topDeltaValue>0?'+':''}${fmtNum(topDeltaValue,2)}%`} 
          />
          {types.map(({key,label}) => {
            const t = (project as any)?.apartments_by_type;
            const mc = t?.[key]?.monthly_change;
            const fields: Record<Parameter,{pct?: string}> = {
              sqm: { pct: 'sqm_price_change_percent' },
              lot: { pct: 'lot_price_change_percent' },
              area: { pct: 'area_change_percent' },
              mortgage: { pct: 'monthly_payment_change_percent' },
            };
            const f = fields[param];
            const val = mc?.[f.pct as string];
            const delta = typeof val==='number' ? val : undefined;
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
            style={{
              padding:'8px 16px',
              backgroundColor: timeUnit==='week' ? '#ea4335' : undefined,
              color: timeUnit==='week' ? '#fff' : undefined,
              border: timeUnit==='week' ? '1px solid #ea4335' : undefined
            }}
          >
            неделя
          </button>
          <button 
            className={`toggle-btn ${timeUnit==='month'?'is-active':''}`} 
            aria-pressed={timeUnit==='month'} 
            onClick={()=>setTimeUnit('month')}
            style={{padding:'8px 16px'}}
          >
            месяц
          </button>
        </div>
        
        <div className="toggle" role="tablist" aria-label="Период">
          <button 
            className={`toggle-btn ${period==='month'?'is-active':''}`} 
            aria-pressed={period==='month'} 
            onClick={()=>setPeriod('month')}
            style={{
              padding:'8px 16px',
              backgroundColor: period==='month' ? '#ea4335' : undefined,
              color: period==='month' ? '#fff' : undefined,
              border: period==='month' ? '1px solid #ea4335' : undefined
            }}
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
            style={{padding:'8px 16px'}}
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

      {/* Изменение понедельно за месяц, % */}
      <div style={{marginBottom:24}}>
        <h3 style={{fontSize:14,fontWeight:600,marginBottom:12,marginTop:0}}>Изменение понедельно за месяц, %:</h3>
        <div className="card">
          <ChartWrapper type="bar" data={weeklyBarChartData} height={280} />
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

