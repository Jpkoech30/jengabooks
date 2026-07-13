export function withSoftDelete<T extends Record<string, any>>(
    where?: T,
): T & { deletedAt: null } {
    return { ...(where || ({} as T)), deletedAt: null };
}

export function withDeleted<T extends Record<string, any>>(
    where?: T,
): T & { deletedAt: { not: null } } {
    return { ...(where || ({} as T)), deletedAt: { not: null } };
}
