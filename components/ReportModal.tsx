import React, { useState, useEffect } from 'react';
import { X, Flag, AlertTriangle } from './Icon';
import { moderationService } from '../services/supabaseService';

interface ReportModalProps {
  storyId: string;
  userId: string;
  onClose: () => void;
  onReportSuccess: (message: string) => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  storyId,
  userId,
  onClose,
  onReportSuccess
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reasons, setReasons] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const loadReasons = async () => {
      const reportReasons = await moderationService.getReportReasons();
      setReasons(reportReasons);
    };
    loadReasons();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    setIsSubmitting(true);
    try {
      const result = await moderationService.reportStory(
        storyId,
        userId,
        selectedReason as any,
        details.trim() || undefined
      );

      if (result.success) {
        onReportSuccess(result.message);
        onClose();
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error reporting story:', error);
      alert('Erreur lors du signalement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-500/20 rounded-full">
              <Flag size={20} className="text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Signaler cette story</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle size={20} className="text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-semibold mb-1">Pourquoi signaler ?</p>
              <p className="text-yellow-300/80">
                Les signalements aident à maintenir une communauté saine. 
                Les stories avec 3+ signalements sont masquées automatiquement.
              </p>
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Raison du signalement *
            </label>
            <div className="space-y-2">
              {reasons.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => setSelectedReason(reason.value)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedReason === reason.value
                      ? 'bg-purple-600/20 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{reason.label}</span>
                    {selectedReason === reason.value && (
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Details (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Détails (optionnel)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Ajoutez des détails pour nous aider à comprendre..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl p-3 text-white text-sm focus:border-purple-500 focus:outline-none resize-none placeholder-gray-500"
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{details.length}/500</p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedReason || isSubmitting}
              className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Envoi...</span>
                </>
              ) : (
                <>
                  <Flag size={16} />
                  <span>Signaler</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReportModal;

