package net.neoforged.neoforge.network.handling;

import java.util.concurrent.CompletableFuture;

import net.minecraft.world.entity.player.Player;

public interface IPayloadContext {
    Player player();

    CompletableFuture<Void> enqueueWork(Runnable task);
}
