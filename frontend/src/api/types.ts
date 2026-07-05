export type CommonResponse<T> = {
  status: number;
  message: string;
  data: T | null;
};

export type SiteFeatureFlag = {
  key: string;
  label: string;
  description: string;
  group: string;
  enabled: boolean;
  public: boolean;
  updated_at: string;
};

export type SiteRuntimeData = {
  name: string;
  version: string;
  environment: string;
  feature_flags: SiteFeatureFlag[];
  feature_map: Record<string, boolean>;
};

export type ServiceHealthData = {
  name: string;
  version: string;
  environment: string;
  api_prefix: string;
  time_zone: string;
  db_enabled: boolean;
  response_at: string;
};

export type ClassAnalysisItem = {
  class_name: string;
  homework_deduction: number;
  daily_deduction: number;
  late_deduction: number;
};

export type StudentAnalysisItem = {
  student_name: string;
  total_add_score: number;
  rank: number;
  bonus_details: string;
};

export type BypAnalysisData = {
  response_at: string;
  class_stat: ClassAnalysisItem[];
  student_stat: StudentAnalysisItem[];
};

export type OpsOverviewData = {
  service_name: string;
  service_version: string;
  environment: string;
  log_dir: string;
  db_enabled: boolean;
  log_files_count: number;
  enabled_features: number;
  feature_count: number;
  recent_logs: OpsLogFileInfo[];
};

export type OpsFeatureFlagRecord = SiteFeatureFlag;

export type OpsFeatureFlagListData = {
  items: OpsFeatureFlagRecord[];
};

export type OpsLogFileInfo = {
  name: string;
  size: number;
  modified: string;
};

export type OpsLogFileListData = {
  files: OpsLogFileInfo[];
};

export type OpsLogTailData = {
  file: string;
  lines: string[];
  total_lines: number;
  matched_lines: number;
};

export type OpsFilterOperator =
  | "eq"
  | "ne"
  | "contains"
  | "startswith"
  | "endswith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "is_null";

export type OpsQueryableTableColumn = {
  name: string;
  type: string;
  nullable: boolean;
  operators: OpsFilterOperator[];
  hidden_by_default: boolean;
};

export type OpsQueryableTable = {
  name: string;
  columns: OpsQueryableTableColumn[];
};

export type OpsQueryableTableListData = {
  tables: OpsQueryableTable[];
};

export type OpsTableQueryFilter = {
  column: string;
  op: OpsFilterOperator;
  value?: unknown;
};

export type OpsTableQueryResult = {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  total_count: number;
  page: number;
  page_size: number;
};
