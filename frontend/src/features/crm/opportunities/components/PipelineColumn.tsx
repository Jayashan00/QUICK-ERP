import { useState, type DragEvent } from 'react';
import type { Opportunity, OpportunityStage } from '@/features/crm/opportunities/types/opportunity';
import { OpportunityCard } from './OpportunityCard';

interface PipelineColumnProps {
  stage: { value: OpportunityStage; label: string };
  opportunities: Opportunity[];
  onViewOpportunity?: (opp: Opportunity) => void;
  onEditOpportunity?: (opp: Opportunity) => void;
  onMoveStage?: (opp: Opportunity, newStage: OpportunityStage) => void;
  onDropOpportunity?: (opportunityId: string, newStage: OpportunityStage) => void;
}

export function PipelineColumn({
  stage,
  opportunities,
  onViewOpportunity,
  onEditOpportunity,
  onMoveStage,
  onDropOpportunity,
}: PipelineColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.expectedValue || 0), 0);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (!onDropOpportunity) return;
    const opportunityId = event.dataTransfer.getData('application/x-opportunity-id') || event.dataTransfer.getData('text/plain');
    if (opportunityId) onDropOpportunity(opportunityId, stage.value);
  };

  return (
    <div
      onDragOver={(event) => {
        if (!onDropOpportunity) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragOver(false);
      }}
      onDrop={handleDrop}
      className={`flex w-80 shrink-0 flex-col rounded-xl p-3 border max-h-full transition-colors ${isDragOver ? 'border-blue-400 bg-blue-50/80' : 'border-slate-200/70 bg-slate-50/80'}`}
    >
      {/* Column Header */}
      <div className="mb-3 flex items-center justify-between border-b border-slate-200/60 pb-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {stage.label}
          </h3>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
            {opportunities.length}
          </span>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          ${totalValue.toLocaleString()}
        </div>
      </div>

      {/* Cards List */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {opportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            No opportunities
          </div>
        ) : (
          opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onView={onViewOpportunity}
              onEdit={onEditOpportunity}
              onMoveStage={onMoveStage}
            />
          ))
        )}
      </div>
    </div>
  );
}
