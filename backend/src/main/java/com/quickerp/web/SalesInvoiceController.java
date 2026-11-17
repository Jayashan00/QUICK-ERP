package com.quickerp.web;

import com.quickerp.core.SalesInvoicePdfService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Server-side customer-invoice document operations. */
@RestController
@RequestMapping("/sales/invoices")
public class SalesInvoiceController {

    private final SalesInvoicePdfService pdfService;

    public SalesInvoiceController(SalesInvoicePdfService pdfService) {
        this.pdfService = pdfService;
    }

    @GetMapping("/{invoiceId}/pdf")
    public PdfResponse pdf(@PathVariable String invoiceId,
                           @RequestParam(required = false) String currency,
                           @RequestParam(required = false) BigDecimal multiplier,
                           HttpServletRequest request) {
        SalesInvoicePdfService.PdfDocument pdf = pdfService.pdf(
                AuthInterceptor.principal(request), invoiceId, currency, multiplier);
        return new PdfResponse(pdf.fileName(), "application/pdf", Base64.getEncoder().encodeToString(pdf.bytes()));
    }

    @PostMapping("/{invoiceId}/email")
    public SalesInvoicePdfService.DeliveryResult email(@PathVariable String invoiceId,
                                                        @RequestParam(required = false) String currency,
                                                        @RequestParam(required = false) BigDecimal multiplier,
                                                        HttpServletRequest request) {
        return pdfService.deliver(AuthInterceptor.principal(request), invoiceId, currency, multiplier);
    }

    public record PdfResponse(String fileName, String contentType, String base64) {}
}
