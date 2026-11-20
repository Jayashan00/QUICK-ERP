package com.quickerp.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

/**
 * Company profile and branding (logo, business info, contacts) used when generating
 * tenant-scoped customer and sales document PDFs.
 */
public record CompanyPdfBranding(
        String companyName,
        String legalName,
        String registrationNumber,
        String taxNumber,
        String email,
        String phone,
        String website,
        String address,
        String logoUrl,
        byte[] logoBytes
) {

    public static CompanyPdfBranding load(Connection connection, String tenantId, ObjectMapper mapper) throws SQLException {
        ObjectNode company = loadCompanyNode(connection, tenantId, mapper);
        String tenantFallbackName = Sql.queryString(connection, "SELECT name FROM tenants WHERE id = ?", tenantId);
        String tenantProfileText = Sql.queryString(connection, "SELECT profile::text FROM tenants WHERE id = ?", tenantId);
        JsonNode tenantProfile = tenantProfileText != null ? Sql.readJson(mapper, tenantProfileText) : null;

        String name = firstNonBlank(
                text(company, "name"),
                text(company, "legalName"),
                text(tenantProfile, "name"),
                tenantFallbackName,
                "Quick ERP");
        String legalName = firstNonBlank(text(company, "legalName"), text(company, "name"), name);
        String registrationNumber = firstNonBlank(text(company, "registrationNumber"), text(tenantProfile, "registrationNumber"));
        String taxNumber = firstNonBlank(text(company, "taxNumber"), text(tenantProfile, "taxNumber"));
        String email = firstNonBlank(text(company, "email"), text(tenantProfile, "email"), text(tenantProfile, "ownerEmail"));
        String phone = firstNonBlank(text(company, "phone"), text(tenantProfile, "phone"));
        String website = firstNonBlank(text(company, "website"), text(tenantProfile, "website"));
        String logoUrl = firstNonBlank(text(company, "logoUrl"), text(tenantProfile, "logoUrl"));

        String address = formatAddress(company != null ? company.path("address") : null);
        if (address == null && tenantProfile != null) {
            address = formatAddress(tenantProfile.path("address"));
        }

        byte[] logoBytes = decodeLogoBytes(logoUrl);

        return new CompanyPdfBranding(
                name,
                legalName,
                registrationNumber,
                taxNumber,
                email,
                phone,
                website,
                address,
                logoUrl,
                logoBytes);
    }

    private static ObjectNode loadCompanyNode(Connection connection, String tenantId, ObjectMapper mapper) throws SQLException {
        String value = Sql.queryString(connection,
                "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = 'settings.company' AND NOT deleted AND record_id NOT LIKE '__%' ORDER BY change_seq DESC LIMIT 1",
                tenantId);
        if (value == null) {
            value = Sql.queryString(connection,
                    "SELECT data::text FROM erp_records WHERE tenant_id = ? AND collection = 'settings.company' AND NOT deleted ORDER BY change_seq DESC LIMIT 1",
                    tenantId);
        }
        if (value == null) return null;
        JsonNode node = Sql.readJson(mapper, value);
        if (node instanceof ObjectNode object) return object;
        if (node instanceof ArrayNode array && !array.isEmpty() && array.get(0) instanceof ObjectNode object) return object;
        return null;
    }

    public static byte[] decodeLogoBytes(String logoUrl) {
        if (logoUrl == null || logoUrl.isBlank()) return null;
        try {
            String trimmed = logoUrl.trim();
            if (trimmed.startsWith("data:image/")) {
                int commaIndex = trimmed.indexOf(',');
                if (commaIndex > 0) {
                    String base64Part = trimmed.substring(commaIndex + 1).replaceAll("\\s+", "");
                    return Base64.getMimeDecoder().decode(base64Part);
                }
            } else if (trimmed.matches("^[A-Za-z0-9+/=\\r\\n\\s]+$") && trimmed.length() > 50) {
                return Base64.getMimeDecoder().decode(trimmed.replaceAll("\\s+", ""));
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public static PDImageXObject createImage(PDDocument document, byte[] logoBytes) {
        if (logoBytes == null || logoBytes.length == 0) return null;
        try {
            BufferedImage bim = ImageIO.read(new ByteArrayInputStream(logoBytes));
            if (bim == null) return null;
            int type = bim.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
            BufferedImage converted = new BufferedImage(bim.getWidth(), bim.getHeight(), type);
            Graphics2D g = converted.createGraphics();
            g.drawImage(bim, 0, 0, null);
            g.dispose();
            return LosslessFactory.createFromImage(document, converted);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String formatAddress(JsonNode addr) {
        if (addr == null || !addr.isObject()) return null;
        List<String> parts = new ArrayList<>();
        String street = text(addr, "street");
        String city = text(addr, "city");
        String state = text(addr, "state");
        String postalCode = text(addr, "postalCode");
        String country = text(addr, "country");
        if (street != null && !street.isBlank()) parts.add(street.trim());
        if (city != null && !city.isBlank()) parts.add(city.trim());
        if (state != null && !state.isBlank()) parts.add(state.trim());
        if (postalCode != null && !postalCode.isBlank()) parts.add(postalCode.trim());
        if (country != null && !country.isBlank()) parts.add(country.trim());
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode value = node.get(field);
        return value != null && !value.isNull() && !value.asText().isBlank() ? value.asText().trim() : null;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "";
    }
}
