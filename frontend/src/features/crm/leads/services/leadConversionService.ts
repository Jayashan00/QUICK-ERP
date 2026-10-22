import { customerService } from "@/features/customers/services/customerService";

import type { Lead } from '@/features/crm/leads/types/lead';

import type { LeadConversionFormValues } from "../schemas/leadConversionSchema";
import { leadService } from "./leadService";
import type { TenantBranchScope } from "@/core/tenant/dataScope";

function generateCustomerCode() {
  return `CUST-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;
}

export const leadConversionService = {
  async convertLead(
    scope: TenantBranchScope,
    lead: Lead,
    data: LeadConversionFormValues,
  ) {
    if (lead.status === "converted") {
      throw new Error(
        "This lead has already been converted",
      );
    }

    const customer =
      await customerService.createCustomer(scope, {
        name: data.customerName,

        code: generateCustomerCode(),

        type: data.customerType,

        email: data.email,
        phone: data.phone,

        currency: data.currency,

        status: "active",

        billingAddress: {
          street: data.street ?? "",
          city: data.city ?? "",
          country: data.country,
          postalCode:
            data.postalCode ?? "",
        },

        notes: data.notes,
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
