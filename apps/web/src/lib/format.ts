export function formatCurrencyFromCents(amountCents: number): string {
  return new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export function formatDateLabel(dateValue: string): string {
  return new Intl.DateTimeFormat("en-HK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

export function getTodayDateValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatAmountInputFromCents(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

export function parseAmountInputToCents(rawValue: string): number | null {
  const value = rawValue.trim();

  if (value === "" || !/^\d+(\.\d{1,2})?$/.test(value)) {
    return null;
  }

  const [wholePart, decimalPart = ""] = value.split(".");
  const cents = Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}
