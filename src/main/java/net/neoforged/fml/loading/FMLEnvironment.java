package net.neoforged.fml.loading;

import net.neoforged.api.distmarker.Dist;

public final class FMLEnvironment {
    private FMLEnvironment() {
    }

    public static boolean isProduction() {
        return FMLLoader.getCurrent().isProduction();
    }

    public static Dist getDist() {
        return FMLLoader.getCurrent().getDist();
    }
}
