package com.msframework.backend;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.core.util.DefaultIndenter;
import tools.jackson.core.util.DefaultPrettyPrinter;
import tools.jackson.core.util.Separators;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.JsonNodeFactory;
import tools.jackson.databind.node.ObjectNode;

import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Keeps the committed API contract ({@code api/openapi.json} at the repository root) in step with
 * the code. The live description from {@code /v3/api-docs} is normalised (keys sorted, two-space
 * indent, trailing newline) and compared with the file.
 *
 * <p>After an intended API change, regenerate the file and commit it with the change:</p>
 * <pre>./mvnw verify -Dopenapi.write=true</pre>
 * <p>({@code OPENAPI_WRITE=true} in the environment works too.)</p>
 */
@IntegrationTest
class OpenApiContractTest {

    private static final String CONTRACT = "api/openapi.json";
    private static final String REGENERATE =
            "cd backend && ./mvnw verify -Dopenapi.write=true   (or only this test: "
                    + "./mvnw test -Dtest=OpenApiContractTest -Dopenapi.write=true)";

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Autowired
    private MockMvc mvc;

    @Test
    void committedContractMatchesTheApi() throws Exception {
        // No session: the description must be reachable without signing in.
        String live = mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String actual = normalise(live);
        Path file = repositoryRoot().resolve(CONTRACT);

        if (writeRequested()) {
            Files.createDirectories(file.getParent());
            Files.writeString(file, actual, StandardCharsets.UTF_8);
            System.out.println("[openapi] Wrote " + file);
            return;
        }

        assertThat(Files.exists(file))
                .withFailMessage("%s does not exist. Generate it with:%n  %s", CONTRACT, REGENERATE)
                .isTrue();
        String expected = Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n");
        assertThat(actual)
                .withFailMessage("The API no longer matches %s.%n"
                        + "If the change is intended, regenerate the file and commit it in the same pull request:%n"
                        + "  %s%n"
                        + "Then review the diff of %s.%n%s",
                        CONTRACT, REGENERATE, CONTRACT, firstDifference(expected, actual))
                .isEqualTo(expected);
    }

    private static boolean writeRequested() {
        return Boolean.parseBoolean(System.getProperty("openapi.write"))
                || Boolean.parseBoolean(System.getenv("OPENAPI_WRITE"));
    }

    /** Sorted keys, two-space indent, one array element per line, LF line endings, trailing newline. */
    static String normalise(String json) {
        JsonNode sorted = sort(MAPPER.readTree(json));
        DefaultIndenter indenter = new DefaultIndenter("  ", "\n");
        DefaultPrettyPrinter printer = new DefaultPrettyPrinter(Separators.createDefaultInstance()
                .withObjectNameValueSpacing(Separators.Spacing.AFTER)
                .withObjectEmptySeparator("")
                .withArrayEmptySeparator(""))
                .withObjectIndenter(indenter)
                .withArrayIndenter(indenter);
        return MAPPER.writer().with(printer).writeValueAsString(sorted) + "\n";
    }

    private static JsonNode sort(JsonNode node) {
        if (node.isObject()) {
            List<String> names = new ArrayList<>(node.propertyNames());
            Collections.sort(names);
            ObjectNode result = JsonNodeFactory.instance.objectNode();
            for (String name : names) {
                result.set(name, sort(node.get(name)));
            }
            return result;
        }
        if (node.isArray()) {
            ArrayNode result = JsonNodeFactory.instance.arrayNode();
            node.forEach(element -> result.add(sort(element)));
            return result;
        }
        return node;
    }

    private static String firstDifference(String expected, String actual) {
        String[] want = expected.split("\n", -1);
        String[] got = actual.split("\n", -1);
        for (int i = 0; i < Math.max(want.length, got.length); i++) {
            String w = i < want.length ? want[i] : "<end of file>";
            String g = i < got.length ? got[i] : "<end of file>";
            if (!w.equals(g)) {
                String nl = System.lineSeparator();
                return "First difference at line " + (i + 1) + ":" + nl
                        + "  committed: " + w.strip() + nl
                        + "  live:      " + g.strip();
            }
        }
        return "";
    }

    /**
     * The repository root, found from the compiled test classes (backend/target/test-classes), so
     * it does not depend on the directory Maven was started from.
     */
    private static Path repositoryRoot() throws URISyntaxException {
        Path dir = Path.of(OpenApiContractTest.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        for (Path candidate = dir; candidate != null; candidate = candidate.getParent()) {
            if (Files.isRegularFile(candidate.resolve("backend/pom.xml"))) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not find the repository root (a directory with backend/pom.xml) above " + dir);
    }
}
