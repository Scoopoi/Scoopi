package com.scoopi.stormbow;

import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.DustParticleOptions;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.core.Holder;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.LightningBolt;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.phys.Vec3;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Runs the smite sequence on every entity hit by a Stormcaller arrow.
 *
 * <pre>
 *  0      hit: chime, sparks, the target freezes and starts to glow
 *  1-34   ascension: rises ~4 blocks, spinning faster and faster inside a crackling
 *         helix while a storm cloud gathers overhead and thunder rumbles
 *  26-34  trembles violently as the charge builds
 *  35     STRIKE: lightning bolt + ring of bolts, flash, shockwave, death
 *  36-70  aftermath: smouldering corpse falls, soul spirals out of it, ash drifts down
 * </pre>
 */
public final class SmiteManager {
    private static final int RISE_TICKS = 34;
    private static final int TREMBLE_START = 26;
    private static final int STRIKE_TICK = 35;
    private static final int END_TICK = 70;
    private static final double RISE_HEIGHT = 4.0;

    private static final DustParticleOptions STORM_DUST = new DustParticleOptions(0x2A2F45, 3.0f);
    private static final DustParticleOptions CHARGE_DUST = new DustParticleOptions(0x7FD8FF, 1.2f);
    private static final DustParticleOptions SCORCH_DUST = new DustParticleOptions(0x1A1A1A, 1.6f);

    private static final Map<LivingEntity, Smite> ACTIVE = new IdentityHashMap<>();
    private static final Set<AbstractArrow> ARROWS = Collections.newSetFromMap(new IdentityHashMap<>());

    private SmiteManager() {}

    private static final class Smite {
        final ServerLevel level;
        final LivingEntity target;
        @Nullable final Entity attacker;
        final Vec3 origin;
        final boolean hadNoGravity;
        final boolean hadNoAi;
        int age;
        float spin;
        float spinSpeed = 6f;

        Smite(ServerLevel level, LivingEntity target, @Nullable Entity attacker) {
            this.level = level;
            this.target = target;
            this.attacker = attacker;
            this.origin = target.position();
            this.hadNoGravity = target.isNoGravity();
            this.hadNoAi = target instanceof Mob mob && mob.isNoAi();
            this.spin = target.getYRot();
        }
    }

    public static void trackArrow(AbstractArrow arrow) {
        ARROWS.add(arrow);
    }

    /** @return true if the smite started (the arrow should be consumed). */
    public static boolean start(ServerLevel level, LivingEntity target, @Nullable Entity attacker) {
        if (!target.isAlive() || ACTIVE.containsKey(target)) return false;

        Smite s = new Smite(level, target, attacker);
        ACTIVE.put(target, s);

        target.setNoGravity(true);
        target.setDeltaMovement(Vec3.ZERO);
        target.hurtMarked = true;
        target.setGlowingTag(true);
        if (target instanceof Mob mob) mob.setNoAi(true);

        Vec3 c = center(target);
        burst(level, ParticleTypes.ELECTRIC_SPARK, c, 40, 0.4, 0.6);
        burst(level, ParticleTypes.END_ROD, c, 12, 0.2, 0.15);
        sound(level, c, SoundEvents.BEACON_ACTIVATE, 1.5f, 1.8f);
        sound(level, c, SoundEvents.AMETHYST_BLOCK_CHIME, 2.0f, 0.6f);
        sound(level, c, SoundEvents.EVOKER_CAST_SPELL, 1.0f, 0.7f);
        return true;
    }

    public static void tick() {
        ARROWS.removeIf(SmiteManager::tickArrow);

        if (ACTIVE.isEmpty()) return;
        List<Smite> snapshot = new ArrayList<>(ACTIVE.values());
        for (Smite s : snapshot) {
            s.age++;
            boolean done;
            try {
                done = tickSmite(s);
            } catch (RuntimeException e) {
                Stormcaller.LOGGER.error("Smite failed", e);
                done = true;
            }
            if (done) {
                finish(s);
                ACTIVE.remove(s.target);
            }
        }
    }

    /** Crackling trail behind flying arrows. Returns true when the arrow should stop being tracked. */
    private static boolean tickArrow(AbstractArrow arrow) {
        if (arrow.isRemoved() || !(arrow.level() instanceof ServerLevel level)) return true;
        Vec3 v = arrow.getDeltaMovement();
        if (v.lengthSqr() < 0.01) return arrow.tickCount > 20; // stuck in a block
        Vec3 p = arrow.position();
        level.sendParticles(ParticleTypes.ELECTRIC_SPARK, p.x, p.y, p.z, 3, 0.05, 0.05, 0.05, 0.02);
        level.sendParticles(CHARGE_DUST, p.x - v.x * 0.5, p.y - v.y * 0.5, p.z - v.z * 0.5, 1, 0, 0, 0, 0);
        if (arrow.tickCount % 3 == 0) {
            level.sendParticles(ParticleTypes.END_ROD, p.x, p.y, p.z, 1, 0, 0, 0, 0);
        }
        return false;
    }

    private static boolean tickSmite(Smite s) {
        LivingEntity t = s.target;
        ServerLevel level = s.level;
        if (t.isRemoved() || t.level() != level) return true;

        if (s.age < STRIKE_TICK) {
            if (!t.isAlive()) return true;
            ascend(s);
        } else if (s.age == STRIKE_TICK) {
            strike(s);
        } else {
            aftermath(s);
        }
        return s.age >= END_TICK;
    }

    // ---------------------------------------------------------------- ascension

    private static void ascend(Smite s) {
        LivingEntity t = s.target;
        ServerLevel level = s.level;
        int age = s.age;
        float progress = Math.min(1f, age / (float) RISE_TICKS);

        // Smooth ease-out rise, with a tremble once the charge is nearly full.
        double eased = 1 - Math.pow(1 - progress, 3);
        double targetY = s.origin.y + RISE_HEIGHT * eased + Math.sin(age * 0.5) * 0.05;
        double jx = 0, jz = 0;
        if (age >= TREMBLE_START) {
            double amp = 0.04 + 0.03 * (age - TREMBLE_START);
            jx = (t.getRandom().nextDouble() - 0.5) * amp;
            jz = (t.getRandom().nextDouble() - 0.5) * amp;
        }
        Vec3 desired = new Vec3(s.origin.x + jx, targetY, s.origin.z + jz);
        if (t instanceof Player) {
            // Players are client-authoritative: steer them with velocity.
            t.setDeltaMovement(desired.subtract(t.position()));
            t.hurtMarked = true;
        } else {
            // Mobs have their AI frozen (which also freezes physics), so move them directly.
            t.setPos(desired);
            t.setDeltaMovement(Vec3.ZERO);
        }
        t.fallDistance = 0;

        // Spin, faster and faster.
        s.spinSpeed = Math.min(50f, s.spinSpeed * 1.09f);
        s.spin = Mth.wrapDegrees(s.spin + s.spinSpeed);
        t.setYRot(s.spin);
        t.setYBodyRot(s.spin);
        t.setYHeadRot(s.spin);

        Vec3 c = center(t);
        double h = t.getBbHeight();
        double r = Math.max(0.7, t.getBbWidth() * 0.9);

        // Double helix of energy wrapping the body.
        for (int strand = 0; strand < 2; strand++) {
            for (int i = 0; i < 3; i++) {
                double a = age * 0.55 + strand * Math.PI + i * 0.35;
                double y = t.getY() + ((age * 0.12 + i * 0.33) % 1.0) * h;
                level.sendParticles(strand == 0 ? ParticleTypes.END_ROD : ParticleTypes.ELECTRIC_SPARK,
                        t.getX() + Math.cos(a) * r, y, t.getZ() + Math.sin(a) * r, 1, 0, 0, 0, 0);
            }
        }
        // Enchant glyphs and charge dust being sucked in.
        level.sendParticles(ParticleTypes.ENCHANT, c.x, c.y, c.z, 6, r, h * 0.5, r, 0.8);
        level.sendParticles(CHARGE_DUST, c.x, c.y, c.z, 3, r * 0.6, h * 0.4, r * 0.6, 0);
        // Tractor beam column from the ground.
        for (double y = s.origin.y; y < t.getY(); y += 0.6) {
            if (t.getRandom().nextFloat() < 0.35f) {
                level.sendParticles(ParticleTypes.REVERSE_PORTAL, s.origin.x, y, s.origin.z, 1, 0.15, 0.1, 0.15, 0.01);
            }
        }
        // Magic circle on the ground.
        if (age % 2 == 0) {
            int points = 20;
            for (int i = 0; i < points; i++) {
                double a = i * (Math.PI * 2 / points) + age * 0.08;
                level.sendParticles(ParticleTypes.SOUL_FIRE_FLAME,
                        s.origin.x + Math.cos(a) * 1.8, s.origin.y + 0.05, s.origin.z + Math.sin(a) * 1.8,
                        1, 0, 0, 0, 0);
            }
        }
        // Storm cloud gathering overhead.
        double cloudY = s.origin.y + RISE_HEIGHT + h + 5;
        int cloudParts = 4 + (int) (progress * 10);
        level.sendParticles(STORM_DUST, s.origin.x, cloudY, s.origin.z, cloudParts, 1.6 * progress + 0.4, 0.3, 1.6 * progress + 0.4, 0);
        level.sendParticles(ParticleTypes.LARGE_SMOKE, s.origin.x, cloudY, s.origin.z, 2, 1.4 * progress, 0.2, 1.4 * progress, 0.005);
        if (age > 12 && age % 4 == 0) {
            // Sparks crawling inside the cloud.
            level.sendParticles(ParticleTypes.ELECTRIC_SPARK, s.origin.x, cloudY - 0.3, s.origin.z, 10, 1.5, 0.2, 1.5, 0.2);
        }

        // Sound design: rising charge with rumbles.
        if (age == 6) sound(level, c, SoundEvents.RESPAWN_ANCHOR_CHARGE, 1.0f, 0.8f);
        if (age == 14) sound(level, c, SoundEvents.RESPAWN_ANCHOR_CHARGE, 1.0f, 1.1f);
        if (age == 22) sound(level, c, SoundEvents.RESPAWN_ANCHOR_CHARGE, 1.0f, 1.5f);
        if (age == 10 || age == 24) sound(level, c, SoundEvents.LIGHTNING_BOLT_THUNDER, 0.8f, 0.5f);
        if (age == TREMBLE_START) sound(level, c, SoundEvents.BEACON_POWER_SELECT, 1.5f, 2.0f);
    }

    // ---------------------------------------------------------------- strike

    private static void strike(Smite s) {
        LivingEntity t = s.target;
        ServerLevel level = s.level;
        Vec3 c = center(t);

        // Main bolt straight through the target.
        bolt(level, t.position());
        // Crown of bolts slamming into the ground around it.
        for (int i = 0; i < 4; i++) {
            double a = i * Math.PI / 2 + t.getRandom().nextDouble() * 0.6;
            bolt(level, new Vec3(s.origin.x + Math.cos(a) * 3.5, s.origin.y, s.origin.z + Math.sin(a) * 3.5));
        }

        // Blinding flash + explosion of sparks.
        level.sendParticles(ColorParticleOption.create(ParticleTypes.FLASH, 0xFFFFFFFF), c.x, c.y, c.z, 3, 0.1, 0.1, 0.1, 0);
        level.sendParticles(ParticleTypes.EXPLOSION, c.x, c.y, c.z, 4, 0.5, 0.5, 0.5, 0);
        level.sendParticles(ParticleTypes.SONIC_BOOM, c.x, c.y, c.z, 1, 0, 0, 0, 0);
        sphere(level, ParticleTypes.ELECTRIC_SPARK, c, 80, 1.2);
        sphere(level, ParticleTypes.END_ROD, c, 40, 0.5);
        sphere(level, ParticleTypes.FIREWORK, c, 40, 0.35);
        level.sendParticles(ParticleTypes.LAVA, c.x, c.y, c.z, 12, 0.3, 0.3, 0.3, 0);

        // Shockwave ring rolling out over the ground.
        for (int i = 0; i < 48; i++) {
            double a = i * (Math.PI * 2 / 48);
            double dx = Math.cos(a), dz = Math.sin(a);
            level.sendParticles(ParticleTypes.CLOUD, s.origin.x + dx * 0.5, s.origin.y + 0.15, s.origin.z + dz * 0.5,
                    0, dx, 0.02, dz, 0.55);
            level.sendParticles(ParticleTypes.SOUL_FIRE_FLAME, s.origin.x + dx * 0.5, s.origin.y + 0.1, s.origin.z + dz * 0.5,
                    0, dx, 0.0, dz, 0.35);
        }
        level.sendParticles(SCORCH_DUST, s.origin.x, s.origin.y + 0.05, s.origin.z, 30, 1.2, 0.02, 1.2, 0);

        sound(level, c, SoundEvents.LIGHTNING_BOLT_THUNDER, 6.0f, 0.9f);
        sound(level, c, SoundEvents.LIGHTNING_BOLT_IMPACT, 2.0f, 0.8f);
        sound(level, c, SoundEvents.GENERIC_EXPLODE, 1.0f, 1.4f);
        sound(level, c, SoundEvents.TRIDENT_THUNDER, 2.0f, 1.0f);

        // Let it fall, on fire.
        t.setNoGravity(s.hadNoGravity);
        t.setGlowingTag(false);
        if (t instanceof Mob mob) mob.setNoAi(s.hadNoAi);
        t.igniteForSeconds(6);
        t.setDeltaMovement(0, -0.3, 0);
        t.hurtMarked = true;

        Entity attacker = s.attacker != null && s.attacker.isAlive() ? s.attacker : null;
        t.hurtServer(level, level.damageSources().lightningBolt(), Float.MAX_VALUE);
        if (t.isAlive() && attacker != null) {
            // Survived the bolt (totem, creative, ...): still hit it hard with magic.
            t.hurtServer(level, level.damageSources().indirectMagic(attacker, attacker), 1000f);
        }
    }

    private static void bolt(ServerLevel level, Vec3 pos) {
        LightningBolt bolt = EntityTypes.LIGHTNING_BOLT.create(level, EntitySpawnReason.TRIGGERED);
        if (bolt == null) return;
        bolt.snapTo(pos);
        bolt.setVisualOnly(true); // no fires, no collateral damage
        level.addFreshEntity(bolt);
    }

    // ---------------------------------------------------------------- aftermath

    private static void aftermath(Smite s) {
        LivingEntity t = s.target;
        ServerLevel level = s.level;
        int since = s.age - STRIKE_TICK;
        Vec3 c = center(t);
        double r = Math.max(0.4, t.getBbWidth() * 0.6);

        // Smouldering, charred body.
        level.sendParticles(ParticleTypes.LARGE_SMOKE, c.x, c.y, c.z, 2, r, 0.3, r, 0.02);
        level.sendParticles(SCORCH_DUST, c.x, c.y, c.z, 2, r, 0.4, r, 0);
        if (since < 15) {
            level.sendParticles(ParticleTypes.ELECTRIC_SPARK, c.x, c.y, c.z, 4, r, 0.4, r, 0.1);
        }

        // The soul spirals up out of the body.
        if (since >= 6 && since < 30) {
            double rise = (since - 6) * 0.22;
            for (int i = 0; i < 2; i++) {
                double a = since * 0.6 + i * Math.PI;
                double rad = 0.5 + rise * 0.08;
                level.sendParticles(ParticleTypes.SOUL,
                        t.getX() + Math.cos(a) * rad, c.y + rise, t.getZ() + Math.sin(a) * rad, 1, 0, 0.02, 0, 0.01);
                level.sendParticles(ParticleTypes.SOUL_FIRE_FLAME,
                        t.getX() + Math.cos(a) * rad, c.y + rise, t.getZ() + Math.sin(a) * rad, 1, 0, 0, 0, 0);
            }
        }
        if (since == 6) sound(level, c, SoundEvents.SOUL_ESCAPE, 2.0f, 0.7f);

        // Ash drifting down from the dissipating cloud.
        double cloudY = s.origin.y + RISE_HEIGHT + t.getBbHeight() + 5;
        if (since < 25) {
            level.sendParticles(STORM_DUST, s.origin.x, cloudY, s.origin.z, 4, 2.2, 0.3, 2.2, 0);
        }
        level.sendParticles(ParticleTypes.WHITE_ASH, s.origin.x, cloudY - 1, s.origin.z, 6, 2.5, 1.5, 2.5, 0);
        level.sendParticles(ParticleTypes.ASH, s.origin.x, s.origin.y + 2, s.origin.z, 4, 2.0, 1.5, 2.0, 0);

        // Final poof when the body disappears.
        if (since == 20 && !t.isAlive()) {
            burst(level, ParticleTypes.SOUL, c, 20, r, 0.08);
            burst(level, ParticleTypes.POOF, c, 20, r, 0.05);
            sound(level, c, SoundEvents.FIREWORK_ROCKET_TWINKLE, 1.0f, 0.8f);
        }
    }

    private static void finish(Smite s) {
        LivingEntity t = s.target;
        if (t.isRemoved()) return;
        t.setNoGravity(s.hadNoGravity);
        t.setGlowingTag(false);
        if (t instanceof Mob mob) mob.setNoAi(s.hadNoAi);
    }

    // ---------------------------------------------------------------- helpers

    private static Vec3 center(Entity e) {
        return e.position().add(0, e.getBbHeight() * 0.5, 0);
    }

    private static void burst(ServerLevel level, ParticleOptions p, Vec3 c, int count, double spread, double speed) {
        level.sendParticles(p, c.x, c.y, c.z, count, spread, spread, spread, speed);
    }

    /** Particles flying outward in every direction. */
    private static void sphere(ServerLevel level, ParticleOptions p, Vec3 c, int count, double speed) {
        double golden = Math.PI * (3 - Math.sqrt(5));
        for (int i = 0; i < count; i++) {
            double y = 1 - (i / (double) (count - 1)) * 2;
            double rad = Math.sqrt(1 - y * y);
            double a = golden * i;
            // count = 0 makes the offset act as a velocity vector.
            level.sendParticles(p, c.x, c.y, c.z, 0, Math.cos(a) * rad, y, Math.sin(a) * rad, speed);
        }
    }

    private static void sound(ServerLevel level, Vec3 at, SoundEvent sound, float volume, float pitch) {
        level.playSound(null, at.x, at.y, at.z, sound, SoundSource.PLAYERS, volume, pitch);
    }

    private static void sound(ServerLevel level, Vec3 at, Holder<SoundEvent> sound, float volume, float pitch) {
        level.playSound(null, at.x, at.y, at.z, sound, SoundSource.PLAYERS, volume, pitch);
    }
}
