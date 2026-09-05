// Fills in the reports.html summary cards with live data from the
// FabricNow backend (same /api/stats endpoint the dashboard home uses).

function money(n) {
  return `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const totalProductsEl = document.getElementById("statTotalProducts");
  if (!totalProductsEl) return; // not on the reports page

  try {
    const stats = await window.FabricNowAPI.getStats();

    totalProductsEl.textContent = stats.totalProducts;
    document.getElementById("statTotalCategories").textContent = `${stats.totalCategories} categories`;
    document.getElementById("statTotalRevenue").textContent = money(stats.totalRevenue);
    document.getElementById("statPaidOrders").textContent = stats.paidOrdersCount;
    document.getElementById("statPendingOrders").textContent = stats.pendingOrdersCount;
  } catch (err) {
    totalProductsEl.textContent = "N/A";
    console.error("Could not load report stats — is the API running?", err);
  }
});
