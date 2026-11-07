package com.scoopi.stormbow.mixin;

import com.scoopi.stormbow.SmiteManager;
import com.scoopi.stormbow.Stormcaller;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.phys.EntityHitResult;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(AbstractArrow.class)
public abstract class AbstractArrowMixin {
    /** A Stormcaller arrow doesn't do normal damage: it starts the smite instead. */
    @Inject(method = "onHitEntity", at = @At("HEAD"), cancellable = true)
    private void stormcaller$smite(EntityHitResult hit, CallbackInfo ci) {
        AbstractArrow self = (AbstractArrow) (Object) this;
        if (!self.entityTags().contains(Stormcaller.ARROW_TAG)) return;
        if (!(self.level() instanceof ServerLevel level)) return;

        Entity target = hit.getEntity();
        if (!(target instanceof LivingEntity living) || target == self.getOwner()) return;

        if (SmiteManager.start(level, living, self.getOwner())) {
            self.discard();
            ci.cancel();
        }
    }
}
