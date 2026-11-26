package com.quickerp.ai.data;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickerp.ai.AiModels.AccessContext;
import com.quickerp.config.AppProperties;
import com.quickerp.core.ApiException;
import com.quickerp.core.Db;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Statement;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.postgresql.ds.PGSimpleDataSource;
import static com.quickerp.ai.data.ErpQueryRequest.*;
import static org.junit.jupiter.api.Assertions.*;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ErpQueryEngineIntegrationTest {
    private final String schema = "ai_query_" + UUID.randomUUID().toString().replace("-", "");
    private PGSimpleDataSource source;
    private final ObjectMapper mapper = new ObjectMapper();
    private ErpQueryEngine engine;
    private AccessContext scope;

    @BeforeAll void setup() throws Exception {
        String url = System.getenv("QUICKERP_TEST_DB_URL");
        Assumptions.assumeTrue(url != null && !url.isBlank(), "Set QUICKERP_TEST_DB_URL for PostgreSQL tests.");
        PGSimpleDataSource admin = new PGSimpleDataSource(); admin.setURL(url);
        try (Connection c = admin.getConnection(); Statement s = c.createStatement()) { s.execute("CREATE SCHEMA " + schema); }
        source = new PGSimpleDataSource(); source.setURL(url); source.setCurrentSchema(schema);
        List<Path> migrations;
        try (var paths = Files.list(Path.of("src/main/resources/db/migration"))) {
            migrations = paths.sorted(Comparator.comparingInt(p -> Integer.parseInt(p.getFileName().toString().replaceAll("^V(\\d+)__.*", "$1")))).toList();
        }
        try (Connection c = source.getConnection(); Statement s = c.createStatement()) {
            for (Path migration : migrations) s.execute(Files.readString(migration));
            s.execute("INSERT INTO tenants(id,name) VALUES ('tenant-a','A'),('tenant-b','B')");
        }
        Db db = new Db(source);
        db.tx(c -> {
            put(c,"tenant-a","customers.records","customer-a","{\"id\":\"customer-a\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"name\":\"John\",\"status\":\"active\",\"email\":\"private@example.test\"}",false);
            put(c,"tenant-a","core.branches","branch-a","{\"id\":\"branch-a\",\"tenantId\":\"tenant-a\",\"name\":\"Colombo\",\"code\":\"CMB\"}",false);
            put(c,"tenant-a","core.branches","branch-b","{\"id\":\"branch-b\",\"tenantId\":\"tenant-a\",\"name\":\"Kandy\",\"code\":\"KDY\"}",false);
            put(c,"tenant-a","customers.records","customer-b","{\"id\":\"customer-b\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-b\",\"name\":\"Other branch\"}",false);
            put(c,"tenant-b","customers.records","customer-other","{\"id\":\"customer-other\",\"tenantId\":\"tenant-b\",\"branchId\":\"branch-a\",\"name\":\"Other tenant\"}",false);
            put(c,"tenant-a","customers.records","deleted","{\"id\":\"deleted\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"name\":\"Deleted\"}",true);
            put(c,"tenant-a","customers.records","__order__","[\"customer-a\",\"customer-b\"]",false);
            put(c,"tenant-a","customers.records","__value__","{\"id\":\"hidden-metadata\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"name\":\"Internal value\"}",false);
            put(c,"tenant-a","suppliers.records","__all__","[{\"id\":\"supplier-a\",\"tenantId\":\"tenant-a\",\"name\":\"Supplier One\",\"bankDetails\":{\"accountNumber\":\"SECRET\"}},{\"id\":\"supplier-b\",\"tenantId\":\"tenant-a\",\"name\":\"Supplier Two\"}]",false);
            put(c,"tenant-a","products.records","product-a","{\"id\":\"product-a\",\"tenantId\":\"tenant-a\",\"sku\":\"P-1\",\"name\":\"Widget\"}",false);
            put(c,"tenant-a","products.records","__all__","[{\"id\":\"product-a\",\"tenantId\":\"tenant-a\",\"name\":\"Widget\"}]",false);
            put(c,"tenant-a","sales.invoices","invoice-a","{\"id\":\"invoice-a\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"customerId\":\"customer-a\",\"invoiceDate\":\"2026-10-15\",\"status\":\"posted\",\"currency\":\"USD\",\"totalAmount\":100.10}",false);
            put(c,"tenant-a","sales.invoices","invoice-b","{\"id\":\"invoice-b\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"customerId\":\"customer-a\",\"invoiceDate\":\"2026-09-15\",\"status\":\"paid\",\"currency\":\"USD\",\"totalAmount\":29.90}",false);
            put(c,"tenant-a","sales.invoices","invoice-c","{\"id\":\"invoice-c\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"customerId\":\"customer-a\",\"invoiceDate\":\"2026-10-16\",\"status\":\"posted\",\"currency\":\"LKR\",\"totalAmount\":2000}",false);
            put(c,"tenant-a","sales.invoices","invoice-d","{\"id\":\"invoice-d\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"status\":\"draft\",\"currency\":\"USD\",\"totalAmount\":500}",false);
            put(c,"tenant-a","sales.invoices","invoice-e","{\"id\":\"invoice-e\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-b\",\"status\":\"posted\",\"currency\":\"USD\",\"totalAmount\":999}",false);
            put(c,"tenant-a","purchases.orders","po-a","{\"id\":\"po-a\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"supplierId\":\"supplier-a\",\"status\":\"issued\"}",false);
            put(c,"tenant-a","purchases.receipts","grn-a","{\"id\":\"grn-a\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"purchaseOrderId\":\"po-a\",\"status\":\"completed\"}",false);
            put(c,"tenant-a","inventory.balances","stock-a","{\"id\":\"stock-a\",\"tenantId\":\"tenant-a\",\"branchId\":\"branch-a\",\"productId\":\"product-a\",\"quantityAvailable\":12.5}",false);
            return null;
        });
        engine = new ErpQueryEngine(db, mapper, new AppProperties.Ai());
        scope = new AccessContext("tenant-a","user-a","role-a", Set.of("customers.view","suppliers.suppliers.view","products.view","sales.view","purchase.view","grn.view","inventory.stock.view"),
                Set.of("chatbot","customers","suppliers","products","sales","purchases","inventory","stock"),List.of("branch-a"),"branch-a");
    }
    private static void put(Connection c,String tenant,String collection,String id,String json,boolean deleted) throws Exception {
        try (var s=c.prepareStatement("INSERT INTO erp_records(tenant_id,collection,record_id,data,deleted,change_seq) VALUES(?,?,?,?::jsonb,?,nextval('erp_change_seq'))")) {
            s.setString(1,tenant);s.setString(2,collection);s.setString(3,id);s.setString(4,json);s.setBoolean(5,deleted);s.executeUpdate();
        }
    }
    @AfterAll void cleanup() throws Exception {
        if (source == null) return;
        try (Connection c=source.getConnection();Statement s=c.createStatement()) {s.execute("DROP SCHEMA " + schema + " CASCADE");}
    }
    private Filter f(String field,String op,String json) throws Exception {return new Filter(field,op,mapper.readTree(json));}

    @Test void discoverySchemaAndTenantBranchIsolation() throws Exception {
        assertTrue(engine.discover(scope).path("data").size() >= 6);
        assertEquals(404,assertThrows(ApiException.class,()->engine.schema("employees",scope)).getStatus());
        assertFalse(engine.schema("suppliers",scope).toString().contains("bankDetails"));
        Query customers = new Query("customers",List.of("id","name"),List.of(),"and",List.of(),null,25,0,null);
        var result = engine.query(customers,scope);
        assertEquals(1,result.path("count").asInt());
        assertEquals("branch-a",engine.resolveBranch("Colombo",scope).path("data").path("branchId").asText());
        assertEquals(404,assertThrows(ApiException.class,()->engine.resolveBranch("Kandy",scope)).getStatus());
        assertEquals("John",result.path("data").get(0).path("name").asText());
        assertFalse(result.toString().contains("private@example.test"));
        assertEquals(403,assertThrows(ApiException.class,()->engine.query(new Query("customers",null,List.of(),"and",List.of(),null,25,0,List.of("branch-b")),scope)).getStatus());
        assertEquals(1,engine.query(new Query("products",null,List.of(),"and",List.of(),null,25,0,null),scope).path("count").asInt());
        assertEquals(2,engine.query(new Query("suppliers",null,List.of(),"and",List.of(),null,25,0,null),scope).path("count").asInt());
    }

    @Test void filtersSearchSortingPaginationAndValidation() throws Exception {
        var invoices = engine.query(new Query("sales_invoices",List.of("id","totalAmount"),
                List.of(f("status","eq","\"posted\""),f("invoiceDate","between","[\"2026-10-01\",\"2026-11-01\"]")),"and",
                List.of(new Sort("totalAmount","desc")),null,1,0,null),scope);
        assertEquals(2,invoices.path("count").asInt());
        assertEquals("invoice-c",invoices.path("data").get(0).path("id").asText());
        assertTrue(invoices.path("truncated").asBoolean());
        assertEquals(1,engine.query(new Query("customers",null,List.of(),"and",List.of(),"Joh",25,0,null),scope).path("count").asInt());
        var matches = engine.search(new Search(List.of("customers","suppliers"),"John",5),scope);
        assertEquals(2,matches.path("data").size());
        assertEquals(1,matches.path("data").get(0).path("count").asInt());
        assertEquals(0,engine.query(new Query("customers",null,List.of(f("name","eq","\"Nobody\"")),"and",List.of(),null,25,0,null),scope).path("count").asInt());
        assertEquals(422,assertThrows(ApiException.class,()->engine.query(new Query("customers",List.of("passwordHash"),List.of(),"and",List.of(),null,25,0,null),scope)).getStatus());
        assertEquals(422,assertThrows(ApiException.class,()->engine.query(new Query("customers",null,List.of(f("name","regex","\".*\"")),"and",List.of(),null,25,0,null),scope)).getStatus());
        assertEquals(422,assertThrows(ApiException.class,()->engine.query(new Query("customers",null,List.of(),"and",List.of(),null,1000,0,null),scope)).getStatus());
        assertEquals(404,assertThrows(ApiException.class,()->engine.schema("customers'; DROP TABLE erp_records; --",scope)).getStatus());
    }

    @Test void aggregationIsDecimalAndCurrencySafe() throws Exception {
        Aggregate request = new Aggregate("sales_invoices",List.of(f("status","in","[\"posted\",\"paid\"]")),"and",null,"sum","totalAmount",null,null);
        var result = engine.aggregate(request,scope);
        assertEquals(2,result.path("data").size());
        assertTrue(result.toString().contains("LKR"));
        assertTrue(result.toString().contains("USD"));
        assertFalse(result.toString().contains("2129.99"));
        assertEquals(422,assertThrows(ApiException.class,()->engine.aggregate(new Aggregate("sales_invoices",List.of(),"and",null,"sum","totalAmount",null,null),scope)).getStatus());
        var stock = engine.aggregate(new Aggregate("stock_balances",List.of(),"and",null,"sum","quantityAvailable",null,null),scope);
        assertEquals("12.5",stock.path("data").get(0).path("value").decimalValue().stripTrailingZeros().toPlainString());
        var grouped = engine.aggregate(new Aggregate("sales_invoices",List.of(),"and",null,"count",null,"status",null),scope);
        assertTrue(grouped.path("data").size() >= 2);
    }

    @Test void verifiedRelationshipsRemainScoped() throws Exception {
        var related = engine.related(new Related("customers","customer-a","sales_invoices",25),scope);
        assertEquals(3,related.path("count").asInt());
        assertEquals(1,engine.related(new Related("purchase_orders","po-a","goods_receipts",25),scope).path("count").asInt());
        assertEquals(422,assertThrows(ApiException.class,()->engine.related(new Related("customers","customer-a","employees",25),scope)).getStatus());
        assertEquals(404,assertThrows(ApiException.class,()->engine.related(new Related("customers","customer-b","sales_invoices",25),scope)).getStatus());
    }

    @Test void comparesIdenticalMetricsAcrossPeriodsWithoutMixingCurrencies() throws Exception {
        Aggregate metric = new Aggregate("sales_invoices",List.of(f("status","in","[\"posted\",\"paid\"]"),
                f("currency","eq","\"USD\"")),"and",null,"sum","totalAmount",null,null);
        Compare request = new Compare(metric,"invoiceDate",List.of(new Period("October","2026-10-01","2026-11-01"),
                new Period("September","2026-09-01","2026-10-01")));
        var result = engine.compare(request,scope);
        assertEquals(0,new java.math.BigDecimal("70.20").compareTo(result.path("difference").path("absolute").decimalValue()));
        assertEquals("up",result.path("difference").path("direction").asText());
    }
}
