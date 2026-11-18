package com.quickerp.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.quickerp.core.RfqWorkflowService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RfqWorkflowController {
    private final RfqWorkflowService service;

    public RfqWorkflowController(RfqWorkflowService service) {
        this.service = service;
    }

    @PostMapping("/purchases/rfqs")
    public JsonNode create(@RequestBody RfqWorkflowService.CreateRequest body, HttpServletRequest request) {
        return service.create(AuthInterceptor.principal(request), body);
    }

    @GetMapping("/public/supplier/rfq/{token}")
    public JsonNode publicView(@PathVariable("token") String token) {
        return service.publicView(token);
    }

    @PostMapping("/public/supplier/rfq/{token}/submit")
    public JsonNode submit(@PathVariable("token") String token, @RequestBody RfqWorkflowService.SubmitRequest body) {
        return service.submit(token, body);
    }
}
