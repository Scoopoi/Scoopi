package com.scoopi.creepertackle.network;

import com.scoopi.creepertackle.CreeperTackle;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

/**
 * Sent to every client tracking a creeper when it gets tackled, so they can play the
 * knock-down animation. {@code dirX}/{@code dirZ} is the horizontal direction it falls in.
 */
public record TacklePayload(int creeperId, int tacklerId, float dirX, float dirZ, int duration)
        implements CustomPayload {

    public static final CustomPayload.Id<TacklePayload> ID =
            new CustomPayload.Id<>(Identifier.of(CreeperTackle.MOD_ID, "tackle"));

    public static final PacketCodec<RegistryByteBuf, TacklePayload> CODEC = PacketCodec.tuple(
            PacketCodecs.VAR_INT, TacklePayload::creeperId,
            PacketCodecs.VAR_INT, TacklePayload::tacklerId,
            PacketCodecs.FLOAT, TacklePayload::dirX,
            PacketCodecs.FLOAT, TacklePayload::dirZ,
            PacketCodecs.VAR_INT, TacklePayload::duration,
            TacklePayload::new);

    @Override
    public Id<? extends CustomPayload> getId() {
        return ID;
    }
}
