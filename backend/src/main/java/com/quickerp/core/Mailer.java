package com.quickerp.core;

/** Sends email through the server-side SMTP configuration. */
public interface Mailer {

    boolean configured();

    void send(String to, String subject, String body);

    void sendWithAttachment(String to, String subject, String body, String attachmentName,
                            String attachmentContentType, byte[] attachment);
}
