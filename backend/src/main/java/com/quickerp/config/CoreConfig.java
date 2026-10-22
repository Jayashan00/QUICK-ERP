package com.quickerp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.core.AccessPolicy;
import com.quickerp.core.AccessRules;
import com.quickerp.core.CollectionRule;
import com.quickerp.core.AuthService;
import com.quickerp.core.CoreSettings;
import com.quickerp.core.Db;
import com.quickerp.core.FileStore;
import com.quickerp.core.Mailer;
import com.quickerp.core.MfaService;
import com.quickerp.core.PasswordResetService;
import com.quickerp.core.PasswordHasher;
import com.quickerp.core.ProvisioningService;
import com.quickerp.core.SeedService;
import com.quickerp.core.StateStore;
import com.quickerp.core.TokenService;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

/** Wires the framework-independent core services. */
@Configuration
public class CoreConfig {

    private static final Logger log = LoggerFactory.getLogger(CoreConfig.class);

    @Bean
    public Db db(DataSource dataSource) {
        return new Db(dataSource);
    }

    @Bean
    public PasswordHasher passwordHasher() {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);
        return new PasswordHasher() {
            @Override
            public String hash(String rawPassword) {
                return encoder.encode(rawPassword);
            }

            @Override
            public boolean matches(String rawPassword, String hash) {
                if (rawPassword == null || hash == null || hash.isBlank()) return false;
                return encoder.matches(rawPassword, hash);
            }
        };
    }

    @Bean
    public CoreSettings coreSettings(AppProperties properties, @Value("${spring.datasource.password:}") String databasePassword) {
        List<String> problems = ProductionGuard.problems(properties, databasePassword);
        if (!problems.isEmpty()) {
            problems.forEach(problem -> log.error("Unsafe production setting: {}", problem));
            throw new IllegalStateException("Quick ERP will not start in production with unsafe settings:\n - " + String.join("\n - ", problems));
        }
        String secret = properties.getJwt().getSecret();
        if (secret == null || secret.isBlank()) {
            byte[] random = new byte[48];
            new SecureRandom().nextBytes(random);
            secret = Base64.getEncoder().encodeToString(random);
            log.warn("JWT_SECRET is not set. A random secret is used, so everyone must sign in again after each restart. "
                    + "Set JWT_SECRET (at least 32 characters) in production.");
        } else if (secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters long.");
        }
        return new CoreSettings(
                secret,
                properties.getJwt().getTtlHours(),
                properties.getUsers().getInitialPassword(),
                properties.getSecurity().getMaxLoginFailures(),
                properties.getSecurity().getLockMinutes(),
                properties.getState().getMaxRecordBytes(),
                properties.getState().getMaxBatchChanges(),
                properties.getState().isHistoryEnabled(),
                clean(properties.getState().getSharedCollections()),
                clean(properties.getPublicShop().getReadableCollections()),
                clean(properties.getPublicShop().getWritableCollections()),
                properties.getPublicShop().getWritesPerMinute(),
                List.copyOf(clean(properties.getProvision().getCopyCollections())),
                properties.getMail().getPasswordResetUrl(),
                properties.getFiles().getMaxBytes());
    }

    private static Set<String> clean(List<String> values) {
        Set<String> result = new LinkedHashSet<>();
        if (values != null) values.stream().filter(value -> value != null && !value.isBlank()).map(String::trim).forEach(result::add);
        return Set.copyOf(result);
    }

    @Bean
    public TokenService tokenService(CoreSettings settings, ObjectMapper mapper) {
        return new TokenService(settings.jwtSecret(), settings.tokenTtlHours(), mapper);
    }

    @Bean
    public AccessRules accessRules(ObjectMapper mapper) {
        return new AccessRules(mapper);
    }

    /** Who may read and write each collection (app.access in application.yml). */
    @Bean
    public AccessPolicy accessPolicy(AppProperties properties) {
        List<CollectionRule> rules = properties.getAccess().getRules().stream()
                .map(rule -> new CollectionRule(rule.getCollection(), rule.getRead(), rule.getWrite(), rule.isAppendOnly(),
                        rule.getRedactFields(), rule.getRedactUnless(), rule.isPlatformOnly()))
                .toList();
        AccessPolicy policy = new AccessPolicy(rules, clean(properties.getAccess().getServerSeededCollections()),
                clean(properties.getAccess().getDefaultCreatableCollections()));
        log.info("Loaded {} collection access rules.", rules.size());
        return policy;
    }

    @Bean
    public MfaService mfaService(Db db, ObjectMapper mapper, AccessRules access) {
        return new MfaService(db, mapper, access);
    }

    @Bean
    public AuthService authService(Db db, ObjectMapper mapper, PasswordHasher hasher, TokenService tokens, AccessRules access,
                                   CoreSettings settings, MfaService mfaService) {
        return new AuthService(db, mapper, hasher, tokens, access, settings, mfaService);
    }

    /** Sends email through the configured SMTP server (spring.mail.*); without one, the message is written to the log. */
    @Bean
    public Mailer mailer(ObjectProvider<JavaMailSender> senders, AppProperties properties) {
        return (to, subject, body) -> {
            JavaMailSender sender = senders.getIfAvailable();
            if (sender == null) {
                if (properties.isProduction()) {
                    // Never write message bodies (they can contain password reset links) to production logs.
                    log.error("Email is not configured (set SPRING_MAIL_HOST). The message \"{}\" to {} was not sent.", subject, to);
                } else {
                    log.warn("Email is not configured (set SPRING_MAIL_HOST). Message for {} - {}:\n{}", to, subject, body);
                }
                return;
            }
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(properties.getMail().getFrom());
                message.setTo(to);
                message.setSubject(subject);
                message.setText(body);
                sender.send(message);
            } catch (RuntimeException error) {
                log.error("Could not send email to {}", to, error);
            }
        };
    }

    @Bean
    public PasswordResetService passwordResetService(Db db, PasswordHasher hasher, Mailer mailer, CoreSettings settings) {
        return new PasswordResetService(db, hasher, mailer, settings);
    }

    @Bean
    public FileStore fileStore(Db db, CoreSettings settings) {
        return new FileStore(db, settings.maxFileBytes());
    }

    @Bean
    public StateStore stateStore(Db db, ObjectMapper mapper, CoreSettings settings, PasswordHasher hasher, AccessRules access,
                                 AccessPolicy accessPolicy) {
        return new StateStore(db, mapper, settings, hasher, access, accessPolicy);
    }

    @Bean
    public ProvisioningService provisioningService(Db db, ObjectMapper mapper, PasswordHasher hasher, CoreSettings settings) {
        return new ProvisioningService(db, mapper, hasher, settings);
    }

    @Bean
    public SeedService seedService(Db db, ObjectMapper mapper, PasswordHasher hasher) {
        return new SeedService(db, mapper, hasher);
    }

    /** Creates the starter tenant, its users and its data the first time the application starts on an empty database. */
    @Bean
    public ApplicationRunner starterDataRunner(AppProperties properties, SeedService seedService) {
        return arguments -> {
            if (!properties.getSeed().isEnabled()) return;
            ClassPathResource starter = new ClassPathResource("seed/starter-data.json");
            try (InputStream accounts = new ClassPathResource("seed/seed-data.json").getInputStream();
                 InputStream data = starter.exists() ? starter.getInputStream() : null) {
                SeedService.Result result = seedService.seedIfEmpty(accounts, data, properties.getSeed().getDefaultPassword(),
                        properties.getSeed().isDemoData(), properties.getProvision().getCopyCollections());
                if (result.users() > 0) {
                    log.warn("Created {} starter users (for example admin@quickerp.test and superadmin@quickerp.test) and {} starter "
                            + "collections ({} data). Change the starter passwords before going live.", result.users(), result.collections(),
                            properties.getSeed().isDemoData() ? "demo" : "configuration only");
                }
            }
        };
    }
}
