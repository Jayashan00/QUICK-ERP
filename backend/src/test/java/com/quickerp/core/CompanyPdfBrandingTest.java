package com.quickerp.core;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CompanyPdfBrandingTest {

    @Test
    void decodesLogoBytesFromDataUrl() throws Exception {
        byte[] sample = createSamplePngBytes();
        String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(sample);

        byte[] decoded = CompanyPdfBranding.decodeLogoBytes(dataUrl);
        assertNotNull(decoded);
        assertArrayEquals(sample, decoded);
    }

    @Test
    void decodesLogoBytesWithWhitespaceAndNewlines() throws Exception {
        byte[] sample = createSamplePngBytes();
        String base64 = Base64.getEncoder().encodeToString(sample);
        String formatted = "data:image/png;base64,\n  " + base64.substring(0, base64.length() / 2)
                + "\r\n  " + base64.substring(base64.length() / 2) + "\n";

        byte[] decoded = CompanyPdfBranding.decodeLogoBytes(formatted);
        assertNotNull(decoded);
        assertArrayEquals(sample, decoded);
    }

    @Test
    void handlesNullOrInvalidLogoGracefully() {
        assertNull(CompanyPdfBranding.decodeLogoBytes(null));
        assertNull(CompanyPdfBranding.decodeLogoBytes(""));
        assertNull(CompanyPdfBranding.decodeLogoBytes("   "));
        assertNull(CompanyPdfBranding.decodeLogoBytes("not-a-valid-data-url"));
    }

    @Test
    void createsPdImageObjectSuccessfully() throws Exception {
        byte[] sample = createSamplePngBytes();
        try (PDDocument document = new PDDocument()) {
            PDImageXObject image = CompanyPdfBranding.createImage(document, sample);
            assertNotNull(image);
            assertEquals(16, image.getWidth());
            assertEquals(16, image.getHeight());
        }
    }

    @Test
    void createsPdImageObjectReturnsNullOnInvalidBytes() {
        try (PDDocument document = new PDDocument()) {
            assertNull(CompanyPdfBranding.createImage(document, null));
            assertNull(CompanyPdfBranding.createImage(document, new byte[]{1, 2, 3, 4}));
        } catch (Exception e) {
            fail("Should not throw: " + e.getMessage());
        }
    }

    private static byte[] createSamplePngBytes() throws Exception {
        BufferedImage image = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(Color.BLUE);
        g.fillRect(0, 0, 16, 16);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", out);
        return out.toByteArray();
    }
}
