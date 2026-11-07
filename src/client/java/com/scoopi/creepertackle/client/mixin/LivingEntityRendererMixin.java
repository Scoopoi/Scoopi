package com.scoopi.creepertackle.client.mixin;

import com.scoopi.creepertackle.client.TackleAnimations;
import net.minecraft.client.render.entity.LivingEntityRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.mob.CreeperEntity;
import org.joml.Quaternionf;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(LivingEntityRenderer.class)
public abstract class LivingEntityRendererMixin {
    /**
     * Runs before the body-yaw rotation, while the matrix is still world-aligned at the
     * creeper's feet, so we can tip it over in the direction it was tackled.
     */
    @Inject(method = "setupTransforms", at = @At("HEAD"))
    private void creepertackle$knockOver(LivingEntity entity, MatrixStack matrices, float animationProgress,
                                         float bodyYaw, float tickDelta, float scale, CallbackInfo ci) {
        if (!(entity instanceof CreeperEntity)) return;
        TackleAnimations.Anim anim = TackleAnimations.get(entity.getId());
        if (anim == null) return;

        float age = TackleAnimations.age(anim, tickDelta);
        if (age > anim.duration()) return;

        float tilt = TackleAnimations.tiltDegrees(anim, age);
        float rad = (float) Math.toRadians(tilt);

        // Lift slightly so the body doesn't sink into the floor once it's horizontal.
        matrices.translate(0, 0.3f * Math.sin(rad), 0);

        // Rotating around (up x dir) tips the creeper's head toward the tackle direction.
        matrices.multiply(new Quaternionf().rotationAxis(rad, anim.dirZ(), 0f, -anim.dirX()));

        // Cartoon squash on impact.
        float s = TackleAnimations.squash(age);
        if (s > 0) {
            matrices.scale(1f + 0.25f * s, 1f - 0.2f * s, 1f + 0.25f * s);
        }
    }
}
