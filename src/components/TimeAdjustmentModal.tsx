import React, { useState, useEffect } from 'react';
import { EventType, Site } from '../types';
import { Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TimeAdjustmentModalProps {
  isOpen: boolean;
  eventType: EventType;
  sites: Site[];
  selectedSiteId: string;
  onSelectSiteId: (siteId: string) => void;
  autoTime: string; // HH:mm format
  onSubmit: (effectiveTimeHHMM: string, wasAdjusted: boolean, reason?: string) => void;
  onCancel: () => void;
}

export const TimeAdjustmentModal: React.FC<TimeAdjustmentModalProps> = ({
  isOpen,
  eventType,
  sites,
  selectedSiteId,
  onSelectSiteId,
  autoTime,
  onSubmit,
  onCancel,
}) => {
  const [inputTime, setInputTime] = useState<string>(autoTime);
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Synchronize inputTime whenever modal opens or autoTime changes
  useEffect(() => {
    if (isOpen) {
      setInputTime(autoTime);
      setReason('');
      setError(null);
    }
  }, [isOpen, autoTime]);

  if (!isOpen) return null;

  const isAdjusted = inputTime !== autoTime;

  const getTitle = () => {
    switch (eventType) {
      case 'START':
        return { en: 'Confirm START Work', si: 'වැඩ ආරම්භය තහවුරු කරන්න', bg: 'bg-[#2EAF7D]' };
      case 'MOVE':
        return { en: 'Confirm Site MOVE', si: 'ස්ථාන මාරුව තහවුරු කරන්න', bg: 'bg-[#8B5CF6]' };
      case 'OFF':
        return { en: 'Confirm END / OFF Work', si: 'වැඩ අවසන් කිරීම තහවුරු කරන්න', bg: 'bg-[#EF4444]' };
    }
  };

  const title = getTitle();

  const handleConfirm = () => {
    setError(null);
    // Reason is only required if the user actually changed the auto-filled live time
    if (isAdjusted) {
      if (!reason || reason.trim().length < 3) {
        setError('Please provide a reason for changing the auto-filled time (e.g. "Forgot to tap at 5 PM").');
        return;
      }
    }
    onSubmit(inputTime, isAdjusted, isAdjusted ? reason.trim() : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header with action-themed color */}
        <div className={`${title.bg} text-white p-5 text-center shadow-sm`}>
          <h3 className="text-xl font-black tracking-tight">{title.en}</h3>
          <p className="sinhala-text text-sm text-white/90 mt-0.5 font-bold">{title.si}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Site selection for START and MOVE */}
          {(eventType === 'START' || eventType === 'MOVE') && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Construction Site / වැඩබිම
              </label>
              <select
                value={selectedSiteId}
                onChange={(e) => onSelectSiteId(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-[#2EAF7D] focus:outline-none"
              >
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Time auto-fill & edit */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Event Time / වේලාව
              </label>
              {isAdjusted ? (
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Manually Changed
                </span>
              ) : (
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  Current Live Time
                </span>
              )}
            </div>

            <input
              type="time"
              value={inputTime}
              onChange={(e) => setInputTime(e.target.value)}
              className={`w-full text-3xl font-black text-center tracking-wider p-3 bg-slate-50 border-2 rounded-xl focus:outline-none transition-colors ${
                isAdjusted ? 'border-amber-400 text-amber-900 bg-amber-50/40' : 'border-slate-300 text-[#02353C]'
              }`}
            />
            <p className="text-[11px] text-slate-500 mt-1 text-center">
              Sri Lankan Local Time (Asia/Colombo)
            </p>
          </div>

          {/* Correction Reason: Faded / Disabled when current time is kept; Active only if changed */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isAdjusted
                ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-300/50'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <label className={`text-xs font-bold ${isAdjusted ? 'text-amber-900' : 'text-slate-500'}`}>
                Reason for Time Correction / හේතුව {isAdjusted && '*'}
              </label>
              {!isAdjusted && (
                <span className="text-[10px] text-slate-400 font-medium">Not required (Live time kept)</span>
              )}
            </div>

            <input
              type="text"
              disabled={!isAdjusted}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isAdjusted ? 'e.g. Forgot to tap when leaving site at 5:00 PM' : 'Only required if you change the time'}
              className={`w-full p-2.5 rounded-lg text-xs transition-colors ${
                isAdjusted
                  ? 'bg-white border border-amber-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500'
                  : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            />
            {isAdjusted && (
              <p className="text-[11px] text-amber-800 sinhala-text mt-1 font-medium">
                ස්වයංක්‍රීයව ලැබුණු වේලාව වෙනස් කළහොත් හේතුවක් සඳහන් කිරීම අනිවාර්ය වේ.
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-4 rounded-xl border border-slate-300 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="py-3 px-4 rounded-xl font-bold text-white bg-[#02353C] hover:bg-[#03444d] transition-colors flex items-center justify-center gap-1.5 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4 text-[#3FD0C9]" />
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
