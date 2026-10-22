import { useState, type DragEvent } from 'react';
import { Building, Calendar, DollarSign, MoreVertical, ArrowRight, User } from 'lucide-react';
import { StatusBadge } from '@/shared/components/common/StatusBadge';
import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from '@/features/crm/opportunities/types/opportunity';

interface OpportunityCardProps {
  opportunity: Opportunity;
  onView?: (opp: Opportunity) => void;
  onEdit?: (opp: Opportunity) => void;
  onMoveStage?: (opp: Opportunity, newStage: OpportunityStage) => void;
}

export function OpportunityCard({
  opportunity,
  onView,
  onEdit,
  onMoveStage,
}: OpportunityCardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const availableStages = OPPORTUNITY_STAGES.filter(
    (stage) => stage.value !== opportunity.stage
  );

  return (
    <div
      draggable={Boolean(onMoveStage)}
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        if (!onMoveStage) return;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-opportunity-id', opportunity.id);
        event.dataTransfer.setData('text/plain', opportunity.id);
        setIsDragging(true);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`group relative flex flex-col justify-between rounded-lg border border-slate-200/90 bg-white p-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md ${onMoveStage ? 'cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Top row: Code + Status Badge + Action Menu */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium font-mono text-slate-500">
          {opportunity.code}
        </span>
        <div className="flex items-center gap-1">
          <StatusBadge status={opportunity.status} />
          {onMoveStage && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMoveMenu(!showMoveMenu);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Change stage"
              >
                <MoreVertical size={14} />
              </button>

              {showMoveMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMoveMenu(false);
                    }}
                  />
                  <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Move to Stage
                    </div>
                    {availableStages.map((st) => (
                      <button
                        key={st.value}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMoveMenu(false);
                          onMoveStage(opportunity, st.value);
                        }}
                        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600"
                      >
                        <span>{st.label}</span>
                        <ArrowRight size={12} className="text-slate-400" />
                      </button>
                    ))}
                    {onEdit && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowMoveMenu(false);
                            onEdit(opportunity);
                          }}
                          className="w-full px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Edit Opportunity
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main title */}
      <div
        className="mt-1.5 cursor-pointer"
        onClick={() => onView?.(opportunity)}
      >
        <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-blue-600 transition-colors">
          {opportunity.name}
        </h4>
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <Building size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{opportunity.customerName}</span>
        </div>
      </div>

      {/* Values and Metrics */}
      <div className="mt-3 border-t border-slate-100 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5 text-sm font-bold text-slate-900">
            <DollarSign size={14} className="text-emerald-600" />
            <span>{opportunity.expectedValue.toLocaleString()}</span>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            {opportunity.probability}%
          </span>
        </div>

        {/* Footer info: Owner & Close Date */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1 truncate" title={opportunity.salesOwnerName}>
            <User size={12} />
            <span className="truncate max-w-[100px]">{opportunity.salesOwnerName || 'Unassigned'}</span>
          </div>
          {opportunity.expectedCloseDate && (
            <div className="flex items-center gap-1 shrink-0">
              <Calendar size={12} />
              <span>{new Date(opportunity.expectedCloseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
