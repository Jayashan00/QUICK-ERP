package com.quickerp.web;

import com.quickerp.core.DeliveryNotePdfService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Base64;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only delivery-note document operations. */
@RestController
@RequestMapping("/sales/deliveries")
public class DeliveryNoteController {
    private final DeliveryNotePdfService pdfService;

    public DeliveryNoteController(DeliveryNotePdfService pdfService) {
        this.pdfService = pdfService;
    }

    @GetMapping("/{deliveryId}/pdf")
    public PdfResponse pdf(@PathVariable String deliveryId, HttpServletRequest request) {
        DeliveryNotePdfService.PdfDocument pdf = pdfService.pdf(AuthInterceptor.principal(request), deliveryId);
        return new PdfResponse(pdf.fileName(), "application/pdf", Base64.getEncoder().encodeToString(pdf.bytes()));
    }

    public record PdfResponse(String fileName, String contentType, String base64) {}
}
