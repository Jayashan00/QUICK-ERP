import { useSearchRecord } from '@/features/global-search/hooks/useSearchRecord';
import { leadService } from '../services/leadService';
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  Plus,
  Target,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/shared/components/common/Button";
import { StatusBadge } from "@/shared/components/common/StatusBadge";
import { StatCard } from "@/shared/components/cards/StatCard";
import { ConfirmDialog } from "@/shared/components/feedback/ConfirmDialog";
import { ErrorState } from "@/shared/components/feedback/ErrorState";
import { Card } from "@/shared/components/common/Card";
import { PageContainer } from "@/shared/components/layout/PageContainer";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { DataTable } from "@/shared/components/tables/DataTable";
import { FilterPanel } from "@/shared/components/tables/FilterPanel";
import { TableToolbar } from "@/shared/components/tables/TableToolbar";

import type { Column } from "@/shared/components/tables/TableHeader";
import type { Lead, LeadSource, LeadStatus } from '@/features/crm/leads/types/lead';

import { LeadDetailModal } from "../components/LeadDetailModal";
import { LeadFormModal } from "../components/LeadFormModal";
import { useLeads } from "../hooks/useLeads";
import type { LeadFormValues } from "../schemas/leadSchema";
import { controlBase } from "@/shared/components/forms/controlStyles";
import { cn } from "@/shared/utils/cn";
import { getErrorMessage } from "@/shared/utils/errors";
import { appToast } from "@/shared/utils/toast";
import { Can } from "@/core/permissions/components";
import { PERMISSIONS } from "@/core/permissions";
import { usePermissions } from "@/core/permissions/permission-context";
import type { DropdownItem } from "@/shared/components/common/Dropdown";

function formatSource(source: Lead["source"]) {
  return source
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function formatValue(value?: number) {
  if (value === undefined) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function LeadsPage() {
  const searchRecord = useSearchRecord('leads', 'leads.view', leadService.getById);
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.LEADS.CREATE);
  const canEdit = hasPermission(PERMISSIONS.LEADS.EDIT);
  const canDelete = hasPermission(PERMISSIONS.LEADS.DELETE);
  const canExport = hasPermission(PERMISSIONS.LEADS.EXPORT);
  const canConvert = hasPermission(PERMISSIONS.LEADS.CONVERT);
  const {
    leads,
    total,
    isLoading,
    isError,
    error,
    refetch,

    search,
    setSearch,

    status,
    setStatus,

    source,
    setSource,

    page,
    setPage,

    pageSize,
    setPageSize,

    createLead,
    updateLead,
    deleteLead,
    convertLead,
    isDeleting,
  } = useLeads(searchRecord.initialSearch);

  const [
    selectedLead,
    setSelectedLead,
  ] = useState<Lead | null>(null);

  const [
    editingLead,
    setEditingLead,
  ] = useState<Lead | null>(null);

  const [
    isDetailOpen,
    setIsDetailOpen,
  ] = useState(false);

  const [
    isFormOpen,
    setIsFormOpen,
  ] = useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);

  const newCount = leads.filter(
    (lead) => lead.status === "new",
  ).length;

  const contactedCount = leads.filter(
    (lead) =>
      lead.status === "contacted",
  ).length;

  const qualifiedCount = leads.filter(
    (lead) =>
      lead.status === "qualified",
  ).length;

  const columns: Column<Lead>[] = [
    {
      key: "code",
      header: "Code",
      width: "120px",
      render: (lead) => (
        <span className="font-semibold text-slate-900">
          {lead.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Lead",
      sortable: true,
      render: (lead) => (
        <div>
          <div className="font-semibold text-blue-600">
            {lead.firstName}{" "}
            {lead.lastName}
          </div>

          <div className="text-xs text-slate-500">
            {lead.company ||
              lead.email}
          </div>
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      width: "130px",
      render: (lead) => (
        <span className="text-xs text-slate-600">
          {formatSource(lead.source)}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (lead) => lead.phone,
    },
    {
      key: "estimatedValue",
      header: "Est. Value",
      render: (lead) =>
        formatValue(
          lead.estimatedValue,
        ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (lead) => (
        <StatusBadge
          status={lead.status}
        />
      ),
    },
  ];

  const handleCreateOrUpdate =
    async (
      data: LeadFormValues,
    ) => {
      if (editingLead) {
        await updateLead(
          editingLead.id,
          data,
        );
      } else {
        await createLead(data);
      }
    };

  const handleConfirmDelete =
    async () => {
      if (!deletingId) {
        return;
      }

      try {
        await deleteLead(deletingId);
        setDeletingId(null);
        appToast.success("Lead deleted successfully.");
      } catch (error) {
        appToast.error(getErrorMessage(error, "Unable to delete the lead. Please try again."));
      }
    };

  const openCreateModal = () => {
    setEditingLead(null);
    setIsFormOpen(true);
  };

  return (
    <PageContainer>{searchRecord.recordId && searchRecord.unavailable && <ErrorState message="Requested lead is unavailable in this branch." />}
      <PageHeader
        title="Leads"
        description="Capture, qualify, assign and manage prospective customers."
        actions={(canExport || canCreate) ? (
          <>
            <Can permission={PERMISSIONS.LEADS.EXPORT}>
              <Button
                variant="secondary"
                leftIcon={<Download size={16} />}
                onClick={() => appToast.info("Lead export will be available when the export service is connected.")}
              >
                Export
              </Button>
            </Can>

            <Can permission={PERMISSIONS.LEADS.CREATE}>
              <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openCreateModal}>
                Add Lead
              </Button>
            </Can>
          </>
        ) : undefined}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Leads"
          value={total}
          icon={<Users size={20} />}
          description="All prospective customers"
        />

        <StatCard
          title="New"
          value={newCount}
          icon={<UserPlus size={20} />}
          description="Awaiting first contact"
        />

        <StatCard
          title="Contacted"
          value={contactedCount}
          icon={<Target size={20} />}
          description="Follow-up in progress"
        />

        <StatCard
          title="Qualified"
          value={qualifiedCount}
          icon={<UserCheck size={20} />}
          description="Ready for sales process"
        />
      </div>

      {isError ? (
        <Card className="p-0">
          <ErrorState
            message={getErrorMessage(error, "Failed to load leads. Please try again.")}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : (
      <DataTable<Lead>
        columns={columns}
        data={leads}
        keyField="id"
        isLoading={isLoading}
        emptyTitle="No leads found"
        emptyMessage="Try adjusting your search or filter settings."
        emptyAction={canCreate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={
              openCreateModal
            }
          >
            Add First Lead
          </Button>
        ) : undefined}
        onRowClick={(lead) => {
          setSelectedLead(lead);
          setIsDetailOpen(true);
        }}
        rowActions={(lead) => {
          const actions: DropdownItem[] = [{
            key: "view",
            label: "View Details",
            onClick: () => {
              setSelectedLead(lead);
              setIsDetailOpen(true);
            },
          }];

          if (canEdit) actions.push({
            key: "edit",
            label: "Edit Lead",
            onClick: () => {
              setEditingLead(lead);
              setIsFormOpen(true);
            },
          });

          if (canDelete) actions.push({
            key: "delete",
            label: "Delete Lead",
            danger: true,
            onClick: () =>
              setDeletingId(lead.id),
          });

          return actions;
        }}
        pagination={{
          page,
          pageSize,
          total,
          onPageChange: setPage,
          onPageSizeChange:
            setPageSize,
        }}
        toolbar={
          <TableToolbar
            searchValue={search}
            onSearchChange={
              setSearch
            }
            searchPlaceholder="Search name, company, email, phone or code..."
            filters={
              <FilterPanel
                activeFilterCount={
                  (status !== "all"
                    ? 1
                    : 0) +
                  (source !== "all"
                    ? 1
                    : 0)
                }
                onReset={() => {
                  setStatus("all");
                  setSource("all");
                  setSearch("");
                }}
              >
                <select
                  className={cn(controlBase, "h-8 w-full py-0 text-xs sm:w-auto")}
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target
                        .value as
                        | LeadStatus
                        | "all",
                    )
                  }
                >
                  <option value="all">
                    All Statuses
                  </option>
                  <option value="new">
                    New
                  </option>
                  <option value="contacted">
                    Contacted
                  </option>
                  <option value="qualified">
                    Qualified
                  </option>
                  <option value="unqualified">
                    Unqualified
                  </option>
                  <option value="converted">
                    Converted
                  </option>
                  <option value="lost">
                    Lost
                  </option>
                </select>

                <select
                  className={cn(controlBase, "h-8 w-full py-0 text-xs sm:w-auto")}
                  value={source}
                  onChange={(event) =>
                    setSource(
                      event.target
                        .value as
                        | LeadSource
                        | "all",
                    )
                  }
                >
                  <option value="all">
                    All Sources
                  </option>
                  <option value="website">
                    Website
                  </option>
                  <option value="referral">
                    Referral
                  </option>
                  <option value="social_media">
                    Social Media
                  </option>
                  <option value="email">
                    Email
                  </option>
                  <option value="phone">
                    Phone
                  </option>
                  <option value="event">
                    Event
                  </option>
                  <option value="advertisement">
                    Advertisement
                  </option>
                  <option value="other">
                    Other
                  </option>
                </select>
              </FilterPanel>
            }
          />
        }
      />

      )}

      <LeadDetailModal
        lead={searchRecord.recordId ? searchRecord.record : selectedLead}
        isOpen={searchRecord.recordId ? Boolean(searchRecord.record) : isDetailOpen}
        canEdit={canEdit}
        canConvert={canConvert}
        canManageActivities={hasPermission(PERMISSIONS.CRM.ACTIVITIES_EDIT)}
        canCreateOpportunity={hasPermission(PERMISSIONS.CRM.OPPORTUNITIES_CREATE)}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedLead(null);
          searchRecord.clearRecord();
        }}
        onEdit={(lead) => {
          setIsDetailOpen(false);
          setSelectedLead(null);
          searchRecord.clearRecord();
          setEditingLead(lead);
          setIsFormOpen(true);
        }}
        onConvert={async (
          lead,
          data,
        ) => {
          const result = await convertLead(
            lead,
            data,
          );

          setSelectedLead(result.lead);
        }}
        onCreateOpportunity={(lead) => {
          const query = new URLSearchParams({
            leadId: lead.id,
            leadName: `${lead.firstName} ${lead.lastName}`,
            opportunityName: `${lead.company || `${lead.firstName} ${lead.lastName}`} Opportunity`,
            expectedValue: String(lead.estimatedValue ?? 0),
            ownerId: lead.assignedTo ?? '',
          });
          navigate(`/crm/opportunities/new?${query.toString()}`);
        }}
      />

      {(canCreate || canEdit) && <LeadFormModal
        lead={editingLead}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingLead(null);
        }}
        onSubmit={
          handleCreateOrUpdate
        }
      />}

      {canDelete && <ConfirmDialog
        isOpen={Boolean(deletingId)}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={
          handleConfirmDelete
        }
        onCancel={() =>
          setDeletingId(null)
        }
      />}
    </PageContainer>
  );
}
