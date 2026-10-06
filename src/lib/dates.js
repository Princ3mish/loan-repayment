export function isValidDateString(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = s.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  if (month < 1 || month > 12) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addMonths(dateStr, n) {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const targetDay = parseInt(dayStr, 10);

  const totalMonths = month + n;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(targetDay, daysInTargetMonth);

  const yyyy = String(targetYear).padStart(4, "0");
  const mm = String(targetMonth + 1).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

export function todayIST() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${year}-${month}-${day}`;
}

export function daysBetween(fromStr, toStr) {
  const [y1, m1, d1] = fromStr.split("-").map((v) => parseInt(v, 10));
  const [y2, m2, d2] = toStr.split("-").map((v) => parseInt(v, 10));
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utc2 - utc1) / msPerDay);
}
