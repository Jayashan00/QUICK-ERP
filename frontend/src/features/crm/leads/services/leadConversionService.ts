import { customerService } from "@/features/customers/services/customerService";
import type { CustomerFormValues } from '@/features/customers/schemas/customerSchema';

import type { Lead } from '@/features/crm/leads/types/lead';

import { leadService } from "./leadService";
import type { TenantBranchScope } from "@/core/tenant/dataScope";

export const leadConversionService = {
  async convertLead(
    scope: TenantBranchScope,
    lead: Lead,
    data: CustomerFormValues,
  ) {
    if (lead.status === "converted") {
      throw new Error(
        "This lead has already been converted",
      );
    }

    const { shippingSameAsBilling, shippingAddress, primaryContact, ...customerData } = data;
    const hasPrimaryContact = Boolean(
      primaryContact.name || primaryContact.email || primaryContact.phone || primaryContact.jobTitle,
    );
    const customer = await customerService.createCustomer(scope, {
      ...customerData,
      shippingAddress: shippingSameAsBilling ? undefined : shippingAddress,
      primaryContact: hasPrimaryContact ? primaryContact : undefined,
      contacts: hasPrimaryContact
        ? [{ id: crypto.randomUUID(), ...primaryContact, isPrimary: true }]
        : [],
    });

    const convertedLead =
      await leadService.markConverted(
        scope,
        lead.id,
        customer.id,
      );

    return {
      customer,
      lead: convertedLead,
    };
  },
};
