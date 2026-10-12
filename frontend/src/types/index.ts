export interface User {
  id: string;
  name: string;
  email: string;
  subsatgas: string;
  unit_name: string;
  role: 'admin' | 'operator' | 'viewer';
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
}

export interface DailyReport {
  id: string;
  report_date: string;
  satgas_name: string;
  subsatgas: 'MINOPS' | 'LIDIK' | 'INVESTIGASI' | 'ANALIS' | string;
  unit_name: string;
  activity_time: string;
  personnel_count: string;
  location: string;
  activity: string;
  results: string;
  description?: string;
  documentation_urls?: string[];
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProminentIncident {
  id: string;
  report_date: string;
  incident_time: string;
  location: string;
  incident_description: string;
  losses_or_results: string;
  actions_taken: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ReportConfig {
  id?: string | null;
  report_date: string;
  signatory_title: string;
  signatory_name: string;
  signatory_rank: string;
  signatory_place: string;
  status: 'DRAFT' | 'SUBMITTED' | 'FINAL';
}

export interface FullLapharData {
  report_date: string;
  satgas_name: string;
  config: ReportConfig;
  minops: Record<string, DailyReport[]>;
  lidik: Record<string, DailyReport[]>;
  investigasi: Record<string, DailyReport[]>;
  analis: Record<string, DailyReport[]>;
  incidents: ProminentIncident[];
  stats: {
    total_activities: number;
    total_incidents: number;
    MINOPS: number;
    LIDIK: number;
    INVESTIGASI: number;
    ANALIS: number;
  };
}

export interface SubmissionMatrix {
  report_date: string;
  matrix: Record<string, Record<string, number>>;
  total_submitted_units: number;
  total_expected_units: number;
}
