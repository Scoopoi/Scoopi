package guideme;

import org.jspecify.annotations.Nullable;

import net.minecraft.resources.Identifier;

/** Minimal stand-in for GuideME (not available on Fabric). */
public record PageAnchor(Identifier pageId, @Nullable String anchor) {
}
