export function formatINR(rupeeString) {
  const num =
    typeof rupeeString === "number" ? rupeeString : parseFloat(rupeeString);
  if (isNaN(num)) {
    return "₹0.00";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return "";
  }
  const [year, month, day] = dateStr.split("-").map((v) => parseInt(v, 10));
  if (!year || !month || !day) {
    return dateStr;
  }
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dd = String(day).padStart(2, "0");
  const mmm = months[month - 1] || "";
  return `${dd} ${mmm} ${year}`;
}
