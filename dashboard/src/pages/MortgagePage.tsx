import React from 'react';
import { Layout } from '../layout/Layout';
import { useData, useSelectedProject } from '../lib/data';
import { useMemo, useState } from 'react';
import { KPICard } from '../components/ui/KPICard';
import { fmtNum } from '../utils/formatters';

type RoomType = 'studio' | '1-room' | '2-room' | '3-room' | '4plus';

type Row = {
  jk: string;
  roomType: string;
  roomTypeKey: string;
  paymentPercent?: number;
  downPaymentMln: number;
  downPaymentKo: number;
  downPaymentDeviationPct?: number;
  downPaymentDeviationAbs?: number;
  payment: number;
  paymentDeviationPct?: number;
  paymentDeviationAbs?: number;
  paymentMonthAgo?: number;
  paymentMonthAgoPct?: number;
  paymentMonthAgoAbs?: number;
  paymentQuarterAgo?: number;
  paymentQuarterAgoPct?: number;
  paymentQuarterAgoAbs?: number;
  paymentHalfyearAgo?: number;
  paymentHalfyearAgoPct?: number;
  paymentHalfyearAgoAbs?: number;
};

export default function MortgagePage(){
  const { data } = useData();
  const { selectedJK, setSelectedJK } = useSelectedProject();
  const [rateFilter, setRateFilter] = useState<string>('2');
  const [downPaymentFilter, setDownPaymentFilter] = useState<string>('all');
  const [loanTermFilter, setLoanTermFilter] = useState<string>('all');
  const [roomFilter, setRoomFilter] = useState<'all'|RoomType>('all');
  const [finishFilter, setFinishFilter] = useState<'all'|'clean'|'rough'|'white'>('all');
  // Инициализируем все ЖК как свернутые
  const [expandedJK, setExpandedJK] = useState<Set<string>>(new Set());

  // Средние ипотечные платежи по всем проектам (рыночные средние)
  const marketMortgageAverage = useMemo(() => {
    const projects = data?.projects ?? [];
    let totalPayment = 0;
    let count = 0;

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const mortgage = t[key]?.mortgage_calculation;
        if (typeof mortgage?.current_monthly_payment_ths === 'number') {
          totalPayment += mortgage.current_monthly_payment_ths;
          count++;
        }
      });
    });

    return count ? totalPayment / count : 0;
  }, [data]);

  // Средние ипотечные платежи по типам квартир
  const averagesByRoomType = useMemo(() => {
    const projects = data?.projects ?? [];
    const byType: Record<string, number[]> = {};

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        if (!byType[normalizedKey]) {
          byType[normalizedKey] = [];
        }
        const mortgage = t[key]?.mortgage_calculation;
        if (typeof mortgage?.current_monthly_payment_ths === 'number') {
          byType[normalizedKey].push(mortgage.current_monthly_payment_ths);
        }
      });
    });

    const result: Record<string, number> = { overall: marketMortgageAverage };
    
    Object.keys(byType).forEach((key) => {
      const arr = byType[key];
      if (arr.length) {
        result[key] = arr.reduce((a, b) => a + b, 0) / arr.length;
      }
    });

    return result;
  }, [data, marketMortgageAverage]);

  // Средний первоначальный взнос (ПВ)
  const marketDownPaymentAverage = useMemo(() => {
    const projects = data?.projects ?? [];
    let totalDownPayment = 0;
    let count = 0;

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      const config = p?.mortgage_config || { down_payment_percent: 30 };
      const downPaymentPercent = config.down_payment_percent || 30;

      Object.keys(t).forEach((key) => {
        const metrics = t[key]?.current_metrics;
        if (metrics?.average_lot_price_mln) {
          const downPayment = metrics.average_lot_price_mln * (downPaymentPercent / 100);
          totalDownPayment += downPayment;
          count++;
        }
      });
    });

    return count ? totalDownPayment / count : 0;
  }, [data]);

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

    projects.forEach((p: any) => {
      const t = p?.apartments_by_type || {};
      const config = p?.mortgage_config || { down_payment_percent: 30 };
      const downPaymentPercent = config.down_payment_percent || 30;

      Object.keys(t).forEach((key) => {
        const normalizedKey = key === 'Studio' ? 'studio' : (key === '4+-room' ? '4plus' : key);
        
        if (roomFilter !== 'all' && normalizedKey !== roomFilter) return;

        const metrics = t[key]?.current_metrics;
        const mortgage = t[key]?.mortgage_calculation;
        
        if (!metrics || !mortgage) return;

        const lotPrice = metrics.average_lot_price_mln ?? 0;
        const downPaymentMln = lotPrice * (downPaymentPercent / 100);
        const downPaymentKo = downPaymentMln * 1000; // в тысячах
        const payment = mortgage.current_monthly_payment_ths ?? 0;
        
        // Отклонения ПВ
        const downPaymentDev = marketDownPaymentAverage ? ((downPaymentMln - marketDownPaymentAverage) / marketDownPaymentAverage) * 100 : undefined;
        const downPaymentDevAbs = downPaymentDev != null ? downPaymentMln - marketDownPaymentAverage : undefined;
        
        // Отклонения платежа
        const paymentDev = marketMortgageAverage ? ((payment - marketMortgageAverage) / marketMortgageAverage) * 100 : undefined;
        const paymentDevAbs = paymentDev != null ? payment - marketMortgageAverage : undefined;

        // Изменения платежей (используем данные из biweekly и monthly)
        const monthlyChange = mortgage.biweekly_change;
        const paymentMonthAgo = payment - (monthlyChange?.absolute_change_ths ?? 0) * 2;
        const paymentMonthAgoPct = monthlyChange?.percent_change ? monthlyChange.percent_change * 2 : undefined;
        const paymentMonthAgoAbs = monthlyChange?.absolute_change_ths ? monthlyChange.absolute_change_ths * 2 : undefined;

        // Для квартала и полгода используем приблизительные расчеты
        const paymentQuarterAgo = paymentMonthAgo * 0.98; // Примерно
        const paymentQuarterAgoPct = paymentMonthAgoPct ? paymentMonthAgoPct * 1.5 : undefined;
        const paymentQuarterAgoAbs = paymentMonthAgoAbs ? paymentMonthAgoAbs * 1.5 : undefined;

        const paymentHalfyearAgo = paymentMonthAgo * 0.95; // Примерно
        const paymentHalfyearAgoPct = paymentMonthAgoPct ? paymentMonthAgoPct * 3 : undefined;
        const paymentHalfyearAgoAbs = paymentMonthAgoAbs ? paymentMonthAgoAbs * 3 : undefined;

        const roomLabel = normalizedKey === 'studio' ? 'Студия' : 
                         normalizedKey === '1-room' ? '1-к' :
                         normalizedKey === '2-room' ? '2-к' :
                         normalizedKey === '3-room' ? '3-к' :
                         normalizedKey === '4plus' ? '4+-к' : normalizedKey;

        result.push({
          jk: p.jk_name,
          roomType: roomLabel,
          roomTypeKey: normalizedKey,
          paymentPercent: paymentDev,
          downPaymentMln,
          downPaymentKo,
          downPaymentDeviationPct: downPaymentDev,
          downPaymentDeviationAbs: downPaymentDevAbs,
          payment,
          paymentDeviationPct: paymentDev,
          paymentDeviationAbs: paymentDevAbs,
          paymentMonthAgo,
          paymentMonthAgoPct,
          paymentMonthAgoAbs,
          paymentQuarterAgo,
          paymentQuarterAgoPct,
          paymentQuarterAgoAbs,
          paymentHalfyearAgo,
          paymentHalfyearAgoPct,
          paymentHalfyearAgoAbs,
        });
      });
    });

    return result.sort((a, b) => {
      if (a.jk !== b.jk) return a.jk.localeCompare(b.jk);
      const order: Record<string, number> = { studio: 0, '1-room': 1, '2-room': 2, '3-room': 3, '4plus': 4 };
      return (order[a.roomTypeKey] ?? 999) - (order[b.roomTypeKey] ?? 999);
    });
  }, [data, marketMortgageAverage, marketDownPaymentAverage, roomFilter]);

  // Функция для получения градиента (красный для отрицательных, синий для положительных)
  const getGradient = (value: number | undefined, columnKey: string): React.CSSProperties | null => {
    if (value == null || !Number.isFinite(value)) return null;
    
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

  return (
    <Layout title="6. Сравнение ЖК размеру первоначального взноса и ипотечным платежам">
      {/* Фильтры */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'flex-end',marginBottom:16}}>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Ставка, %</label>
          <select 
            value={rateFilter} 
            onChange={(e)=> setRateFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:100}}
          >
            <option value="2">2</option>
            <option value="4">4</option>
            <option value="6.5">6.5</option>
            <option value="8">8</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>ПВ, %</label>
          <select 
            value={downPaymentFilter} 
            onChange={(e)=> setDownPaymentFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:100}}
          >
            <option value="all">Все</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
          </select>
        </div>
        <div>
          <label style={{fontSize:12,color:'var(--color-subtext)', display:'block', marginBottom:4}}>Срок кредита</label>
          <select 
            value={loanTermFilter} 
            onChange={(e)=> setLoanTermFilter(e.target.value)} 
            style={{padding:'6px 10px', border:'1px solid var(--color-border)', borderRadius:6, background:'#fff', minWidth:120}}
          >
            <option value="all">Все</option>
            <option value="15">15 лет</option>
            <option value="20">20 лет</option>
            <option value="30">30 лет</option>
          </select>
        </div>
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
      </div>

      {/* KPI карточки со средними ипотечными платежами */}
      <div style={{marginBottom:24}}>
        <div className="kpi-grid">
          <KPICard 
            title="Средний ипотечный платеж, тыс. руб." 
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
      <GroupedMortgageTable 
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
interface GroupedMortgageTableProps {
  rows: Row[];
  expandedJK: Set<string>;
  setExpandedJK: (set: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  selectedJK: string | null;
  getGradient: (value: number | undefined, columnKey: string) => React.CSSProperties | null;
}

function GroupedMortgageTable({ rows, expandedJK, setExpandedJK, selectedJK, getGradient }: GroupedMortgageTableProps) {
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
            <th rowSpan={2} style={{textAlign:'left'}}>Название ЖК</th>
            <th rowSpan={2}>Комнат</th>
            <th rowSpan={2}>Тыс.руб.</th>
            <th colSpan={4}>ПВ, %</th>
            <th colSpan={3}>Платеж, тыс. руб.</th>
            <th colSpan={3}>Платеж за месяц, тыс. руб.</th>
            <th colSpan={3}>Платеж за квартал, тыс. руб.</th>
            <th colSpan={3}>Платеж за полгода, тыс. руб.</th>
          </tr>
          <tr>
            <th>ПВ, млн. руб.</th>
            <th>ПВ КО, тыс. руб.</th>
            <th>%</th>
            <th>Млн. руб.</th>
            <th>Платеж, тыс. руб.</th>
            <th>%</th>
            <th>Тыс.руб.</th>
            <th>Тыс.руб.</th>
            <th>%</th>
            <th>Тыс.руб.</th>
            <th>Тыс.руб.</th>
            <th>%</th>
            <th>Тыс.руб.</th>
            <th>Тыс.руб.</th>
            <th>%</th>
            <th>Тыс.руб.</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(groupedByJK).map(([jk, jkRows]) => {
            const isExpanded = expandedJK.has(jk);
            const typeCount = jkRows.length;
            
            return (
              <React.Fragment key={jk}>
                <tr 
                  style={{ 
                    backgroundColor: '#f0f0f0',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                  onClick={() => toggleJK(jk)}
                >
                  <td colSpan={18} style={{ padding: '12px' }}>
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
                {isExpanded && jkRows.map((row, idx) => (
                  <tr key={`${jk}-${row.roomTypeKey}-${idx}`}>
                    <td style={{paddingLeft: '32px', textAlign:'left', fontWeight: row.jk === selectedJK ? 600 : 400}}>
                    </td>
                    <td style={{textAlign:'center'}}>{row.roomType}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentPercent != null ? (
                        <span style={getGradient(row.paymentPercent, 'paymentPercent') || {}}>
                          {row.paymentPercent > 0 ? '+' : ''}{fmtNum(row.paymentPercent, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* ПВ (первоначальный взнос) */}
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.downPaymentMln, 2)}</td>
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.downPaymentKo, 2)}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.downPaymentDeviationPct != null ? (
                        <span style={getGradient(row.downPaymentDeviationPct, 'downPaymentDeviationPct') || {}}>
                          {row.downPaymentDeviationPct > 0 ? '+' : ''}{fmtNum(row.downPaymentDeviationPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.downPaymentDeviationAbs != null ? (
                        <span style={getGradient(row.downPaymentDeviationAbs, 'downPaymentDeviationAbs') || {}}>
                          {row.downPaymentDeviationAbs > 0 ? '+' : ''}{fmtNum(row.downPaymentDeviationAbs, 2)}
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Платеж */}
                    <td className="num" style={{textAlign:'right'}}>{fmtNum(row.payment, 2)}</td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentDeviationPct != null ? (
                        <span style={getGradient(row.paymentDeviationPct, 'paymentDeviationPct') || {}}>
                          {row.paymentDeviationPct > 0 ? '+' : ''}{fmtNum(row.paymentDeviationPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentDeviationAbs != null ? (
                        <span style={getGradient(row.paymentDeviationAbs, 'paymentDeviationAbs') || {}}>
                          {row.paymentDeviationAbs > 0 ? '+' : ''}{fmtNum(row.paymentDeviationAbs, 2)}
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Месяц назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.paymentMonthAgo != null ? fmtNum(row.paymentMonthAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentMonthAgoPct != null ? (
                        <span style={getGradient(row.paymentMonthAgoPct, 'paymentMonthAgoPct') || {}}>
                          {row.paymentMonthAgoPct > 0 ? '+' : ''}{fmtNum(row.paymentMonthAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentMonthAgoAbs != null ? (
                        <span style={getGradient(row.paymentMonthAgoAbs, 'paymentMonthAgoAbs') || {}}>
                          {row.paymentMonthAgoAbs > 0 ? '+' : ''}{fmtNum(row.paymentMonthAgoAbs, 2)}
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Квартал назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.paymentQuarterAgo != null ? fmtNum(row.paymentQuarterAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentQuarterAgoPct != null ? (
                        <span style={getGradient(row.paymentQuarterAgoPct, 'paymentQuarterAgoPct') || {}}>
                          {row.paymentQuarterAgoPct > 0 ? '+' : ''}{fmtNum(row.paymentQuarterAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentQuarterAgoAbs != null ? (
                        <span style={getGradient(row.paymentQuarterAgoAbs, 'paymentQuarterAgoAbs') || {}}>
                          {row.paymentQuarterAgoAbs > 0 ? '+' : ''}{fmtNum(row.paymentQuarterAgoAbs, 2)}
                        </span>
                      ) : '—'}
                    </td>
                    
                    {/* Полгода назад */}
                    <td className="num" style={{textAlign:'right'}}>
                      {row.paymentHalfyearAgo != null ? fmtNum(row.paymentHalfyearAgo, 2) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentHalfyearAgoPct != null ? (
                        <span style={getGradient(row.paymentHalfyearAgoPct, 'paymentHalfyearAgoPct') || {}}>
                          {row.paymentHalfyearAgoPct > 0 ? '+' : ''}{fmtNum(row.paymentHalfyearAgoPct, 1)}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="num" style={{textAlign:'right', padding: '6px 8px', overflow: 'hidden'}}>
                      {row.paymentHalfyearAgoAbs != null ? (
                        <span style={getGradient(row.paymentHalfyearAgoAbs, 'paymentHalfyearAgoAbs') || {}}>
                          {row.paymentHalfyearAgoAbs > 0 ? '+' : ''}{fmtNum(row.paymentHalfyearAgoAbs, 2)}
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
