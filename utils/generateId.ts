/**
 * Generate a unique ID that works in all browsers
 * Fallback for environments where crypto.randomUUID() is not available
 */
export const generateId = (): string => {
    // Try crypto.randomUUID if available
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback: generate UUID v4 manually
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
