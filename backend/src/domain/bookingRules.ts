export function usesTokenQueue(bookingMode?: string | null) {
  return bookingMode === "QUEUE";
}
