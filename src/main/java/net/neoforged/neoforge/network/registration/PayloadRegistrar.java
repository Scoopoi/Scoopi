package net.neoforged.neoforge.network.registration;

import java.util.concurrent.CompletableFuture;

import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.world.entity.player.Player;
import net.neoforged.neoforge.network.handling.IPayloadContext;
import net.neoforged.neoforge.network.handling.IPayloadHandler;

/**
 * Registers payloads with the Fabric networking API. Clientbound handlers are registered on the client by
 * {@code RegisterClientPayloadHandlersEvent}.
 */
public class PayloadRegistrar {
    /** Large packets (ME inventory updates, GUI sync) are allowed up to this size, like NeoForge's packet splitting. */
    private static final int MAX_PACKET_SIZE = 16 * 1024 * 1024;

    public PayloadRegistrar(String version) {
    }

    public PayloadRegistrar versioned(String version) {
        return this;
    }

    public PayloadRegistrar optional() {
        return this;
    }

    public PayloadRegistrar executesOn(Object thread) {
        return this;
    }

    public <T extends CustomPacketPayload> PayloadRegistrar playToClient(CustomPacketPayload.Type<T> type,
            StreamCodec<? super RegistryFriendlyByteBuf, T> codec) {
        PayloadTypeRegistry.clientboundPlay().registerLarge(type, codec, MAX_PACKET_SIZE);
        return this;
    }

    public <T extends CustomPacketPayload> PayloadRegistrar playToClient(CustomPacketPayload.Type<T> type,
            StreamCodec<? super RegistryFriendlyByteBuf, T> codec, IPayloadHandler<T> handler) {
        return playToClient(type, codec);
    }

    public <T extends CustomPacketPayload> PayloadRegistrar playToServer(CustomPacketPayload.Type<T> type,
            StreamCodec<? super RegistryFriendlyByteBuf, T> codec, IPayloadHandler<T> handler) {
        PayloadTypeRegistry.serverboundPlay().registerLarge(type, codec, MAX_PACKET_SIZE);
        ServerPlayNetworking.registerGlobalReceiver(type, (payload, ctx) -> handler.handle(payload,
                new IPayloadContext() {
                    @Override
                    public Player player() {
                        return ctx.player();
                    }

                    @Override
                    public CompletableFuture<Void> enqueueWork(Runnable task) {
                        return ctx.server().submit(task);
                    }
                }));
        return this;
    }

    public <T extends CustomPacketPayload> PayloadRegistrar playBidirectional(CustomPacketPayload.Type<T> type,
            StreamCodec<? super RegistryFriendlyByteBuf, T> codec, IPayloadHandler<T> serverHandler) {
        playToClient(type, codec);
        return playToServer(type, codec, serverHandler);
    }
}
