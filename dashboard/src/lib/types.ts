export type ApartmentTypeKey = 'studio' | '1-room' | '2-room' | '3-room' | '4plus';

export interface MetricsCurrent {
  apartment_count: number;
  min_area: number;
  average_area: number;
  max_area: number;
  min_lot_price_mln: number;
  average_lot_price_mln: number;
  max_lot_price_mln: number;
  min_sqm_price_ths: number;
  average_sqm_price_ths: number;
  max_sqm_price_ths: number;
}

export interface ChangeBlock {
  sqm_price_change_percent?: number;
  lot_price_change_percent?: number;
  area_change_percent?: number;
  payment_change_percent?: number;
}

export interface ApartmentTypeData {
  current_metrics: MetricsCurrent;
  weekly_change?: ChangeBlock;
  monthly_change?: ChangeBlock;
  quarterly_change?: ChangeBlock;
}

export interface ProjectData {
  jk_name: string;
  apartments_by_type: Record<ApartmentTypeKey | string, ApartmentTypeData>;
}

export interface RootData {
  projects: ProjectData[];
  last_updated?: string;
}

export type UnitMode = 'rub' | 'pct';
