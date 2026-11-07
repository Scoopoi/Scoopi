package com.scoopi.creepertackle;

import com.scoopi.creepertackle.network.TacklePayload;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.entity.Entity;
import net.minecraft.entity.mob.CreeperEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.EntityHitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;
import org.jetbrains.annotations.Nullable;

import java.util.Map;
import java.util.UUID;
import java.util.WeakHashMap;

public final class TackleHandler {
    /** How long the creeper stays pinned on the ground (3 seconds). */
    public static final int STUN_TICKS = 60;
    private static final int COOLDOWN_TICKS = 20;

    private static final Map<UUID, Long> LAST_TACKLE = new WeakHashMap<>();

    private TackleHandler() {}

    public static ActionResult onUseEntity(PlayerEntity player, World world, Hand hand, Entity entity,
                                           @Nullable EntityHitResult hit) {
        if (!(entity instanceof CreeperEntity creeper) || hand != Hand.MAIN_HAND) return ActionResult.PASS;
        if (player.isSpectator() || !player.isSprinting() || !creeper.isAlive()) return ActionResult.PASS;

        TackleableCreeper tackleable = (TackleableCreeper) creeper;
        if (tackleable.creepertackle$getStunTicks() > 0) return ActionResult.PASS;

        // Client: just report success so the hand swings and the interaction is sent to the server.
        if (world.isClient) return ActionResult.SUCCESS;

        long now = world.getTime();
        Long last = LAST_TACKLE.get(player.getUuid());
        if (last != null && now - last < COOLDOWN_TICKS) return ActionResult.PASS;
        LAST_TACKLE.put(player.getUuid(), now);

        Vec3d dir = creeper.getPos().subtract(player.getPos()).multiply(1, 0, 1);
        dir = dir.lengthSquared() < 1.0E-4 ? player.getRotationVector().multiply(1, 0, 1) : dir;
        dir = dir.normalize();

        boolean wasDefused = tackleable.creepertackle$isDefused();
        tackleable.creepertackle$tackle(STUN_TICKS);

        // Physics: player dives forward, creeper gets bowled over.
        player.setVelocity(dir.x * 0.55, 0.22, dir.z * 0.55);
        player.velocityModified = true;
        creeper.setVelocity(dir.x * 0.85, 0.42, dir.z * 0.85);
        creeper.velocityModified = true;
        creeper.setTarget(null);

        ServerWorld serverWorld = (ServerWorld) world;
        double cx = creeper.getX(), cy = creeper.getY(), cz = creeper.getZ();

        // Impact effects.
        serverWorld.spawnParticles(ParticleTypes.POOF, cx, cy + 0.6, cz, 16, 0.35, 0.35, 0.35, 0.08);
        serverWorld.spawnParticles(ParticleTypes.CRIT, cx, cy + 1.0, cz, 24, 0.4, 0.4, 0.4, 0.4);
        serverWorld.spawnParticles(ParticleTypes.SWEEP_ATTACK, cx - dir.x * 0.4, cy + 0.9, cz - dir.z * 0.4, 1, 0, 0, 0, 0);
        // The fuse gets snuffed out.
        serverWorld.spawnParticles(ParticleTypes.LARGE_SMOKE, cx, cy + 1.6, cz, 8, 0.15, 0.1, 0.15, 0.03);

        world.playSound(null, cx, cy, cz, SoundEvents.ENTITY_PLAYER_ATTACK_KNOCKBACK, SoundCategory.PLAYERS, 1.0F, 0.8F);
        world.playSound(null, cx, cy, cz, SoundEvents.ENTITY_GENERIC_BIG_FALL, SoundCategory.HOSTILE, 1.0F, 0.9F);
        world.playSound(null, cx, cy, cz, SoundEvents.BLOCK_FIRE_EXTINGUISH, SoundCategory.HOSTILE, 0.8F, 1.4F);
        world.playSound(null, cx, cy, cz, SoundEvents.ENTITY_CREEPER_HURT, SoundCategory.HOSTILE, 1.0F, 1.3F);

        // First tackle yanks the gunpowder out.
        if (!wasDefused) {
            creeper.dropStack(new ItemStack(Items.GUNPOWDER), 1.0F);
        }

        TacklePayload payload = new TacklePayload(creeper.getId(), player.getId(), (float) dir.x, (float) dir.z, STUN_TICKS);
        for (ServerPlayerEntity viewer : PlayerLookup.tracking(creeper)) {
            ServerPlayNetworking.send(viewer, payload);
        }
        if (player instanceof ServerPlayerEntity sp && !PlayerLookup.tracking(creeper).contains(sp)) {
            ServerPlayNetworking.send(sp, payload);
        }

        return ActionResult.SUCCESS;
    }
}
