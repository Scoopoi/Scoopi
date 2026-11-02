package net.neoforged.neoforge.client.network;

import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

public final class ClientPacketDistributor {
    private ClientPacketDistributor() {
    }

    public static void sendToServer(CustomPacketPayload payload, CustomPacketPayload... payloads) {
        ClientPlayNetworking.send(payload);
        for (var p : payloads) {
            ClientPlayNetworking.send(p);
        }
    }
}
