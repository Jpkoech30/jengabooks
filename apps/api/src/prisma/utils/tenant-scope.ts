export function withTenant<T extends Record<string, any>>(
    where: T,
    companyId: string,
): T & { companyId: string } {
    return { ...where, companyId };
}
