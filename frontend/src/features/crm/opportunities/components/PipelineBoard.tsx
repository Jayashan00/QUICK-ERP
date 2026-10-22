import { OPPORTUNITY_STAGES, type Opportunity, type OpportunityStage } from '@/features/crm/opportunities/types/opportunity';
import { PipelineColumn } from './PipelineColumn';

interface PipelineBoardProps {
  opportunities: Opportunity[];
  onViewOpportunity?: (opp: Opportunity) => void;
  onEditOpportunity?: (opp: Opportunity) => void;
  onMoveStage?: (opp: Opportunity, newStage: OpportunityStage) => void;
}

export function PipelineBoard({
  opportunities,
  onViewOpportunity,
  onEditOpportunity,
  onMoveStage,
}: PipelineBoardProps) {
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity]));

  return (
    <div className="flex w-full gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[550px]">
      {OPPORTUNITY_STAGES.map((stage) => {
        const stageOpps = opportunities.filter((opp) => opp.stage === stage.value);
        return (
          <PipelineColumn
            key={stage.value}
            stage={stage}
            opportunities={stageOpps}
            onViewOpportunity={onViewOpportunity}
            onEditOpportunity={onEditOpportunity}
            onMoveStage={onMoveStage ? (opportunity, newStage) => {
              const currentOpportunity = opportunityById.get(opportunity.id) ?? opportunity;
              onMoveStage(currentOpportunity, newStage);
            } : undefined}
            onDropOpportunity={onMoveStage ? (opportunityId, newStage) => {
              const opportunity = opportunityById.get(opportunityId);
              if (opportunity && opportunity.stage !== newStage) onMoveStage(opportunity, newStage);
            } : undefined}
          />
        );
      })}
    </div>
  );
}
