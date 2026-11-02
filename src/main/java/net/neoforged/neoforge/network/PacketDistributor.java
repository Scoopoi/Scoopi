package net.neoforged.neoforge.network;

import org.jspecify.annotations.Nullable;

import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;
import net.minecraft.world.phys.Vec3;

public final class PacketDistributor {
    private PacketDistributor() {
    }

    public static void sendToPlayer(ServerPlayer player, CustomPacketPayload payload, CustomPacketPayload... payloads) {
        ServerPlayNetworking.send(player, payload);
        for (var p : payloads) {
            ServerPlayNetworking.send(player, p);
        }
    }

    public static void sendToPlayersNear(ServerLevel level, @Nullable ServerPlayer excluded, double x, double y,
            double z, double radius, CustomPacketPayload payload, CustomPacketPayload... payloads) {
        for (var player : PlayerLookup.around(level, new Vec3(x, y, z), radius)) {
            if (player != excluded) {
                sendToPlayer(player, payload, payloads);
            }
        }
    }

    public static void sendToAllPlayers(net.minecraft.server.MinecraftServer server, CustomPacketPayload payload) {
        for (var player : PlayerLookup.all(server)) {
            ServerPlayNetworking.send(player, payload);
        }
    }
}
