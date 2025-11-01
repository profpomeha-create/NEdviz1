import { memo } from 'react';
import { Line, Bar, Pie, Doughnut, Radar } from 'react-chartjs-2';
import { defaultChartOptions } from '../../lib/chartConfig';

interface Props {
  type: 'line' | 'bar' | 'pie' | 'doughnut' | 'radar';
  data: any;
  options?: any;
  height?: number;
}

function ChartWrapperBase({ type, data, options, height = 280 }: Props) {
  const merged = { 
    ...defaultChartOptions, 
    responsive: true,
    maintainAspectRatio: false,
    ...(options || {}) 
  } as any;
  
  // Адаптивная высота через CSS, но можно задать явно для мобильных
  const responsiveHeight = height;
  
  return (
    <div className="chart-container" style={{ height: responsiveHeight, minHeight: responsiveHeight }}>
      {type === 'line' && <Line data={data} options={merged} />}
      {type === 'bar' && <Bar data={data} options={merged} />}
      {type === 'pie' && <Pie data={data} options={merged} />}
      {type === 'doughnut' && <Doughnut data={data} options={merged} />}
      {type === 'radar' && <Radar data={data} options={merged} />}
    </div>
  );
}

export const ChartWrapper = memo(ChartWrapperBase);
