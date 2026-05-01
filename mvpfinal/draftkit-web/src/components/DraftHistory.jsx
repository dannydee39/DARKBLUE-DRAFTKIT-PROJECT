import { useState } from "react";
import {
  createDraftHistoryCsv,
  downloadCsv,
  formatSignedMoney,
} from "../utils/draftHistory.js";

const FILTERS = [
  ["all", "All Events"],
  ["auction", "Auction"],
  ["keeper", "Keepers"],
  ["taxi", "Taxi"],
  ["removal", "Removed"],
];

function matchesFilter(row, filter) {
  if (filter === "all") return true;
  if (filter === "auction") return row.type === "auction";
  if (filter === "keeper") return row.type.startsWith("keeper");
  if (filter === "taxi") return row.type.startsWith("taxi");
  if (filter === "removal") return row.type.endsWith("_remove");
  return true;
}

function buildFilename(league) {
  const safeName = String(league?.name || "draft")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${safeName || "draft"}-history.csv`;
}

export default function DraftHistory({ league, rows }) {
  const [filter, setFilter] = useState("all");
  const [sortKey, setSortKey] = useState("eventNumber");
  const [sortDir, setSortDir] = useState("asc");

  const filteredRows = rows.filter((row) => matchesFilter(row, filter));
  const visibleRows = filteredRows.slice().sort((a, b) => {
    let aValue = a[sortKey];
    let bValue = b[sortKey];

    if (sortKey === "timestamp") {
      aValue = Number(a.timestamp) || Date.parse(a.timestamp) || 0;
      bValue = Number(b.timestamp) || Date.parse(b.timestamp) || 0;
    }

    if (typeof aValue === "string" || typeof bValue === "string") {
      return sortDir === "asc"
        ? String(aValue || "").localeCompare(String(bValue || ""))
        : String(bValue || "").localeCompare(String(aValue || ""));
    }

    return sortDir === "asc"
      ? Number(aValue || 0) - Number(bValue || 0)
      : Number(bValue || 0) - Number(aValue || 0);
  });

  const totalSpend = rows
    .filter((row) => row.type === "auction" || row.type === "keeper")
    .reduce((total, row) => total + (Number(row.price) || 0), 0);
  const auctionCount = rows.filter((row) => row.type === "auction").length;
  const keeperCount = rows.filter((row) => row.type.startsWith("keeper")).length;
  const taxiCount = rows.filter((row) => row.type.startsWith("taxi")).length;

  function toggleSort(nextKey) {
    if (sortKey === nextKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir(nextKey === "eventNumber" ? "asc" : "desc");
  }

  function exportCsv() {
    const csv = createDraftHistoryCsv(visibleRows, league);
    downloadCsv(buildFilename(league), csv);
  }

  return (
    <section className="draft-history-view">
      <div className="draft-history-header">
        <div>
          <span className="draft-history-eyebrow">Draft audit trail</span>
          <h2>Ordered Draft History</h2>
          <p>
            Review every recorded auction pick, keeper contract, and taxi squad
            entry in event order.
          </p>
        </div>
        <button
          type="button"
          className="history-export-btn"
          onClick={exportCsv}
          disabled={visibleRows.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="history-summary-grid">
        <div>
          <span>Total Events</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Auction Picks</span>
          <strong>{auctionCount}</strong>
        </div>
        <div>
          <span>Keeper Events</span>
          <strong>{keeperCount}</strong>
        </div>
        <div>
          <span>Taxi Events</span>
          <strong>{taxiCount}</strong>
        </div>
        <div>
          <span>Active Spend</span>
          <strong>${totalSpend}</strong>
        </div>
      </div>

      <div className="history-toolbar">
        <div className="history-filter-group" aria-label="Draft history filters">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="history-sort-hint">
          Showing {visibleRows.length} of {rows.length}
        </div>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th>
                <button type="button" onClick={() => toggleSort("eventNumber")}>
                  #
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("typeLabel")}>
                  Type
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("timestamp")}>
                  Time
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("playerName")}>
                  Player
                </button>
              </th>
              <th>MLB</th>
              <th>Pos</th>
              <th>
                <button type="button" onClick={() => toggleSort("fantasyOwner")}>
                  Owner
                </button>
              </th>
              <th>Slot</th>
              <th>
                <button type="button" onClick={() => toggleSort("price")}>
                  Bid
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("prePickValue")}>
                  Value
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggleSort("valueDelta")}>
                  Delta
                </button>
              </th>
              <th>Budget After</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.eventNumber}-${row.playerId}-${row.type}`}>
                <td>{row.eventNumber}</td>
                <td>
                  <span className={`history-type-pill ${row.type}`}>
                    {row.typeLabel}
                  </span>
                </td>
                <td>{row.timestampLabel}</td>
                <td>
                  <strong>{row.playerName || "Unknown Player"}</strong>
                  {row.note ? <span className="history-note">{row.note}</span> : null}
                </td>
                <td>{row.mlbTeam || "-"}</td>
                <td>{row.positions || "-"}</td>
                <td>{row.fantasyOwner || "-"}</td>
                <td>{row.rosterSlot || "-"}</td>
                <td>{row.priceLabel ? `$${row.priceLabel}` : "-"}</td>
                <td>
                  {row.prePickValueLabel ? `$${row.prePickValueLabel}` : "-"}
                </td>
                <td
                  className={
                    Number(row.valueDelta) > 0
                      ? "history-delta over"
                      : Number(row.valueDelta) < 0
                        ? "history-delta under"
                        : "history-delta"
                  }
                >
                  {formatSignedMoney(row.valueDelta)}
                </td>
                <td>
                  {row.remainingBudgetAfterLabel
                    ? `$${row.remainingBudgetAfterLabel}`
                    : "-"}
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan="12" className="history-empty">
                  No draft history events match this filter yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
