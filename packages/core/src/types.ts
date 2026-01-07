import { z } from 'zod';

// Common types for the core package
export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
});

export type AppError = z.infer<typeof AppErrorSchema>;

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public timestamp: string = new Date().toISOString()
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

export const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  total: z.number().min(0).default(0),
  pages: z.number().min(0).default(1),
});

export type Pagination = z.infer<typeof PaginationSchema>;

export const SortOptionsSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('asc'),
});

export type SortOptions = z.infer<typeof SortOptionsSchema>;

export const FilterOptionsSchema = z.record(z.array(z.string()));

export type FilterOptions = z.infer<typeof FilterOptionsSchema>;

export interface QueryOptions {
  pagination?: Pagination;
  sort?: SortOptions;
  filters?: FilterOptions;
  search?: string;
}

export interface RepositoryOptions {
  cacheTtl?: number;
  useCache?: boolean;
}

export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: AppError };

export type PaginatedResult<T> = 
  | { success: true; data: T[]; pagination: Pagination }
  | { success: false; error: AppError };