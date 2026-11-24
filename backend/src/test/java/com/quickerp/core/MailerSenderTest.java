package com.quickerp.core;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/** Company emails show the company's name and send replies to the company; malformed values never reach headers. */
class MailerSenderTest {

    private static CompanyPdfBranding company(String name, String email) {
        return new CompanyPdfBranding(name, null, null, null, email, null, null, null, null, null);
    }

    @Test
    void companyEmailsUseTheCompanyNameAndReplyToTheCompany() {
        Mailer.Sender sender = Mailer.Sender.company(company("Nimal Stores", "nimalstores@gmail.com"));
        assertEquals("Nimal Stores via Vyro ERP", sender.displayName());
        assertEquals("nimalstores@gmail.com", sender.replyTo());
    }

    @Test
    void withoutAValidCompanyEmailRepliesAreNotRedirected() {
        assertNull(Mailer.Sender.company(company("Nimal Stores", null)).replyTo());
        assertNull(Mailer.Sender.company(company("Nimal Stores", "not an email")).replyTo());
        assertNull(Mailer.Sender.company(company("Nimal Stores", "a@b.lk, attacker@evil.com")).replyTo());
    }

    @Test
    void headerInjectionAndOddNamesAreNeutralised() {
        Mailer.Sender sender = Mailer.Sender.company(company("Evil\r\nBcc: victim@x.com", "ok@shop.lk\r\nBcc: v@x.com"));
        assertEquals("Evil Bcc: victim@x.com via Vyro ERP", sender.displayName());
        assertNull(sender.replyTo());
        assertEquals("Vyro ERP", Mailer.Sender.company(company("   ", null)).displayName());
        assertEquals("Vyro ERP", Mailer.Sender.company(null).displayName());
        assertEquals(60 + " via Vyro ERP".length(), Mailer.Sender.company(company("x".repeat(200), null)).displayName().length());
        assertEquals("Vyro ERP", Mailer.Sender.PLATFORM.displayName());
    }
}
