package com.quickerp.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AiGroundingGuardTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void blocksInventedMonetaryFiguresButAllowsVerifiedFormatting() throws Exception {
        var data = mapper.readTree("{\"data\":[{\"currency\":\"LKR\",\"value\":850000.00,\"count\":5},{\"currency\":\"USD\",\"value\":100.10}]}");
        assertTrue(AiGroundingGuard.monetaryClaimsSupported("LKR 850,000 and 100.10 USD", data));
        assertFalse(AiGroundingGuard.monetaryClaimsSupported("LKR 950,000", data));
        assertFalse(AiGroundingGuard.monetaryClaimsSupported("USD 850,000", data));
        assertFalse(AiGroundingGuard.monetaryClaimsSupported("LKR 5", data));
        assertFalse(AiGroundingGuard.monetaryClaimsSupported("USD 850,000, LKR 950,000", data));
        assertFalse(AiGroundingGuard.monetaryClaimsSupported("Your revenue was LKR 850,000", null));
    }
}
