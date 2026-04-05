"use client";
import { db, type ReportCategory } from '@/lib/db';
import Link from 'next/link';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSync } from '@/hooks/useSync';

export default function Home() {
  const [text, setText] = useState("");
  const [urgency, setUrgency] = useState(7);
  const [category, setCategory] = useState<ReportCategory>('medical');
  const [shareLocation, setShareLocation] = useState(true);
  const [locationLabel, setLocationLabel] = useState('Location not captured yet');
  const { isOnline, syncPendingReports } = useSync();
  // This automatically updates the UI when IndexedDB changes
  const pendingCount = useLiveQuery(() => 
    db.reports.where('status').equals('pending').count()
  );
  const failedCount = useLiveQuery(() =>
    db.reports.where('status').equals('failed').count()
  );

  const getCurrentPosition = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 30000,
      });
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let latitude: number | undefined;
    let longitude: number | undefined;
    let locationAccuracyM: number | undefined;

    if (shareLocation && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      try {
        const position = await getCurrentPosition();
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        locationAccuracyM = position.coords.accuracy;
        setLocationLabel(`Location captured (±${Math.round(position.coords.accuracy)} m)`);
      } catch {
        setLocationLabel('Location unavailable; report still saved.');
      }
    }

    await db.reports.add({
      text,
      urgency,
      category,
      latitude,
      longitude,
      locationAccuracyM,
      status: 'pending',
      timestamp: Date.now(),
      attempts: 0,
    });
    void syncPendingReports();
    setText("");
    setUrgency(7);
    setCategory('medical');
    alert("Report saved locally!");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-24 pt-5 text-slate-100 md:px-8 md:pb-10 md:pt-8">
      <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">DisasterDoc AI</h1>
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-400/40 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
        >
          Open Intelligence Dashboard
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Category</span>
            <select
              className="min-h-11 w-full rounded border border-white/10 bg-slate-900 p-3 text-slate-100"
              value={category}
              onChange={(e) => setCategory(e.target.value as ReportCategory)}
            >
              <option value="medical">Medical</option>
              <option value="shelter">Shelter</option>
              <option value="food">Food & Water</option>
              <option value="security">Security</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Urgency: {urgency}/10</span>
            <input
              type="range"
              min={1}
              max={10}
              value={urgency}
              onChange={(e) => setUrgency(Number(e.target.value))}
              className="mt-2 w-full"
            />
          </label>
        </div>

        <label className="flex min-h-11 items-center gap-2 rounded border border-white/10 bg-white/5 px-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={shareLocation}
            onChange={(e) => setShareLocation(e.target.checked)}
          />
          Share GPS location with rescue team
        </label>

        <p className="text-xs text-slate-400">{locationLabel}</p>

        <textarea 
          className="min-h-36 w-full rounded border border-white/10 bg-slate-900 p-3 text-base text-slate-100 placeholder:text-slate-500"
          placeholder="Describe the emergency..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="min-h-11 w-full rounded bg-red-600 px-4 py-2 text-base font-semibold text-white transition hover:bg-red-500 sm:w-auto">
          Submit Report
        </button>
      </form>
      
      <div className="mt-6 grid gap-3 sm:grid-cols-3 md:mt-8">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Network</p>
          <p className="mt-1 text-base font-bold">{isOnline ? 'Online' : 'Offline'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending Sync</p>
          <p className="mt-1 text-base font-bold">{pendingCount || 0}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Failed Sync Queue</p>
          <p className="mt-1 text-base font-bold">{failedCount || 0}</p>
        </div>
      </div>

      <button
        onClick={async () => {
          await db.reports.add({
            text: 'Manual Test',
            urgency: 8,
            category: 'security',
            status: 'pending',
            timestamp: Date.now(),
            attempts: 0,
          });
          void syncPendingReports();
          console.log('Manual write successful');
        }}
        className="mt-4 min-h-11 w-full rounded bg-blue-500 p-2 text-base font-medium text-white transition hover:bg-blue-400 sm:w-auto"
      >
        Force Database Write
      </button>
      </div>
    </main>
  );
}