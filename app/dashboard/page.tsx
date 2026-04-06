"use client";

import { db, type EmergencyReport } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useState } from 'react';

type WorkflowStatus = 'new' | 'acknowledged' | 'dispatched' | 'resolved';

type SearchMatch = {
  id: string;
  score?: number;
  metadata?: {
    urgency?: number;
    category?: string;
    summary?: string;
    text?: string;
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
    [key: string]: unknown;
  };
};

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [minUrgency, setMinUrgency] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showOnlyUnresolved, setShowOnlyUnresolved] = useState(true);
  const [workflowById, setWorkflowById] = useState<Record<string, WorkflowStatus>>({});
  const localReports = useLiveQuery(async () => {
    const items = await db.reports.orderBy('timestamp').reverse().toArray();
    return items.slice(0, 8);
  }, []);

  const handleSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setError('Enter a search query first.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Search failed');
      }

      setResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyBorderClass = (urgency?: number) => {
    if (typeof urgency !== 'number') return 'border-white/10';
    if (urgency > 8) return 'border-red-500';
    if (urgency >= 5) return 'border-orange-500';
    return 'border-green-500';
  };

  const getWorkflowStatus = (match: SearchMatch): WorkflowStatus => {
    return workflowById[match.id] ?? 'new';
  };

  const filteredResults = results.filter((match) => {
    const urgency = typeof match.metadata?.urgency === 'number' ? match.metadata.urgency : 0;
    const category = typeof match.metadata?.category === 'string' ? match.metadata.category : 'other';
    const status = getWorkflowStatus(match);

    const urgencyMatches = urgency >= minUrgency;
    const categoryMatches = categoryFilter === 'all' || category === categoryFilter;
    const workflowMatches = !showOnlyUnresolved || status !== 'resolved';

    return urgencyMatches && categoryMatches && workflowMatches;
  });

  const updateWorkflow = (id: string, status: WorkflowStatus) => {
    setWorkflowById((current) => ({ ...current, [id]: status }));
  };

  const getLocation = (match: SearchMatch) => {
    const lat =
      typeof match.metadata?.latitude === 'number'
        ? match.metadata.latitude
        : typeof match.metadata?.lat === 'number'
          ? match.metadata.lat
          : undefined;
    const lng =
      typeof match.metadata?.longitude === 'number'
        ? match.metadata.longitude
        : typeof match.metadata?.lng === 'number'
          ? match.metadata.lng
          : undefined;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return null;
    }

    return { lat, lng };
  };

  return (
    <div className="app-shell min-h-screen px-4 pb-24 pt-5 text-slate-100 md:px-6 md:pb-10 md:pt-10">
      <div className="ambient-layer" aria-hidden />
      <div className="grid-texture" aria-hidden />
      <div className="glow-orb orb-a" aria-hidden />
      <div className="glow-orb orb-b" aria-hidden />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 md:gap-8">
        <div className="reveal">
          <Link href="/" className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 hover:text-cyan-200">
            ← Back to report entry
          </Link>
        </div>
        <header className="reveal reveal-delay-1 space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 md:text-sm md:tracking-[0.3em]">DisasterDoc Intelligence</p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Semantic search across emergency reports
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
            Search by meaning instead of exact keywords. Titan generates the embedding and Pinecone returns the most relevant reports.
          </p>
        </header>

        <section className="reveal reveal-delay-2 rounded-3xl border border-white/10 bg-slate-900/55 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur md:p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              className="min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              placeholder="Search: collapsed buildings, medical help, fire smoke, gas leak..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleSearch();
                }
              }}
            />
            <button
              onClick={handleSearch}
              className="pulse-ring min-h-11 rounded-2xl bg-cyan-500 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Minimum urgency: {minUrgency}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={minUrgency}
                onChange={(e) => setMinUrgency(Number(e.target.value))}
                className="w-full"
              />
            </label>

            <label className="text-sm text-slate-300">
              <span className="mb-1 block">Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="min-h-11 w-full rounded border border-white/10 bg-slate-900 px-3 py-2"
              >
                <option value="all">All categories</option>
                <option value="medical">Medical</option>
                <option value="shelter">Shelter</option>
                <option value="food">Food & Water</option>
                <option value="security">Security</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-300 md:mt-6">
              <input
                type="checkbox"
                checked={showOnlyUnresolved}
                onChange={(e) => setShowOnlyUnresolved(e.target.checked)}
              />
              Show only unresolved reports
            </label>
          </div>
        </section>

        <section className="reveal reveal-delay-3 grid gap-4">
          {filteredResults.length === 0 && !loading ? (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-slate-400">
              No reports match the current filters.
            </div>
          ) : null}

          {filteredResults.map((match) => {
            const location = getLocation(match);

            return (
            <article
              key={match.id}
              className={`tilt-card rounded-3xl border ${getUrgencyBorderClass(match.metadata?.urgency)} bg-slate-900/80 p-5 shadow-lg shadow-black/20`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-cyan-300">
                  Urgency: {match.metadata?.urgency ?? 'n/a'}/10
                </span>
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  Match: {typeof match.score === 'number' ? (match.score * 100).toFixed(1) : 'n/a'}%
                </span>
              </div>
              <p className="mt-3 text-lg font-medium text-slate-100">
                {match.metadata?.summary ?? 'No summary available'}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                {match.metadata?.text ?? 'No report text available'}
              </p>

              {location ? (
                <div className="mt-3 text-sm text-slate-300">
                  <p>
                    Location: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </p>
                  <a
                    href={`https://www.google.com/maps?q=${location.lat},${location.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex min-h-10 items-center rounded border border-cyan-400/40 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-400/10"
                  >
                    Open in Google Maps
                  </a>
                </div>
              ) : (
                <div className="mt-3 text-sm text-slate-400">
                  <p>Location unavailable in cloud metadata.</p>
                  <button
                    disabled
                    className="mt-1 inline-flex min-h-10 items-center rounded border border-white/20 px-3 py-2 text-sm font-medium text-slate-500"
                  >
                    No location to track
                  </button>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-300">
                  Status: {getWorkflowStatus(match)}
                </span>
                <button
                  onClick={() => updateWorkflow(match.id, 'acknowledged')}
                  className="min-h-10 rounded bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
                >
                  Acknowledge
                </button>
                <button
                  onClick={() => updateWorkflow(match.id, 'dispatched')}
                  className="min-h-10 rounded bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
                >
                  Dispatch
                </button>
                <button
                  onClick={() => updateWorkflow(match.id, 'resolved')}
                  className="min-h-10 rounded bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 transition hover:brightness-110"
                >
                  Resolve
                </button>
              </div>
            </article>
            );
          })}
        </section>

        <section className="reveal reveal-delay-3 rounded-3xl border border-white/10 bg-slate-900/50 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-slate-100">Local Device Reports (GPS Tracking)</h2>
          <p className="mt-1 text-sm text-slate-400">
            This section reads directly from the local offline database and always shows map tracking when captured.
          </p>

          <div className="mt-4 grid gap-3">
            {(localReports ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No local reports found yet.</p>
            ) : (
              (localReports as EmergencyReport[]).map((report) => {
                const hasGps = typeof report.latitude === 'number' && typeof report.longitude === 'number';
                return (
                  <article key={`local-${report.id}`} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                    <p className="text-sm text-slate-200">{report.text}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(report.timestamp).toLocaleString()} | {report.category} | urgency {report.urgency}/10
                    </p>
                    {hasGps ? (
                      <a
                        href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex min-h-10 items-center rounded border border-cyan-400/40 px-3 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-400/10"
                      >
                        Track Location (Google Maps)
                      </a>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No GPS captured for this report.</p>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
