package net.neoforged.neoforge.server;

import org.jspecify.annotations.Nullable;

import net.minecraft.server.MinecraftServer;

public final class ServerLifecycleHooks {
    @Nullable
    private static MinecraftServer currentServer;

    private ServerLifecycleHooks() {
    }

    @Nullable
    public static MinecraftServer getCurrentServer() {
        return currentServer;
    }

    public static void setCurrentServer(@Nullable MinecraftServer server) {
        currentServer = server;
    }
}
