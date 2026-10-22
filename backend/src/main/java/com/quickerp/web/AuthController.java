package com.quickerp.web;

import com.quickerp.core.AuthService;
import com.quickerp.core.MfaService;
import com.quickerp.core.PasswordResetService;
import com.quickerp.core.TokenService;
import com.quickerp.core.Principal;
import java.util.List;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    public record LoginRequest(String email, String password) {
    }

    public record ChangePasswordRequest(String currentPassword, String newPassword) {
    }

    public record MfaVerifyRequest(String challenge, String code) {
    }

    public record CodeRequest(String code) {
    }

    public record ResetRequest(String email) {
    }

    public record ResetConfirmRequest(String token, String password) {
    }

    private final AuthService authService;
    private final MfaService mfaService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, MfaService mfaService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.mfaService = mfaService;
        this.passwordResetService = passwordResetService;
    }

    private static Map<String, Object> loginBody(AuthService.LoginResult result) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", result.token());
        response.put("expiresAt", result.expiresAt() == null ? null : result.expiresAt().toString());
        response.put("user", result.user());
        response.put("tenant", result.tenant());
        response.put("mfaRequired", result.mfaRequired());
        response.put("challenge", result.challenge());
        return response;
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginRequest body, HttpServletRequest request) {
        return loginBody(authService.login(body.email(), body.password(), request.getRemoteAddr()));
    }

    /** Second sign-in step: { challenge, code } from an authenticator app or a recovery code. */
    @PostMapping("/mfa/verify")
    public Map<String, Object> verifyMfa(@RequestBody MfaVerifyRequest body) {
        return loginBody(authService.verifyMfaLogin(body.challenge(), body.code()));
    }

    @GetMapping("/mfa")
    public Map<String, Object> mfaStatus(HttpServletRequest request) {
        return Map.of("enabled", mfaService.isEnabled(AuthInterceptor.principal(request)));
    }

    @PostMapping("/mfa/setup")
    public MfaService.Setup mfaSetup(HttpServletRequest request) {
        return mfaService.setup(AuthInterceptor.principal(request));
    }

    @PostMapping("/mfa/enable")
    public Map<String, Object> mfaEnable(@RequestBody CodeRequest body, HttpServletRequest request) {
        List<String> codes = mfaService.enable(AuthInterceptor.principal(request), body.code());
        return Map.of("recoveryCodes", codes);
    }

    @PostMapping("/mfa/disable")
    public ResponseEntity<Void> mfaDisable(@RequestBody CodeRequest body, HttpServletRequest request) {
        mfaService.disable(AuthInterceptor.principal(request), body.code());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/request")
    public ResponseEntity<Void> requestReset(@RequestBody ResetRequest body, HttpServletRequest request) {
        passwordResetService.request(body.email(), request.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Void> confirmReset(@RequestBody ResetConfirmRequest body) {
        passwordResetService.confirm(body.token(), body.password());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public Map<String, Object> me(HttpServletRequest request) {
        Principal principal = AuthInterceptor.principal(request);
        AuthService.Identity identity = authService.me(principal);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", identity.user());
        response.put("tenant", identity.tenant());
        return response;
    }

    /** Changes the password, signs out other devices and returns a new token for this device: { token, expiresAt }. */
    @PostMapping("/change-password")
    public Map<String, Object> changePassword(@RequestBody ChangePasswordRequest body, HttpServletRequest request) {
        TokenService.Issued issued = authService.changePassword(AuthInterceptor.principal(request), body.currentPassword(), body.newPassword());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("token", issued.token());
        response.put("expiresAt", issued.expiresAt().toString());
        return response;
    }

    /** Ends this session: the token stops working immediately. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        authService.logout(AuthInterceptor.principal(request));
        return ResponseEntity.noContent().build();
    }

    /** Signs the caller out on every device. */
    @PostMapping("/logout-all")
    public ResponseEntity<Void> logoutAll(HttpServletRequest request) {
        authService.logoutEverywhere(AuthInterceptor.principal(request));
        return ResponseEntity.noContent().build();
    }
}
