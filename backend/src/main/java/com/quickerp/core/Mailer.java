package com.quickerp.core;

/** Sends email through the server-side SMTP configuration. */
public interface Mailer {

    /**
     * Who an email is sent on behalf of. The address is always the platform's own (MAIL_FROM), so emails pass
     * SPF/DKIM; customers see the company's name, and their replies go to the company's own email address.
     */
    record Sender(String displayName, String replyTo) {
        /** Platform emails (password setup and reset). */
        public static final Sender PLATFORM = new Sender("Vyro ERP", null);

        /** "<Company> via Vyro ERP", with replies to the company's email address when it has a valid one. */
        public static Sender company(CompanyPdfBranding company) {
            String name = company == null ? null : clean(company.companyName());
            String email = company == null ? null : clean(company.email());
            boolean validEmail = email != null && email.matches("[^\\s@<>\",;]+@[^\\s@<>\",;]+\\.[^\\s@<>\",;]+");
            String display = name == null ? "Vyro ERP" : truncate(name, 60) + " via Vyro ERP";
            return new Sender(display, validEmail ? email : null);
        }

        private static String clean(String value) {
            if (value == null) return null;
            String cleaned = value.replaceAll("[\\r\\n\\t\"<>]", " ").replaceAll(" {2,}", " ").trim();
            return cleaned.isEmpty() ? null : cleaned;
        }

        private static String truncate(String value, int max) {
            return value.length() <= max ? value : value.substring(0, max).trim();
        }
    }

    boolean configured();

    void send(String to, String subject, String body);

    /** Sends on behalf of {@code sender}; implementations without sender support ignore it. */
    default void send(String to, String subject, String body, Sender sender) {
        send(to, subject, body);
    }

    void sendWithAttachment(String to, String subject, String body, String attachmentName,
                            String attachmentContentType, byte[] attachment);

    /** Sends with an attachment on behalf of {@code sender}; implementations without sender support ignore it. */
    default void sendWithAttachment(String to, String subject, String body, String attachmentName,
                                    String attachmentContentType, byte[] attachment, Sender sender) {
        sendWithAttachment(to, subject, body, attachmentName, attachmentContentType, attachment);
    }
}
