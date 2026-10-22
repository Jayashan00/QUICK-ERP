package com.quickerp.core;

/** Sends plain-text email. */
public interface Mailer {

    void send(String to, String subject, String body);
}
