package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Issues and verifies HS256-signed JSON Web Tokens. */
public final class TokenService {

    /** Claims of a verified token. {@code version} is matched against app_users.token_version on every request. */
    public record Claims(String userId, String tenantId, boolean superAdmin, Instant expiresAt, long version, String tokenId) {
    }

    public record Issued(String token, Instant expiresAt) {
    }

    private static final String ISSUER = "quick-erp";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private final byte[] key;
    private final long ttlSeconds;
    private final ObjectMapper mapper;

    public TokenService(String secret, long ttlHours, ObjectMapper mapper) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalArgumentException("The JWT secret must be at least 32 bytes long.");
        }
        if (ttlHours <= 0) throw new IllegalArgumentException("The token lifetime must be positive.");
        this.key = secret.getBytes(StandardCharsets.UTF_8);
        this.ttlSeconds = ttlHours * 3600L;
        this.mapper = mapper;
    }

    private static final String ACCESS = "access";
    private static final String MFA_CHALLENGE = "mfa";
    private static final long CHALLENGE_SECONDS = 300;

    /** Issues a session token for token version 0. */
    public Issued issue(String userId, String tenantId, boolean superAdmin) {
        return issue(userId, tenantId, superAdmin, 0L);
    }

    /** Issues a session token. Raising the user's token version later revokes it. */
    public Issued issue(String userId, String tenantId, boolean superAdmin, long version) {
        return issue(userId, tenantId, superAdmin, ACCESS, ttlSeconds, version);
    }

    /** Issues a short-lived token that only allows completing two-factor sign-in. */
    public Issued issueChallenge(String userId, String tenantId, boolean superAdmin) {
        return issueChallenge(userId, tenantId, superAdmin, 0L);
    }

    public Issued issueChallenge(String userId, String tenantId, boolean superAdmin, long version) {
        return issue(userId, tenantId, superAdmin, MFA_CHALLENGE, CHALLENGE_SECONDS, version);
    }

    /** Returns the claims of a valid, unexpired session token, or null. */
    public Claims verify(String token) {
        return verify(token, ACCESS);
    }

    /** Returns the claims of a valid, unexpired two-factor challenge token, or null. */
    public Claims verifyChallenge(String token) {
        return verify(token, MFA_CHALLENGE);
    }

    private Issued issue(String userId, String tenantId, boolean superAdmin, String type, long lifetimeSeconds, long version) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(lifetimeSeconds);
        ObjectNode header = mapper.createObjectNode().put("alg", "HS256").put("typ", "JWT");
        ObjectNode payload = mapper.createObjectNode()
                .put("iss", ISSUER)
                .put("sub", userId)
                .put("tid", tenantId)
                .put("sa", superAdmin)
                .put("typ", type)
                .put("ver", version)
                .put("jti", UUID.randomUUID().toString())
                .put("iat", now.getEpochSecond())
                .put("exp", expiresAt.getEpochSecond());
        String unsigned = encode(header) + "." + encode(payload);
        return new Issued(unsigned + "." + ENCODER.encodeToString(sign(unsigned)), expiresAt);
    }

    private Claims verify(String token, String expectedType) {
        if (token == null) return null;
        String[] parts = token.split("\\.");
        if (parts.length != 3) return null;
        try {
            byte[] expected = sign(parts[0] + "." + parts[1]);
            byte[] actual = DECODER.decode(parts[2]);
            if (!MessageDigest.isEqual(expected, actual)) return null;
            JsonNode header = mapper.readTree(DECODER.decode(parts[0]));
            if (!"HS256".equals(header.path("alg").asText())) return null;
            JsonNode payload = mapper.readTree(DECODER.decode(parts[1]));
            if (!ISSUER.equals(payload.path("iss").asText())) return null;
            if (!expectedType.equals(payload.path("typ").asText())) return null;
            long exp = payload.path("exp").asLong(0);
            if (exp <= Instant.now().getEpochSecond()) return null;
            String userId = payload.path("sub").asText("");
            String tenantId = payload.path("tid").asText("");
            if (userId.isEmpty() || tenantId.isEmpty()) return null;
            // Tokens issued before token versions existed carry no "ver" and count as version 0.
            return new Claims(userId, tenantId, payload.path("sa").asBoolean(false), Instant.ofEpochSecond(exp),
                    payload.path("ver").asLong(0), payload.path("jti").asText(null));
        } catch (IllegalArgumentException | java.io.IOException error) {
            return null;
        }
    }

    private String encode(JsonNode node) {
        try {
            return ENCODER.encodeToString(mapper.writeValueAsBytes(node));
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalStateException(error);
        }
    }

    private byte[] sign(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(content.getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("HMAC-SHA256 is not available.", error);
        }
    }
}
