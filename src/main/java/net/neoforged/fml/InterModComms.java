package net.neoforged.fml;

import java.util.function.Supplier;

/** No-op on Fabric. */
public final class InterModComms {
    private InterModComms() {
    }

    public static boolean sendTo(String modId, String method, Supplier<?> thing) {
        return false;
    }
}
