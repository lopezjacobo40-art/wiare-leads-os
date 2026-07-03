/* Mensaje legible de un error capturado como unknown (catch estricto). */
export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))
