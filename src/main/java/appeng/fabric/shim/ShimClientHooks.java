package appeng.fabric.shim;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;

/** Indirection so common code can request client-only operations without loading client classes on servers. */
public final class ShimClientHooks {
    private ShimClientHooks() {
    }

    public static Runnable2 rerenderHandler = (level, pos) -> {
    };

    @FunctionalInterface
    public interface Runnable2 {
        void run(Level level, BlockPos pos);
    }

    public static void requestRerender(Level level, BlockPos pos) {
        rerenderHandler.run(level, pos);
    }

    public static java.util.function.BooleanSupplier shiftDown = () -> false;

    public static boolean hasShiftDown() {
        return shiftDown.getAsBoolean();
    }
}
