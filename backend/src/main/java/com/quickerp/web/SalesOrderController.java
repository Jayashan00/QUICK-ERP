package com.quickerp.web;

import com.quickerp.core.SalesOrderPdfService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Server-side sales-order document operations. */
@RestController
@RequestMapping("/sales/orders")
public class SalesOrderController {

    private final SalesOrderPdfService pdfService;

    public SalesOrderController(SalesOrderPdfService pdfService) {
        this.pdfService = pdfService;
    }

    @GetMapping("/{orderId}/pdf")
    public PdfResponse pdf(@PathVariable String orderId,
                           @RequestParam(required = false) String currency,
                           @RequestParam(required = false) BigDecimal multiplier,
                           HttpServletRequest request) {
        SalesOrderPdfService.PdfDocument pdf = pdfService.pdf(
                AuthInterceptor.principal(request), orderId, currency, multiplier);
        return new PdfResponse(pdf.fileName(), "application/pdf", Base64.getEncoder().encodeToString(pdf.bytes()));
    }

    public record PdfResponse(String fileName, String contentType, String base64) {}
}
