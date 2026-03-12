import { useDesignStore } from '../../store/designStore';
import { AlertTriangle, CheckCircle, XCircle, Info, ExternalLink } from 'lucide-react';

export function ValidationPanel() {
  const validationResults = useDesignStore((s) => s.validationResults);
  const showValidationPanel = useDesignStore((s) => s.showValidationPanel);

  if (!showValidationPanel) return null;

  const iconMap = {
    error: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
    success: <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />,
  };

  const bgMap = {
    error: 'bg-red-500/5 border-red-500/20',
    warning: 'bg-yellow-500/5 border-yellow-500/20',
    info: 'bg-blue-500/5 border-blue-500/20',
    success: 'bg-green-500/5 border-green-500/20',
  };

  return (
    <div className="border-t border-slate-700 bg-nvidia-dark max-h-48 overflow-y-auto">
      <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          Validation
        </h3>
        <span className="text-[10px] text-slate-500">
          {validationResults.filter((r) => !r.valid).length} issues
        </span>
      </div>
      <div className="p-2 space-y-1.5">
        {validationResults.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-2">
            Add components to see validation results
          </p>
        )}
        {validationResults.map((result, i) => (
          <div
            key={i}
            className={`p-2.5 rounded-lg border ${bgMap[result.severity]}`}
          >
            <div className="flex items-start gap-2">
              {iconMap[result.severity]}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200">{result.message}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  {result.explanation}
                </p>
                {result.suggestion && (
                  <p className="text-[10px] text-nvidia-accent mt-1">
                    💡 {result.suggestion}
                  </p>
                )}
                {result.documentationUrl && (
                  <a
                    href={result.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-nvidia-green hover:underline mt-1"
                  >
                    Learn more <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
