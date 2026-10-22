import { useState, useCallback } from 'react';

export type SortOrder = 'asc' | 'desc';

export function useSort(initialField: string = '', initialOrder: SortOrder = 'asc') {
  const [sortField, setSortField] = useState(initialField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialOrder);

  const toggleSort = useCallback((field: string) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return field;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  return {
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
    toggleSort,
  };
}
