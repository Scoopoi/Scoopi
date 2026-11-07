package com.scoopi.creepertackle.client.mixin;

import com.scoopi.creepertackle.client.TackleAnimations;
import net.minecraft.client.render.GameRenderer;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.RotationAxis;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {
    /** Screen shake for the player who made the tackle. */
    @Inject(method = "tiltViewWhenHurt", at = @At("HEAD"))
    private void creepertackle$impactShake(MatrixStack matrices, float tickDelta, CallbackInfo ci) {
        float strength = TackleAnimations.shake(tickDelta);
        if (strength <= 0) return;
        float t = TackleAnimations.shakeTime(tickDelta);
        float amp = strength * strength * 4.0f;
        matrices.multiply(RotationAxis.POSITIVE_Z.rotationDegrees(MathHelper.sin(t * 3.1f) * amp));
        matrices.multiply(RotationAxis.POSITIVE_X.rotationDegrees(MathHelper.sin(t * 2.3f + 1f) * amp * 0.6f));
    }
}
