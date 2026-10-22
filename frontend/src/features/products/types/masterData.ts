export interface MasterDataListParams {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  page?: number;
  pageSize?: number;
}

export interface MasterDataPage<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
