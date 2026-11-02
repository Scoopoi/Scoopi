package net.neoforged.fml.loading;

import net.fabricmc.api.EnvType;
import net.fabricmc.loader.api.FabricLoader;
import net.neoforged.api.distmarker.Dist;

public final class FMLLoader {
    private static final FMLLoader INSTANCE = new FMLLoader();

    public static FMLLoader getCurrentOrNull() {
        return INSTANCE;
    }

    public static FMLLoader getCurrent() {
        return INSTANCE;
    }

    public Dist getDist() {
        return FabricLoader.getInstance().getEnvironmentType() == EnvType.CLIENT ? Dist.CLIENT
                : Dist.DEDICATED_SERVER;
    }

    public boolean isProduction() {
        return !FabricLoader.getInstance().isDevelopmentEnvironment();
    }
}
