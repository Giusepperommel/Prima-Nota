export function getNextProtocollo(lastProtocollo: string | null | undefined): number {
  if (!lastProtocollo) return 1;
  const numPart = lastProtocollo.split("/")[0];
  const num = parseInt(numPart, 10);
  if (isNaN(num)) return 1;
  return num + 1;
}

export function formatProtocollo(num: number, anno: number): string {
  return `${String(num).padStart(4, "0")}/${anno}`;
}
