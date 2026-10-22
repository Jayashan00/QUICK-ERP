package com.quickerp.core;

/** Password hashing abstraction (BCrypt in the running application). */
public interface PasswordHasher {

    String hash(String rawPassword);

    boolean matches(String rawPassword, String hash);
}
