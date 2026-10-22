package com.quickerp.web;

import com.quickerp.core.StateStore;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** ERP data of the signed-in user's tenant. */
@RestController
@RequestMapping("/state")
public class StateController {

    private final StateStore stateStore;

    public StateController(StateStore stateStore) {
        this.stateStore = stateStore;
    }

    @GetMapping
    public StateStore.StateView load(HttpServletRequest request) {
        return stateStore.load(AuthInterceptor.principal(request));
    }

    @GetMapping("/changes")
    public StateStore.ChangesView changes(@RequestParam(name = "since", defaultValue = "0") long since,
                                          @RequestHeader(name = "X-Client-Id", required = false) String clientId,
                                          HttpServletRequest request) {
        return stateStore.changes(AuthInterceptor.principal(request), since, clientId);
    }

    @PostMapping("/batch")
    public StateStore.BatchResult batch(@RequestBody StateStore.BatchRequest body, HttpServletRequest request) {
        return stateStore.applyBatch(AuthInterceptor.principal(request), body);
    }
}
