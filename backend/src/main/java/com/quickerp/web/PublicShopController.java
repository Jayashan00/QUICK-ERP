package com.quickerp.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.quickerp.core.StateStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints for the public customer web shop (no sign-in). */
@RestController
@RequestMapping("/public/shop/{tenantId}")
public class PublicShopController {

    private final StateStore stateStore;

    public PublicShopController(StateStore stateStore) {
        this.stateStore = stateStore;
    }

    @GetMapping("/state")
    public StateStore.StateView state(@PathVariable("tenantId") String tenantId) {
        return stateStore.publicState(tenantId);
    }

    @GetMapping("/orders/{orderId}")
    public JsonNode order(@PathVariable("tenantId") String tenantId, @PathVariable("orderId") String orderId) {
        return stateStore.publicOrder(tenantId, orderId);
    }

    @PostMapping("/batch")
    public StateStore.BatchResult batch(@PathVariable("tenantId") String tenantId, @RequestBody StateStore.BatchRequest body,
                                        HttpServletRequest request) {
        return stateStore.publicBatch(tenantId, body, request.getRemoteAddr());
    }
}
