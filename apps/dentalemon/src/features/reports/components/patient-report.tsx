import React, { useState } from 'react';
import { usePatientReport } from '../hooks/use-patient-report';

export interface PatientReportProps {
  branchId: string;
}

export function PatientReport({ branchId }: PatientReportProps) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + '-01';

  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate] = useState(today);

  const { stats, patients, isLoading, isError } = usePatientReport({
    branchId,
    startDate,
    endDate,
  });

  function handleExportCSV() {
    const header = 'ID,Name,Status,Registered';
    const rows = patients.map(
      (p) => `${p.id},"${p.displayName}",${p.status},${p.createdAt.slice(0, 10)}`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients-${startDate}-${endDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Patient Report</h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="Start date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <input
            type="date"
            aria-label="End date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-border px-3 text-sm bg-background"
          />
          <button
            type="button"
            onClick={handleExportCSV}
            className="h-9 px-4 rounded-lg border border-border text-sm hover:bg-secondary transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Failed to load patient report. Please try again.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Active Patients
              </p>
              <p className="text-2xl font-bold mt-1 text-green-600">{stats.totalActive}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Archived Patients
              </p>
              <p className="text-2xl font-bold mt-1 text-muted-foreground">{stats.totalArchived}</p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                New Registrations
              </p>
              <p className="text-2xl font-bold mt-1 text-blue-600">{stats.newRegistrations}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {startDate} to {endDate}
              </p>
            </div>
          </div>

          {/* Patient list table */}
          <div className="rounded-xl border border-border">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-semibold">
                All Patients ({patients.length})
              </h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{p.displayName}</td>
                    <td className="px-4 py-2.5 capitalize">{p.status}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No patients found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
