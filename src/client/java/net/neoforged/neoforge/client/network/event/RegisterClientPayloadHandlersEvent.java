package net.neoforged.neoforge.client.network.event;

import java.util.concurrent.CompletableFuture;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.world.entity.player.Player;
import net.neoforged.bus.api.Event;
import net.neoforged.fml.event.IModBusEvent;
import net.neoforged.neoforge.network.handling.IPayloadContext;
import net.neoforged.neoforge.network.handling.IPayloadHandler;

public class RegisterClientPayloadHandlersEvent extends Event implements IModBusEvent {
    public <T extends CustomPacketPayload> void register(CustomPacketPayload.Type<T> type, IPayloadHandler<T> handler) {
        // Fabric runs client play handlers on the client thread already
        ClientPlayNetworking.registerGlobalReceiver(type, (payload, ctx) -> handler.handle(payload,
                new IPayloadContext() {
                    @Override
                    public Player player() {
                        return ctx.player();
                    }

                    @Override
                    public CompletableFuture<Void> enqueueWork(Runnable task) {
                        return ctx.client().submit(task);
                    }
                }));
    }
}
