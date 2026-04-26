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
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
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

  const updateSelectedPhotoNames = (files: FileList | null) => {
    const nextFiles = Array.from(files ?? []);
    setPhotoNames(nextFiles.map((file) => file.name));
  };

  const openPhotoPicker = (mode: 'gallery' | 'camera') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    if (mode === 'gallery') {
      input.multiple = true;
    } else {
      input.setAttribute('capture', 'environment');
    }

    input.onchange = () => {
      updateSelectedPhotoNames(input.files);
    };

    input.click();
  };

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
    setPhotoNames([]);
    setShowPhotoActions(false);
    alert("Report saved locally!");
  };

  return (
    <main className="app-shell min-h-screen px-4 pb-24 pt-5 text-slate-100 md:px-8 md:pb-10 md:pt-8">
      <div className="ambient-layer" aria-hidden />
      <div className="grid-texture" aria-hidden />
      <div className="glow-orb orb-a" aria-hidden />
      <div className="glow-orb orb-b" aria-hidden />
      <div className="glow-orb orb-c" aria-hidden />
      <div className="mx-auto w-full max-w-3xl">
      <div className="reveal mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between md:mb-8">
        <h1 className="text-2xl font-bold leading-tight md:text-3xl">DisasterDoc AI</h1>
        <Link
          href="/dashboard"
          className="pulse-ring inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900/55 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-400/10"
        >
          Open Intelligence Dashboard
        </Link>
      </div>
      <form onSubmit={handleSubmit} className="reveal reveal-delay-1 space-y-4 rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-6">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-slate-300">Category</span>
            <select
              className="min-h-11 w-full rounded border border-white/10 bg-slate-950/70 p-3 text-slate-100"
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

        <div>
          <div className="relative">
            <textarea
              className="min-h-36 w-full rounded border border-white/10 bg-slate-950/70 p-3 pr-14 text-base text-slate-100 placeholder:text-slate-500"
              placeholder="Describe the emergency..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPhotoActions((prev) => !prev)}
              className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-900/85 text-lg text-slate-100 transition hover:bg-slate-800"
              aria-label="Photo options"
              title="Photo options"
            >
              +
            </button>
            {showPhotoActions && (
              <div className="absolute bottom-14 right-3 z-10 min-w-36 rounded-xl border border-white/15 bg-slate-900/95 p-1.5 shadow-xl backdrop-blur">
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoActions(false);
                    openPhotoPicker('gallery');
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10"
                >
                  Add Photo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoActions(false);
                    openPhotoPicker('camera');
                  }}
                  className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/10"
                >
                  Take Photo
                </button>
              </div>
            )}
          </div>
          {photoNames.length > 0 && (
            <p className="mt-2 text-xs text-slate-300">
              Selected: {photoNames.slice(0, 3).join(', ')}
              {photoNames.length > 3 ? ` +${photoNames.length - 3} more` : ''}
            </p>
          )}
        </div>

        <button type="submit" className="min-h-11 w-full rounded bg-linear-to-r from-red-600 to-orange-500 px-4 py-2 text-base font-semibold text-white transition hover:brightness-110 sm:w-auto">
          Submit Report
        </button>
      </form>
      
      <div className="reveal reveal-delay-2 mt-6 grid gap-3 sm:grid-cols-3 md:mt-8">
        <div className="tilt-card rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Network</p>
          <p className="mt-1 text-base font-bold">{isOnline ? 'Online' : 'Offline'}</p>
        </div>
        <div className="tilt-card rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Pending Sync</p>
          <p className="mt-1 text-base font-bold">{pendingCount || 0}</p>
        </div>
        <div className="tilt-card rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Failed Sync Queue</p>
          <p className="mt-1 text-base font-bold">{failedCount || 0}</p>
        </div>
      </div>

      <div className="reveal reveal-delay-3 mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-5 text-sm">
        <a
          href="https://www.linkedin.com/in/mohammed-hasham-38765a27a"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-400/40 bg-slate-900/50 px-4 py-2 text-sky-200 transition hover:bg-sky-500/15"
          aria-label="Open LinkedIn profile"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3A1.97 1.97 0 0 0 3.3 4.97c0 1.08.86 1.97 1.95 1.97h.02A1.97 1.97 0 1 0 5.25 3ZM20.7 13.4c0-3.5-1.86-5.13-4.35-5.13-2 0-2.9 1.1-3.4 1.86V8.5H9.57c.04 1.08 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.12-.92.27-.68.9-1.38 1.95-1.38 1.38 0 1.93 1.04 1.93 2.57V20H20.7v-6.6Z" />
          </svg>
          LinkedIn
        </a>
        <a
          href="https://github.com/Hasham-03"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/20 bg-slate-900/50 px-4 py-2 text-slate-200 transition hover:bg-white/10"
          aria-label="Open GitHub profile"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.21.68-.48v-1.66c-2.78.6-3.37-1.18-3.37-1.18-.46-1.14-1.11-1.44-1.11-1.44-.91-.61.07-.6.07-.6 1 .07 1.54 1.03 1.54 1.03.9 1.54 2.37 1.1 2.95.84.09-.65.35-1.1.64-1.36-2.22-.26-4.56-1.11-4.56-4.95 0-1.1.39-2 .03-2.7 0 0 .84-.27 2.75 1.03a9.55 9.55 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.37.7.03 1.6.03 2.7 0 3.85-2.34 4.69-4.57 4.95.36.31.69.91.69 1.84v2.73c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
          </svg>
          GitHub
        </a>
      </div>
      </div>
    </main>
  );
}