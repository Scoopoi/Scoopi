package guideme.compiler;

import net.minecraft.resources.Identifier;

public final class IdUtils {
    private IdUtils() {
    }

    public static Identifier resolveId(String id, String defaultNamespace) {
        return id.contains(":") ? Identifier.parse(id) : Identifier.fromNamespaceAndPath(defaultNamespace, id);
    }
}
