package com.quickerp.core;

import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/** Time-based one-time passwords (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits), compatible with authenticator apps. */
public final class Totp {

    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();
    public static final int STEP_SECONDS = 30;

    private Totp() {
    }

    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    public static long currentStep(long epochSeconds) {
        return Math.floorDiv(epochSeconds, STEP_SECONDS);
    }

    public static String code(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(base32Decode(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format("%06d", binary % 1_000_000);
        } catch (GeneralSecurityException error) {
            throw new IllegalStateException("HMAC-SHA1 is not available.", error);
        }
    }

    /** Returns the matching time step (one step of clock drift either way), or -1. */
    public static long matchStep(String secret, String code, long epochSeconds) {
        if (secret == null || code == null || !code.matches("\\d{6}")) return -1;
        long now = currentStep(epochSeconds);
        for (long step = now - 1; step <= now + 1; step++) {
            if (java.security.MessageDigest.isEqual(code(secret, step).getBytes(), code.getBytes())) return step;
        }
        return -1;
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte value : data) {
            buffer = (buffer << 8) | (value & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(ALPHABET.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(ALPHABET.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    static byte[] base32Decode(String text) {
        String clean = text.replace("=", "").replace(" ", "").toUpperCase(java.util.Locale.ROOT);
        ByteBuffer out = ByteBuffer.allocate(clean.length() * 5 / 8);
        int buffer = 0;
        int bits = 0;
        for (char character : clean.toCharArray()) {
            int value = ALPHABET.indexOf(character);
            if (value < 0) throw new IllegalArgumentException("Invalid base32 character.");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out.put((byte) ((buffer >> (bits - 8)) & 0xff));
                bits -= 8;
            }
        }
        byte[] result = new byte[out.position()];
        out.flip();
        out.get(result);
        return result;
    }
}
