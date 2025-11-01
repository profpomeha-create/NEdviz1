import type { ChartOptions } from 'chart.js';
import {
  Chart,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Tooltip,
  Legend,
} from 'chart.js';

// Register needed controllers automatically via react-chartjs-2 peer
// Consumers can import specific charts in components if needed

export const baseColors = {
  primary: '#1a73e8',
  success: '#34a853',
  danger: '#ea4335',
  warning: '#fbbc04',
  grid: '#e8eaed',
  text: '#202124',
  subtext: '#5f6368',
};

export const defaultChartOptions: ChartOptions<'line' | 'bar' | 'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: { 
        color: baseColors.subtext, 
        font: { size: 12 },
        boxWidth: 12,
        padding: 8,
      },
    },
    tooltip: {
      backgroundColor: 'rgba(32,33,36,0.9)',
      padding: 12,
      cornerRadius: 4,
      titleFont: { size: 12 },
      bodyFont: { size: 11 },
      titleSpacing: 4,
      bodySpacing: 2,
    },
  },
  scales: {
    x: {
      grid: { color: baseColors.grid },
      border: { display: false },
      ticks: { color: baseColors.subtext, font: { size: 11 }, maxRotation: 45, minRotation: 0 },
    },
    y: {
      grid: { color: baseColors.grid },
      border: { display: false },
      ticks: { color: baseColors.subtext, font: { size: 11 } },
    },
  },
};

export function setGlobalDefaults() {
  Chart.defaults.color = baseColors.text;
}

let registered = false;
export function ensureRegistered() {
  if (registered) return;
  Chart.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend);
  setGlobalDefaults();
  registered = true;
}
