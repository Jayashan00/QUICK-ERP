package com.quickerp.web;

import com.quickerp.core.CreditNotePdfService;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sales/credit-notes")
public class CreditNoteController {
    private final CreditNotePdfService service;
    public CreditNoteController(CreditNotePdfService service) { this.service = service; }
    @GetMapping("/{creditNoteId}/pdf")
    public PdfResponse pdf(@PathVariable String creditNoteId, @RequestParam(required = false) String currency,
                           @RequestParam(required = false) BigDecimal multiplier, HttpServletRequest request) {
        CreditNotePdfService.PdfDocument pdf = service.pdf(AuthInterceptor.principal(request), creditNoteId, currency, multiplier);
        return new PdfResponse(pdf.fileName(), "application/pdf", Base64.getEncoder().encodeToString(pdf.bytes()));
    }
    public record PdfResponse(String fileName, String contentType, String base64) {}
}
