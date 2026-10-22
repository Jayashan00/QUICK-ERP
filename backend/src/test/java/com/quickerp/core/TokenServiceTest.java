package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class TokenServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final TokenService tokens = new TokenService("a-test-secret-that-is-long-enough-123", 1, mapper);

    @Test
    void issuedTokenVerifies() {
        TokenService.Issued issued = tokens.issue("usr-001", "tenant-001", false);
        TokenService.Claims claims = tokens.verify(issued.token());
        assertNotNull(claims);
        assertEquals("usr-001", claims.userId());
        assertEquals("tenant-001", claims.tenantId());
        assertEquals(false, claims.superAdmin());
    }

    @Test
    void tamperedTokenIsRejected() {
        String token = tokens.issue("usr-001", "tenant-001", false).token();
        String[] parts = token.split("\\.");
        String forged = parts[0] + "." + parts[1] + "." + parts[2].substring(0, parts[2].length() - 2) + "AA";
        assertNull(tokens.verify(forged));
        assertNull(tokens.verify("not-a-token"));
        assertNull(tokens.verify(null));
    }

    @Test
    void tokenFromAnotherSecretIsRejected() {
        TokenService other = new TokenService("another-test-secret-that-is-long-enough", 1, mapper);
        assertNull(tokens.verify(other.issue("usr-001", "tenant-001", true).token()));
    }

    @Test
    void challengeAndSessionTokensAreNotInterchangeable() {
        String challenge = tokens.issueChallenge("usr-001", "tenant-001", false).token();
        assertNull(tokens.verify(challenge));
        assertNotNull(tokens.verifyChallenge(challenge));
        assertNull(tokens.verifyChallenge(tokens.issue("usr-001", "tenant-001", false).token()));
    }

    @Test
    void totpMatchesKnownVector() {
        // RFC 6238 test secret "12345678901234567890" (base32 below) at T = 59 seconds -> 287082 (6 digits).
        String secret = Totp.base32("12345678901234567890".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        assertEquals("287082", Totp.code(secret, Totp.currentStep(59)));
        assertEquals(1L, Totp.matchStep(secret, "287082", 59));
        assertEquals(-1L, Totp.matchStep(secret, "000000", 59));
    }

    @Test
    void shortSecretIsRefused() {
        assertThrows(IllegalArgumentException.class, () -> new TokenService("short", 1, mapper));
    }

    @Test
    void templateTenantIdIsReplaced() throws Exception {
        var source = mapper.readTree("{\"id\":\"role-001\",\"tenantId\":\"tenant-001\",\"scope\":{\"tenantId\":\"tenant-001\"},\"tags\":[\"tenant-001\",\"x\"]}");
        var copy = ProvisioningService.replaceTenant(source, "tenant-001", "acme");
        assertEquals("acme", copy.path("tenantId").asText());
        assertEquals("acme", copy.path("scope").path("tenantId").asText());
        assertEquals("acme", copy.path("tags").get(0).asText());
        assertEquals("role-001", copy.path("id").asText());
        assertTrue(source.path("tenantId").asText().equals("tenant-001"));
    }

    @Test
    void tokensCarryVersionAndUniqueId() {
        TokenService.Claims first = tokens.verify(tokens.issue("usr-001", "tenant-001", false, 7).token());
        TokenService.Claims second = tokens.verify(tokens.issue("usr-001", "tenant-001", false, 7).token());
        assertEquals(7L, first.version());
        assertNotNull(first.tokenId());
        assertTrue(!first.tokenId().equals(second.tokenId()));
        assertEquals(0L, tokens.verify(tokens.issue("usr-001", "tenant-001", false).token()).version());
    }
}
