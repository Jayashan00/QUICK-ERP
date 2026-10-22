package com.quickerp.web;

import com.quickerp.core.AuthService;
import com.quickerp.core.MfaService;
import com.quickerp.core.ProvisioningService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Administration endpoints: set a user's password and create tenants. */
@RestController
public class AdminController {

    public record SetPasswordRequest(String password) {
    }

    private final AuthService authService;
    private final ProvisioningService provisioningService;
    private final MfaService mfaService;

    public AdminController(AuthService authService, ProvisioningService provisioningService, MfaService mfaService) {
        this.authService = authService;
        this.provisioningService = provisioningService;
        this.mfaService = mfaService;
    }

    /** Turns off two-factor sign-in for a user who lost their authenticator app. */
    @PostMapping("/users/{userId}/mfa/reset")
    public ResponseEntity<Void> resetMfa(@PathVariable("userId") String userId, HttpServletRequest request) {
        mfaService.adminReset(AuthInterceptor.principal(request), userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{userId}/password")
    public ResponseEntity<Void> setPassword(@PathVariable("userId") String userId, @RequestBody SetPasswordRequest body,
                                            HttpServletRequest request) {
        authService.setPassword(AuthInterceptor.principal(request), userId, body.password());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/platform/tenants/{tenantId}/provision")
    public ResponseEntity<ProvisioningService.ProvisionResult> provision(@PathVariable("tenantId") String tenantId,
                                                                         @RequestBody ProvisioningService.ProvisionRequest body,
                                                                         HttpServletRequest request) {
        return ResponseEntity.status(201).body(provisioningService.provision(AuthInterceptor.principal(request), tenantId, body));
    }
}
