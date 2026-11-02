package appeng.fabric.shim;

import java.util.Map;
import java.util.WeakHashMap;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.Level;
import net.neoforged.neoforge.capabilities.CapabilityListenerHolder;
import net.neoforged.neoforge.capabilities.ICapabilityInvalidationListener;

/**
 * Stores capability invalidation listeners per server level (NeoForge keeps them in a ServerLevel field).
 */
public final class CapabilityLevelHooks {
    private static final Map<ServerLevel, CapabilityListenerHolder> HOLDERS = new WeakHashMap<>();

    private CapabilityLevelHooks() {
    }

    private static synchronized CapabilityListenerHolder holder(ServerLevel level) {
        return HOLDERS.computeIfAbsent(level, l -> new CapabilityListenerHolder());
    }

    public static void registerListener(Level level, BlockPos pos, ICapabilityInvalidationListener listener) {
        if (level instanceof ServerLevel serverLevel) {
            holder(serverLevel).addListener(pos, listener);
        }
    }

    public static void invalidate(Level level, BlockPos pos) {
        if (level instanceof ServerLevel serverLevel) {
            CapabilityListenerHolder h;
            synchronized (CapabilityLevelHooks.class) {
                h = HOLDERS.get(serverLevel);
            }
            if (h != null) {
                h.invalidatePos(pos);
            }
        }
    }

    public static void invalidate(Level level, ChunkPos pos) {
        if (level instanceof ServerLevel serverLevel) {
            CapabilityListenerHolder h;
            synchronized (CapabilityLevelHooks.class) {
                h = HOLDERS.get(serverLevel);
            }
            if (h != null) {
                h.invalidateChunk(pos);
            }
        }
    }

    public static void clean(ServerLevel level) {
        CapabilityListenerHolder h;
        synchronized (CapabilityLevelHooks.class) {
            h = HOLDERS.get(level);
        }
        if (h != null) {
            h.clean();
        }
    }
}
