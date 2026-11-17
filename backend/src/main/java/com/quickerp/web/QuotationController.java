package com.quickerp.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.quickerp.core.QuotationDeliveryService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Server-side quotation delivery operations. */
@RestController
@RequestMapping("/sales/quotations")
public class QuotationController {

    private final QuotationDeliveryService deliveryService;

    public QuotationController(QuotationDeliveryService deliveryService) {
        this.deliveryService = deliveryService;
    }

    @GetMapping("/{quotationId}/pdf")
    public PdfResponse pdf(@PathVariable String quotationId,
                           @RequestParam(required = false) String currency,
                           @RequestParam(required = false) BigDecimal multiplier,
                           HttpServletRequest request) {
        QuotationDeliveryService.PdfDocument pdf = deliveryService.pdf(
                AuthInterceptor.principal(request), quotationId, currency, multiplier);
        return new PdfResponse(pdf.fileName(), "application/pdf", Base64.getEncoder().encodeToString(pdf.bytes()));
    }

    @PostMapping("/{quotationId}/email")
    public JsonNode email(@PathVariable String quotationId,
                          @RequestParam(required = false) String currency,
                          @RequestParam(required = false) BigDecimal multiplier,
                          HttpServletRequest request) {
        return deliveryService.deliver(AuthInterceptor.principal(request), quotationId, currency, multiplier);
    }

    public record PdfResponse(String fileName, String contentType, String base64) {}
}
