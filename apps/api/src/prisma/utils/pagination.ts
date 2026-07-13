export interface PaginationParams {
    page?: number;
    limit?: number;
    cursor?: string;
    orderBy?: { field: string; direction: 'asc' | 'desc' };
}

export interface PaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
}

export function paginate<T>(
    items: T[],
    total: number,
    params: { page?: number; limit?: number },
): PaginatedResult<T> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    return {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1,
    };
}
