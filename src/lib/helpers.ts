export const formatDate = (date: Date, formatStr: string): string => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (formatStr === 'MMM yyyy') return `${shortMonths[date.getMonth()]} ${date.getFullYear()}`;
  if (formatStr === 'MMM') return shortMonths[date.getMonth()];
  if (formatStr === 'MMMM d, yyyy') return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  if (formatStr === 'yyyy-MM-dd') return date.toISOString().split('T')[0];
  if (formatStr === 'MMM d, yyyy HH:mm') {
    return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  if (formatStr === 'MMM d, HH:mm') {
    return `${shortMonths[date.getMonth()]} ${date.getDate()}, ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  return date.toLocaleDateString('en-GB');
};

export const subMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
};

export const formatCurrency = (amount: number): string => `UGX ${amount.toLocaleString()}`;

export const calculatePenalty = (annualTaxDue: number, taxDueDateString: string) => {
  const today = new Date();
  const taxDueDate = new Date(taxDueDateString);
  const daysOverdue = Math.max(0, Math.floor((today.getTime() - taxDueDate.getTime()) / 86400000));
  const monthsOverdue = daysOverdue / 30;
  const interest = annualTaxDue * 0.02 * monthsOverdue;
  const totalOwed = annualTaxDue + interest;
  const dailyInterest = (annualTaxDue * 0.02) / 30;

  return {
    daysOverdue: Math.round(daysOverdue),
    monthsOverdue: Math.round(monthsOverdue * 10) / 10,
    interest: Math.round(interest),
    totalOwed: Math.round(totalOwed),
    dailyInterest: Math.round(dailyInterest),
  };
};

export const downloadTextFile = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const parseCSV = (text: string): string[][] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  return lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else current += c;
    }
    result.push(current.trim());
    return result;
  });
};

export const assignEnforcementStage = (daysOverdue: number, status: string): string => {
  if (status === 'paid') return 'resolved';
  if (daysOverdue <= 30) return 'interest_accruing';
  if (daysOverdue <= 60) return 'demand_notice';
  if (daysOverdue <= 90) return 'rent_interception';
  return 'legal_action';
};
