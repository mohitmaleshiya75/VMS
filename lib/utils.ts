export function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(' '); }
export function money(amount: number, currency = 'INR') { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
export function formatDate(value: string | number | Date) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
export function formatDateTime(value: string | number | Date) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
export function pct(value: number) { return `${value.toFixed(1)}%`; }

export function generateInstallmentSchedule(
  totalAmount: number,
  months: number,
  startDate: string,
  frequency: 'Monthly' | 'Quarterly' = 'Monthly'
) {
  if (months <= 0 || totalAmount <= 0) return [];
  
  const monthlyAmount = Number((totalAmount / months).toFixed(2));
  const schedule = [];
  let currentBalance = totalAmount;

  for (let i = 0; i < months; i++) {
    const dueDate = new Date(startDate);
    const monthsToAdd = frequency === 'Monthly' ? i : i * 3;
    dueDate.setMonth(dueDate.getMonth() + monthsToAdd);

    const isLast = i === months - 1;
    const amount = isLast ? Number(currentBalance.toFixed(2)) : monthlyAmount;
    currentBalance -= amount;

    schedule.push({
      id: `INS-${Date.now()}-${i}`,
      installmentNo: i + 1,
      dueDate: dueDate.toISOString().slice(0, 10),
      amount,
      status: 'Pending' as const,
    });
  }

  return schedule;
}
