package com.scoopi.creepertackle.client;

import com.scoopi.creepertackle.network.TacklePayload;
import it.unimi.dsi.fastutil.ints.Int2ObjectMap;
import it.unimi.dsi.fastutil.ints.Int2ObjectOpenHashMap;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.entity.Entity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import org.jetbrains.annotations.Nullable;

/**
 * Client-side state for the tackle animation.
 *
 * Timeline (default 60 ticks):
 *   0-10   knocked over, bouncing as it hits the ground
 *   10-46  lying flat on its back, wobbling, stars circling its head
 *   46-60  scrambles back up
 */
public final class TackleAnimations {
    public static final float FALL_END = 10f;
    public static final float RISE_TIME = 14f;

    public record Anim(long startTick, float dirX, float dirZ, int duration) {}

    private static final Int2ObjectMap<Anim> ACTIVE = new Int2ObjectOpenHashMap<>();

    private static long clientTicks;
    private static long shakeStart = Long.MIN_VALUE;

    private TackleAnimations() {}

    public static void start(MinecraftClient client, TacklePayload p) {
        ACTIVE.put(p.creeperId(), new Anim(clientTicks, p.dirX(), p.dirZ(), p.duration()));
        if (client.player != null && client.player.getId() == p.tacklerId()) {
            shakeStart = clientTicks;
        }
    }

    public static void tick(MinecraftClient client) {
        clientTicks++;
        ClientWorld world = client.world;
        if (world == null) {
            ACTIVE.clear();
            return;
        }
        if (client.isPaused()) return;

        var it = ACTIVE.int2ObjectEntrySet().iterator();
        while (it.hasNext()) {
            var entry = it.next();
            Anim anim = entry.getValue();
            long age = clientTicks - anim.startTick;
            Entity e = world.getEntityById(entry.getIntKey());
            if (age > anim.duration || e == null || !e.isAlive()) {
                it.remove();
                continue;
            }
            spawnParticles(world, e, anim, age);
        }
    }

    private static void spawnParticles(ClientWorld world, Entity e, Anim anim, long age) {
        float tilt = tiltDegrees(anim, age);
        double lying = Math.sin(Math.toRadians(tilt));
        double standing = Math.cos(Math.toRadians(tilt));
        // Where the head is right now (it swings down with the body).
        Vec3d head = e.getPos().add(anim.dirX * 1.45 * lying, 0.35 + 1.45 * standing, anim.dirZ * 1.45 * lying);

        // Snuffed fuse keeps smoking for a moment.
        if (age < 25 && age % 2 == 0) {
            world.addParticle(ParticleTypes.SMOKE, head.x, head.y + 0.2, head.z, 0, 0.04, 0);
        }

        // Dizzy stars orbiting the head while it's down.
        if (age >= FALL_END && age < anim.duration - RISE_TIME) {
            for (int i = 0; i < 3; i++) {
                double a = age * 0.35 + i * (Math.PI * 2 / 3);
                double x = head.x + Math.cos(a) * 0.45;
                double z = head.z + Math.sin(a) * 0.45;
                double y = head.y + 0.35 + Math.sin(a * 2) * 0.06;
                world.addParticle(i == 0 ? ParticleTypes.WAX_OFF : ParticleTypes.ELECTRIC_SPARK, x, y, z, 0, 0, 0);
            }
        }

        // Dust kicked up on impact and when it scrambles up.
        if (age == (long) FALL_END - 4 || age == anim.duration - 4) {
            for (int i = 0; i < 12; i++) {
                double a = i * (Math.PI * 2 / 12);
                world.addParticle(ParticleTypes.CLOUD,
                        e.getX() + anim.dirX * 0.8 + Math.cos(a) * 0.3, e.getY() + 0.1,
                        e.getZ() + anim.dirZ * 0.8 + Math.sin(a) * 0.3,
                        Math.cos(a) * 0.08, 0.02, Math.sin(a) * 0.08);
            }
        }
    }

    @Nullable
    public static Anim get(int entityId) {
        return ACTIVE.get(entityId);
    }

    public static float age(Anim anim, float tickDelta) {
        return (clientTicks - anim.startTick) + tickDelta;
    }

    /** How far over the creeper is, 0 = upright, 90 = flat on its back. */
    public static float tiltDegrees(Anim anim, float age) {
        float riseStart = anim.duration - RISE_TIME;
        if (age < FALL_END) {
            return 90f * easeOutBounce(age / FALL_END);
        } else if (age < riseStart) {
            // Little wobble while it lies there, dying down.
            float t = age - FALL_END;
            return 90f - Math.abs(MathHelper.sin(t * 0.6f)) * 6f * (float) Math.exp(-t * 0.08f);
        } else {
            float t = MathHelper.clamp((age - riseStart) / RISE_TIME, 0f, 1f);
            // Wiggle, then hop back up.
            float wiggle = t < 0.35f ? MathHelper.sin(t * 60f) * 6f : 0f;
            return 90f * (1f - easeInOutBack(t)) + wiggle;
        }
    }

    /** Extra squash right as it slams into the ground: 0..1. */
    public static float squash(float age) {
        float t = age - (FALL_END * 0.36f);
        if (t < 0 || t > 6) return 0;
        return MathHelper.sin(t / 6f * MathHelper.PI) * (1f - t / 6f);
    }

    /** Camera shake strength for the tackling player, 0..1. */
    public static float shake(float tickDelta) {
        float t = (clientTicks - shakeStart) + tickDelta;
        if (t < 0 || t > 12) return 0;
        return 1f - t / 12f;
    }

    public static float shakeTime(float tickDelta) {
        return (clientTicks - shakeStart) + tickDelta;
    }

    private static float easeOutBounce(float x) {
        x = MathHelper.clamp(x, 0f, 1f);
        final float n1 = 7.5625f, d1 = 2.75f;
        if (x < 1 / d1) return n1 * x * x;
        if (x < 2 / d1) return n1 * (x -= 1.5f / d1) * x + 0.75f;
        if (x < 2.5 / d1) return n1 * (x -= 2.25f / d1) * x + 0.9375f;
        return n1 * (x -= 2.625f / d1) * x + 0.984375f;
    }

    private static float easeInOutBack(float x) {
        final float c2 = 1.70158f * 1.525f;
        return x < 0.5f
                ? (float) (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
                : (float) (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
    }
}
